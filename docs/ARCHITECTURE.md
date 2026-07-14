# Architecture

The site is **one self-contained HTML file** with inline CSS, JavaScript, and
i18n dictionaries. No build step, no bundler, no framework. The file size is
roughly 150 KB before image assets and font requests.

The decision to keep everything in one file is deliberate. It eliminates a
class of issues (cache desync, asset 404s, build server downtime) that
plagued the original Zyro template the site grew out of. Anyone can open
`index.html` in a browser and see the same thing the production server serves.

## Page structure

```
<html data-theme="dark|light" data-lang="es|en">
  <head>
    SEO meta, JSON-LD Person schema, Open Graph, Twitter card,
    favicon (data URI SVG), Google Fonts (non-blocking)
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

    <script>I18N = { en: {…}, es: {…} }; Object.freeze(I18N);</script>
    <script>main app: theme, lang, cursor, magnetic, tilt, reveal, scroll</script>
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

The single inline `<script>` block runs on `DOMContentLoaded` and sets up
seven small modules in this order. Each one is independent.

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

The dictionary lives inline in the same file:

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

- Single HTML file, no external CSS/JS to fetch
- Google Fonts loaded with `media="print" onload` so it doesn't block
  first paint, with a `<noscript>` fallback
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
