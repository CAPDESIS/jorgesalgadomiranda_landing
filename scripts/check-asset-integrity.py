#!/usr/bin/env python3
"""Fail if HTML still hotlinks Zyrosite or references missing local assets.

Regression guard for the 2026-07-13 production incident where partners
marquee, skills tech-strip, and about portrait all broke after
assets.zyrosite.com started returning 404.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZYROSITE = "assets.zyrosite.com"
SRC_HREF = re.compile(r"""(?:src|href)=["'](assets/[^"'?#]+)""")


def main() -> int:
    errors: list[str] = []

    htaccess = ROOT / ".htaccess"
    if htaccess.exists() and ZYROSITE in htaccess.read_text(encoding="utf-8", errors="ignore"):
        errors.append(".htaccess still allowlists assets.zyrosite.com in CSP")

    html_files = [
        p
        for p in ROOT.rglob("*.html")
        if "node_modules" not in p.parts and ".git" not in p.parts
    ]
    for path in html_files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        if ZYROSITE in text:
            errors.append(f"{path.relative_to(ROOT)} still references {ZYROSITE}")

    index = ROOT / "index.html"
    text = index.read_text(encoding="utf-8", errors="ignore")
    refs = sorted(set(SRC_HREF.findall(text)))
    for rel in refs:
        if not (ROOT / rel).is_file():
            errors.append(f"index.html references missing file: {rel}")

    required = [
        "assets/images/foto_perfil.png",
        "assets/brands/paypal.svg",
        "assets/brands/capdesis.webp",
        "assets/brands/tienda-unam.svg",
        "assets/brands/flexera.svg",
        "assets/brands/udemy.svg",
        "assets/brands/ios-lab-unam.svg",
        "assets/logos/flutter.svg",
        "assets/logos/jetpack-compose.svg",
        "assets/logos/kubernetes.svg",
        "assets/logos/graphql.svg",
    ]
    for rel in required:
        if not (ROOT / rel).is_file():
            errors.append(f"required self-hosted asset missing: {rel}")

    if errors:
        for err in errors:
            print(f"::error::{err}", file=sys.stderr)
        print(f"asset integrity failed with {len(errors)} issue(s)", file=sys.stderr)
        return 1

    print(f"asset integrity OK ({len(refs)} local assets/ refs in index.html)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
