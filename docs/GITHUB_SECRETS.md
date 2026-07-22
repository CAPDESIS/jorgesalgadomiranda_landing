# GitHub Actions secrets

Full reference for every secret the `Deploy to Hostinger` workflow
reads. All secrets live under:

> `Settings > Secrets and variables > Actions > Repository secrets`

Last updated: 2026-07-13.

---

## TL;DR

Production deploys run only through manual `workflow_dispatch` on the trusted
self-hosted `ci-runner-node`/`deploy-only` lane. `main` pushes validate through
the test workflow; they do not upload files automatically.

Configure 3 required FTP secrets. Optional tokens enable analytics and
contact delivery. Contact uses **Resend** (server-side `api/secrets.php`),
not Web3Forms.

| Name | Status | What breaks without it |
|---|---|---|
| `FTP_HOST` | REQUIRED | Deploy cannot connect to Hostinger. |
| `FTP_USER` | REQUIRED | Deploy fails authentication. |
| `FTP_PASSWORD` | REQUIRED | Deploy fails authentication. |
| `UMAMI_WEBSITE_ID` | optional | Umami analytics script skips init (IIFE detects the `YOUR_` prefix). |
| `CF_BEACON_TOKEN` | optional | Cloudflare Web Analytics beacon skips init. |
| `PUBLIC_POSTHOG_KEY` | optional | PostHog stays on placeholder. |
| `RESEND_API_KEY` | optional (required for live form) | `/api/contact.php` returns 503 until set (or SMTP fallback). |
| `RESEND_FROM` | optional | Defaults at inject time if key is set. |
| `RESEND_TO` | optional | Defaults to `jorgesalgadomiranda@protonmail.com`. |
| `SMTP_*` | optional | Fallback only when Resend fails/quota. |

HTML placeholders (`YOUR_*`) are replaced at deploy for analytics only.
Resend/SMTP credentials are written to `api/secrets.php`, never into HTML.

---

## Required: FTP credentials

### FTP_HOST / FTP_USER / FTP_PASSWORD

See Hostinger hPanel → Files → FTP Accounts. Hostinger FTP users are
chrooted to `public_html/`; the workflow uses `server-dir: ./`.

---

## Optional: analytics tokens (HTML inject)

### UMAMI_WEBSITE_ID / CF_BEACON_TOKEN / PUBLIC_POSTHOG_KEY

Placeholders in `index.html` (`YOUR_UMAMI_WEBSITE_ID`, `YOUR_CF_BEACON_TOKEN`,
`YOUR_POSTHOG_KEY`). Substituted only when the secret is non-empty.

---

## Optional: contact delivery (server-side)

### RESEND_API_KEY / RESEND_FROM / RESEND_TO

See [`RESEND_SETUP.md`](./RESEND_SETUP.md). Deploy generates `api/secrets.php`.

### SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM

Optional quota/outage fallback. Never SMTP-primary greenfield.

---

## How the workflow reads each secret

- `Sanitize FTP host` → `FTP_HOST`
- `Inject production tokens` → analytics `YOUR_*` + optional `api/secrets.php`
- `Assert contact Resend secrets are live` → rejects residual Web3Forms markup
- `Deploy via FTPS` → `FTP_USER` / `FTP_PASSWORD`

---

## Rotation checklist

1. Rotate in Resend / Hostinger / analytics vendor.
2. Update the GitHub secret (prefer Update over delete+recreate).
3. Run `workflow_dispatch` on Deploy to Hostinger.
4. Smoke the live site; confirm `/api/contact.php` is present on origin.
