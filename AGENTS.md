# Jorge Salgado Miranda Landing Page

Personal portfolio and consulting lead-generation site at `https://jorgesalgadomiranda.com/` (`CAPDESIS/jorgesalgadomiranda_landing`). Zero-build static HTML/CSS/vanilla JS paired with a same-origin PHP contact proxy.

See parent `/Users/jorge/Documents/Apps/AGENTS.md` for workspace defaults, [`README.md`](README.md) for overview/forking, [`MASTER_SPEC.md`](MASTER_SPEC.md) for current architecture evidence, and [`HANDOFF.md`](HANDOFF.md) for historical session logs.

## Architecture and runtime notes

- **Frontend:** zero-build static `index.html`, `404.html`, `legal/*.html`, `cv/*.html`, `assets/styles.css`, `assets/i18n.js` (343 ES/EN keys in parity), and browser modules under `assets/js/`.
- **Contact backend (`PHP 8.4+`):** `api/contact.php` + `api/lib/{bootstrap-env,contact-validator,rate-limit,turnstile,resend-mail}.php`.
  - **Resend is the only mail transport** (fleet policy; no SMTP fallback). Returns `503` fail-closed if `RESEND_API_KEY` or `RESEND_FROM` is missing.
  - Includes honeypot (`botcheck`), file-backed per-IP rate limiting (`429`), field/disposable-domain validation (`400`), and optional Cloudflare Turnstile verification (`400`/`403`, enforced automatically when `TURNSTILE_SECRET_KEY` is present in env or `api/secrets.php`).
  - Live secrets are never committed; `deploy.yml` writes gitignored `api/secrets.php` from GitHub Secrets (`scripts/write-contact-secrets.py`), and `.htaccess` denies HTTP access to `api/secrets.php`, `api/secrets.example.php`, `api/lib/`, and dotfiles.
- **Shared UI library (`capdesis-ui`):** This personal static site has **zero runtime dependencies** on `capdesis-ui` (`@capdesis/ui-astro` or `capdesis_ui`). Do not add `capdesis-ui` pins here unless the site is intentionally migrated to Astro/React; see `capdesis-ui/CONSUMPTION.md` for active fleet pins (`CapdesisWebLanding`, `Formulae`, Flutter apps).

## Style and hygiene rules

- **Zero em-dashes or en-dashes:** Never use em-dash (`U+2014`) or en-dash (`U+2013`) characters in code, JS, tests, copy, or Markdown documentation. Use ASCII `-` or `:` instead. `.github/workflows/test.yml` enforces this in `assets/js` and `tests`.
- **Single-source excludes & asset stamping:** Never maintain a second exclude list or manual asset-version list. Production excludes live in `.github/workflows/deploy.yml` (`exclude: |`) and are mirrored locally via `scripts/prune-excluded.py`; `?v=<sha[:7]>` cache-busting runs via `scripts/stamp-assets.py`.
- **No secrets or real analytics tokens in git:** Keep `YOUR_UMAMI_WEBSITE_ID`, `YOUR_CF_BEACON_TOKEN`, and `YOUR_POSTHOG_KEY` placeholders in `index.html`; `deploy.yml` substitutes them at deploy time.

## CI/CD and deploy policy

- **Public-repo runner policy:** Because `CAPDESIS/jorgesalgadomiranda_landing` is a **public** repository, every workflow (`ci.yml`, `test.yml`, `gitleaks.yml`, `release-policy.yml`, `deploy.yml`) MUST run on GitHub-hosted `ubuntu-latest` runners, never on self-hosted fleet runners (`CAPDESIS/CapLiving#525` containment; enforced by `tests/ci-hygiene.test.ts` and `.github/workflows/release-policy.yml`).
- **Manual promotion only:** Production deploys run exclusively via `workflow_dispatch` on `.github/workflows/deploy.yml` with an exact 40-char `release_sha` on `origin/main` and `confirm_no_p0_p1_alerts=yes`. Automated gates (`scripts/deploy-gates.py`) verify green `CI`, `test`, and `gitleaks` push runs on `main` and a valid `/version.json` rollback point.

## Local commands

```bash
bun install --frozen-lockfile   # install devDependencies (@happy-dom/global-registrator)
bun run dev                     # local static preview (bunx serve . -l 3000)
bun run lint                    # python3 scripts/validate-static-site.py
bun run build                   # python3 scripts/validate-static-site.py (no bundler)
bun run check:assets            # python3 scripts/check-local-assets.py
bun run test:assets             # check-asset-integrity.py + bun test tests/asset-integrity.test.ts
bun test --coverage             # full Bun suite (>= 85% line coverage gate in bunfig.toml)
bun run test:contact            # php scripts/test-contact-api.php (mocked Resend via RESEND_API_BASE)
```
