# jorgesalgadomiranda.com

Personal portfolio of **Jorge Salgado Miranda**, Software Architect
specialized in mobile, web and security. Senior Engineer at PayPal /
Venmo, CEO of Capdesis, instructor to 54,000+ developers on Udemy.

Live at [**jorgesalgadomiranda.com**](https://jorgesalgadomiranda.com/).

> A single-file, zero-build, bilingual, dual-theme portfolio that
> doubles as a lead-gen surface for architecture, security,
> performance and cost audits.

---

## Why this repo is worth your time

Most portfolio templates stop at "hero + projects + contact form". This
one is a complete launch kit with things that are rarely considered on
other personal sites:

- **Zero build step, zero runtime.** One `index.html` (~180 KB),
  inline CSS + inline JS, self-hosted woff2 fonts. No bundler, no
  framework, no Node runtime. Ships as a static file over FTP.
- **Bilingual with enforced parity.** ES + EN i18n dictionaries with
  258 keys each, a Python parity check, and a token system
  (`{{yearsSince:YYYY}}`) so tenure copy re-computes itself every new
  year.
- **Dual-theme OKLCH design system.** Theme + language toggles
  persisted in `localStorage`, respecting `prefers-color-scheme` and
  `prefers-reduced-motion`.
- **ATS-compatible CVs in EN + ES.** Semantic HTML, labelled contact
  block, linearized skills, ATS-parseable dates, keyword-rich for
  Workday / Greenhouse / Lever / Taleo / iCIMS / SuccessFactors.
- **Automated PDF pipeline.** `scripts/build-cv-pdfs.sh` renders both
  CVs to ATS-readable PDF via headless Chromium, stamps metadata via
  exiftool when present.
- **Lead gen baked in.** Welcome modal with the "free 30-min review"
  offer, Resend contact form (same-origin PHP proxy) with honeypot + RFC5322 regex +
  ~70-entry disposable-email blocklist, Cal.com CTA, Capdesis tier
  card for corporate invoicing.
- **Analytics built for privacy.** Umami (self-hosted) plus Cloudflare
  Web Analytics, no cookies, no consent banner needed.
- **SEO that actually shows up.** hreflang `es-MX`/`en`/`x-default`,
  canonical, `sitemap.xml`, `ProfessionalService` JSON-LD with a full
  `OfferCatalog`, `WebSite` schema, open `robots.txt` for the AI answer
  engines (GPT, Claude, Perplexity) that recommend experts today.
- **Security headers.** `.htaccess` with HSTS, CSP, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, gzip, immutable font cache,
  plus Cloudflare at the edge for DDoS + bot fight mode.
- **Year-aware stats.** `data-years-since` spans and JS-bound spans so
  tenure counters, copyright and CV footers never go stale.
- **CI deploy to Hostinger.** GitHub Actions workflow with FTP host
  sanitization, DNS preflight check, cache-busting, post-deploy asset smoke,
  `main`/daily production deploy triggers, and a manual `lftp` fallback for
  when Actions is unavailable.
- **Accessibility first.** Skip link, `:focus-visible` rings,
  `aria-pressed` toggles, motion / pointer-coarse gates for cursor and
  tilt effects, explicit `width`/`height` on every image.

---

## Live demo

Open [jorgesalgadomiranda.com](https://jorgesalgadomiranda.com/) and
try:

- Toggle ES `/` EN (top right).
- Toggle light `/` dark theme.
- Wait ~12 seconds, the 30-min-review modal appears. Dismiss persists
  for 7 days.
- Scroll to *Contact*: 4 audit chips, Cal.com CTA, Capdesis tier card,
  and the Resend contact form (same-origin PHP proxy).
- Scroll to *CV*: opens the EN or ES CV in a new tab.
- Open DevTools `>` Console: you'll see the author signature.

---

## Quick start (local preview)

```bash
git clone https://github.com/chochy2001/jorgesalgadomiranda_landing.git
cd jorgesalgadomiranda_landing
python3 -m http.server 8765 --bind 127.0.0.1
open http://127.0.0.1:8765/
```

No dependencies, no `npm install`. If you prefer bun:

```bash
bun run dev      # same as above, wraps python3's http.server
bun run deploy   # manual FTP upload via scripts/deploy.sh (needs .env)
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

```
jorgesalgadomiranda_landing/
├── index.html                           Self-contained landing (inline CSS + JS + i18n)
├── og.html, og.png                      Source + rendered Open Graph card
├── robots.txt                           Crawl policy (open to AI answer engines)
├── sitemap.xml                          hreflang es-MX / en
├── .htaccess                            HSTS, CSP, gzip, redirects, cache
├── .env.example                         FTP credentials template
├── cv/
│   ├── Jorge_Salgado_Miranda_CV_EN.html ATS-compatible CV (EN)
│   └── Jorge_Salgado_Miranda_CV_ES.html ATS-compatible CV (ES)
├── assets/
│   └── cv/                              Rendered PDFs (built by scripts/build-cv-pdfs.sh)
├── fonts/                               Self-hosted woff2 (Instrument Serif, Geist, Geist Mono)
├── scripts/
│   ├── deploy.sh                        Manual FTP deploy (lftp + .env)
│   └── build-cv-pdfs.sh                 Headless Chromium PDF builder
├── docs/
│   ├── ARCHITECTURE.md                  Page structure, design tokens, JS modules
│   ├── TECHNOLOGIES.md                  Every tech choice, with reasoning
│   ├── DEPLOY.md                        Deploy flow + troubleshooting
│   ├── MANUAL_SETUP.md                  Dashboard-only action checklist
│   ├── CHANGELOG.md                     What shipped, when, why
│   └── CERTIFICATIONS.md                Cert path rationale
├── .github/workflows/deploy.yml         CI FTP deploy to Hostinger
└── README.md                            This file
```

---

## Design system

| Token        | Dark                         | Light                        |
|--------------|------------------------------|------------------------------|
| Background   | `oklch(0.14 0.008 240)`      | `oklch(0.985 0.003 80)`      |
| Foreground   | `oklch(0.97 0.005 240)`      | `oklch(0.18 0.01 250)`       |
| Accent       | `oklch(0.82 0.14 210)` cyan  | `oklch(0.52 0.15 210)` cyan  |
| Serif        | Instrument Serif             | Instrument Serif             |
| Sans         | Geist (300, 700 variable)    | Geist                        |
| Mono         | Geist Mono (400, 500)        | Geist Mono                   |

Theme is detected from system preference, togglable, persisted in
`localStorage`. Language is detected from `navigator.language`,
togglable, persisted.

---

## Tech inventory

- **Structure**: single `index.html`, two standalone CVs in `cv/`.
- **Fonts**: self-hosted woff2, `@font-face` declarations inline.
- **Animations**: CSS transitions + one `IntersectionObserver` for
  reveal / count-up / scramble. No animation libraries.
- **i18n**: two frozen dictionaries on `window.__I18N__`, swapped via
  `data-i18n` attribute walker.
- **Forms**: vanilla JS with client-side RFC5322 regex + disposable
  email blocklist, posting to same-origin `/api/contact.php` (Resend primary, optional SMTP fallback).
- **Analytics**: [Umami](https://umami.is/) (self-hosted) +
  [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/).
- **Bookings**: [Cal.com](https://cal.com/) inline button.
- **SEO**: JSON-LD `Person` + `ProfessionalService` + `WebSite`,
  hreflang, canonical, OpenGraph + Twitter Card, `sitemap.xml`,
  `robots.txt`.
- **Security**: `.htaccess` headers + Cloudflare edge.
- **CI**: GitHub Actions with `SamKirkland/FTP-Deploy-Action`.

Full reasoning for each choice is in
[`docs/TECHNOLOGIES.md`](docs/TECHNOLOGIES.md).

---

## Deploying your fork

1. Point `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` secrets at your own
   host in GitHub Actions settings.
2. Review `.github/workflows/deploy.yml`. If your host is not
   Hostinger, adjust `server-dir` (Hostinger FTP users are chrooted to
   `public_html/`, so `./` is correct there).
3. Push landing-file changes to `main`. CI uploads over FTPS on port 21 after
   release context checks and asset smoke. Manual dispatch still supports an
   exact release SHA for rollback/promotion.
4. Fallback: `cp .env.example .env`, fill in credentials, then
   `bash scripts/deploy.sh`.

Full deploy doc: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## Configuration placeholders

Before going live, replace these in `index.html`:

| Placeholder                 | Source                                |
|-----------------------------|---------------------------------------|
| `YOUR_UMAMI_WEBSITE_ID`     | Your Umami dashboard → Websites → Add |
| `YOUR_CF_BEACON_TOKEN`      | Cloudflare → Analytics → Web Analytics |
| `RESEND_API_KEY` (+ FROM/TO) | Resend dashboard → deploy injects `api/secrets.php` |
| `jorgesalgadomiranda/30min` | Your Cal.com event type slug          |

The contact form refuses to submit while placeholders remain, so you
will see a clear error until configured. Details in
[`docs/MANUAL_SETUP.md`](docs/MANUAL_SETUP.md) (gitignored, template
copy in the fork).

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

**Source code** (HTML structure, CSS, JavaScript, CI workflows, deploy
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
