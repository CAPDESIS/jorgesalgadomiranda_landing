#!/usr/bin/env python3
"""Automatic production gates for deploy.yml.

Replaces two hand-typed inputs that verified nothing (a person typed "yes"):

  ci              confirm_release_green. Reads the GitHub Actions runs listed
                  for the release SHA and requires a successful push run on
                  main for every required workflow.
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
import re
import subprocess
import sys

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_WORKFLOWS = ("CI", "test", "gitleaks")


def fail(message: str) -> int:
    print(f"::error::{message}")
    return 1


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
    missing = []
    for name in required:
        ok = any(
            isinstance(run, dict)
            and run.get("name") == name
            and run.get("head_sha") == sha
            and run.get("event") == "push"
            and run.get("head_branch") == "main"
            and run.get("status") == "completed"
            and run.get("conclusion") == "success"
            for run in runs
        )
        if ok:
            print(f"ok: {name} push run on main succeeded for {sha}")
        else:
            missing.append(name)
    if missing:
        return fail(
            "no successful push run on main for "
            + ", ".join(missing)
            + f" at {sha}; wait for CI or fix it before deploying."
        )
    return 0


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
    rb = sub.add_parser("rollback-point")
    rb.add_argument("--version-file", required=True)
    rb.add_argument("--main-ref", default="refs/remotes/origin/main")
    args = parser.parse_args(argv)
    if args.command == "ci":
        return check_ci(args.runs_file, args.sha, REQUIRED_WORKFLOWS)
    return check_rollback_point(args.version_file, args.main_ref)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
