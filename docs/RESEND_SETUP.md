# Resend setup (contact form)

Contact delivery uses the same-origin PHP proxy at `/api/contact.php`.
**Resend is the only mail provider** (fleet policy). There is no SMTP fallback:
when Resend is unset or fails, the endpoint answers 503 with a generic body and
logs the cause with `error_log`. Web3Forms is retired.

Do not put `RESEND_API_KEY` in `index.html`.

## Anti-abuse protections in `api/contact.php`

- Honeypot field (`botcheck`): silently returns HTTP 200 without sending email.
- Per-IP sliding-window rate limiter (`api/lib/rate-limit.php`): returns HTTP 429 when exceeded.
- Server-side field & disposable-domain validation (`api/lib/contact-validator.php`): returns HTTP 400.
- Optional Cloudflare Turnstile verification (`api/lib/turnstile.php`): enforced automatically (`400`/`403`) when `TURNSTILE_SECRET_KEY` is configured in `api/secrets.php` or environment.

## Required GitHub Actions secrets

| Secret | Example |
|--------|---------|
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `RESEND_FROM` | `Jorge Salgado Miranda <noreply@jorgesalgadomiranda.com>` |
| `RESEND_TO` | `jorgesalgadomiranda@protonmail.com` |

Optional: `RESEND_REPLY_TO` (also `TURNSTILE_SECRET_KEY` in `api/secrets.php` or host env when enabling Turnstile; see `api/secrets.example.php`).

On deploy, CI runs `scripts/write-contact-secrets.py` to generate `api/secrets.php` (gitignored) and uploads it with the
site. `.htaccess` denies HTTP access to `api/secrets.php`, `api/secrets.example.php`, and `api/lib/`.

## Local validation

```bash
bun test --coverage
bun run test:contact
```

`test:contact` (`php scripts/test-contact-api.php`) mocks Resend via `RESEND_API_BASE` and never calls the live API.

## Domain notes

Verify `jorgesalgadomiranda.com` (or the From domain) in the Resend dashboard
and add SPF/DKIM before flipping production secrets. Repository PRs ship code
and docs only - no VPS/Hostinger secret flip is performed from an agent PR.
