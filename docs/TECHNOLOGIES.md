# Technologies

This document lists every external dependency and runtime choice in the
project, what it is, why it's here, and how it's used. The goal is that any
engineer who clones the repo can reproduce or audit the stack without
guesswork.

## Runtime (the deployed website)

### Vanilla HTML, CSS, JavaScript
The site ships as static first-party files: `index.html`, `404.html`,
`legal/*.html`, `assets/styles.css`, `assets/i18n.js`, `assets/js/*.js`,
CV HTML/PDF assets, fonts, and SEO files.
- Why: no bundler, no framework runtime, no Node server process, and no asset
  compilation step. The browser reads committed files directly.
- How: edit `index.html`, `assets/styles.css`, `assets/i18n.js`, or
  `assets/js/*.js` directly, then run `bun run lint` and `bun run build`
  (both execute `python3 scripts/validate-static-site.py`).

### PHP 8.4+ contact proxy (`api/contact.php`)
- Why: keep `RESEND_API_KEY` server-side while running on Hostinger shared
  hosting (LiteSpeed/PHP) with zero external backend server.
- How: `index.html` submits form data same-origin to `/api/contact.php`, which
  applies honeypot filtering, per-IP rate limiting (`api/lib/rate-limit.php`),
  input/disposable-domain validation (`api/lib/contact-validator.php`),
  optional Cloudflare Turnstile verification (`api/lib/turnstile.php`), and
  Resend delivery (`api/lib/resend-mail.php`), failing closed (`503`) if
  unconfigured.

### Self-hosted fonts: Instrument Serif + Geist + Geist Mono
- Why: Instrument Serif gives the editorial weight to titles. Geist is a
  sharp neo-grotesque designed by Vercel; reads cleanly at any size. Geist
  Mono carries kickers, code, and stat labels.
- How: served from local `fonts/*.woff2` files with `@font-face`
  declarations in `assets/styles.css` and preload hints in `index.html`.

### OKLCH + color-mix
- Why: predictable perceptual lightness across the whole gamut, makes
  light/dark contrast deterministic.
- How: every color in the design tokens uses `oklch(L C H)`. Hover states
  use `color-mix(in oklab, var(--accent) 12%, transparent)` for translucent
  accent washes.

### IntersectionObserver
- Why: trigger reveal/count-up/scramble animations only when the user
  reaches them, not on page load.
- How: one observer, threshold 0.15, rootMargin -60px from bottom. On
  intersection: add `.in-view`, run any nested counters or scrambles, then
  unobserve.

### CSS `prefers-reduced-motion` + `pointer: coarse`
- Why: respect the user's OS-level accessibility setting and don't run
  cursor effects on touch devices.
- How: every transition is shortened to 0.01ms inside the media query, and
  the JS reads both queries before registering cursor/magnetic/tilt
  handlers.

## Hosted assets

### Self-hosted under `assets/`
Portrait, partner/brand marks, and tech logos ship from this repo:
- `assets/images/foto_perfil.png`
- `assets/brands/*` (PayPal, Capdesis, Tienda UNAM, Flexera, Udemy, iOS Lab, Formulae)
- `assets/logos/*` (Flutter, Swift, Kotlin, Compose, Go, AWS, Docker, K8s, ...)

Why: the previous Zyrosite CDN (`assets.zyrosite.com`) started returning
404 in July 2026 and blanked the partners marquee, skills strip, and
about portrait (see `docs/evidence/image-audit-2026-07-13/`).

Guard: `scripts/check-asset-integrity.py` + `scripts/check-local-assets.py` +
`tests/asset-integrity.test.ts` block deploys that reintroduce Zyrosite
hotlinks or missing local files.

### `capdesis.com/images/products/` and `/images/clients/`
- What: Capdesis product logos and client brand marks.
- Why: real brand identity on Capdesis cards; each `<img>` has an
  `onerror` monogram fallback if the URL 404s.
- How: hotlinked from Capdesis cards (still allowed by CSP `img-src`).

## Local development tooling

### Bun (pinned 1.3.14 in CI)
- Why: fast TypeScript-aware runtime and test runner with built-in coverage
  and static file serving (`@happy-dom/global-registrator` as the only
  devDependency).
- How: `bun run dev` invokes `bunx serve . -l 3000` for local preview;
  `bun test --coverage` enforces the 85% coverage threshold in `bunfig.toml`.
- Install: `curl -fsSL https://bun.sh/install | bash`

### lftp
- Why: parallel, resumable FTP mirror for emergency fallback deploys.
- How: `RELEASE_SHA=<40-char-main-sha> bun run deploy` calls
  `scripts/deploy.sh`, verifies the SHA is on `origin/main`, extracts a
  clean `git archive`, runs `scripts/stamp-assets.py`, injects deploy-time
  public tokens, writes `version.json`, prunes excluded files via
  `scripts/prune-excluded.py`, and runs `lftp` with
  `mirror --reverse --delete --exclude-glob api/secrets.php`.
- Install: `brew install lftp`

### Python 3
- Why: zero-dependency static HTML/i18n/asset validation, asset stamping,
  deploy gating, and exclude pruning in CI and locally.
- How: `scripts/validate-static-site.py`, `scripts/check-local-assets.py`,
  `scripts/check-asset-integrity.py`, `scripts/stamp-assets.py`,
  `scripts/deploy-gates.py`, `scripts/prune-excluded.py`,
  `scripts/write-version-json.py`, `scripts/write-contact-secrets.py`.

### Playwright (used during development only)
- Why: visual verification of the rendered page across themes and viewports.
- How: invoked manually during design checks; never shipped with the site.

## Authoring conventions

### i18n keys
Every translatable string lives in two places: an `<element data-i18n="key">`
in the HTML, and the same `key` inside both `I18N.en` and `I18N.es`. The
EN dict is the source of truth; the HTML default text matches it.
`scripts/validate-static-site.py` verifies 343/343 key parity.

### CSS naming
BEM-ish: `.section-name`, `.section-name-element`, `.section-name-element--modifier`.
Custom properties are scoped to `:root` and overridden in `[data-theme="light"]`
and `html[data-surface="aux"]`.

### JavaScript style
- IIFEs or small browser helpers under `assets/js/`
- `const` over `let`; never `var`
- Zero external npm runtime dependencies
- Immediately frozen objects for `window.__I18N__`
- Explicit `null`-checks before touching DOM nodes that may not exist on
  every page
- Zero em-dashes (`U+2014`) or en-dashes (`U+2013`), enforced in CI

## Outside the runtime

### git
Commit messages are clean, concise, and authored without AI attribution.

### GitHub
Repo lives at `github.com/CAPDESIS/jorgesalgadomiranda_landing`.
Production deploy remains a manual SHA promotion via FTPS (`deploy.yml`).

All five workflows run on GitHub-hosted `ubuntu-latest`, which is the fleet
policy for public repositories (`CAPDESIS/CapLiving#525` containment):

| Workflow | Triggers |
|----------|----------|
| `ci.yml` | `push` to `main`, `pull_request` to `main` |
| `gitleaks.yml` | `push` to `main`/`master`, `pull_request` to `main`, `workflow_dispatch` |
| `test.yml` | `push` to `main`, `pull_request` to `main`, `workflow_dispatch`, daily `schedule` |
| `release-policy.yml` | `pull_request` to `main`, `workflow_dispatch`, daily `schedule` |
| `deploy.yml` | `workflow_dispatch` only (manual SHA promotion to `production`) |

"Secret scanning" in CI means the **gitleaks** job inside `gitleaks.yml`.
GitHub's native secret scanning and ruleset state live in repo settings;
`main` is protected by the `local-first-main-safety` ruleset requiring status
checks (land changes via pull requests).
