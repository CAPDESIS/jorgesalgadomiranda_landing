# Design System

Single source of truth for the visual and interaction vocabulary of
`jorgesalgadomiranda.com`. If something in the site does not match this
document, the site is wrong, not the document.

Last updated: 2026-09-11.

---

## 1. Design tokens

All tokens live in `assets/styles.css` inside `:root` and
`[data-theme="light"]`. Never introduce ad-hoc colors or spacing.
Legal pages and the 404 surface load that stylesheet
(`html[data-surface="aux"]`) instead of a private hex palette.

### Colors

| Token | Dark value | Light value | Used for |
|-------|-----------|-------------|----------|
| `--bg` | `oklch(0.14 0.008 240)` | `oklch(0.985 0.003 80)` | Page background |
| `--bg-elev` | `oklch(0.17 0.01 240)` | `oklch(0.97 0.004 80)` | Cards, panel surfaces |
| `--bg-elev-2` | `oklch(0.20 0.012 240)` | `oklch(0.945 0.005 80)` | Hovered or nested surfaces |
| `--fg` | `oklch(0.97 0.005 240)` | `oklch(0.18 0.01 250)` | Primary text |
| `--fg-muted` | `oklch(0.72 0.012 240)` | `oklch(0.38 0.012 250)` | Secondary text, kickers |
| `--fg-dim` | `oklch(0.54 0.012 240)` | `oklch(0.52 0.012 250)` | Low-emphasis text |
| `--border` | `oklch(0.32 0.012 240)` | `oklch(0.76 0.008 250)` | Standard borders |
| `--border-soft` | `oklch(0.24 0.01 240)` | `oklch(0.85 0.006 250)` | Dashed dividers, subtle lines |
| `--accent` | `oklch(0.82 0.14 210)` | `oklch(0.52 0.15 210)` | Primary cyan. Interactive states, links, hover |
| `--accent-hi` | `oklch(0.90 0.15 210)` | `oklch(0.44 0.16 210)` | Emphasis on accent (rare) |
| `--accent-dim` | `oklch(0.55 0.12 210)` | `oklch(0.68 0.12 210)` | Very low-emphasis accent |
| `--accent-warm` | `oklch(0.78 0.14 60)` | `oklch(0.62 0.16 60)` | Secondary warm. Pills, callouts |
| `--accent-warm-hi` | `oklch(0.86 0.15 60)` | `oklch(0.52 0.17 60)` | Warm emphasis |
| `--accent-warm-dim` | `oklch(0.55 0.14 60)` | `oklch(0.72 0.14 60)` | Low-emphasis warm |

Rules:
- Cyan is primary. Use for hover states, active nav, numbered kickers,
  code keys, CTA backgrounds, timeline accents.
- Warm is secondary. Use for "in development" / "coming soon" pills,
  subtle hero panel gradient, future-planned callouts.
- Never mix both accents on the same element.
- Never use opacity-based hover. Use `color-mix(in oklab, ...)` or a
  solid hover color.

### Typography

| Family token | Files | Usage |
|---|---|---|
| `--font-serif` | `instrument-serif.woff2` | Section titles, hero, large editorial copy |
| `--font-sans` | `geist.woff2` (variable 300-700) | Body copy, buttons, nav links |
| `--font-mono` | `geist-mono.woff2` | Kickers, code, labels, level pills |

Scales follow `clamp(min, vw, max)` so copy breathes on desktop and
stays readable on mobile. Never hardcode a pixel size for display type.

### Spacing and layout

| Token | Value | Usage |
|---|---|---|
| `--maxw` | `1280px` | Outer max content width |
| `--pad-x` | `clamp(20px, 4vw, 80px)` | Section horizontal padding |
| `--gap` | `clamp(20px, 2.5vw, 48px)` | Generic gap |
| Section vertical padding | `clamp(104px, 8vw, 132px)` top, `clamp(80px, 10vw, 160px)` bottom | Used by every `.section` |

### Shadow and elevation

| Token | Dark | Light |
|---|---|---|
| `--shadow` | `0 20px 60px -20px oklch(0 0 0 / 0.6)` | `0 20px 50px -24px oklch(0.2 0.02 250 / 0.2)` |
| `--shadow-soft` | `0 8px 28px -12px oklch(0 0 0 / 0.5)` | `0 6px 20px -10px oklch(0.2 0.02 250 / 0.14)` |

---

## 2. Interaction primitives

These rules apply across the entire site. Breaking them makes the page
feel incoherent.

| State | Rule |
|---|---|
| Hover on a clickable card | `translateY(-3px)` lift + `var(--shadow-soft)` + border goes `var(--accent)`. Duration 300ms. |
| Hover on an editorial card (eng-card, case-card) | Top border accent line grows from 48px to 100%. Heading color shifts to accent. No translate. |
| Hover on a nav-style row (oss-card, contact-link) | Padding-left shifts by 6-8px. Border top color becomes accent. No translate. |
| Active/press on any button | `scale(0.96-0.97)` for 80ms. |
| Focus visible | 2px outline in `var(--accent)` with 2px offset. Applied globally in `styles.css`. |
| Reveal on scroll | `data-reveal` observer fades in + translates Y, 0.7s cubic-bezier. |
| Caret inside text fields | Accent color (browser default respects `caret-color` if set). |

Respect `@media (prefers-reduced-motion: reduce)` by stripping
transitions on every animated component.

---

## 3. Components

### Section head

```html
<div class="section-head">
  <span class="section-num">03</span>
  <span class="section-kicker" data-i18n="capdesis.kicker">Capdesis, my lab</span>
</div>
```

- Num is always 2 digits, accent color.
- Kicker is mono, uppercase, `letter-spacing: 0.14em`.
- Below `480px` viewport, font drops to 10px with tighter letter-spacing.
- Always rendered above the `section-title` heading.

### Section title

```html
<h2 class="section-title">
  <span data-reveal data-scramble>Products I ship</span>
  <em data-reveal data-scramble>as founder and CEO.</em>
</h2>
```

- Serif. `clamp(38px, 6.5vw, 88px)`.
- First span is regular, italic `<em>` uses accent color.
- Each line wrapped in `data-reveal` for scroll fade-in, optionally
  `data-scramble` for the type-in animation.

### Buttons

| Class | Purpose | Hover | Press |
|---|---|---|---|
| `.btn .btn-primary` | Primary CTA | Background `var(--accent)`, text `var(--bg)` | `scale(0.97)` |
| `.btn .btn-ghost` | Secondary CTA | Border and text `var(--accent)` | `scale(0.97)` |
| `.cal-cta` | Cal.com booking link | Background `var(--accent)`, text `var(--bg)`, `translateY(-2px)` | `scale(0.96)` |
| `.toggle` | Nav language/theme | Border `var(--accent)`, text `var(--fg)` | (no press) |
| `.form-submit` | Contact submit | Background shift to `var(--accent)` | `scale(0.96)` |

All buttons use `border-radius: 999px`, `font-size: 14px`, `font-weight: 500`.

### Cards

| Type | Used in | Hover rule |
|---|---|---|
| `.app-card` | Capdesis apps grid | Lift `-3px` + soft shadow + accent border |
| `.web-card` | Capdesis web projects | Lift `-2px` + accent border + image zoom 1.04 |
| `.eng-card` | Engineering practice | Top border line grows 48px to 100%, heading goes accent |
| `.case-card` | Cases section | Same as eng-card |
| `.oss-card` | Open source row | Padding-left shift 8px, top border accent |
| `.contact-tier-card` | Contact Cal.com tier | No hover lift, accent border on `:hover` |

All share: `border-radius: 16px` (cards) or `0` (editorial rows),
`background: var(--bg-elev)`, `border: 1px solid var(--border)`.

### Stack list item

```html
<li>
  <!-- logo: either img from devicon or inline svg mark -->
  <img class="stack-logo" src="..." alt="" />
  <span>Kotlin, Jetpack Compose</span>
  <span class="stack-level" data-lv="core">Core</span>
  <span class="stack-tip" role="tooltip">
    <strong>Android core</strong>
    Description with project references.
  </span>
</li>
```

- Grid `20px 1fr auto`. Logo column is fixed at 20px.
- Hover shows the `stack-tip` popover above the item.
- `data-lv` values: `core`, `daily`, `working`, `learning`. Each maps
  to a pill background via `:root` tokens.

### Timeline item

```html
<article class="tl-item">
  <div class="tl-content" role="button" tabindex="0" aria-expanded="false">
    <!-- meta, role, blurb, chevron -->
  </div>
  <div class="tl-body">
    <div class="tl-body-inner">
      <!-- bullets, chips, expanded copy -->
    </div>
  </div>
</article>
```

- Collapsed by default except the first (most recent) item.
- `.tl-body` uses `grid-template-rows: 0fr` to `1fr` for smooth
  height animation without JS measurement.
- Bullets inside `.tl-body-inner` fade in with an 80ms stagger when
  `.is-open` is added.
- Keyboard accessible: Enter or Space toggles.

### Testimonial slide

- Big opening quote mark in serif accent color.
- Blockquote in serif italic.
- Attribution line: role and location in mono.
- Controls: prev/next circular arrows at the bottom, hairline dots.

### Navigation

- Fixed top, blur background `color-mix(in oklch, var(--bg) 78%, transparent)`.
- Brand + 9 section links + lang/theme toggles above 1060px.
- Hamburger at `<=1060px` opens a right-slide drawer.
- Drawer is 320px max width, full height, backdrop blur, focus trap,
  Escape to close, auto-close on resize past the breakpoint.

---

## 4. Breakpoints

Primary breakpoints, from widest:

| Max width | What changes |
|---|---|
| 1280+ | Max content width caps. Ultrawide shows same layout centered. |
| 1100 | Nav link padding tightens. Hero goes single column. |
| 1060 | Nav links hide, hamburger appears. |
| 900 | Most 2-column grids collapse to 1. |
| 800 | Stack grid collapses to 1 column. |
| 620 | Nav brand text hides. |
| 600 | Tech-strip from 10 columns to 3. |
| 480 | Kicker font drops. Panel body switches to `pre-wrap`. |
| 440 | Nav paddings tighten further, toggles shrink. |

When adding responsive rules, prefer one of the above values. Do not
introduce ad-hoc breakpoints like `@media (max-width: 777px)`.

---

## 5. Watermarks (do not strip)

Distributed throughout for fork tracing:

- HTML comment at top of `index.html`
- `<html data-origin="jsm">`
- `<body data-origin="jsm">`
- `<meta name="template-origin" content="jsm-portfolio-v1" />`
- `:root { --jsm-origin: "jorgesalgadomiranda.com"; }`
- `@id: "https://jorgesalgadomiranda.com/#person"` on the Person JSON-LD
- `console.info("%cBuilt by Jorge Salgado Miranda ...")` in the IIFE

---

## 6. When to extend this document

Update this file when you:
- Add a new token to `:root` or `[data-theme="light"]`.
- Introduce a new component class or pattern.
- Change a breakpoint or shift a shared interaction rule.
- Add a new accent or semantic color.

When you remove a pattern from the site, remove it from here too.
