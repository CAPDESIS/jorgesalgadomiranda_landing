# Image audit evidence — 2026-07-13

User screenshots of production (`jorgesalgadomiranda.com`) while
`assets.zyrosite.com` returned HTTP 404 for every hotlinked asset.

| File | Section | Symptom |
|---|---|---|
| `01-map-portrait-broken.png` | About portrait (alt "Jorge Salgado Miranda") | Broken `<img>` / empty frame with site pin overlay |
| `02-partners-marquee-broken.png` | Partners marquee | Capdesis, Tienda UNAM, Flexera, Udemy logos broken |
| `03-skills-tech-strip-broken.png` | Skills / tech strip | Flutter, Swift, Kotlin, Compose, Go, AWS, Docker, K8s, Postgres, GraphQL, Firebase, Neovim broken |

Fix: self-host under `assets/images/`, `assets/brands/`, `assets/logos/`
(PR #18). Regression guard: `scripts/check-asset-integrity.py`,
`tests/asset-integrity.test.ts`, deploy preflight + smoke probes.
