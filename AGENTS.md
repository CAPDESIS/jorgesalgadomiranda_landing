# Jorge Salgado Miranda Landing Page

Personal landing page at jorgesalgadomiranda.com. Static HTML/CSS site.
See `HANDOFF.md` for maintenance notes.

See parent `/Users/jorge/Documents/Apps/AGENTS.md` for workspace defaults.

## Shared UI library: capdesis-ui

This personal static site uses standalone HTML/CSS/vanilla JS (`index.html`,
`script.js`, `styles.css`) plus a PHP contact proxy (`api/contact.php`) and has
**zero runtime dependencies** on `capdesis-ui` (`@capdesis/ui-astro` or
`capdesis_ui`). Do not add `capdesis-ui` pins here unless the site is
intentionally migrated to Astro/React; see `capdesis-ui/CONSUMPTION.md` for
active fleet pins (`CapdesisWebLanding`, `Formulae`, Flutter apps).
