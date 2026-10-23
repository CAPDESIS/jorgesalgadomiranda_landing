#!/usr/bin/env python3
"""Automatic production gates for deploy.yml.

Replaces two hand-typed inputs that verified nothing (a person typed "yes"):

  ci              confirm_release_green. Reads the GitHub Actions runs listed
                  for the release SHA and requires a successful push run on
                  main for every required workflow.
  ci-wait         The same verdict, read from the API with a bounded re-read.
                  The runs listing lags (fragantia deploy runs 39805359214 and
                  39807905769, 2026-10-22, read "no run for this SHA" while
                  completed successes existed), so one read is not evidence
                  of absence. While a required workflow has no run, or its
                  run has no conclusion yet, it re-reads (--attempts reads,
                  --delay seconds apart). A red run is judged at once. At the
                  ceiling it fails closed with ::error::.
  rollback-point  confirm_backup_ready. This site holds no data; what a
                  deploy can destroy is the release currently served. The
                  gate reads the live /version.json and requires that its SHA
                  is a commit contained in origin/main, so the previous
                  release can be rebuilt and redeployed from git.

Both fail closed: unreadable input, missing runs or an unknown served SHA
exit 1 with an ::error:: line. No secret is read or printed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_WORKFLOWS = ("CI", "test", "gitleaks")


def fail(message: str) -> int:
    print(f"::error::{message}")
    return 1


def _candidates(runs: list, name: str, sha: str) -> list:
    return [
        run for run in runs
        if isinstance(run, dict)
        and run.get("name") == name
        and run.get("head_sha") == sha
        and run.get("event") == "push"
        and run.get("head_branch") == "main"
    ]


def judge_ci(runs: list, sha: str, required: tuple[str, ...]) -> tuple[list, list, list]:
    """Split required workflows into (green, waiting, red).

    green    a completed success push run on main for the SHA exists
    waiting  no such run yet, or one is still without conclusion
    red      only completed runs without success (failure, skipped, ...)
    """
    green, waiting, red = [], [], []
    for name in required:
        runs_for = _candidates(runs, name, sha)
        if any(r.get("status") == "completed" and r.get("conclusion") == "success" for r in runs_for):
            green.append(name)
        elif not runs_for or any(r.get("status") != "completed" or r.get("conclusion") is None for r in runs_for):
            waiting.append(name)
        else:
            red.append(name)
    return green, waiting, red


def _verdict(runs: list, sha: str, required: tuple[str, ...]) -> int:
    green, waiting, red = judge_ci(runs, sha, required)
    for name in green:
        print(f"ok: {name} push run on main succeeded for {sha}")
    missing = waiting + red
    if missing:
        return fail(
            "no successful push run on main for "
            + ", ".join(name for name in required if name in missing)
            + f" at {sha}; wait for CI or fix it before deploying."
        )
    return 0


def check_ci(runs_file: str, sha: str, required: tuple[str, ...]) -> int:
    if not SHA_RE.match(sha):
        return fail("release SHA must be 40 lowercase hex characters.")
    try:
        with open(runs_file, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError) as exc:
        return fail(f"GitHub Actions runs response is unreadable ({type(exc).__name__}); refusing to deploy unchecked.")
    runs = payload.get("workflow_runs") if isinstance(payload, dict) else None
    if not isinstance(runs, list):
        return fail("GitHub Actions runs response has no workflow_runs list; refusing to deploy unchecked.")
    return _verdict(runs, sha, required)


def api_get(api_url: str, path: str, token: str, tries: int = 3, pause: float = 5) -> list:
    """GET one runs listing; transport or format errors retried, then raised."""
    last = ""
    for attempt in range(1, tries + 1):
        request = urllib.request.Request(
            f"{api_url.rstrip('/')}{path}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            runs = payload.get("workflow_runs") if isinstance(payload, dict) else None
            if isinstance(runs, list):
                return runs
            last = "response has no workflow_runs list"
        except (urllib.error.URLError, OSError, ValueError) as exc:
            last = type(exc).__name__
        if attempt < tries:
            time.sleep(pause)
    raise RuntimeError(f"could not list Actions runs ({last})")


def wait_ci(repository: str, sha: str, required: tuple[str, ...], api_url: str, token: str,
            attempts: int, delay: float, transport_pause: float) -> int:
    if not SHA_RE.match(sha):
        return fail("release SHA must be 40 lowercase hex characters.")
    if not token:
        return fail("GITHUB_TOKEN is empty; refusing to deploy unchecked.")
    attempts = max(1, attempts)
    runs: list = []
    for attempt in range(1, attempts + 1):
        try:
            runs = api_get(api_url, f"/repos/{repository}/actions/runs?head_sha={sha}&event=push&per_page=100",
                           token, pause=transport_pause)
            _green, waiting, _red = judge_ci(runs, sha, required)
            if waiting:
                # The head_sha filter lags behind the plain listing; read the
                # newest main push runs too and filter them here.
                seen = {r.get("id") for r in runs if isinstance(r, dict)}
                extra = api_get(api_url, f"/repos/{repository}/actions/runs?branch=main&event=push&per_page=100",
                                token, pause=transport_pause)
                runs = runs + [r for r in extra if isinstance(r, dict) and r.get("id") not in seen]
        except RuntimeError as exc:
            return fail(f"{exc} for {sha}; refusing to deploy unchecked.")
        _green, waiting, red = judge_ci(runs, sha, required)
        if red or not waiting:
            return _verdict(runs, sha, required)
        if attempt < attempts:
            print(f"CI not settled for {', '.join(waiting)} at {sha}; re-read {attempt}/{attempts - 1} in {delay:g}s")
            time.sleep(delay)
    _green, waiting, _red = judge_ci(runs, sha, required)
    return fail(
        f"CI still has no concluded push run on main for {', '.join(waiting)} at {sha} after "
        f"{attempts} reads; refusing to deploy unchecked."
    )


def git_ok(*args: str) -> bool:
    return subprocess.run(["git", *args], capture_output=True).returncode == 0


def check_rollback_point(version_file: str, main_ref: str) -> int:
    try:
        with open(version_file, encoding="utf-8") as handle:
            served = json.load(handle)
    except (OSError, ValueError) as exc:
        return fail(f"live /version.json is unreadable ({type(exc).__name__}); the current release cannot be identified for rollback.")
    sha = served.get("sha") if isinstance(served, dict) else None
    if not isinstance(sha, str) or not SHA_RE.match(sha):
        return fail("live /version.json carries no 40-character sha; the current release cannot be identified for rollback.")
    if not git_ok("cat-file", "-e", f"{sha}^{{commit}}"):
        return fail(f"served release {sha} is not a commit in this repository; it cannot be rebuilt for rollback.")
    if not git_ok("merge-base", "--is-ancestor", sha, main_ref):
        return fail(f"served release {sha} is not contained in {main_ref}; it cannot be rebuilt for rollback.")
    print(f"ok: served release {sha} is in {main_ref} and can be redeployed for rollback")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    ci = sub.add_parser("ci")
    ci.add_argument("--runs-file", required=True)
    ci.add_argument("--sha", required=True)
    cw = sub.add_parser("ci-wait")
    cw.add_argument("--repository", required=True)
    cw.add_argument("--sha", required=True)
    cw.add_argument("--api-url", default=os.environ.get("GITHUB_API_URL", "https://api.github.com"))
    cw.add_argument("--attempts", type=int, default=10)
    cw.add_argument("--delay", type=float, default=30)
    cw.add_argument("--transport-pause", type=float, default=5)
    rb = sub.add_parser("rollback-point")
    rb.add_argument("--version-file", required=True)
    rb.add_argument("--main-ref", default="refs/remotes/origin/main")
    args = parser.parse_args(argv)
    if args.command == "ci":
        return check_ci(args.runs_file, args.sha, REQUIRED_WORKFLOWS)
    if args.command == "ci-wait":
        return wait_ci(args.repository, args.sha, REQUIRED_WORKFLOWS, args.api_url,
                       os.environ.get("GITHUB_TOKEN", ""), args.attempts, args.delay,
                       args.transport_pause)
    return check_rollback_point(args.version_file, args.main_ref)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
