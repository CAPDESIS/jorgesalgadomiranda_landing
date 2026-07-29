# Architecture

The site is a **zero-build static landing** centered on `index.html`, with
styling and part of the runtime extracted into self-hosted assets:
`assets/styles.css`, `assets/i18n.js`, and helper scripts under `assets/js/`.
`index.html` still keeps a few inline bootstraps and page-specific wiring IIFEs.
No build step, no bundler, no framework.

The decision to keep the site zero-build is deliberate. It eliminates a class
of issues (build server downtime, framework churn, asset indirection) that
plagued the original Zyro template the site grew out of. Anyone can open
`index.html` in a browser and inspect the same document structure production
serves.

Historical note: earlier revisions were truly single-file with inline CSS, JS,
and dictionaries. The current layout keeps the same operating model while
moving reusable CSS/JS into self-hosted assets so they can be tested, cache-
busted, and reused more safely.

## Page structure

```
<html data-theme="dark|light" data-lang="es|en">
  <head>
    SEO meta, JSON-LD Person schema, Open Graph, Twitter card,
    favicon (data URI SVG), preconnect/preload hints,
    <link rel="stylesheet" href="assets/styles.css">
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div id="cursor-dot"></div>
    <div id="cursor-blob"></div>
    <div id="scroll-indicator">…</div>

    <nav class="nav">
      <a class="nav-brand">Jorge Salgado / Software Architect</a>
      <ul class="nav-links">…</ul>
      <button id="lang-toggle">ES / EN</button>
      <button id="theme-toggle">sun / moon</button>
    </nav>

    <main id="main">
      <section class="hero">…</section>
      <section class="marquee">…</section>
      <section id="about">…</section>
      <section id="experience">…</section>
      <section id="capdesis">…</section>
      <section id="stack">…</section>
      <section id="engineering">…</section>
      <section id="certifications">…</section>
      <section id="udemy">…</section>
      <section id="testimonials">…</section>
      <section id="cv">…</section>
      <section id="contact">…</section>
    </main>

    <footer>…</footer>

    <script src="assets/i18n.js"></script>
    <script src="assets/js/i18n-utils.js"></script>
    <script src="assets/js/welcome-modal.js"></script>
    <script src="assets/js/email-validation.js"></script>
    <script>main app: theme, lang, cursor, magnetic, tilt, reveal, scroll</script>
    <script src="assets/js/cookie-banner.js"></script>
    <script>cookie banner DOM wiring IIFE</script>
  </body>
</html>
```

## Design tokens

All colors live as CSS custom properties on `:root` and `[data-theme="light"]`.
The OKLCH color space is used everywhere because it provides predictable
perceptual lightness across the whole gamut.

```css
:root {
  --bg: oklch(0.14 0.008 240);
  --bg-elev: oklch(0.17 0.01 240);
  --fg: oklch(0.97 0.005 240);
  --fg-muted: oklch(0.72 0.012 240);
  --border: oklch(0.32 0.012 240);
  --accent: oklch(0.82 0.14 210);
  --font-serif: 'Instrument Serif', serif;
  --font-sans:  'Geist', sans-serif;
  --font-mono:  'Geist Mono', monospace;
  --maxw: 1280px;
  --pad-x: clamp(20px, 5vw, 64px);
}
```

Light theme overrides only the color tokens, keeps everything else identical.

## JavaScript modules

The runtime is split between extracted helper files and two inline IIFEs in
`index.html`. Load order matters because the inline scripts consume contracts
attached to `window` by the extracted files.

1. **`assets/js/consent.js`**: loaded near the top of `index.html` so consent
   state is available before analytics bootstraps.
2. **`assets/i18n.js`**: publishes the frozen EN/ES dictionaries on
   `window.__I18N__`.
3. **`assets/js/i18n-utils.js`**: shared translation helpers consumed by the
   landing runtime.
4. **`assets/js/welcome-modal.js`**: modal timing/state helpers.
5. **`assets/js/email-validation.js`**: disposable-domain list, regex, and the
   `validateEmail()` decision used by the contact form.
6. **Main inline app IIFE**: runs on `DOMContentLoaded` and sets up the page
   interactions below.
7. **`assets/js/cookie-banner.js` + trailing inline IIFE**: cookie-banner copy,
   persistence, and DOM event wiring.

Inside the main inline app IIFE, the landing initializes these behaviors:

1. **Copyright year**: sets the footer year from `new Date().getFullYear()`
   so it never goes stale.
2. **Theme**: reads `localStorage.theme`, falls back to
   `prefers-color-scheme`, wires the toggle button, syncs `aria-pressed` and
   `aria-label` on each click.
3. **Language**: reads `localStorage.lang`, falls back to
   `navigator.language` (truncated to `es`/`en`), iterates every
   `[data-i18n]` and sets `el.innerHTML = dict[k]`. Also updates
   `document.title` and `<meta name="description">`.
4. **Custom cursor**: dot + delayed blob animated with
   `requestAnimationFrame`. Disabled entirely under
   `prefers-reduced-motion` or `pointer: coarse` so it never runs on
   touch or accessibility-sensitive setups.
5. **Magnetic + tilt**: `[data-magnetic]` follows the cursor at 25%,
   `[data-tilt]` rotates with `perspective(1000px) rotateX/Y`. Same
   accessibility gate as the custom cursor.
6. **Scroll progress**: top-of-viewport bar that fills as the page
   scrolls. Listens to `scroll` with `passive: true`.
7. **Reveal + count-up + scramble**: one `IntersectionObserver` watches
   every `[data-reveal]`. On entry: adds `.in-view`, runs count-up on any
   `[data-count]` child, runs scramble on any `[data-scramble]` child,
   then unobserves.

## i18n

The dictionary lives in `assets/i18n.js` and is loaded before the main app
script:

```js
const I18N = {
  en: { "nav.about": "About", … },
  es: { "nav.about": "Sobre mí", … }
};
Object.freeze(I18N);
Object.freeze(I18N.en);
Object.freeze(I18N.es);
window.__I18N__ = I18N;
```

Every translatable element carries `data-i18n="some.key"`. On language
switch, the page iterates and sets `innerHTML` to the dict value. The HTML
default text (between the open and close tag) is the EN copy, so the page
renders correctly even if JavaScript fails or `localStorage` is unavailable.

The dictionaries are frozen so an attacker cannot mutate
`window.__I18N__` from another script in the page.

The current dictionary has **202 keys per language**, in perfect parity.

## Accessibility

- Skip link to `#main` as the first focusable element
- `:focus-visible` rings via CSS (no JS needed)
- `aria-pressed` on the theme toggle, dynamic `aria-label` on both toggles
- All `<svg>` decorative icons marked `aria-hidden="true"`
- `prefers-reduced-motion` collapses every transition to 0.01ms and
  short-circuits the cursor / magnetic / tilt JS
- `aria-hidden="true"` on the marquee since it's purely decorative
- All `target="_blank"` links carry `rel="noopener noreferrer"`
- `scroll-margin-top: 96px` on every section so anchored navigation lands
  below the fixed nav

## Performance

- One HTML entrypoint with self-hosted CSS/JS assets; no bundler output tree
- `assets/styles.css`, `assets/i18n.js`, and the helper scripts are requested
  directly from stable paths the deploy workflow cache-busts by SHA
- `preconnect` hints for Capdesis image hosts still hotlinked from cards
  (`capdesis.com`); partner/skill/portrait assets are self-hosted under
  `assets/` (Zyrosite CDN retired after 2026-07-13 404s)
- About portrait uses `loading="lazy"` with explicit width/height; self-hosted
  at `assets/images/foto_perfil.png`
- Every `<img>` has explicit `width`/`height` to avoid CLS
- All other images are `loading="lazy" decoding="async"`

## Browser support

Tested in current versions of Chrome, Safari, Firefox. Uses `oklch()`,
`color-mix()`, `aspect-ratio`, `clamp()`, `:focus-visible`,
`prefers-reduced-motion`, `prefers-color-scheme`. None of these have a
graceful degradation path for browsers older than 2023, but the content
remains readable. Only the styling and animations are affected.
