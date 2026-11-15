# GitHub Actions secrets

Full reference for every secret the `Deploy to production` workflow
(`.github/workflows/deploy.yml`) reads. All secrets live under:

> `Settings > Secrets and variables > Actions > Repository secrets`

Last updated: 2026-11-15.

---

## TL;DR

Production deploys run only through manual `workflow_dispatch` on
GitHub-hosted **`ubuntu-latest`** (never a self-hosted fleet runner, because
`CAPDESIS/jorgesalgadomiranda_landing` is a public repository under
`CAPDESIS/CapLiving#525` containment). `main` pushes validate through `ci.yml`,
`test.yml`, and `gitleaks.yml`; they do not upload files automatically.

Configure 3 required FTP secrets. Optional tokens enable analytics and
contact delivery. Contact uses **Resend** (server-side `api/secrets.php`),
not Web3Forms.

| Name | Status | What breaks without it |
|---|---|---|
| `FTP_HOST` | REQUIRED | Deploy cannot connect to Hostinger. |
| `FTP_USER` | REQUIRED | Deploy fails authentication. |
| `FTP_PASSWORD` | REQUIRED | Deploy fails authentication. |
| `UMAMI_WEBSITE_ID` | optional | Umami analytics script skips init (detects `YOUR_` prefix). |
| `CF_BEACON_TOKEN` | optional | Cloudflare Web Analytics beacon skips init. |
| `PUBLIC_POSTHOG_KEY` | optional | PostHog stays on placeholder. |
| `RESEND_API_KEY` | optional (required for live form) | `/api/contact.php` returns 503 until set. |
| `RESEND_FROM` | optional | Defaults to `Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>` if `RESEND_API_KEY` is set. |
| `RESEND_TO` | optional | Defaults to `jorgesalgadomiranda@protonmail.com`. |
| `RESEND_REPLY_TO` | optional | Reply-To defaults to the visitor email, or falls back to `RESEND_REPLY_TO` if configured. |

HTML placeholders (`YOUR_*`) are replaced at deploy for analytics only.
Resend credentials are written to `api/secrets.php` by `scripts/write-contact-secrets.py`, never into HTML.
Optional Cloudflare Turnstile server verification (`TURNSTILE_SECRET_KEY` in `api/secrets.php` or server env; see `api/secrets.example.php` and `api/lib/turnstile.php`) activates automatically when provisioned on the host.

---

## Required: FTP credentials

### FTP_HOST / FTP_USER / FTP_PASSWORD

See Hostinger hPanel > Files > FTP Accounts. Hostinger FTP users are
chrooted to `public_html/`; the workflow uses `server-dir: ./`.
Note: `FTP_REMOTE_DIR` is no longer read by `deploy.yml` (it is only an optional override in local fallback `scripts/deploy.sh`).

---

## Optional: analytics tokens (HTML inject)

### UMAMI_WEBSITE_ID / CF_BEACON_TOKEN / PUBLIC_POSTHOG_KEY

Placeholders in `index.html` (`YOUR_UMAMI_WEBSITE_ID`, `YOUR_CF_BEACON_TOKEN`,
`YOUR_POSTHOG_KEY`). Substituted at deploy time only when the secret is non-empty.

---

## Optional: contact delivery (server-side)

### RESEND_API_KEY / RESEND_FROM / RESEND_TO / RESEND_REPLY_TO

See [`RESEND_SETUP.md`](./RESEND_SETUP.md). Deploy generates `api/secrets.php` via `scripts/write-contact-secrets.py` when `RESEND_API_KEY` is non-empty.

---

## How the workflow reads each secret

- `Gate on a rebuildable rollback point` -> `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` (FTPS origin fallback for `/version.json` when Cloudflare challenges runner IPs)
- `Sanitize FTP host` -> `FTP_HOST`
- `Inject production tokens` -> analytics `YOUR_*` + `api/secrets.php`
- `Assert contact Resend secrets are live` -> verifies `RESEND_API_KEY` / `api/secrets.php` and rejects residual Web3Forms markup
- `Deploy via FTPS` -> `FTP_USER`, `FTP_PASSWORD`
- `Post-deploy smoke test` -> `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` (FTPS origin fallback for `/version.json` parity check)

---

## Rotation checklist

1. Rotate in Resend / Hostinger / analytics vendor.
2. Update the GitHub secret (prefer Update over delete+recreate).
3. Run `workflow_dispatch` on `Deploy to production` with the target `origin/main` SHA and `confirm_no_p0_p1_alerts=yes`.
4. Smoke the live site; confirm `/version.json` and `/api/contact.php` behave as expected.
