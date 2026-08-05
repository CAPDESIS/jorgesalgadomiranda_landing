# jorgesalgadomiranda_landing Master Spec

Last evidence pass: 2026-06-29.

This file documents the current static portfolio/lead-generation site at
`jorgesalgadomiranda.com`.

## Verified Scope

- Product: personal portfolio for Jorge Salgado Miranda and lead-generation
  surface for architecture, security, performance, and cost audits.
- Runtime: static files hosted on Hostinger.
- Primary page: `index.html`.
- Supporting assets: `cv/`, `assets/`, `fonts/`, `robots.txt`, `sitemap.xml`,
  `.htaccess`, `og.html`, and `og.png`.
- No framework runtime and no build pipeline are required for the main site.

## Stack Evidence

- `package.json`: private package with `dev`, `build`, and `deploy` scripts.
  `build` runs the static-site validator through `bun run lint`; there is no
  asset bundling step for the main site.
- `README.md`: single-file static site, bilingual dictionaries, theme toggles,
  CV/PDF assets, Web3Forms, Cal.com, Umami, Cloudflare Web Analytics, SEO, and
  `.htaccess` security headers.
- `docs/DEPLOY.md`: Hostinger deployment through manual GitHub Actions
  `release_sha` promotion or local `RELEASE_SHA` fallback.

## Source Of Truth

- Product and repo layout: `README.md`.
- Deploy flow: `docs/DEPLOY.md`.
- Architecture and technology rationale: `docs/ARCHITECTURE.md` and
  `docs/TECHNOLOGIES.md`.
- Manual provider setup: `docs/MANUAL_SETUP.md`.
- Changelog: `docs/CHANGELOG.md`.

## Deployment Rules

- Production deploy is manual SHA promotion.
- GitHub Actions workflow requires exact `release_sha`, verifies the checkout,
  verifies `origin/main` ancestry, requires green CI, gitleaks, and release
  policy runs for that SHA, injects public deploy-time tokens, and uploads over
  explicit FTPS on port 21.
- The manual promotion also requires a Monday window in `America/Mexico_City`
  unless `emergency_override=true` is explicitly approved, plus operator
  confirmations for staging health, monitoring, and backup/data applicability.
- Local fallback requires `RELEASE_SHA`, verifies `origin/main` ancestry, creates
  a temporary `git archive`, injects the required contact-form key, and uploads
  that archived source tree with `lftp` over FTPS.
- Do not deploy a dirty working directory or arbitrary branch.

## Public Token Rules

- Public analytics/contact tokens may be injected at deploy time.
- Do not commit private FTP credentials or `.env` files.
- `WEB3FORMS_ACCESS_KEY` is required for production. GitHub Actions and the
  local fallback fail closed instead of publishing a dead contact form.

## Validation Commands

```bash
bun run build
python3 -m http.server 8765 --bind 127.0.0.1
bash -n scripts/deploy.sh
RELEASE_SHA=bad FTP_HOST=example.com FTP_USER=u FTP_PASS=p bash scripts/deploy.sh
ruby -e 'require "yaml"; ARGV.each { |f| YAML.load_file(f) }' .github/workflows/deploy.yml
actionlint -config-file .github/actionlint.yaml .github/workflows/*.yml
git diff --check
```

The invalid `RELEASE_SHA` command must fail before any FTP connection.

## Known Open Items

- Production token presence is environment-specific. Verify GitHub secrets and
  public runtime behavior before claiming live lead-generation readiness.
- Hostinger has no per-file rollback. Rollback is a redeploy of a known-good
  commit SHA.
