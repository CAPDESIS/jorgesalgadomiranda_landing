# Deploy

The site is hosted on Hostinger and deploys through one controlled FTP/FTPS
path:

1. **Manual `workflow_dispatch`** from `main`, on the trusted self-hosted
   `deploy-only` runner, with an exact release SHA, release confirmations,
   pinned FTP credentials and post-deploy smoke.
2. **Manual** from your laptop via `bun run deploy` only as an audited recovery
   fallback.

## Current production pilot status

As of 2026-07-22, `.github/workflows/deploy.yml` is the direct
main-to-production path:

- Pushes and schedules do not deploy automatically.
- `workflow_dispatch` requires an exact SHA contained in `origin/main`, green
  validation, no known P0/P1 alerts, and backup confirmation (`yes` or `n/a`).
- The deployment runs on the trusted self-hosted `deploy-only` runner and keeps
  the production environment/concurrency lock.
- Run `28984333192` on commit `bc3f382` passed in 26 seconds: release context,
  host preflight, cache-bust, optional token injection, contact-form guard, FTPS
  upload and asset smoke all passed.
- External smoke after deploy returned HTTP 200 for `/`, `/robots.txt` and the
  versioned CSS asset.
- Follow-up `fd23fc4` confirmed the origin/new cache-busted HTML carried the
  updated CapMenu link, while Hostinger CDN kept bare `/` stale as
  `x-hcdn-cache-status: HIT`. The workflow now validates cache-busted HTML
  content when the edge allows it, and `.htaccess` sets explicit 5-minute
  HTML/XML Expires plus `s-maxage=300`.
- Current note: set `RESEND_API_KEY` (+ `RESEND_FROM` / `RESEND_TO`) in GitHub
  Actions so deploy writes `api/secrets.php`. Without it, `/api/contact.php`
  returns 503. See `docs/RESEND_SETUP.md`.

## Automatic deploy: GitHub Actions

### Setup (once)

Go to `github.com/chochy2001/jorgesalgadomiranda_landing/settings/secrets/actions`
and create these **four repository secrets**:

| Secret name        | Example value        | Notes                                     |
|--------------------|----------------------|-------------------------------------------|
| `FTP_HOST`         | `ftp.jorgesalgadomiranda.com` or `files.hostinger.com` | Same value you'd put in an FTP client |
| `FTP_USER`         | `u1234567`           | Hostinger panel > Files > FTP Accounts     |
| `FTP_PASSWORD`     | `your-real-password` | Password from the same panel               |

> `FTP_REMOTE_DIR` is **no longer required**. Hostinger's FTP user is
> chrooted to `public_html/`, so the workflow uploads to `./` at the
> account root. If the secret still exists it's harmless; you can delete
> it.

Exact names matter. The workflow at `.github/workflows/deploy.yml` reads
them as `${{ secrets.FTP_HOST }}`, etc.

### How it runs

Trigger it manually from the Actions tab using the "Run workflow" button. The
workflow is registered with `workflow_dispatch` only.

Flow:
1. The workflow resolves the exact `release_sha` input and verifies that it is
   contained in `origin/main`.
2. The operator confirms release health, known P0/P1 status and backup state;
   there is no Monday-only or staging gate.
3. `actions/checkout@v6` pulls the selected SHA.
4. The workflow sanitizes and resolves `FTP_HOST`.
5. It rewrites CSS/JS URLs with the short SHA for cache busting.
6. Optional production tokens are injected from secrets when configured.
7. `SamKirkland/FTP-Deploy-Action@v4.3.5` mirrors the working tree to the
   FTP server on port 21 using FTPS.
8. The action uses the same exclude list as the local deploy script, so
   `.git*`, `.github/`, `docs/`, `scripts/`, `.env*`, `node_modules/`,
   `bun.lockb`, `package*.json`, `README.md` and `og.html` never leave
   the repo.
9. Static assets are smoke-tested from the public domain after upload.

Typical duration: 30-60 seconds.

### Status checks

Watch the run live at
`github.com/chochy2001/jorgesalgadomiranda_landing/actions`.

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
- **Contact form warning**: set `RESEND_API_KEY` (+ FROM/TO) in GitHub Actions
  secrets. Without it the workflow still deploys, but the client-side guard
  blocks submissions visibly.
- **Concurrency lock** from a still-running deploy. The `concurrency`
  block in the workflow serializes deploys so you won't race yourself.

## Manual deploy (fallback)

Requires `lftp` on your machine:

```bash
brew install lftp
cp .env.example .env
# fill in FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR
bun run deploy
```

The script at `scripts/deploy.sh` uses the same exclude list as the
GitHub Actions workflow, so both deploy paths produce byte-identical
remotes.

## What gets uploaded

| File / Dir                          | Uploaded? | Reason                                |
|-------------------------------------|-----------|---------------------------------------|
| `index.html`                        | yes       | the site                              |
| `og.png`                            | yes       | Open Graph card                       |
| `cv/*.html`                         | yes       | print-ready CVs                       |
| `assets/cv/*.pdf`                   | yes       | downloadable PDF                      |
| `fonts/*.woff2`                     | yes       | self-hosted font files                |
| `.htaccess`                         | yes       | Apache headers + HTTPS redirect       |
| `robots.txt`                        | yes       | crawlers + sitemap pointer            |
| `sitemap.xml`                       | yes       | SEO                                   |
| `og.html`                           | no        | source for og.png, not needed live    |
| `docs/`                             | no        | repo documentation                    |
| `scripts/`                          | no        | local tooling                         |
| `.github/`                          | no        | CI config                             |
| `.env*`, `.gitignore`, `.git/`      | no        | private / dev-only                    |
| `package.json`, `README.md`         | no        | repo metadata                         |

## Rollback

Hostinger does not give you per-file version history. If a deploy breaks
production, the cleanest rollback is:

```bash
git checkout <last-good-commit>
bun run deploy
git checkout main
```

This re-runs the same mirror against the remote with the old file tree,
restoring it. Then switch back to `main` locally so future commits are
based on current.

Alternatively, trigger the GitHub Actions workflow manually pointing at the
last-good commit via the "Run workflow" UI and provide the required
confirmations.

## Smoke test before deploy

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

Click through:
- Hero: title renders, code panel shows JSON without horizontal scroll
- Theme toggle: light <-> dark works, persists across reload
- Lang toggle: ES <-> EN works
- About: portrait visible, quick-facts box renders, 4 cards below
- Engineering: 6 cards with kicker (CIMIENTOS, ALCANCE, ...)
- CV button: opens `cv/Jorge_Salgado_Miranda_CV_EN.html`
- PDF download: `assets/cv/Jorge_Salgado_Miranda_CV.pdf` returns 200

## DNS

`jorgesalgadomiranda.com` -> Hostinger nameservers. CNAME for `www` ->
apex. HTTPS handled by Hostinger automatically.

## Third-party tokens to plug in

The repo ships with clearly-labelled `YOUR_*` placeholders. Fill them in
and push. All four are safe to commit because they're scoped to the
public domain and/or don't expose secrets server-side.

| Placeholder                  | Where                                      | Where to get it                                       |
|------------------------------|--------------------------------------------|-------------------------------------------------------|
| `YOUR_UMAMI_WEBSITE_ID`      | `<script data-website-id>` in `index.html` | `stats.capdesis.com` → Settings → Websites → Add site |
| `YOUR_CF_BEACON_TOKEN`       | `data-cf-beacon` in `index.html`           | Cloudflare → Analytics & Logs → Web Analytics         |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | `api/secrets.php` at deploy | Resend dashboard; see `docs/RESEND_SETUP.md` |
| `jorgesalgadomiranda/30min`  | `href` on `#cal-cta` button in `index.html`| cal.com → Event Types → copy the slug                 |

After plugging them in:
1. Smoke-test locally (`python3 -m http.server 8765 --bind 127.0.0.1`)
2. Submit the contact form with a real email. Confirm it hits your inbox.
3. Check the Umami dashboard within ~60s to see the visit appear.
4. Check the Cloudflare Web Analytics dashboard within ~5 min.

## Security stack

Defense-in-depth for a static site:

1. **Cloudflare (free plan, proxied DNS)**: WAF, DDoS, bot fight mode,
   client-side security monitor, leaked-credential mitigation. Already
   enabled.
2. **`.htaccess`**: HSTS, X-Frame-Options, CSP, Referrer-Policy,
   Permissions-Policy, gzip, long-cache immutable assets. Lives at
   repo root, uploaded on every deploy.
3. **FTP password rotation**: rotate `FTP_PASSWORD` secret every
   3-6 months in Hostinger panel and GitHub Secrets.
4. **Watermark in code**: scattered attribution in HTML comment,
   `<meta name="template-origin">`, `--jsm-origin` CSS custom property,
   `data-origin` on `<html>`/`<body>`, JSON-LD `@id`, and a console
   signature. Humans can find it; casual AI-assisted rebrands miss at
   least one.

## Pre-deploy checklist

- [ ] `git status` clean
- [ ] Smoke test on `http://127.0.0.1:8765` passes
- [ ] i18n parity unchanged or improved (run the `EN={n}, ES={n}` Python
      check from `CHANGELOG.md` examples)
- [ ] Commit, push to `main`, watch the Actions tab
