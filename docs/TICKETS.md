# Tickets

Living audit log for `jorgesalgadomiranda.com`. Captures everything
that has shipped recently, what is in progress, and what is waiting on
the user so nothing slips between sessions.

Last refreshed: 2026-07-13.

---

## Legend

| Tag | Meaning |
|---|---|
| SHIPPED | Merged to main, deployed to production, verified live. |
| IN PROGRESS | Code exists or partial rollout, not fully done. |
| BLOCKED | Cannot progress without the user (credentials, manual action, pending content). |
| BACKLOG | Idea worth doing eventually, not scheduled. |
| WONTDO | Evaluated, decided against, documented so it stops getting re-proposed. |

Priority column: P0 critical, P1 high, P2 medium, P3 nice-to-have.

---

## SHIPPED 2026-07-13

| ID | Priority | Title | Why it mattered |
|---|---|---|---|
| T-202 | P0 | Self-host Zyrosite-hotlinked images + deploy integrity guard | `assets.zyrosite.com` returned 404 for portrait, partners marquee, and skills tech-strip (user screenshots in `docs/evidence/image-audit-2026-07-13/`). Vendored under `assets/`, removed CDN from CSP, added `scripts/check-asset-integrity.py` + bun tests + deploy smoke probes. Also repaired broken `deploy.yml` YAML (Resend inject) and moved Hostinger FTP to `ubuntu-latest`. |

---

## SHIPPED 2026-04-21

| ID | Priority | Title | Why it mattered |
|---|---|---|---|
| T-001 | P0 | Fix mobile horizontal scroll by clipping html/body overflow-x | Tooltip on 108 px chip was pushing docScrollW to 410 px on a 390 px viewport, dragging the whole page left under the thumb. |
| T-002 | P0 | Hamburger drawer with focus trap, Escape close, auto-close on resize | Below 1060 px the full nav hid with no alternative. Site was unnavigable on mobile. |
| T-003 | P0 | Versioned asset URLs per deploy (workflow rewrites `assets/styles.css` to `...?v=SHA`) | Cloudflare had cached the pre-hamburger stylesheet for 7 days; new HTML met old CSS and the drawer links leaked unstyled into the top-left of the live page. |
| T-004 | P1 | Short-TTL HTML via .htaccess (`max-age=300, must-revalidate`) | HTML is the doc that carries the versioned asset URLs, so it must not be pinned by CDN edges for 24 h. |
| T-005 | P0 | CSP img-src allowlist devicon CDN, then swap to self-hosted | Strict CSP blocked 27 devicon logos with `violates the following Content Security Policy directive`. First loosened the allowlist, then self-hosted the SVGs under `assets/logos/` and re-tightened CSP. |
| T-006 | P1 | Self-host 22 devicon SVGs under `assets/logos/` | Removes a CDN dependency, removes a DNS lookup, shrinks CSP. Assets covered by the 6-month `mod_expires` rule. |
| T-007 | P2 | Remove draft legal pages from sitemap.xml | `/legal/privacy.html` and `/legal/terms.html` are still DRAFT. They should not be advertised to search engines until the user reviews the copy. |
| T-008 | P2 | Theme-color meta for dark and light | Mobile Chrome painting the address bar in the correct surface color, one less visual tell that this is a plain HTML site. |
| T-009 | P1 | Compress og.png 294 KB to 39 KB via pngquant | Social share previews now load instantly on slow networks. Dimensions preserved 1200x630. Quality band 75-92 kept visible fidelity. |
| T-010 | P1 | Rebuild `assets/cv/*.pdf` from the updated HTML CVs | The PDFs were drifting from HTML after the Venmo and Udemy content updates. Verified via `pdftotext`: VCC 2.0, GraphQL, Compose migration, Linux (Debian, Ubuntu, Kali), Udemy Senior Instructor all present. No em/en dashes. |
| T-011 | P2 | Typewriter animation on `.panel-body` with `contain: layout paint style` on the hero panel | Hero serif scramble was jittering the JSON panel sideways. Adding `contain` isolates the render tree; delaying the typewriter 2 s lets the scramble settle first. |
| T-012 | P3 | `exiftool` installed and CV PDFs now carry Author, Title, Subject, Keywords in the `/Info` dictionary | ATS parsers that read PDF metadata now see the right fields. Kept as a separate ticket because it depends on the local `brew install exiftool`, which the build script detects but cannot install itself. |
| T-013 | P3 | `humans.txt` at the site root | Classic attribution file with owner, stack, and thanks. Served 200 by Apache default, no htaccess rule needed. |
| T-014 | P1 | Replace outdated Udemy stats with real numbers scraped from the instructor profile and every course page | Landing was still showing 4 courses, 54,000+ students, 4.5 instructor rating, 3,462 reviews. Real numbers pulled via Playwright from the instructor page and all 6 course detail pages: 6 published courses, 54,200 students, 4.6 weighted instructor rating, 3,996 reviews. Per-course student counts fixed: Go was overstated at 35,200+ vs actual 4,261; C, Git, and the free intro were close to reality and were tightened to the exact figures. Catalog list reordered by review count (credibility proxy) and expanded to include VIM and the Photoshop CC intro which were previously omitted. CV (EN, ES) also updated. |
| T-015 | P0 | Cal.com CTA now points at the real profile slug `jorge-salgado-miranda-lt3qxa` | Previous URL `cal.com/jorgesalgadomiranda/30min` returned 404 because the username was never registered. Profile is now active and the `/30min` event type exists, so Book a call finally works for visitors. |
| T-016 | P1 | Certifications section rebuilt with real 44 credentials | Replaced the 2-item placeholder plus 5 fabricated In-progress percentages with a 3-column layout: 8 featured cards (Google, Meta, Coursera/UC Irvine), a dense grouped catalog with 33 more credentials (Mobile, Go, Platform, Security & Architecture, Foundation), and a 5-item roadmap (AWS SA Pro, AWS Security, CISSP, AWS DevOps, ISSAP). Removed the fake progress bars. CV cert list also expanded. i18n updated, 341 keys EN and ES in parity. |
| T-017 | P1 | Five real Udemy review quotes now render on the Udemy section | Added a `.udemy-reviews` grid under the course list with reviewer initials, name, course, 5-star mark, and the quote. One review per course (C, Git, Intro Prog, VIM, Photoshop). Kept original language per review (one is Portuguese from a Brazilian student). |
| T-018 | P2 | Per-course Udemy ratings use 2-decimal precision instead of rounded stars | C 4.66, Git 4.52, Go 4.52, Intro 4.63, Photoshop 4.52, VIM 4.21. The headline instructor stat stays at 4.6 since that is the weighted average across the full catalog. |
| T-019 | P3 | Legal pages published: DRAFT banner removed, sitemap re-adds them, footer links show Privacy and Terms | Both HTML pages also updated to last-updated 2026-04-22. Added a `.footer-link` style so the new links match the rest of the footer. i18n keys `footer.privacy` and `footer.terms` in EN and ES. |
| T-020 | P3 | humans.txt refreshed with the updated stack (CV already in metadata, social links, etc.) | Minor hygiene. Kept the format minimal. |
| T-021 | P1 | Cal.com event enriched and bio fixed via API, no repo change | Title was "30 min meeting" (generic) and description was empty; bio had a typo "Sofware Architecture". Via Cal.com API v2: `PATCH /v2/event-types/5459064` updated title to "Free 30-min Review: architecture, security, performance" and added a paragraph matching the free-review clause in `legal/terms.html` §3. `PATCH /v2/me` fixed the bio to "Software Architect. Mobile, web, security." Verified the public booker reflects both. The Cal.com URL in the landing did not change so no redeploy needed. |
| T-022 | P0 | Cal.com API key stored in `.env` (chmod 600, gitignored), not in any committed file | Cal.com personal API key saved as `CAL_API_KEY` in a local `.env` that is already covered by `.gitignore` and now has permissions `-rw-------`. `.env.example` gained a sibling placeholder `your-cal-com-api-key` so future forks know the key exists as a configuration point. `git grep -i "cal_live_"` returns 0 matches across the working tree; `git log -p -S "cal_live_"` returns 0 matches across history. |
| T-023 | P0 | Security sweep: repo secret leak check, live file exposure, CSP and header review, XSS vector audit | Scanned every tracked file for 11 secret patterns (Cal, AWS keys and secrets, GitHub PAT, Slack token, Stripe, Firebase, OpenAI, JWT, generic password assignments, RSA/EC/OpenSSH/PGP private keys, RFC1918 IPs): 0 hits. Fetched 15 sensitive URL paths on live (`/.env`, `/.git/config`, `/CLAUDE.md`, `/HANDOFF.md`, `/package.json`, `/scripts/deploy.sh`, etc.) and every one returns 403 or 404. Verified 6 security headers live: HSTS preload, strict CSP, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin, Permissions-Policy locked down. All 44 `target="_blank"` links carry `rel="noopener noreferrer"`. Inline JS contains zero `eval`, `new Function`, string-arg `setTimeout`, or cross-origin `postMessage` listeners; the only `innerHTML` assignment reads from the frozen `I18N` dictionary. Contact form has honeypot + Web3Forms access-key guard + placeholder skip. |

Verified live after Cloudflare purge:

- Drawer renders correctly.
- Stack logos visible in both the list and the tech-strip (27/27 loaded after scroll).
- OG card fetched fresh on Twitter and LinkedIn scrapers.
- CV PDFs are in sync with HTML content and carry embedded metadata.
- humans.txt responds 200.
- JSON-LD blocks parse cleanly (Person, ProfessionalService, WebSite).

---

## BLOCKED, need user action

| ID | Priority | Title | What you have to do |
|---|---|---|---|
| T-104 | P1 | Add a Cloudflare Cache Rule for `*.css?*` and `*.js?*` to restore edge caching | Right now CF returns `cf-cache-status: DYNAMIC` for versioned asset URLs because default CF rules bypass cache when a query string is present. In CF dashboard: Caching, Cache Rules, create a rule matching `(http.request.uri.path.extension in {"css" "js"})` with Eligible for cache, TTL 1 week. This shaves ~50 ms off cold CSS loads. Optional but easy. |
| T-108 | P3 | The LF card for Lo Más Fresh now shows the `LF` monogram because the capdesis CDN does not host `lomasfresh_logo.webp` | Once lomasfresh has a real logo you want on the card, either upload it to `capdesis.com/images/products/` or drop the SVG under `assets/logos/` and swap the `<img>` back in. |

---

## BACKLOG

| ID | Priority | Title | Notes |
|---|---|---|---|
| T-201 | P3 | Split design tokens into `assets/tokens.css` | `styles.css` is 2723 lines. Tokens live in `:root` and `[data-theme="light"]` blocks. Extracting would shrink the main stylesheet and let other pages (404, CVs, legal) import the same token file. |
| T-203 | P3 | Replace the timeline expand animation with a CSS `interpolate-size: allow-keywords` implementation once Safari stable ships it | Current `grid-template-rows: 0fr -> 1fr` trick is fine, but `interpolate-size` would let us animate to `auto` with no hack. |
| T-205 | P3 | Publish an atom feed if a writing section is ever added | Premature until content exists. |
| T-206 | P2 | Add a `downloads.json` or similar so the Cal.com CTA and CV download can be A/B tested | Only worth doing if we ever want to measure click-through. Today we have Umami and CF Web Analytics watching page views, but not per-CTA conversions. |

---

## WONTDO

| ID | Evaluated | Why we are not doing it |
|---|---|---|
| T-301 | Migrate to Astro | Current site is 37 KB total, FCP 640 ms, load 777 ms. Astro output for a single-page portfolio would be in the same ballpark. The cost is a Node build step, a rewrite of 2482 lines into components, and risk of breaking watermarks, animations, i18n timing, focus traps. Revisit only if we start publishing blog posts or multiple case studies. |
| T-302 | Self-host the Instrument Serif and Geist fonts from Google Fonts | Already self-hosted. |
| T-303 | Use a bundler | No runtime dependency, no bundler, no lockfile. Deploy is literally FTP upload of HTML + CSS + JS files. A bundler would add complexity without user-visible benefit. |

---

## How to add or update a ticket

1. Pick an unused ID in the right range (T-001 through T-099 shipped, T-101 through T-199 blocked, T-201 through T-299 backlog, T-301 through T-399 wontdo).
2. Fill in priority, title, context. For BLOCKED, write exactly what the user has to do, not a vague "ask user". For SHIPPED, write the pain you were relieving, not the fix itself (the commit message already explains the fix).
3. Keep the table compact. If a ticket needs more than a couple sentences, link to a doc under `docs/` or to a commit.
4. When a ticket ships, move it to SHIPPED with the same ID. When a ticket is abandoned, move to WONTDO with the rationale, not just a stub.
5. Update the "Last refreshed" line at the top.

---

## Related docs

- `docs/ARCHITECTURE.md` explains how the site is built.
- `docs/DESIGN_SYSTEM.md` explains the visual vocabulary.
- `docs/DEPLOY.md` explains the deploy flow and cache-bust mechanism.
- `docs/MANUAL_SETUP.md` is the user-only checklist for external service tokens.
- `CLAUDE.md` (gitignored) captures the hard rules for future-me.
