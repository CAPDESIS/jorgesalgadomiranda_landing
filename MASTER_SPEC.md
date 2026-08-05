# jorgesalgadomiranda_landing MASTER_SPEC

## Executive Summary

`jorgesalgadomiranda_landing` is an active audit target in the `jorgesalgadomiranda_landing` family. This document records only evidence found in code, manifests, configuration, tests, deployment files, Markdown paths, and generated validation records under `/Users/jorge/Documents/Apps`.

Client readiness: **Partial**. The code and project surfaces are documented, but runtime readiness must not be represented as ready until skipped stack validations are executed or explicitly accepted.

## Current Capabilities

- Verified current capability: this target contains the project surfaces listed below.
- Product behavior claims are intentionally limited to source-backed evidence in this file.
- Any behavior that exists only in old Markdown remains unresolved until traced to source evidence.

### Detected stacks
- `Infrastructure/VPS`
- `JavaScript/TypeScript/Web`

### Manifest evidence
- `jorgesalgadomiranda_landing/package.json`

### Source roots
- `jorgesalgadomiranda_landing`

### Test roots
- none-found

## Architecture and Source Map

- Root path: `jorgesalgadomiranda_landing`
- Git root: `jorgesalgadomiranda_landing`
- Git remote: `git@github.com:chochy2001/jorgesalgadomiranda_landing.git`
- Nearest guidance: `AGENTS.md`

## Key Workflows

- Audit workflow: read guidance, inspect manifests/source/configuration/tests, reconcile Markdown, record validation, then update this master spec.
- Development validation workflow: run the commands listed under `Validation Evidence` for the detected stack before moving readiness above Partial.

## Integration Boundaries

### Endpoint or API configuration evidence
- none-found

### Boundary classification
- Integration boundaries are considered partial until both source-side and target-side evidence are validated.
- Endpoint and route synchronization must be checked against the code paths above and any client configuration paths in the same target.

## Data, Storage, and Deployment

### Deployment, infrastructure, or operational evidence
- `jorgesalgadomiranda_landing/.github/workflows`
- `jorgesalgadomiranda_landing/scripts`

No raw environment values, credentials, tokens, private keys, or sensitive deployment secrets are copied into this document.

### Migrated Root Handoff Notes

Root cleanup reviewed JSM landing handoffs and retained these durable notes:

- Root audits tracked PostHog wiring, CSP extension, and gitleaks hardening for this repo.
- Because the repo owner is outside the CAPDESIS org, the `ancare` self-hosted runner may not be available. Workflows for this repo should stay on hosted runners unless runner scope is explicitly changed.
- Public curl responses can be affected by Hostinger/Cloudflare bot protection; browser-like smoke tests are stronger evidence for client-facing readiness.

## Validation Evidence

| scope | command | status | reason | next_action |
|-------|---------|--------|--------|-------------|
| docs | `manual-review` | pass | Filesystem, manifest, Markdown, and route-pattern evidence recorded by audit generator. | none |
| web | `bun run lint` | skipped | Runtime or toolchain validation was not executed during documentation generation. | Run `bun run lint` from `jorgesalgadomiranda_landing` and update validation evidence. |
| web | `bun run build` | skipped | Runtime or toolchain validation was not executed during documentation generation. | Run `bun run build` from `jorgesalgadomiranda_landing` and update validation evidence. |
| infra | `docker compose config / bash -n reviewed scripts` | skipped | Runtime or toolchain validation was not executed during documentation generation. | Run `docker compose config / bash -n reviewed scripts` from `jorgesalgadomiranda_landing` and update validation evidence. |

## Documentation Drift Findings

### False pending items

No false-pending item is confirmed automatically. Pending-like Markdown markers requiring source trace:

- `jorgesalgadomiranda_landing/CLAUDE.md:318`
- `jorgesalgadomiranda_landing/HANDOFF.md:312`
- `jorgesalgadomiranda_landing/HANDOFF.md:320`
- `jorgesalgadomiranda_landing/docs/CHANGELOG.md:312`
- `jorgesalgadomiranda_landing/docs/GITHUB_SECRETS.md:35`
- `jorgesalgadomiranda_landing/docs/MANUAL_SETUP.md:53`
- `jorgesalgadomiranda_landing/docs/MANUAL_SETUP.md:228`
- `jorgesalgadomiranda_landing/docs/TICKETS.md:17`

### Ghost code

Endpoint/source surfaces detected above have been added to this master spec. No client-facing product claim is made beyond those evidence paths.

### Stale claims

No stale claim is promoted as confirmed without line-level semantic review.

### Unresolved claims

Any Markdown-only behavior statement without source evidence remains unresolved and must not be used as a client fact.

## Known Limits and Risks

- Runtime compile/test/build validation is incomplete where records are `skipped`.
- Endpoint synchronization is path-evidence based until route contracts and client calls are executed or reviewed line by line.
- Product-level value propositions must remain conservative until feature behavior is traced from source.

## Client Readiness

Readiness label: **Partial**.

This target is suitable for technical discovery and client scoping conversations. It is not ready to be presented as production-ready until stack validation and integration boundary checks pass or skipped checks are accepted with written rationale.

## Next Steps

- Execute skipped validation commands and update `specs/001-ecosystem-doc-audit/audit/validation-evidence.md`.
- Reconcile pending-like Markdown markers, if any, against source evidence.
- Review endpoint and API configuration evidence against corresponding clients/services.
- Promote readiness only after validation supports the stronger label.

## Superseded or Historical Documentation

Markdown files reviewed for ownership and drift:

- `jorgesalgadomiranda_landing/CLAUDE.md`
- `jorgesalgadomiranda_landing/HANDOFF.md`
- `jorgesalgadomiranda_landing/README.md`
- `jorgesalgadomiranda_landing/docs/ARCHITECTURE.md`
- `jorgesalgadomiranda_landing/docs/CERTIFICATIONS.md`
- `jorgesalgadomiranda_landing/docs/CHANGELOG.md`
- `jorgesalgadomiranda_landing/docs/DEPLOY.md`
- `jorgesalgadomiranda_landing/docs/DESIGN_SYSTEM.md`
- `jorgesalgadomiranda_landing/docs/GITHUB_SECRETS.md`
- `jorgesalgadomiranda_landing/docs/MANUAL_SETUP.md`
- `jorgesalgadomiranda_landing/docs/TECHNOLOGIES.md`
- `jorgesalgadomiranda_landing/docs/TICKETS.md`

---

# Archived: hand-maintained Master Spec (2026-06-29)

The section below is the earlier hand-maintained spec preserved verbatim so no
content is lost. It predates the audit-format spec above.

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
