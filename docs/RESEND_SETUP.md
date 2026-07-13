# Resend setup (contact form)

Contact delivery uses the same-origin PHP proxy at `/api/contact.php`.
**Resend is primary.** Optional Hostinger SMTP is fallback only when Resend
fails or is unset. Web3Forms is retired.

Do not put `RESEND_API_KEY` in `index.html`.

## Required GitHub Actions secrets

| Secret | Example |
|--------|---------|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `RESEND_FROM` | `Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>` |
| `RESEND_TO` | `jorgesalgadomiranda@protonmail.com` |

Optional: `RESEND_REPLY_TO`, and SMTP fallback `SMTP_HOST` / `SMTP_PORT` /
`SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`.

On deploy, CI writes `api/secrets.php` (gitignored) and uploads it with the
site. `.htaccess` denies HTTP access to that file.

## Local validation

```bash
bun run test
bun run test:contact
```

`test:contact` mocks Resend via `RESEND_API_BASE` and never calls the live API.

## Domain notes

Verify `jorgesalgadomiranda.com` (or the From domain) in the Resend dashboard
and add SPF/DKIM before flipping production secrets. This PR ships code only —
no VPS/Hostinger secret flip from the agent.
