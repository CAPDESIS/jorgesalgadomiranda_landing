# Deploy

The site is hosted on Hostinger and deploys through one controlled FTP/FTPS path:

1. **Manual `workflow_dispatch`** from `main` via `.github/workflows/deploy.yml` (`Deploy to production`), running on GitHub-hosted **`ubuntu-latest`** (never a self-hosted fleet runner, because this repository is public under `CAPDESIS/CapLiving#525` containment), with an exact 40-character `release_sha`, automated CI/rollback gates (`scripts/deploy-gates.py`), pinned FTP credentials, and post-deploy smoke checks.
2. **Manual recovery fallback** from a developer machine via `RELEASE_SHA=<40-char-main-sha> bun run deploy` (`scripts/deploy.sh`), only when GitHub Actions is unavailable.

Both paths stamp asset URLs through one script, `scripts/stamp-assets.py`:
every local `.css`, `.js`, and `.mjs` reference in every deployed page gets
`?v=<release SHA[:7]>`, and the run fails if any is left bare. The origin
ignores the query and Cloudflare keeps the first copy it fetches for the 7-day
CSS and JS `Expires`, so a reference that ships without a token keeps old bytes
cached. Nothing is listed by hand: a new page or script is covered when it is
added. `tests/stamp-assets.test.ts` runs both paths against a throwaway release
and fails on any bare reference.

Both paths also share a single exclude definition (`exclude: |` in
`.github/workflows/deploy.yml`): `scripts/deploy.sh` invokes
`scripts/prune-excluded.py` to apply the workflow's exact minimatch/multimatch
rules (`{dot: true, matchBase: true}`) to the staged `git archive` tree before
mirroring with `lftp`.

## Automated deploy: GitHub Actions (`deploy.yml`)

### Setup (once)

Go to `github.com/CAPDESIS/jorgesalgadomiranda_landing/settings/secrets/actions`
and configure the **three required FTP repository secrets** (plus optional
analytics/contact secrets):

| Secret name           | Required? | Example value                                         | Notes                                              |
|-----------------------|-----------|-------------------------------------------------------|----------------------------------------------------|
| `FTP_HOST`            | yes       | `ftp.jorgesalgadomiranda.com` or `46.202.194.123`     | Same host/IP from Hostinger hPanel > FTP Accounts  |
| `FTP_USER`            | yes       | `u1234567`                                            | Hostinger panel > Files > FTP Accounts             |
| `FTP_PASSWORD`        | yes       | `your-real-password`                                  | Password from the same panel                       |
| `RESEND_API_KEY`      | for form  | `re_xxxxxxxx`                                         | Written into `api/secrets.php`; 503 without it     |
| `RESEND_FROM`         | optional  | `Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>` | Defaulted by `write-contact-secrets.py` if unset |
| `RESEND_TO`           | optional  | `jorgesalgadomiranda@protonmail.com`                  | Defaulted by `write-contact-secrets.py` if unset   |
| `RESEND_REPLY_TO`     | optional  | `jorgesalgadomiranda@protonmail.com`                  | Optional reply-to override in `api/secrets.php`    |
| `UMAMI_WEBSITE_ID`    | optional  | `a1b2c3d4-...`                                        | Replaces `YOUR_UMAMI_WEBSITE_ID` in `index.html`   |
| `CF_BEACON_TOKEN`     | optional  | Cloudflare RUM token                                  | Replaces `YOUR_CF_BEACON_TOKEN` in `index.html`    |
| `PUBLIC_POSTHOG_KEY`  | optional  | `phc_...`                                             | Replaces `YOUR_POSTHOG_KEY` in `index.html`        |

> `FTP_REMOTE_DIR` is **no longer used** by `deploy.yml`. Hostinger's FTP user is
> chrooted to `public_html/`, so the workflow uploads to `./` at the
> account root. See [`GITHUB_SECRETS.md`](./GITHUB_SECRETS.md) for details.

### How it runs

Trigger **Deploy to production** manually from the Actions tab (`workflow_dispatch`).
Pushes to `main` and daily schedules run validation/audit workflows (`ci.yml`,
`test.yml`, `gitleaks.yml`, `release-policy.yml`) and do not publish to production.

Inputs:
- `release_sha`: exact 40-character commit SHA from `origin/main`.
- `confirm_no_p0_p1_alerts`: type `yes` to confirm central monitoring has no open P0/P1 alerts (kept manual because Alertmanager requires a production SSH identity that a public repo on `ubuntu-latest` must not hold).

Automated flow on `ubuntu-latest` (`environment: production`, `concurrency: deploy-production`, `cancel-in-progress: false`):
1. **Resolve & verify release context**: validates `release_sha` (40 hex chars), verifies `confirm_no_p0_p1_alerts == "yes"`, checks out `release_sha`, and confirms `git merge-base --is-ancestor "$RELEASE_SHA" refs/remotes/origin/main`.
2. **Automated release gates (`scripts/deploy-gates.py` from `origin/main`)**:
   - `ci-wait`: polls GitHub Actions runs (up to 10 attempts, 30s apart for listing lag) and requires completed `success` push runs on `main` for `CI`, `test`, and `gitleaks` at `release_sha`.
   - `rollback-point`: fetches live `https://jorgesalgadomiranda.com/version.json` (or falls back to reading `/version.json` from the Hostinger origin over TLS 1.2 FTPS when Cloudflare Bot Fight Mode returns 403 to runner IPs) and requires the served SHA to exist in `origin/main`.
3. **Run release tests**: sets up Bun `1.3.14`, runs `bun install --frozen-lockfile` and `bun test --coverage`.
4. **Preflight & integrity checks**: sanitizes `FTP_HOST`, checks DNS/IP resolution, and runs `scripts/check-asset-integrity.py` + Zyrosite hotlink grep.
5. **Stamp, version marker, and token inject**:
   - Runs `scripts/stamp-assets.py` (from `origin/main`) to append `?v=<SHA[:7]>` to all local `.css`/`.js`/`.mjs` references.
   - Runs `scripts/write-version-json.py` to generate `version.json` with `sha`.
   - Substitutes configured `UMAMI_WEBSITE_ID`, `CF_BEACON_TOKEN`, and `PUBLIC_POSTHOG_KEY` in `index.html`, and generates `api/secrets.php` via `scripts/write-contact-secrets.py` when `RESEND_API_KEY` is set.
   - Verifies `index.html` references `/api/contact.php` (never Web3Forms) and `api/contact.php` is present.
6. **FTPS upload (`SamKirkland/FTP-Deploy-Action@v4.4.0`, pinned SHA)**: uploads `./` over explicit FTPS (port 21), excluding repo tooling, docs, tests, specs, audits, and dotfiles (with explicit `!` exceptions for `.htaccess` and `.well-known/**`).
7. **Post-deploy smoke test & parity gate**:
   - Probes `/?v=<SHA[:7]>` (accepting 200 with content checks, or 403 only when Cloudflare Bot Fight Mode challenges the runner TLS fingerprint).
   - Verifies HTTP 200 across 18 static assets (`robots.txt`, `humans.txt`, `og.png`, versioned CSS/JS, logos, brands, portrait, font, EN CV PDF).
   - Verifies `/version.json` parity (`sha == RELEASE_SHA`) over HTTPS or FTPS origin fallback.

### Status checks

Watch the run live at
`github.com/CAPDESIS/jorgesalgadomiranda_landing/actions`.

### Finding the exact FTP host value

This is the #1 cause of deploy failures. In Hostinger:

**hPanel > Files > FTP Accounts > your account**

Look for the field labeled **"Hostname"** or **"FTP hostname"**. Common formats:

- `ftp.yourdomain.com` (works only after DNS has an `ftp.` A record)
- `files.XXXXX.hostingersite.com`
- A plain IPv4 address like `46.202.194.123`
- `srv123.hosting.com` (specific Hostinger server)

**Paste that value verbatim** into the `FTP_HOST` secret. Do not include:
- A scheme (no `ftp://` prefix)
- A trailing slash or path (no `/public_html`)
- A port (port goes in the workflow file, currently 21)

If the workflow fails with `ENOTFOUND`, the pre-flight check will tell
you the DNS didn't resolve. Double-check the value in hPanel.

### Other common deploy failures

- **ENOTFOUND**: wrong `FTP_HOST` value (see above).
- **530 Login incorrect**: wrong `FTP_USER` or `FTP_PASSWORD`.
  Double-check in hPanel, especially for trailing whitespace when you
  paste.
- **550 Permission denied**: the FTP user can't write at its landing
  directory. If Hostinger created a non-standard layout for your account
  you may need to set `server-dir` explicitly in `deploy.yml` (e.g.
  `./public_html/`) instead of the default `./`.
- **Site still shows Hostinger placeholder after a green deploy**:
  you're likely double-nested. The chroot already lands you inside
  `public_html/`, so `server-dir: public_html/` would create
  `public_html/public_html/`. Keep `server-dir: ./`.
- **FTPS handshake failure**: verify Hostinger supports explicit FTPS on port
  21 for this FTP account before changing protocol. Do not silently downgrade
  to plain FTP without documenting the risk.
- **Contact form 503**: set `RESEND_API_KEY` (+ `RESEND_FROM` / `RESEND_TO`)
  in GitHub Actions secrets and redeploy so `api/secrets.php` is written.
- **Concurrency lock**: `deploy.yml` sets `concurrency: deploy-production` with
  `cancel-in-progress: false` to serialize releases safely.

## Manual deploy (fallback)

Requires `lftp` on your machine:

```bash
brew install lftp
cp .env.example .env
# fill in FTP_HOST, FTP_USER, FTP_PASS (or FTP_PASSWORD), FTP_REMOTE_DIR=./
RELEASE_SHA=<40-char-origin-main-sha> bun run deploy
```

The script at `scripts/deploy.sh` stages a clean `git archive` for
`RELEASE_SHA` (verified as an ancestor of `origin/main`), runs
`scripts/stamp-assets.py`, injects optional analytics tokens into `index.html`,
writes `version.json` via `scripts/write-version-json.py`, and prunes the staged
tree with `scripts/prune-excluded.py` using the single `exclude: |` block in
`.github/workflows/deploy.yml`.

`lftp` then mirrors the pruned tree with `mirror --reverse --delete --parallel=4 --exclude-glob api/secrets.php`.
Keeping `api/secrets.php` in `--exclude-glob` prevents `--delete` from wiping
the server-side Resend credentials file that `deploy.yml` generates.
`scripts/prune-excluded.py` fails closed if the workflow block is unreadable,
truncated, or uses unsupported glob syntax, and `tests/deploy-excludes.test.ts`
exercises `deploy.sh` against a fake `lftp` binary to prevent exclude drift.

## What gets uploaded

| File / Dir                                  | Uploaded? | Reason                                      |
|---------------------------------------------|-----------|---------------------------------------------|
| `index.html`, `404.html`                    | yes       | landing page and custom 404 surface         |
| `legal/*.html`                              | yes       | published privacy, terms, and cookie pages  |
| `cv/*.html`, `assets/cv/*.pdf`              | yes       | HTML and downloadable PDF CVs               |
| `assets/styles.css`, `assets/i18n.js`, `assets/js/` | yes | stylesheets, dictionaries, browser scripts  |
| `assets/{brands,icons,images,logos}/`, `fonts/*.woff2` | yes | self-hosted visual assets and woff2 fonts |
| `api/contact.php`, `api/lib/*.php`, `api/secrets.php` (generated) | yes | same-origin Resend/Turnstile contact proxy |
| `og.png`, `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` | yes | social card and site icons |
| `version.json` (generated)                  | yes       | release SHA parity marker                   |
| `.htaccess`, `robots.txt`, `sitemap.xml`, `humans.txt` | yes | Apache rules, SEO, crawl policy     |
| `og.html`, `api/secrets.example.php`        | no        | source/example templates, excluded by `deploy.yml` |
| `docs/`, `specs/`, `audits/`, `tests/`, `scripts/`, `coverage/` | no | repo docs, tests, and tooling      |
| `.github/`, `.git*`, `.env*`, `node_modules/`, `.*`, `.*/**` | no | CI config, secrets, dotfiles (except `.htaccess` and `.well-known/**`) |
| `package.json`, `bun.lock`, `bunfig.toml`, `*.md` | no  | package metadata and root Markdown docs     |

## Rollback

Hostinger does not give you per-file version history. If a deploy breaks
production, trigger **Deploy to production** (`workflow_dispatch`) from the
Actions tab pointing `release_sha` at the last known-good 40-character SHA on
`origin/main` (you can inspect the prior served SHA in `version.json`), or run
the fallback script locally:

```bash
RELEASE_SHA=<last-good-40-char-main-sha> bun run deploy
```

## Smoke test before deploy

```bash
bun run lint
bun run build
bun run check:assets
bun run test:assets
bun test --coverage
bun run test:contact
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

Click through:
- Hero: title renders, code panel shows JSON without horizontal scroll
- Theme toggle: light <-> dark works, persists across reload
- Lang toggle: ES <-> EN works
- About: portrait visible, quick-facts box renders, 4 cards below
- Engineering: 6 cards with kicker (`BACKBONE`, `REACH`, ...)
- CV button: opens `cv/Jorge_Salgado_Miranda_CV_EN.html` or `cv/Jorge_Salgado_Miranda_CV_ES.html`
- PDF downloads: `assets/cv/Jorge_Salgado_Miranda_CV_EN.pdf` and `assets/cv/Jorge_Salgado_Miranda_CV_ES.pdf` return 200

## DNS

`jorgesalgadomiranda.com` uses **Cloudflare nameservers**
(`alberto.ns.cloudflare.com`, `harlee.ns.cloudflare.com`; measured
2026-10-13 via `dig NS`). Apex and `www` resolve to Cloudflare edge
addresses (proxied; no `www` CNAME). HTTPS terminates at the Cloudflare
edge in front of the Hostinger origin.

## Third-party tokens to plug in

Production analytics tokens live in GitHub Actions Secrets and replace `YOUR_*`
placeholders in `index.html` during deploy (do not commit real tokens):

| Placeholder / Secret                 | Where                                      | Where to get it                                       |
|--------------------------------------|--------------------------------------------|-------------------------------------------------------|
| `YOUR_UMAMI_WEBSITE_ID` (`UMAMI_WEBSITE_ID`) | `<script data-website-id>` in `index.html` | `stats.capdesis.com` > Settings > Websites > Add site |
| `YOUR_CF_BEACON_TOKEN` (`CF_BEACON_TOKEN`) | `data-cf-beacon` in `index.html`         | Cloudflare > Analytics & Logs > Web Analytics         |
| `YOUR_POSTHOG_KEY` (`PUBLIC_POSTHOG_KEY`) | PostHog loader in `index.html`        | PostHog > Settings > Project API key                  |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | `api/secrets.php` at deploy      | Resend dashboard; see [`RESEND_SETUP.md`](./RESEND_SETUP.md) |
| `TURNSTILE_SECRET_KEY` (optional)    | `api/secrets.php` or server env            | Cloudflare Turnstile dashboard                        |
| `jorge-salgado-miranda-lt3qxa/30min` | `href` on `#cal-cta` button in `index.html`| cal.com > Event Types (already wired in `index.html`) |

## Security stack

Defense-in-depth for a static site:

1. **Cloudflare (proxied DNS)**: WAF, DDoS, Bot Fight Mode, client-side security monitor, leaked-credential mitigation.
2. **`.htaccess`**: PHP CVE-2026-109618/109619 mitigation block, HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options`, CSP, `Referrer-Policy`, `Permissions-Policy`, dotfile/`api/secrets.php`/`api/lib/` denial, gzip, long-cache immutable assets.
3. **FTP password rotation**: rotate `FTP_PASSWORD` secret every 3-6 months in Hostinger panel and GitHub Secrets.
4. **Watermark in code**: scattered attribution in HTML comment, `<meta name="template-origin">`, `--jsm-origin` CSS custom property, `data-origin` on `<html>`/`<body>`, JSON-LD `@id`, and console signature.

## Pre-deploy checklist

- [ ] `git status` clean and changes merged to `origin/main`
- [ ] Local validation suite (`lint`, `build`, `check:assets`, `test:assets`, `bun test --coverage`, `test:contact`) passes
- [ ] `CI`, `test`, and `gitleaks` push runs on `main` are green for the target `release_sha`
- [ ] Trigger **Deploy to production** (`workflow_dispatch`) from Actions with the exact 40-char `release_sha` and `confirm_no_p0_p1_alerts=yes`

---

## Historical snapshots

> [!NOTE]
> Corte historico fechado (2026-10-29): los registros siguientes documentan mediciones y reglas anteriores de `deploy.yml` (antes del paso a `ubuntu-latest`, `scripts/deploy-gates.py` y la politica vigente de este documento). Consulta las secciones anteriores para el flujo actual.

- **2026-10-29 (production parity snapshot):** Measured 2026-10-29: the live apex served cache-busted assets stamped `v=2e53908`, while `origin/main` was `5b1e2c2` (artifact parity: commits `864612d` #73 and `5b1e2c2` #72 touched only `.github/workflows/`, `scripts/deploy-gates.py`, and `tests/deploy-gates.test.ts`). Edge returned `strict-transport-security: max-age=63072000; includeSubDomains; preload`.
- **2026-07-22 (initial deploy pilot):** Early `deploy.yml` revisions used a self-hosted `deploy-only` runner, Monday-Thursday `America/Mexico_City` window checks, and manual `confirm_release_green` / `confirm_backup_ready` inputs. Run `28984333192` on commit `bc3f382` passed in 26 seconds; follow-up `fd23fc4` exposed Hostinger CDN bare-`/` caching (`x-hcdn-cache-status: HIT`), leading to `.htaccess` 5-minute HTML/XML `Expires` + `s-maxage=300` and cache-busted HTML smoke probes.
