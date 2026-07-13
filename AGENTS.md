# Jorge Salgado Miranda Landing Page

Personal landing page at jorgesalgadomiranda.com. Static HTML/CSS site.
See `HANDOFF.md` for maintenance notes.

See parent `/Users/jorge/Documents/Apps/AGENTS.md` for workspace defaults.

## Shared UI library: capdesis-ui (consume, do not duplicate)

This repo is part of the Capdesis fleet, which has a shared, versioned component
library: **`github.com/CAPDESIS/capdesis-ui`** (private). Before building or
duplicating any UI, check its catalog: `capdesis-ui/COMPONENTS.md`.

- It ships 40+ TDD-validated components for **Astro** (`@capdesis/ui-astro`) and
  **Flutter** (`package:capdesis_ui`), with a React port in progress: buttons,
  text fields (with password reveal), store-download badges, social links,
  status badges, cards, avatars, dialogs, toggles, loading states, layout
  scaffolds, and more.
- **Consume** these instead of re-implementing UI. Pin the release tag (current
  `v0.2.0`) and bump it to pick up newer components fleet-wide.
- If a component you need is **missing**, EXTRACT it into capdesis-ui (so every
  app gets it) rather than hand-rolling a one-off copy here.

This is the fleet modularization model: reusable components plus a versioned
library that apps pin and upgrade.
