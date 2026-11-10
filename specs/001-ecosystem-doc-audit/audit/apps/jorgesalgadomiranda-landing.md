# Audit Inventory: `jorgesalgadomiranda_landing` (`CAPDESIS/jorgesalgadomiranda_landing`)

- **Task**: `[Spec Kit][T031]` (`#5`)
- **Repository**: `CAPDESIS/jorgesalgadomiranda_landing`
- **Default branch**: `main`
- **Audit date**: `2026-11-10`

## Workspace Inventory Table

| path | kind | git_root | nearest_guidance | manifests | documentation_roots | status | notes |
|------|------|----------|------------------|-----------|---------------------|--------|-------|
| `.` | `app` | `.` | `AGENTS.md` | `package.json`, `bunfig.toml` | `README.md`, `HANDOFF.md`, `MASTER_SPEC.md`, `docs/`, `audits/` | `completed` | Bilingual (ES/EN, 343 keys each) static portfolio and consulting lead-generation site (`jorgesalgadomiranda.com`) with zero runtime framework or bundler. |
| `index.html`, `404.html`, `legal/`, `cv/` | `frontend` | `.` | `AGENTS.md` | `package.json` | `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/CERTIFICATIONS.md` | `completed` | Primary single-page landing (`index.html`, 2980 lines), bilingual 404 surface (`404.html`), published legal pages (`legal/privacy.html`, `legal/terms.html`, `legal/cookies.html`), and ATS-parseable HTML CVs (`cv/Jorge_Salgado_Miranda_CV_EN.html`, `cv/Jorge_Salgado_Miranda_CV_ES.html`). |
| `assets/`, `fonts/` | `frontend` | `.` | `AGENTS.md` | `package.json` | `docs/DESIGN_SYSTEM.md`, `docs/TECHNOLOGIES.md` | `completed` | Dual-theme OKLCH stylesheet (`assets/styles.css`, 3172 lines), bilingual dictionary (`assets/i18n.js`, 731 lines), modular browser scripts (`assets/js/consent.js`, `cookie-banner.js`, `email-validation.js`, `i18n-utils.js`, `welcome-modal.js`), self-hosted `.woff2` fonts (`fonts/`), CV PDFs (`assets/cv/`), and vendored SVG/WebP/PNG media. |
| `api/` | `backend` | `.` | `AGENTS.md` | `api/secrets.example.php` | `docs/RESEND_SETUP.md`, `docs/GITHUB_SECRETS.md` | `completed` | Same-origin PHP contact proxy (`api/contact.php`) backed by `api/lib/bootstrap-env.php`, `contact-validator.php`, `rate-limit.php`, `turnstile.php`, and `resend-mail.php`. `api/secrets.php` is gitignored and generated at deploy time. |
| `.github/workflows/`, `scripts/`, `.htaccess` | `infrastructure` | `.` | `AGENTS.md` | `.github/actionlint.yaml`, `.pre-commit-config.yaml`, `.gitleaks.toml` | `docs/DEPLOY.md`, `docs/GITHUB_SECRETS.md`, `docs/MANUAL_SETUP.md` | `completed` | Five GitHub Actions workflows (`ci.yml`, `test.yml`, `deploy.yml`, `gitleaks.yml`, `release-policy.yml`), Apache security/caching config (`.htaccess`), and Python/Bash validation, cache-busting (`scripts/stamp-assets.py`), deploy-gate (`scripts/deploy-gates.py`), and FTPS mirror (`scripts/deploy.sh`, `scripts/prune-excluded.py`) tooling. |
| `tests/` | `frontend` | `.` | `AGENTS.md` | `package.json`, `bunfig.toml` | `README.md` | `completed` | 14 `*.test.ts` suites plus `tests/setup.ts` and `tests/support/{excludes,release}.ts`, enforcing `>= 85%` line/function coverage via `bunfig.toml`. |
| `docs/`, `audits/`, `HANDOFF.md`, `README.md`, `MASTER_SPEC.md` | `documentation` | `.` | `AGENTS.md` | `none-found` | `docs/`, `audits/` | `completed` | Operational, design-system, architecture, ticket, and audit history Markdown; excluded from Hostinger FTPS uploads via `.github/workflows/deploy.yml` and `scripts/prune-excluded.py`. |
| `node_modules/`, `coverage/` | `dependency` | `.` | `AGENTS.md` | `bun.lock` | `none-found` | `excluded` | Untracked local dev/test dependency and coverage output directories (`@happy-dom/global-registrator` only). |

## Application Record Table

| name | root_path | repo_path | stack | source_roots | test_roots | validation_plan | master_spec_path | readiness |
|------|-----------|-----------|-------|--------------|------------|-----------------|------------------|-----------|
| `jorgesalgadomiranda-landing` | `.` | `CAPDESIS/jorgesalgadomiranda_landing` | Static HTML5/CSS3 (OKLCH), Vanilla JavaScript (`assets/i18n.js`, `assets/js/*.js`), PHP 8 (`api/contact.php`), Python 3 & Bash deploy/validation scripts, Bun test runner (`@happy-dom`), Apache `.htaccess` on Hostinger FTPS + Cloudflare | `index.html`, `404.html`, `legal/`, `cv/`, `assets/`, `fonts/`, `api/`, `scripts/`, `.htaccess`, `.github/workflows/` | `tests/`, `scripts/test-contact-api.php`, `scripts/validate-static-site.py`, `scripts/check-asset-integrity.py`, `scripts/check-local-assets.py` | `python3 scripts/validate-static-site.py`, `python3 scripts/check-asset-integrity.py`, `python3 scripts/check-local-assets.py`, `bun test --coverage`, `php scripts/test-contact-api.php` | `MASTER_SPEC.md` | `ready` |

## Markdown Ownership Map

| Path | Ownership Role | Reconciliation Disposition |
|------|----------------|----------------------------|
| `MASTER_SPEC.md` | Canonical technical and client-readiness source of truth | Reconciled in place (`T071`) with full source, workflow, PHP proxy, test, and drift evidence. |
| `AGENTS.md` | Repository engineering guidance and `capdesis-ui` fleet policy | Active guidance; retained. |
| `README.md` | Public repository overview, local preview commands, and template fork license/attribution rules | Active public entry doc; minor line-count drift noted in `drift/jorgesalgadomiranda-landing.md`. |
| `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TECHNOLOGIES.md`, `docs/CERTIFICATIONS.md` | Domain reference docs for layout, OKLCH tokens, stack rationale, and credential catalog | Active reference docs; `docs/DESIGN_SYSTEM.md` updated to `oklch(0.49 0.15 210)` for light `--accent` (`#61`). |
| `docs/DEPLOY.md`, `docs/GITHUB_SECRETS.md`, `docs/RESEND_SETUP.md`, `docs/MANUAL_SETUP.md` | Deployment, secret provisioning, and external dashboard setup guides | Active operational docs with documented stale claims where runner/gate policy evolved (`deploy.yml` now uses `ubuntu-latest` and automated `deploy-gates.py`). |
| `docs/CHANGELOG.md`, `docs/TICKETS.md`, `HANDOFF.md`, `audits/*.md` | Chronological history, backlog log, and historical wave closure notes | Historical/living logs; subordinated to `MASTER_SPEC.md` whenever claims diverge from current code or workflows. |
