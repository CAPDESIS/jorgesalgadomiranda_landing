# jorgesalgadomiranda.com

Personal portfolio of **Jorge Salgado Miranda**, Software Architect
specialized in mobile, web and security. Senior Engineer at PayPal /
Venmo, CEO of Capdesis, instructor to 54,000+ developers on Udemy.

Live at [**jorgesalgadomiranda.com**](https://jorgesalgadomiranda.com/).

> A zero-build, bilingual, dual-theme portfolio that doubles as a
> lead-gen surface for architecture, security, performance and cost
> audits.

---

## Why this repo is worth your time

Most portfolio templates stop at "hero + projects + contact form". This
one is a complete launch kit with things that are rarely considered on
other personal sites:

- **Zero build step, zero JS framework.** One `index.html` (~187 KB,
  2,983 lines) plus `assets/styles.css`, `assets/i18n.js`, small browser
  modules under `assets/js/` (some inline JS/CSS remains), and
  self-hosted woff2 fonts. No bundler, no framework, no Node server
  runtime. Ships as static files plus a lightweight PHP contact proxy
  over FTPS.
- **Bilingual with enforced parity.** ES + EN i18n dictionaries with
  343 keys each, a Python parity check, and a token system
  (`{{yearsSince:YYYY}}`) so tenure copy re-computes itself every new
  year.
- **Dual-theme OKLCH design system.** Theme + language toggles
  persisted in `localStorage`, respecting `prefers-color-scheme` and
  `prefers-reduced-motion`, with WCAG AA contrast verified by test.
- **ATS-compatible CVs in EN + ES.** Semantic HTML, labelled contact
  block, linearized skills, ATS-parseable dates, keyword-rich for
  Workday / Greenhouse / Lever / Taleo / iCIMS / SuccessFactors.
- **Automated PDF pipeline.** `scripts/build-cv-pdfs.sh` renders both
  CVs to ATS-readable PDF via headless Chromium, stamps metadata via
  exiftool when present.
- **Hardened Resend contact proxy.** Welcome modal with the "free 30-min
  review" offer, same-origin PHP proxy (`api/contact.php`) using
  Resend (only mail transport) with honeypot (`botcheck`), per-IP rate
  limiting (`api/lib/rate-limit.php`), RFC5322 regex + disposable-email
  blocklist (`api/lib/contact-validator.php` +
  `assets/js/email-validation.js`), optional Cloudflare Turnstile
  verification (`api/lib/turnstile.php`), Cal.com CTA, and Capdesis tier
  card for corporate invoicing.
- **Analytics built for privacy.** Umami (self-hosted), Cloudflare
  Web Analytics, and PostHog behind a per-provider consent banner
  (`assets/js/consent.js`, `assets/js/cookie-banner.js`); unconfigured
  providers stay silent until deploy injects real tokens.
- **SEO that actually shows up.** hreflang `es-MX`/`en`/`x-default`,
  canonical, `sitemap.xml`, `ProfessionalService` JSON-LD with a full
  `OfferCatalog`, `WebSite` schema, open `robots.txt` for the AI answer
  engines (GPT, Claude, Perplexity) that recommend experts today.
- **Security headers.** `.htaccess` with PHP advisory hardening, HSTS,
  CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, dotfile /
  `api/secrets.php` / `api/lib/` deny rules, gzip, immutable font
  cache, plus Cloudflare at the edge for DDoS + Bot Fight Mode.
- **Year-aware stats.** `data-years-since` spans and JS-bound spans so
  tenure counters, copyright and CV footers never go stale.
- **Controlled FTPS deploy to Hostinger.** GitHub Actions workflow on
  `ubuntu-latest` with automated CI/rollback gates (`scripts/deploy-gates.py`),
  FTP host sanitization, DNS preflight check, `scripts/stamp-assets.py`
  cache-busting, `version.json` parity marker, post-deploy asset smoke,
  manual exact-`main` promotion to production, and a manual `lftp`
  fallback (`scripts/deploy.sh` + `scripts/prune-excluded.py`) sharing
  the exact same exclude list.
- **Accessibility first.** Skip link, `:focus-visible` rings,
  `aria-pressed` toggles, motion / pointer-coarse gates for cursor and
  tilt effects, explicit `width`/`height` on every image.

---

## Live demo

Open [jorgesalgadomiranda.com](https://jorgesalgadomiranda.com/) and
try:

- Toggle ES `/` EN (top right).
- Toggle light `/` dark theme.
- Wait ~12 seconds: the 30-min-review modal appears. Dismiss persists
  for 7 days.
- Scroll to *Contact*: 4 audit chips, Cal.com CTA, Capdesis tier card,
  and the Resend contact form (same-origin PHP proxy at `/api/contact.php`).
- Scroll to *CV*: opens the EN or ES CV in a new tab.
- Open DevTools `>` Console: you'll see the author signature.

---

## Quick start (local preview & checks)

```bash
git clone https://github.com/CAPDESIS/jorgesalgadomiranda_landing.git
cd jorgesalgadomiranda_landing
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/
```

Tooling in CI is pinned to **Bun 1.3.14**, **Python 3**, and **PHP 8.4+**:

```bash
bun install --frozen-lockfile   # install test devDependency (@happy-dom/global-registrator)
bun run dev                     # local static preview (bunx serve . -l 3000)
bun run lint                    # static-site validator (canonical, hreflang, i18n parity, contact contract)
bun run build                   # same static validator (there is no bundler)
bun run check:assets            # verify local asset references exist on disk
bun run test:assets             # verify no Zyro hotlinks + run asset integrity tests
bun test --coverage             # full Bun suite (>= 85% line coverage gate in bunfig.toml)
bun run test:contact            # PHP contact API contract tests (mocked Resend via RESEND_API_BASE)
bun run deploy                  # manual FTP recovery upload via scripts/deploy.sh (requires .env + RELEASE_SHA)
```

---

## Forking this template

You are welcome to use this as a starting point for your own portfolio.
Here is what I ask:

### Required

1. **Keep the attribution intact.** There are multiple scattered
   attribution markers in the file (HTML comment, CSS custom property,
   `data-origin` attributes, `meta[name=template-origin]`, JSON-LD
   `@id`, console signature). Please keep at least one visible reference
   back to this repo.
2. **Add a visible credit line** somewhere on your site's footer or
   "colophon" / "about" page: *"Template originally by Jorge Salgado
   Miranda, jorgesalgadomiranda.com"* is fine. A link is appreciated.
3. **Do not republish my identity.** Replace every reference to Jorge
   Salgado Miranda, Capdesis, PayPal, Venmo, UNAM, the photo, the
   testimonials, and the CVs. Those are mine, not the template.
4. **Do not use my OG card (`og.png`)**. Render your own from `og.html`
   after updating it.

### Allowed

- Modify freely: structure, copy, colors, typography, whatever fits
  your voice.
- Ship commercially: if this helps you land a job or clients, good.
- Rename, refactor, reorganize files as you need.
- Contribute improvements back as a pull request.

### Not allowed

- Claiming authorship of the design, the copy system, or the code
  without attribution.
- Using my CVs or my professional summary as yours.
- Hotlinking my images or my analytics tokens.

### In short

**Fork it, make it yours, and mention me somewhere.** The goal of
publishing this repo is so you see how a personal site can be built
without a framework and learn from it, not to hand over an anonymous
template. Credit is how this stays sustainable.

---

## Repository layout

```text
jorgesalgadomiranda_landing/
├── index.html                           Landing page (2,983 lines; links assets/styles.css + assets/i18n.js)
├── 404.html                             Bilingual 404 surface using site OKLCH tokens
├── og.html, og.png                      Source + rendered Open Graph card
├── favicon.ico, favicon.svg, apple-touch-icon.png  Site icons
├── robots.txt                           Crawl policy (open to AI answer engines)
├── sitemap.xml                          hreflang es-MX / en + legal URLs
├── humans.txt                           Author and stack attribution
├── .htaccess                            PHP advisory guard, HSTS, CSP, gzip, redirects, cache
├── .env.example                         Local recovery FTP credentials template
├── api/
│   ├── contact.php                      Same-origin PHP contact proxy (Resend + Turnstile + rate limit)
│   ├── secrets.example.php              Deploy-injected api/secrets.php shape
│   └── lib/                             bootstrap-env, contact-validator, rate-limit, turnstile, resend-mail
├── legal/
│   ├── privacy.html                     Published bilingual privacy notice
│   ├── terms.html                       Published bilingual terms of service
│   └── cookies.html                     Published bilingual cookie notice
├── cv/
│   ├── Jorge_Salgado_Miranda_CV_EN.html ATS-compatible CV (EN)
│   └── Jorge_Salgado_Miranda_CV_ES.html ATS-compatible CV (ES)
├── assets/
│   ├── styles.css                       Main stylesheet (3,172 lines, OKLCH dark/light tokens)
│   ├── i18n.js                          ES/EN dictionaries (343 keys each)
│   ├── js/                              Browser modules (consent, cookie-banner, email-validation, i18n-utils, welcome-modal)
│   ├── brands/, icons/, images/, logos/ Self-hosted visual assets
│   └── cv/                              Rendered PDFs (built by scripts/build-cv-pdfs.sh)
├── fonts/                               Self-hosted woff2 (Instrument Serif, Geist, Geist Mono)
├── scripts/
│   ├── validate-static-site.py          Static HTML, SEO, i18n parity, and contact contract validator
│   ├── check-local-assets.py            Verifies local asset paths referenced in HTML
│   ├── check-asset-integrity.py         Blocks Zyro CDN regressions and missing assets
│   ├── stamp-assets.py                  Appends ?v=<SHA[:7]> to local css/js/mjs refs (both deploy paths)
│   ├── write-version-json.py            Writes version.json release SHA marker
│   ├── write-contact-secrets.py         Generates api/secrets.php from RESEND_* env vars at deploy
│   ├── deploy-gates.py                  CI green-run polling (ci-wait) and /version.json rollback check
│   ├── prune-excluded.py                Applies deploy.yml exclude list to staged trees for deploy.sh
│   ├── deploy.sh                        Manual FTP recovery deploy (lftp + .env)
│   ├── test-contact-api.php             PHP contact API contract tests (mocked Resend)
│   ├── php-advisory-htaccess-test.sh    Verifies .htaccess PHP CVE-2026-109618/109619 rules
│   ├── build-cv-pdfs.sh                 Headless Chromium PDF builder
│   └── build-og.sh                      Open Graph card renderer
├── tests/                               14 Bun test suites + setup + support helpers
├── .github/workflows/                   ci.yml, test.yml, gitleaks.yml, release-policy.yml, deploy.yml
├── AGENTS.md                            Agent instructions, commands, and zero em/en dash rule
├── MASTER_SPEC.md                       Verified capability spec and evidence summary
├── HANDOFF.md                           Historical session handoffs (2026-04 to 2026-07)
└── docs/                                Detailed documentation (indexed below)
```

### Documentation index

- [`AGENTS.md`](AGENTS.md): engineering conventions, zero em/en dash rule, PHP contact notes, and local commands
- [`MASTER_SPEC.md`](MASTER_SPEC.md): verified capability matrix, integration boundaries, and validation summary
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): page structure, design tokens, JS modules, and i18n
- [`docs/TECHNOLOGIES.md`](docs/TECHNOLOGIES.md): tech stack choices, workflows, and repo ruleset details
- [`docs/DEPLOY.md`](docs/DEPLOY.md): FTPS deploy flow, automated gates, exclusions, rollback, and DNS
- [`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md): dashboard-only setup checklist (Umami, Cloudflare, Search Console)
- [`docs/GITHUB_SECRETS.md`](docs/GITHUB_SECRETS.md): GitHub Actions secrets reference for `deploy.yml`
- [`docs/RESEND_SETUP.md`](docs/RESEND_SETUP.md): Resend contact-proxy secrets and Turnstile notes
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): visual vocabulary, OKLCH tokens, components, and breakpoints
- [`docs/CERTIFICATIONS.md`](docs/CERTIFICATIONS.md): certification catalog rationale
- [`docs/TICKETS.md`](docs/TICKETS.md): dated ticket/audit log
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md): historical changelog
- [`HANDOFF.md`](HANDOFF.md): historical session handoffs

---

## Design system

| Token        | Dark                         | Light                        |
|--------------|------------------------------|------------------------------|
| Background   | `oklch(0.14 0.008 240)`      | `oklch(0.985 0.003 80)`      |
| Foreground   | `oklch(0.97 0.005 240)`      | `oklch(0.18 0.01 250)`       |
| Accent       | `oklch(0.82 0.14 210)` cyan  | `oklch(0.49 0.15 210)` cyan  |
| Serif        | Instrument Serif             | Instrument Serif             |
| Sans         | Geist (300-700 variable)     | Geist                        |
| Mono         | Geist Mono (400-500)         | Geist Mono                   |

Theme is detected from system preference, togglable, persisted in
`localStorage`. Language is detected from `navigator.language` (or `?lang=es`/`en`),
togglable, persisted.

---

## Tech inventory

- **Structure**: `index.html`, `404.html`, `legal/*.html`, and two standalone CVs in `cv/`.
- **Fonts**: self-hosted woff2 under `fonts/`.
- **Animations**: CSS transitions + one `IntersectionObserver` for
  reveal / count-up / scramble. No animation libraries.
- **i18n**: two frozen dictionaries on `window.__I18N__` (343 keys each), swapped via
  `data-i18n` attribute walker.
- **Forms**: vanilla JS with client-side RFC5322 regex + disposable
  email blocklist, posting to same-origin `/api/contact.php` (PHP 8.4+ Resend proxy with honeypot, per-IP rate limiting, and optional Turnstile verification).
- **Analytics**: [Umami](https://umami.is/) (self-hosted),
  [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/), and [PostHog](https://posthog.com/), gated by `assets/js/consent.js` and `assets/js/cookie-banner.js`.
- **Bookings**: [Cal.com](https://cal.com/) external CTA.
- **SEO**: JSON-LD `Person` + `ProfessionalService` + `WebSite`,
  hreflang, canonical, OpenGraph + Twitter Card, `sitemap.xml`,
  `robots.txt`.
- **Security**: `.htaccess` headers + Cloudflare edge.
- **CI/CD**: GitHub Actions on `ubuntu-latest` (`ci.yml`, `test.yml`, `gitleaks.yml`, `release-policy.yml`, `deploy.yml` with `SamKirkland/FTP-Deploy-Action`).

Full reasoning for each choice is in
[`docs/TECHNOLOGIES.md`](docs/TECHNOLOGIES.md).

---

## Deploying your fork

1. Point `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` secrets at your own
   host in GitHub Actions settings.
2. Review `.github/workflows/deploy.yml`. If your host is not
   Hostinger, adjust `server-dir` (Hostinger FTP users are chrooted to
   `public_html/`, so `./` is correct there).
3. Trigger `workflow_dispatch` for `.github/workflows/deploy.yml` with the
   exact `main` SHA you want to promote and `confirm_no_p0_p1_alerts=yes`.
   Pushes and schedules validate only; the FTPS upload happens from the
   manual production workflow after automated CI/rollback gates and
   post-deploy asset smoke.
4. Fallback: `cp .env.example .env`, fill in credentials, then
   `RELEASE_SHA=<40-char-main-sha> bun run deploy`.

Full deploy doc: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Configuration placeholders

Analytics placeholders in `index.html` are replaced at deploy time from
GitHub Actions Secrets (do not commit real tokens):

| Placeholder / Setting                | Source                                |
|--------------------------------------|---------------------------------------|
| `YOUR_UMAMI_WEBSITE_ID`              | Umami dashboard > Websites > Add (`UMAMI_WEBSITE_ID`) |
| `YOUR_CF_BEACON_TOKEN`               | Cloudflare > Analytics > Web Analytics (`CF_BEACON_TOKEN`) |
| `YOUR_POSTHOG_KEY`                   | PostHog > Settings > Project API key (`PUBLIC_POSTHOG_KEY`) |
| `RESEND_API_KEY` (+ FROM/TO/REPLY_TO)| Resend dashboard > deploy injects `api/secrets.php` |
| `TURNSTILE_SECRET_KEY` (optional)    | Cloudflare Turnstile > `api/secrets.php` / env + `jsm-turnstile-site-key` |
| `jorge-salgado-miranda-lt3qxa/30min` | Your Cal.com event-type slug (replace with your own) |

Analytics loaders skip any provider whose token still holds a `YOUR_`
placeholder (`assets/js/consent.js` `isTokenConfigured`), so
unconfigured providers stay silent until deploy injects real tokens.
The contact form itself always submits to `/api/contact.php`. Details
in [`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md).

---

## Contributing improvements

This is a personal portfolio, not an open-source project I actively
maintain, but typo fixes, accessibility improvements, and CI / security
hardening PRs are welcome.

If you ship something significant from this template, I would love a
DM on [LinkedIn](https://linkedin.com/in/jorge-salgado-miranda-74023b181)
with the link.

---

## License

**Source code** (HTML structure, CSS, JavaScript, PHP proxy, CI workflows, deploy
scripts): [MIT License](https://opensource.org/licenses/MIT) with the
attribution requirements above.

**Content** (copy, photos, CVs, testimonials, case-study metrics, CV
PDFs, the `og.png` social card): **all rights reserved**. Replace
before publishing your fork.

---

## Author

**Jorge Salgado Miranda**, Software Architect
- Web: https://jorgesalgadomiranda.com
- LinkedIn: https://linkedin.com/in/jorge-salgado-miranda-74023b181
- GitHub: https://github.com/chochy2001
- Consultancy: https://capdesis.com
