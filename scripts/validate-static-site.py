#!/usr/bin/env python3
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://jorgesalgadomiranda.com/"
REQUIRED_FILES = [
    "index.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    ".htaccess",
    "assets/styles.css",
    "assets/i18n.js",
    "legal/privacy.html",
    "legal/terms.html",
    "cv/Jorge_Salgado_Miranda_CV_EN.html",
    "cv/Jorge_Salgado_Miranda_CV_ES.html",
]


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: list[tuple[str, dict[str, str]]] = []
        self._in_title = False
        self.title_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name.lower(): value or "" for name, value in attrs}
        self.tags.append((tag.lower(), attr_map))
        if tag.lower() == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data.strip())

    @property
    def title(self) -> str:
        return " ".join(part for part in self.title_parts if part).strip()

    def first(self, tag: str, **attrs: str) -> dict[str, str] | None:
        for item_tag, item_attrs in self.tags:
            if item_tag != tag:
                continue
            if all(item_attrs.get(key) == value for key, value in attrs.items()):
                return item_attrs
        return None

    def all(self, tag: str, **attrs: str) -> list[dict[str, str]]:
        matches: list[dict[str, str]] = []
        for item_tag, item_attrs in self.tags:
            if item_tag != tag:
                continue
            if all(item_attrs.get(key) == value for key, value in attrs.items()):
                matches.append(item_attrs)
        return matches


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


def parse_html(relative_path: str) -> PageParser:
    path = ROOT / relative_path
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


for required in REQUIRED_FILES:
    if not (ROOT / required).is_file():
        fail(f"Missing required static artifact: {required}")

index = parse_html("index.html")
html = index.first("html")
if not html or html.get("lang") not in {"es", "es-MX"}:
    fail("index.html must declare a Spanish default html lang.")

if "Jorge Salgado Miranda" not in index.title:
    fail("index.html title must identify Jorge Salgado Miranda.")

description = index.first("meta", name="description")
if not description or len(description.get("content", "")) < 80:
    fail("index.html needs a substantive meta description.")

canonical = index.first("link", rel="canonical")
if not canonical or canonical.get("href") != DOMAIN:
    fail("index.html canonical URL must point to the production root.")

alternate_langs = {tag.get("hreflang") for tag in index.all("link", rel="alternate")}
if not {"es-MX", "en", "x-default"}.issubset(alternate_langs):
    fail("index.html must expose es-MX, en, and x-default hreflang links.")

og_image = index.first("meta", property="og:image")
if not og_image or not og_image.get("content", "").startswith(DOMAIN):
    fail("index.html must expose an absolute production og:image.")

robots_meta = index.first("meta", name="robots")
if not robots_meta or "index" not in robots_meta.get("content", ""):
    fail("index.html must explicitly allow indexing.")

access_key = index.first("input", name="access_key")
if not access_key or "YOUR_WEB3FORMS_ACCESS_KEY" not in access_key.get("value", ""):
    fail("index.html must keep the Web3Forms placeholder for deploy-time secret injection.")

for asset in ("assets/styles.css", "assets/i18n.js"):
    if asset not in (ROOT / "index.html").read_text(encoding="utf-8"):
        fail(f"index.html must reference {asset}.")

index_source = (ROOT / "index.html").read_text(encoding="utf-8")
if "new URLSearchParams(window.location.search).get('lang')" not in index_source:
    fail("index.html must honor ?lang=es/en so hreflang alternates are deterministic.")

i18n_source = (ROOT / "assets/i18n.js").read_text(encoding="utf-8")
if "window.__I18N__ = I18N" not in i18n_source:
    fail("assets/i18n.js must expose the frozen I18N dictionary.")
try:
    en_source, rest = i18n_source.split("  es: {", 1)
except ValueError:
    fail("assets/i18n.js must contain an ES dictionary.")
en_keys = set(re.findall(r'^    "([^"]+)":', en_source, flags=re.MULTILINE))
es_keys = set(re.findall(r'^    "([^"]+)":', rest, flags=re.MULTILINE))
if not en_keys or not es_keys:
    fail("assets/i18n.js must contain EN and ES i18n keys.")
if en_keys != es_keys:
    missing_es = sorted(en_keys - es_keys)
    missing_en = sorted(es_keys - en_keys)
    fail(
        "assets/i18n.js i18n parity failed; "
        f"missing ES keys={missing_es[:5]}, missing EN keys={missing_en[:5]}"
    )

robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
if f"Sitemap: {DOMAIN}sitemap.xml" not in robots:
    fail("robots.txt must point to the production sitemap.")

sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
if DOMAIN not in sitemap or not re.search(r"<loc>https://jorgesalgadomiranda\.com/[^<]*</loc>", sitemap):
    fail("sitemap.xml must list production URLs.")

for page in [
    "404.html",
    "legal/privacy.html",
    "legal/terms.html",
    "cv/Jorge_Salgado_Miranda_CV_EN.html",
    "cv/Jorge_Salgado_Miranda_CV_ES.html",
]:
    parsed = parse_html(page)
    if not parsed.first("html"):
        fail(f"{page} must contain an html root.")
    if not parsed.title:
        fail(f"{page} must contain a title.")

for cv_page in [
    "cv/Jorge_Salgado_Miranda_CV_EN.html",
    "cv/Jorge_Salgado_Miranda_CV_ES.html",
]:
    source = (ROOT / cv_page).read_text(encoding="utf-8")
    if re.search(r"<a\b[^>]*>\s*<button\b", source, flags=re.IGNORECASE):
        fail(f"{cv_page} must not nest a button inside a link.")
    parsed = parse_html(cv_page)
    alternates = {
        tag.get("hreflang"): tag.get("href")
        for tag in parsed.all("link", rel="alternate")
    }
    if alternates.get("es-MX") != f"{DOMAIN}cv/Jorge_Salgado_Miranda_CV_ES.html":
        fail(f"{cv_page} must link the es-MX CV alternate.")
    if alternates.get("en") != f"{DOMAIN}cv/Jorge_Salgado_Miranda_CV_EN.html":
        fail(f"{cv_page} must link the en CV alternate.")
    if alternates.get("x-default") != f"{DOMAIN}cv/Jorge_Salgado_Miranda_CV_EN.html":
        fail(f"{cv_page} must link the x-default CV alternate.")

print("Static site validation OK")
