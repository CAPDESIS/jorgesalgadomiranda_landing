#!/usr/bin/env python3
"""Fail CI if Zyro CDN refs return, or if local asset paths are missing.

Scans deployable site sources only (HTML/CSS/JS/PHP/htaccess/SVG). Docs and
agent Markdown may still mention assets.zyrosite.com historically and are ignored.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    "coverage",
    "docs",
    "tests",
    "scripts",
    ".remember",
    ".github",
    ".agents",
    ".claude",
}

# Shippable / runtime text sources only.
SCAN_SUFFIXES = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".php",
    ".svg",
    ".xml",
    ".txt",
    ".json",
}

SCAN_NAMES = {
    ".htaccess",
}

ZYRO_RE = re.compile(r"assets\.zyrosite\.com", re.IGNORECASE)

# Local paths referenced from markup/CSS/JS (relative or root-absolute).
LOCAL_REF_RE = re.compile(
    r"""(?xi)
    (?:
      (?:src|href)\s*=\s*["']
      |
      url\(\s*["']?
    )
    (?P<path>
      (?:\.?\.?/)*
      (?:assets|fonts)/
      [^"'\)\s?#]+
    )
    """
)


def iter_scan_files() -> list[Path]:
    # Prune skipped directories during the walk instead of filtering after a
    # full rglob: node_modules/.git/coverage hold thousands of entries that
    # can never match, and stating every one of them 4 times (once per guard
    # test) trips the 5 s test timeout on the loaded deploy runner. The
    # visited set is identical to the old filter (a file is skipped iff any
    # of its parent dirs under ROOT is skipped), so the scanned count is
    # unchanged. Symlinked dirs are not descended, matching rglob defaults.
    files: list[Path] = []
    stack: list[Path] = [ROOT]
    while stack:
        current = stack.pop()
        try:
            entries = list(os.scandir(current))
        except OSError:
            continue
        for entry in entries:
            if entry.is_dir(follow_symlinks=False):
                if entry.name in SKIP_DIR_NAMES:
                    continue
                stack.append(Path(entry.path))
            elif entry.is_file():
                name = entry.name
                suffix = Path(name).suffix.lower()
                if name in SCAN_NAMES or suffix in SCAN_SUFFIXES:
                    files.append(Path(entry.path))
    return sorted(files)


def check_zyro(files: list[Path]) -> list[str]:
    hits: list[str] = []
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            hits.append(f"{path.relative_to(ROOT)}: unreadable ({exc})")
            continue
        if ZYRO_RE.search(text):
            hits.append(str(path.relative_to(ROOT)))
    return hits


def check_missing_local_assets(files: list[Path]) -> list[str]:
    missing: list[str] = []
    seen: set[str] = set()
    for path in files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for match in LOCAL_REF_RE.finditer(text):
            raw = match.group("path").strip()
            # Root-absolute refs (/assets/..., /fonts/...) are served from the
            # site root, so they resolve against ROOT and never against the
            # directory of the file that references them. Resolving them with
            # path.parent would escape the repo (filesystem "/assets/...") and
            # report every legal/ and 404 reference as missing.
            if raw.startswith("/"):
                candidate = (ROOT / raw.lstrip("/")).resolve()
            else:
                candidate = (path.parent / raw).resolve()
            try:
                rel = candidate.relative_to(ROOT)
            except ValueError:
                key = f"{path.relative_to(ROOT)} -> {raw}"
                if key not in seen:
                    seen.add(key)
                    missing.append(key)
                continue
            key = str(rel)
            if key in seen:
                continue
            seen.add(key)
            if not candidate.is_file():
                missing.append(f"{path.relative_to(ROOT)} -> {rel}")
    return missing


def main() -> int:
    files = iter_scan_files()
    zyro = check_zyro(files)
    missing = check_missing_local_assets(files)

    ok = True
    if zyro:
        ok = False
        print("::error::Forbidden Zyro CDN references found in shippable sources:")
        for hit in zyro:
            print(f"  - {hit}")
        print("Self-host images under assets/ and remove assets.zyrosite.com URLs.")

    if missing:
        ok = False
        print("::error::Referenced local assets are missing from the tree:")
        for hit in missing:
            print(f"  - {hit}")
        print("Add the file under assets/ or fonts/, or fix the reference.")

    if ok:
        print(
            f"Asset guard OK: scanned {len(files)} files, "
            "no Zyro CDN refs, all local asset refs present."
        )
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
