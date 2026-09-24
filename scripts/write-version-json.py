#!/usr/bin/env python3
"""Write the deploy parity marker version.json.

The file proves which commit the public origin serves:
{"sha": "<full 40-char commit>", "built_at": "<UTC ISO-8601>"}.

Generated at deploy time from the release SHA, never committed by hand
(version.json is gitignored). Both deploy paths use this script: the
GitHub workflow and scripts/deploy.sh.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write version.json parity marker.")
    parser.add_argument("--sha", required=True, help="Full 40-char lowercase commit SHA.")
    parser.add_argument("--out", required=True, help="Output path for version.json.")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    sha = args.sha.strip().lower()
    if not SHA_RE.match(sha):
        print(f"::error::--sha must be a 40-char hex commit SHA, got {args.sha!r}.", file=sys.stderr)
        return 1
    out = Path(args.out)
    payload = {"sha": sha, "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    out.write_text(json.dumps(payload) + "\n", encoding="utf-8")
    print(f"wrote {out}: sha={sha}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
