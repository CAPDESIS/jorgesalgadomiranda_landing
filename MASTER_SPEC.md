# jorgesalgadomiranda-landing MASTER_SPEC

## Executive Summary

`jorgesalgadomiranda-landing` (`CAPDESIS/jorgesalgadomiranda_landing`) powers [`jorgesalgadomiranda.com`](https://jorgesalgadomiranda.com/), the bilingual (Spanish/English) personal portfolio, ATS curriculum vitae publisher, and technical consulting lead-generation site for Jorge Salgado Miranda. The application ships as a zero-build static HTML5/CSS3/vanilla-JS frontend paired with a same-origin PHP 8.4+ contact proxy (`/api/contact.php`) deployed to Hostinger over explicit FTPS behind Cloudflare.

Client readiness: **Ready** (codebase, static/accessibility validators, 14-file Bun test suite with `>= 85%` coverage gate, PHP contact contract tests, security headers, and automated SHA-pinned FTPS deployment gates are implemented and verified; live email/analytics activation remains governed by operator-provisioned GitHub Actions secrets).

## Current Capabilities

All capabilities below are verified directly in repository source, scripts, workflows, and automated tests:

- **Zero-build bilingual landing page**: `index.html` (2983 lines) + `assets/i18n.js` (731 lines, 343 ES keys and 343 EN keys in enforced parity via `scripts/validate-static-site.py`) + `assets/js/i18n-utils.js` (dynamic `{{yearsSince:YYYY}}` tenure interpolation and `localStorage` language persistence).
- **Dual-theme OKLCH design system & WCAG AA contrast**: `assets/styles.css` (3172 lines) defines dark (`:root`) and light (`[data-theme="light"]` and `html[data-surface="aux"]`) OKLCH tokens, self-hosted `Geist`, `Geist Mono`, and `Instrument Serif` `.woff2` fonts (`fonts/`), and WCAG AA-verified `#cookie-banner-title` contrast (`oklch(0.49 0.15 210)` = `#00748f`, `4.95:1` on `--bg-elev` `#f6f5f2`, pinned in `tests/cookie-banner.test.ts`).
- **Auxiliary & legal surfaces**: Bilingual 404 page (`404.html`), published bilingual legal documents (`legal/privacy.html`, `legal/terms.html`, `legal/cookies.html`), and canonical `.htaccess` 301 aliases (`/privacidad`, `/privacy`, `/terminos`, `/terms`, pinned in `tests/legal-aliases.test.ts` and `tests/aux-surfaces.test.ts`).
- **ATS-compatible CVs & PDF build pipeline**: Semantic HTML CVs in English and Spanish (`cv/Jorge_Salgado_Miranda_CV_EN.html`, `cv/Jorge_Salgado_Miranda_CV_ES.html`) rendered to downloadable PDFs (`assets/cv/Jorge_Salgado_Miranda_CV_EN.pdf`, `assets/cv/Jorge_Salgado_Miranda_CV_ES.pdf`) via `scripts/build-cv-pdfs.sh`.
- **Same-origin Resend contact proxy with anti-abuse controls**: `api/contact.php` accepts `POST` submissions from `index.html`, silently absorbs honeypot hits (`botcheck`), enforces file-backed per-IP rate limiting (`api/lib/rate-limit.php`, HTTP `429`), validates fields and blocks disposable domains (`api/lib/contact-validator.php` + client-side `assets/js/email-validation.js`), verifies Cloudflare Turnstile tokens when `TURNSTILE_SECRET_KEY` is configured (`api/lib/turnstile.php`), and sends escaped HTML lead emails exclusively through Resend (`api/lib/resend-mail.php`), failing closed (`503`) if unconfigured.
- **Consent-gated analytics**: `assets/js/consent.js` and `assets/js/cookie-banner.js` gate Umami, Cloudflare Web Analytics, and PostHog behind explicit visitor consent (`jsm-cookie-consent` v1 in `localStorage` with TTL) and skip any provider whose `YOUR_*` token placeholder was not injected at deploy time (`tests/consent.test.ts`, `tests/cookie-banner.test.ts`).
- **Lead-generation consultation modal & booking CTAs**: `assets/js/welcome-modal.js` manages the 12-second delayed consultation modal (`WELCOME_SHOW_DELAY_MS = 12000` in `index.html`, 7-day dismiss cooldown in `localStorage`, tested in `tests/welcome-modal.test.ts`) linking to `https://cal.com/jorge-salgado-miranda-lt3qxa/30min`.
- **Self-hosted asset integrity & Apache edge hardening**: `scripts/check-asset-integrity.py` and `scripts/check-local-assets.py` forbid external Zyro CDN hotlinks and missing local media; `.htaccess` enforces PHP advisory mitigations (`CVE-2026-109618`/`109619`), HSTS (`max-age=63072000; includeSubDomains; preload`), strict CSP, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, dotfile `Require all denied`, `api/secrets.php` deny rules, 5-minute HTML `Expires`, and 6-month immutable font/image caching.

## Architecture and Source Map

- **Repository**: `CAPDESIS/jorgesalgadomiranda_landing` (git root `.`, guidance `AGENTS.md`)
- **Primary entrypoints**:
  - `index.html`: main portfolio and audit lead-generation page
  - `404.html`: bilingual custom error surface
  - `legal/privacy.html`, `legal/terms.html`, `legal/cookies.html`: legal & cookie policy pages
  - `cv/Jorge_Salgado_Miranda_CV_EN.html`, `cv/Jorge_Salgado_Miranda_CV_ES.html`: source HTML CVs
  - `api/contact.php` + `api/lib/{bootstrap-env,contact-validator,rate-limit,turnstile,resend-mail}.php`: server-side PHP contact endpoint
- **Client scripts & styles**:
  - `assets/styles.css`: unified token and component stylesheet
  - `assets/i18n.js`: frozen `I18N.es` / `I18N.en` dictionaries (343 keys each)
  - `assets/js/{consent,cookie-banner,email-validation,i18n-utils,welcome-modal}.js`: modular browser logic
- **Automation & CI/CD**:
  - `scripts/validate-static-site.py`, `scripts/check-asset-integrity.py`, `scripts/check-local-assets.py`: static HTML/i18n/asset validators
  - `scripts/stamp-assets.py`, `scripts/write-version-json.py`, `scripts/write-contact-secrets.py`, `scripts/prune-excluded.py`, `scripts/deploy-gates.py`, `scripts/deploy.sh`: release packaging, parity gating, and FTPS sync tools
  - `.github/workflows/{ci,test,gitleaks,release-policy,deploy}.yml`: CI validation, secret scanning, policy enforcement, and manual SHA-promoted FTPS deployment
- **Test suite**:
  - `tests/*.test.ts` (14 test suites + `tests/setup.ts` + `tests/support/{excludes,release}.ts`) and `scripts/test-contact-api.php`

## Key Workflows

1. **Local preview & static validation**:
   - `bun run dev` (or `python3 -m http.server 8765 --bind 127.0.0.1`) serves the static tree locally.
   - `bun run lint` / `bun run build` runs `python3 scripts/validate-static-site.py` (HTML structure, SEO/canonical/hreflang, i18n parity, `/api/contact.php` contract).
   - `bun run check:assets` and `bun run test:assets` verify all local asset references and Zyro CDN exclusions.
2. **Automated test & coverage gate (`test.yml`, `ci.yml`, `release-policy.yml`, `gitleaks.yml`)**:
   - Every PR and `main` push runs on `ubuntu-latest` (GitHub-hosted runners only, enforced for public-repo containment), executing `bun test --coverage` (`>= 85%` line and function threshold in `bunfig.toml`), `bun run test:contact` (`php scripts/test-contact-api.php`), `actionlint`, PHP `.htaccess` advisory check (`scripts/php-advisory-htaccess-test.sh`), em-dash/en-dash style guards, and `gitleaks`.
3. **Production release promotion (`deploy.yml`)**:
   - Triggered exclusively via manual `workflow_dispatch` with an exact 40-char `release_sha` on `origin/main` and `confirm_no_p0_p1_alerts=yes`.
   - `scripts/deploy-gates.py` polls GitHub Actions (`ci-wait`) to verify `CI`, `test`, and `gitleaks` succeeded on `main` for `release_sha` and checks the live/FTPS `version.json` rollback point (`rollback-point`).
   - `scripts/stamp-assets.py` appends `?v=<release_sha[:7]>` to every local `.css`/`.js`/`.mjs` reference; `scripts/write-version-json.py` writes `version.json`; optional analytics and `api/secrets.php` tokens are injected from GitHub Secrets; `SamKirkland/FTP-Deploy-Action` mirrors allowed files over FTPS while excluding `specs/`, `docs/`, `tests/`, `audits/`, `scripts/`, dotfiles, and repo metadata; post-deploy smoke verifies `version.json` parity and stamped assets.
4. **Local recovery deploy (`scripts/deploy.sh`)**:
   - Requires clean `RELEASE_SHA` on `origin/main`, stages a temporary `git archive`, runs `scripts/stamp-assets.py`, `scripts/write-version-json.py`, and `scripts/prune-excluded.py` (reading the exact exclude list from `.github/workflows/deploy.yml`), and mirrors via `lftp` while preserving server-side `api/secrets.php`.

## Integration Boundaries

| Boundary | Repository Source Side | Target / External Side | Contract & Failure Mode |
|----------|------------------------|------------------------|-------------------------|
| Lead contact submission | `index.html` form + `assets/js/email-validation.js` | `POST /api/contact.php` -> `https://api.resend.com/emails` (`api/lib/resend-mail.php`) | JSON response (`200`, `400`, `403`, `405`, `429`, `503`). Fails closed (`503`) with generic message if `RESEND_API_KEY` is unset or Resend errors; never leaks transport details to browser. |
| Bot challenge verification | `index.html` (`jsm-turnstile-site-key`, `cf-turnstile-response`) + `.htaccess` CSP | `api/lib/turnstile.php` -> Cloudflare Turnstile `siteverify` | Enforced automatically once `TURNSTILE_SECRET_KEY` is present in `api/secrets.php` or environment. |
| Visitor analytics | `assets/js/consent.js`, `assets/js/cookie-banner.js`, `index.html` | Umami (`stats.capdesis.com`), Cloudflare Web Analytics, PostHog (`us.i.posthog.com`) | Strictly opt-in via `jsm-cookie-consent`; uninjected `YOUR_*` placeholders never load external scripts. |
| Technical review booking | `index.html` CTAs & `assets/js/welcome-modal.js` | `https://cal.com/jorge-salgado-miranda-lt3qxa/30min` | External HTTPS navigation (`target="_blank" rel="noopener noreferrer"`). |
| Hosting & CDN edge | `.htaccess`, `.github/workflows/deploy.yml`, `scripts/deploy.sh` | Hostinger Apache/LiteSpeed/PHP (`public_html/`) + Cloudflare proxy | Explicit FTPS on port 21 (`server-dir: ./`); `version.json` and FTPS origin fallback bypass Cloudflare Bot Fight Mode JA3/JA4 challenges during CI parity checks. |

## Data, Storage, and Deployment

- **Persistent storage**: No application database. Browser state uses only `localStorage` keys for theme preference, language (`es`/`en`), cookie consent (`jsm-cookie-consent`), and welcome modal dismissal timestamp. Server-side PHP uses ephemeral temp-directory files solely for per-IP contact rate-limit counters (`api/lib/rate-limit.php`).
- **Secrets management**: Zero credentials or live tokens are stored in git. Deploy-time secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`, `RESEND_REPLY_TO`, `UMAMI_WEBSITE_ID`, `CF_BEACON_TOKEN`, `PUBLIC_POSTHOG_KEY`) reside in GitHub Actions Secrets; server-side mail/Turnstile secrets are written into gitignored `api/secrets.php` during deployment and blocked from HTTP reads by `.htaccess`.
- **Deployment artifact hygiene**: `.github/workflows/deploy.yml` and `scripts/prune-excluded.py` share a single tested exclude block ensuring `specs/`, `docs/`, `audits/`, `tests/`, `scripts/`, `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `MASTER_SPEC.md`, `README.md`, `package.json`, `bun*`, and dotfiles (except `.htaccess` and `.well-known/**`) never ship to Hostinger.

## Validation Evidence

Full baseline command-level records are maintained in [`specs/001-ecosystem-doc-audit/audit/drift/jorgesalgadomiranda-landing.md`](specs/001-ecosystem-doc-audit/audit/drift/jorgesalgadomiranda-landing.md).

| scope | command | status | summary |
|-------|---------|--------|---------|
| `web` | `bun run lint && bun run build` (`python3 scripts/validate-static-site.py`) | `pass` | `Static site validation OK` (canonical, hreflang, JSON-LD, 343-key ES/EN parity, `/api/contact.php` contract). |
| `web` | `bun run check:assets && bun run test:assets` | `pass` | Local `assets/` refs verified and zero Zyro CDN hotlinks. |
| `web` | `bun test --coverage` | `pass` | All 14 Bun test suites pass above the 85% coverage gate in `bunfig.toml`. |
| `php` | `bun run test:contact` (`php scripts/test-contact-api.php`) | `pass` | Validator, Resend config, Turnstile, rate-limit, and HTTP contract tests pass against mocked Resend. |
| `docs` | `manual-review` | `pass` | Cutoff 2026-11-15: reconciled `README.md`, `AGENTS.md`, `docs/DEPLOY.md`, `docs/GITHUB_SECRETS.md`, `docs/MANUAL_SETUP.md`, `docs/RESEND_SETUP.md`, `docs/TECHNOLOGIES.md`, `docs/ARCHITECTURE.md`; verified zero em/en dashes. |

## Open Decisions and External State

- Production GitHub Actions secret population (`RESEND_*`, `TURNSTILE_SECRET_KEY`, `UMAMI_WEBSITE_ID`, `CF_BEACON_TOKEN`, `PUBLIC_POSTHOG_KEY`) and Cloudflare zone cache/bot rules exist outside git and require live operator verification.
- Issue `CAPDESIS/jorgesalgadomiranda_landing#62` tracks an open product decision regarding the 12-second consultation modal trigger (`WELCOME_SHOW_DELAY_MS = 12000` in source vs scroll/exit-intent or removal).

## Known Limits and Risks

- **Shared-hosting rollback model**: Hostinger FTPS has no atomic symlink switch; rollback is executed by running `deploy.yml` (or `scripts/deploy.sh`) with the prior known-good `release_sha` recorded in `version.json`.
- **Cloudflare Bot Fight Mode vs CLI probes**: Cloudflare challenges plain `curl` HTML/XML fetches from datacenter IPs (`403`); post-deploy checks therefore rely on static asset probes and authenticated FTPS origin reads when edge challenges trigger.
- **Consultation modal UX trade-off (`#62`)**: Auto-opening the free-review modal after 12 seconds is intentional lead-gen behavior today (`assets/js/welcome-modal.js`), pending product-owner review in `#62`.

## Client Readiness

Readiness label: **Ready**.

The static frontend, WCAG AA contrast tokens, bilingual dictionary parity, same-origin PHP Resend proxy, asset integrity guards, and SHA-gated FTPS deployment pipeline are complete and covered by automated CI checks on `ubuntu-latest`. Before claiming active email delivery or analytics capture after a fresh credential rotation, verify `/api/contact.php` and `version.json` on the live domain.

## Next Steps

1. Decide on the consultation welcome-modal trigger UX tracked in `CAPDESIS/jorgesalgadomiranda_landing#62` (keep 12s timer, switch to scroll/exit-intent, or remove auto-open).
2. Optionally add the Cloudflare Cache Rule for versioned `*.css?*` and `*.js?*` assets (`docs/TICKETS.md` `T-104`) in the Cloudflare dashboard.

## Documentation Map

- `README.md`: active public overview, script reference, doc index, and fork terms.
- `AGENTS.md`: active engineering, PHP proxy, runner policy, and `capdesis-ui` guidance.
- `docs/DEPLOY.md`, `docs/GITHUB_SECRETS.md`, `docs/MANUAL_SETUP.md`, `docs/RESEND_SETUP.md`: current operational runbooks (`ubuntu-latest`, `scripts/deploy-gates.py`, `scripts/prune-excluded.py`).
- `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TECHNOLOGIES.md`, `docs/CERTIFICATIONS.md`: active design and architecture references.
- `docs/CHANGELOG.md`, `docs/TICKETS.md`, `HANDOFF.md`, `audits/2026-09-11-ola.md`, `audits/CIERRE-2026-09-11.md`: chronological audit and ticket logs retained as dated historical evidence.
