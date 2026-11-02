#!/usr/bin/env python3
"""Prune a staged deploy tree down to the files deploy.yml uploads.

The official upload (.github/workflows/deploy.yml, SamKirkland/FTP-Deploy-Action)
leaves out whatever its `exclude:` block names. That block is the ONE list of
what stays off the server. scripts/deploy.sh, the recovery path, used to keep a
second hand-written list in lftp's own glob dialect and drifted from it: it
would have uploaded tests/, audits/, bunfig.toml and bun.lock. lftp and the
action also read globs differently, so the lists could not simply be shared.
This script closes the gap from the other side: it reads the workflow's block,
applies it with the action's rules to the staged tree, and deletes everything
the action would not upload. deploy.sh then mirrors what is left, with no
exclude list of its own.

The rules reproduced are the action's: each path is matched with multimatch
{dot: true, matchBase: true} (minimatch semantics).

  - a directory is tested with a trailing slash ("docs/"), a file without
  - patterns run in order for each path: a plain pattern excludes it, a "!"
    pattern puts back what an earlier pattern excluded (so a "!" placed before
    the pattern it undoes does nothing)
  - "**" crosses directories, "*" and "?" stay inside one name, and dot files
    are matched by both
  - a pattern with no slash is matched against the file name
  - matching is case sensitive

A path is kept only when it and every parent directory are kept (an excluded
directory is removed whole), and directories left empty are removed, because
the action creates directories only for files it uploads.

It fails closed. It exits 1, leaving the tree untouched, when the workflow
cannot be read, has no `exclude: |` block or more than one, has fewer patterns
than --min-patterns (a bad edit that truncated the list), or uses glob syntax
this script does not reproduce ({} [] () ! + @ \\ and "#" lines, which in a block
scalar are patterns and not comments). It also re-walks the tree after pruning
and fails if anything that should be gone is still there.

Usage:
  python3 scripts/prune-excluded.py --workflow .github/workflows/deploy.yml --root DIR

Stdlib only.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from pathlib import Path

GLOBSTAR = object()
SUPPORTED_SEGMENT = re.compile(r"^[A-Za-z0-9._\-@~=,%:*?]+$")


class PruneError(Exception):
    pass


def fail(message: str) -> int:
    print(f"prune-excluded: error: {message}", file=sys.stderr)
    return 1


def read_patterns(workflow: Path) -> list[str]:
    try:
        lines = workflow.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise PruneError(f"cannot read {workflow}: {error.strerror}") from error
    starts = [i for i, line in enumerate(lines) if line.strip() == "exclude: |"]
    if not starts:
        raise PruneError(f'no "exclude: |" block in {workflow}; refusing to upload with no exclude list.')
    if len(starts) > 1:
        raise PruneError(f'more than one "exclude: |" block in {workflow}; cannot tell which one the upload uses.')
    start = starts[0]
    key_indent = len(lines[start]) - len(lines[start].lstrip())
    patterns: list[str] = []
    for line in lines[start + 1 :]:
        if not line.strip():
            continue
        if len(line) - len(line.lstrip()) <= key_indent:
            break
        patterns.append(line.strip())
    return patterns


def compile_pattern(raw: str) -> tuple[bool, list[object]]:
    negated = raw.startswith("!")
    body = raw[1:] if negated else raw
    if not body or body.startswith("!"):
        raise PruneError(f"unsupported pattern {raw!r}: empty or double negation.")
    segments: list[object] = []
    for segment in re.split(r"/+", body):
        if segment == "**":
            if segments and segments[-1] is GLOBSTAR:
                continue
            segments.append(GLOBSTAR)
            continue
        if "**" in segment or not SUPPORTED_SEGMENT.match(segment):
            raise PruneError(
                f"unsupported glob syntax in {raw!r}: only literal names, * and ? inside a name, and ** as a whole "
                "directory level are reproduced. Extend scripts/prune-excluded.py and its tests before using more."
            )
        regex = "".join("[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c) for c in segment)
        segments.append(re.compile(regex))
    return negated, segments


def match_one(file: list[str], pattern: list[object]) -> bool:
    """Port of minimatch's matchOne for dot: true, non-partial."""
    fi = pi = 0
    fl, pl = len(file), len(pattern)
    while fi < fl and pi < pl:
        part = pattern[pi]
        if part is GLOBSTAR:
            pr = pi + 1
            if pr == pl:
                # A trailing ** swallows the rest, but never "." or "..".
                return all(segment not in (".", "..") for segment in file[fi:])
            fr = fi
            while fr < fl:
                if match_one(file[fr:], pattern[pr:]):
                    return True
                if file[fr] in (".", ".."):
                    break
                fr += 1
            return False
        if not part.fullmatch(file[fi]):  # type: ignore[union-attr]
            return False
        fi += 1
        pi += 1
    if fi == fl and pi == pl:
        return True
    if fi == fl:
        return False
    # Pattern used up: it still matches "dir/" because the last segment is empty.
    return fi == fl - 1 and file[fi] == ""


def matches(item: str, segments: list[object]) -> bool:
    parts = item.split("/")
    if len(segments) == 1 and segments[0] is not GLOBSTAR:
        # matchBase: a pattern with no slash is matched against the file name.
        name = next((p for p in reversed(parts) if p), "")
        return match_one([name], segments)
    return match_one(parts, segments)


def is_excluded(rules: list[tuple[bool, list[object]]], path: str, is_dir: bool) -> bool:
    item = path + "/" if is_dir else path
    excluded = False
    for negated, segments in rules:
        if matches(item, segments):
            excluded = not negated
    return excluded


def prune(root: Path, rules: list[tuple[bool, list[object]]]) -> list[str]:
    removed: list[str] = []

    def walk(directory: Path, prefix: str) -> bool:
        """Prunes below `directory`; returns True when it still holds something."""
        holds = False
        for entry in sorted(os.scandir(directory), key=lambda e: e.name):
            rel = prefix + entry.name
            is_dir = entry.is_dir(follow_symlinks=False)
            if is_excluded(rules, rel, is_dir):
                if is_dir:
                    shutil.rmtree(entry.path)
                else:
                    os.unlink(entry.path)
                removed.append(rel + "/" if is_dir else rel)
            elif is_dir:
                if walk(Path(entry.path), rel + "/"):
                    holds = True
                else:
                    os.rmdir(entry.path)
                    removed.append(rel + "/")
            else:
                holds = True
        return holds

    walk(root, "")
    return removed


def leftovers(root: Path, rules: list[tuple[bool, list[object]]]) -> list[str]:
    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        prefix = "" if rel_dir == "." else rel_dir.replace(os.sep, "/") + "/"
        for name in dirnames:
            if is_excluded(rules, prefix + name, True):
                found.append(prefix + name + "/")
        for name in filenames:
            if is_excluded(rules, prefix + name, False):
                found.append(prefix + name)
    return found


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--workflow", required=True, type=Path, help="workflow whose exclude: block is the list")
    parser.add_argument("--root", required=True, type=Path, help="staged tree to prune in place")
    parser.add_argument("--min-patterns", type=int, default=10, help="refuse a list shorter than this (default 10)")
    args = parser.parse_args(argv)

    if not args.root.is_dir():
        return fail(f"--root {args.root} is not a directory.")
    try:
        patterns = read_patterns(args.workflow)
        if not patterns:
            raise PruneError(f"the exclude: block in {args.workflow} has no patterns; refusing to upload with no exclude list.")
        if len(patterns) < args.min_patterns:
            raise PruneError(
                f"the exclude: block in {args.workflow} has {len(patterns)} pattern(s), below the minimum of "
                f"{args.min_patterns}; a bad edit may have truncated the list."
            )
        for pattern in patterns:
            if pattern.startswith("#"):
                raise PruneError(
                    f"unsupported line {pattern!r}: in a block scalar a line starting with # is a pattern, not a comment."
                )
        rules = [compile_pattern(pattern) for pattern in patterns]
    except PruneError as error:
        return fail(str(error))

    removed = prune(args.root, rules)
    remaining = leftovers(args.root, rules)
    if remaining:
        return fail("still present after pruning:\n  " + "\n  ".join(remaining))

    print(f"prune-excluded: applied {len(patterns)} pattern(s) from {args.workflow}; removed {len(removed)} path(s)")
    top = sorted(path for path in removed if not any(path.startswith(other) for other in removed if other.endswith("/") and other != path))
    for path in top:
        print(f"  {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
