#!/usr/bin/env python3
"""Stamp every local CSS and JS reference in the deployed HTML pages.

The site sits behind Cloudflare and the Hostinger origin ignores the query
string, so the first copy fetched for a URL stays cached for its TTL
(.htaccess: 7 days for text/css and application/javascript). A reference with
no token, or with a token that does not change when the bytes change, keeps old
bytes in caches while the HTML already points at the new layout.

This script is the ONE place that stamps. Both deploy paths call it:

  .github/workflows/deploy.yml   step "Cache-bust asset URLs"
  scripts/deploy.sh              recovery path (docs/DEPLOY.md)

Every href or src attribute of every deployed *.html page that points at a
local .css, .js or .mjs file gets ?v=<first 7 characters of the release SHA>.
Nothing is listed by hand, so a new page or a new script is covered the day it
is added. What does not change:

  - external and protocol-relative URLs (https://..., //cdn...), data: and
    javascript: URLs; absolute URLs to this site's own origin do count as local
  - references to anything that is not css or js (fonts, images, other pages)
  - text that is not a start tag: HTML comments and the inside of <script> and
    <style> are left byte for byte
  - pages the deploy does not upload (docs/, tests/, scripts/, audits/,
    node_modules/, coverage/, .github/ and other dot directories except
    .well-known/), the same set the upload excludes
  - line endings and every byte outside an attribute value

An existing v= parameter is replaced, so stamping twice never stacks tokens;
other query parameters and the fragment are kept.

It fails closed: a bad SHA, an unreadable page, a root that is not a directory,
a tree with no stampable reference at all, or any reference that still lacks
the token after the write (re-read from disk) exits 1, and no page is written
when any page cannot be processed.

Usage:
  python3 scripts/stamp-assets.py --root DIR --sha <40-hex release SHA>

Stdlib only: the deploy runs on a bare GitHub-hosted runner.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

# Mirrors the upload excludes in deploy.yml: pages there are never served.
SKIP_DIRS = frozenset(
    {".git", ".github", "node_modules", "coverage", "docs", "tests", "scripts", "audits"}
)
KEEP_DOT_DIRS = frozenset({".well-known"})

STAMPED_SUFFIXES = (".css", ".js", ".mjs")
OWN_ORIGINS = ("https://jorgesalgadomiranda.com/", "https://www.jorgesalgadomiranda.com/")
SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]*:")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")

# One href or src attribute inside a start tag: quoted either way, or bare.
# A bare value runs to the next space or ">" and may hold "=" (a stamped
# "a.js?v=0123456" is a bare value), the same rule html.parser applies.
# The lookbehind keeps data-src, xlink:href and similar names out.
ATTR_RE = re.compile(
    r"""(?P<name>(?<![\w:.\-])(?:href|src))(?P<eq>\s*=\s*)"""
    r"""(?:"(?P<dq>[^"]*)"|'(?P<sq>[^']*)'|(?P<bare>(?!["'])[^\s>]+))""",
    re.IGNORECASE,
)


class StampError(Exception):
    pass


def fail(message: str) -> int:
    print(f"stamp-assets: error: {message}", file=sys.stderr)
    return 1


def wants_token(url: str) -> bool:
    """True for a local reference to a css or js file."""
    if not url.startswith(OWN_ORIGINS):
        if url.startswith("//") or SCHEME_RE.match(url):
            return False
    path = url.split("#", 1)[0].split("?", 1)[0]
    return path.lower().endswith(STAMPED_SUFFIXES)


def split_params(query: str) -> list[str]:
    return [p for p in re.split(r"&(?:amp;)?", query) if p]


def is_version(param: str) -> bool:
    return param == "v" or param.startswith("v=")


def with_token(url: str, token: str) -> str:
    rest, hash_mark, fragment = url.partition("#")
    path, question, query = rest.partition("?")
    kept = [p for p in split_params(query) if not is_version(p)] if question else []
    return f"{path}?{'&'.join(kept + ['v=' + token])}{hash_mark}{fragment}"


def has_token(url: str, token: str) -> bool:
    query = url.split("#", 1)[0].partition("?")[2]
    return f"v={token}" in split_params(query)


class StartTags(HTMLParser):
    """Collects every start tag with its raw text and its offset in the page.

    html.parser hands <script> and <style> bodies over as data and comments as
    comments, so only real tags show up here.
    """

    def __init__(self, text: str) -> None:
        super().__init__(convert_charrefs=True)
        self.starts = [0]
        for index, char in enumerate(text):
            if char == "\n":
                self.starts.append(index + 1)
        self.text = text
        self.tags: list[tuple[int, str, list[tuple[str, str | None]]]] = []
        self.feed(text)
        self.close()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        raw = self.get_starttag_text() or ""
        line, column = self.getpos()
        offset = self.starts[line - 1] + column
        if self.text[offset : offset + len(raw)] != raw:
            raise StampError(f"line {line}: could not locate the <{tag}> tag in the source")
        self.tags.append((offset, raw, attrs))


def stamp_text(text: str, token: str) -> tuple[str, int]:
    edits: list[tuple[int, int, str]] = []
    count = 0
    for offset, raw, _attrs in StartTags(text).tags:
        stamped = 0

        def rewrite(match: re.Match[str]) -> str:
            nonlocal stamped
            for group, quote in (("dq", '"'), ("sq", "'"), ("bare", "")):
                value = match.group(group)
                if value is not None:
                    break
            else:
                return match.group(0)
            if not wants_token(value):
                return match.group(0)
            stamped += 1
            return f"{match.group('name')}{match.group('eq')}{quote}{with_token(value, token)}{quote}"

        new_raw = ATTR_RE.sub(rewrite, raw)
        if stamped:
            edits.append((offset, len(raw), new_raw))
            count += stamped
    for offset, length, new_raw in sorted(edits, reverse=True):
        text = text[:offset] + new_raw + text[offset + length :]
    return text, count


def unstamped_references(text: str, token: str) -> list[str]:
    """Local css/js references the parser sees that do not carry the token."""
    problems: list[str] = []
    parser = StartTags(text)
    for offset, _raw, attrs in parser.tags:
        for name, value in attrs:
            if name.lower() in ("href", "src") and value and wants_token(value):
                if not has_token(value, token):
                    line = text.count("\n", 0, offset) + 1
                    problems.append(f"line {line}: {name}={value!r}")
    return problems


def deployed_pages(root: Path) -> list[Path]:
    pages: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(
            d
            for d in dirnames
            if d not in SKIP_DIRS and (not d.startswith(".") or d in KEEP_DOT_DIRS)
        )
        for name in sorted(filenames):
            if name.lower().endswith(".html"):
                pages.append(Path(dirpath) / name)
    return pages


def read_page(path: Path, root: Path) -> str:
    try:
        return path.read_bytes().decode("utf-8")
    except UnicodeDecodeError as error:
        raise StampError(f"{path.relative_to(root)}: not valid UTF-8 ({error.reason})") from error


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--root", required=True, type=Path, help="tree that holds the pages to stamp")
    parser.add_argument("--sha", required=True, help="release SHA, 40 lowercase hex characters")
    args = parser.parse_args(argv)

    sha = args.sha.strip().lower()
    if not SHA_RE.match(sha):
        return fail("--sha must be the exact 40-character commit SHA of the release.")
    token = sha[:7]
    root: Path = args.root
    if not root.is_dir():
        return fail(f"--root {root} is not a directory.")

    planned: list[tuple[Path, str, int]] = []
    try:
        for page in deployed_pages(root):
            text = read_page(page, root)
            stamped, count = stamp_text(text, token)
            if count:
                planned.append((page, stamped, count))
    except StampError as error:
        return fail(str(error))

    total = sum(count for _page, _text, count in planned)
    if total == 0:
        return fail(f"no local css or js reference found under {root}; refusing to report a stamp that stamped nothing.")

    for page, stamped, _count in planned:
        page.write_bytes(stamped.encode("utf-8"))

    # Verify what is on disk now, not what was meant to be written.
    problems: list[str] = []
    try:
        for page in deployed_pages(root):
            for problem in unstamped_references(read_page(page, root), token):
                problems.append(f"{page.relative_to(root)}: {problem}")
    except StampError as error:
        return fail(str(error))
    if problems:
        return fail("references still without ?v=" + token + " after the stamp:\n  " + "\n  ".join(problems))

    print(f"stamp-assets: v={token} stamped {total} reference(s) in {len(planned)} page(s) under {root}")
    for page, _stamped, count in planned:
        print(f"  {page.relative_to(root)}: {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
