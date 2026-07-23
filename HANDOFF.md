# Session Handoff, 2026-07-08

## Latest round (2026-07-08)

- `.github/workflows/deploy.yml` is the validated direct production path for
  this landing. It runs only by manual `workflow_dispatch` with an exact
  `origin/main` SHA and confirmation gates; push/schedule workflows validate but
  do not deploy.
- Commit `bc3f382` deployed successfully in GitHub Actions run `28984333192`
  in 26 seconds. Steps passed: release context, host preflight, cache-bust,
  token injection, contact-form guard, FTPS upload and asset smoke.
- External smoke returned HTTP 200 for `/`, `/robots.txt` and
  `assets/styles.css?v=bc3f382`.
- - Residual warning: `RESEND_API_KEY` is not configured, so `/api/contact.php`
  returns 503 until Resend secrets are set and redeployed.
- GitHub emitted a non-blocking Node runtime annotation for
  `SamKirkland/FTP-Deploy-Action@v4.3.5`; track under toolchain drift.

---

# Session Handoff, 2026-04-22

## Latest round (2026-04-22)

User unblocked 4 of the 6 things previously waiting on them and sent
the raw data. Everything that can be shipped from their inputs is now
live.

- **Cal.com CTA fixed.** User registered the `jorge-salgado-miranda-lt3qxa`
  profile and created the `/30min` event. Primary Book a call link
  updated; verified 200 on both profile and event URLs.
- **Certifications section rebuilt from scratch with the real 44
  credentials.** Dropped the fabricated In-progress percentages. New
  3-column layout: Featured (8 recent, high-signal cards), Catalog
  (33 credentials grouped by Mobile, Go, Platform, Security &
  Architecture, Foundation), Roadmap (5 targets). `docs/CERTIFICATIONS.md`
  rewritten as the source of truth. CV cert list also expanded, now
  includes 26 line items ATS-friendly.
- **5 real Udemy review quotes live on the landing.** New
  `.udemy-reviews` grid under the course list with initial-avatar,
  reviewer name, course, 5-star mark, and quote. Reviews kept in their
  original language (Spanish or Portuguese).
- **Per-course Udemy ratings tightened to 2 decimals.** C 4.66, Git
  4.52, Go 4.52, Intro 4.63, Photoshop 4.52, VIM 4.21. Headline stat
  stays at 4.6 (weighted average).
- **Legal pages published.** Removed DRAFT / Borrador banners, bumped
  last-updated to 2026-04-22, added Privacy and Terms links in the
  footer (EN/ES i18n), re-added both URLs to sitemap.xml with
  priority 0.4.
- **Previously unknown IngenieriaTracker latency claim:** user said to
  leave as-is, so no edit.

i18n parity: 341 keys each in EN and ES (was 335, net +6 after removing
3 obsolete keys and adding 9 new ones). No em/en dashes anywhere.

---

# Session Handoff, 2026-04-21

This file captures the state of the site after a very long session.
It exists so the next session starts fast and no context is lost.
Keep this file updated at the end of each session; delete entries that
ship.

## Latest round (2026-04-21)

Shipped across commits `84eb006`, `b58112e`, `87f2ce8`, plus the big
post-audit polish commit you are about to push.

- **CDN cache mismatch root-caused and permanently fixed.** Site was
  showing unstyled drawer links in the top-left because Cloudflare had
  cached the pre-hamburger `assets/styles.css` for the full 7 days the
  `.htaccess` ExpiresByType rule allows. The new HTML markup met the
  old stylesheet, so the drawer leaked into document flow. Fix is two
  layers: (1) the deploy workflow rewrites `href="assets/styles.css"`
  to `href="assets/styles.css?v=SHORT_SHA"` before FTP upload, so every
  deploy ships a unique cache key; (2) `.htaccess` caps HTML at
  `max-age=300, must-revalidate` so the versioned asset URL inside
  propagates in minutes, not a day.
- **2026-07-08 domain-link deploy caveat:** push deploy `fd23fc4` uploaded the
  new `capmenu.com` CTA and the cache-busted URL `/?v=fd23fc4` served it, but
  Hostinger CDN kept bare `/` as `x-hcdn-cache-status: HIT` with stale HTML.
  `.htaccess` now also sets explicit HTML/XML Expires rules and `s-maxage=300`,
  and the deploy smoke checks cache-busted HTML content when Cloudflare allows
  the runner request.
- **CSP fix for stack logos.** 27 devicon SVGs were CSP-blocked because
  `img-src` did not include `cdn.jsdelivr.net`. First loosened the
  allowlist as a hotfix; then self-hosted all 22 unique logos under
  `assets/logos/` and re-tightened the CSP. Net result: one fewer
  external origin, one fewer DNS lookup, tighter allowlist.
- **Audit-driven polish.**
  - `sitemap.xml` no longer advertises the DRAFT legal pages. `lastmod`
    bumped to 2026-04-21 across all remaining URLs.
  - `og.png` compressed 294 KB to 39 KB via `pngquant --quality 75-92
    --strip` at 1200x630. Visible fidelity preserved.
  - `<meta name="theme-color">` added to both `index.html` and
    `404.html`, with dark and light media queries so mobile Chrome
    paints the address bar in the right surface color.
  - CV PDFs rebuilt from the updated HTML so `assets/cv/*.pdf` is back
    in sync with the landing copy. `pdftotext` confirms: VCC 2.0,
    Jetpack Compose migration, GraphQL client, Linux (Debian, Ubuntu,
    Kali), Udemy Senior Instructor. Zero em/en dashes, zero Kafka
    references, per CLAUDE.md.
- **New: `docs/TICKETS.md`** as the living audit log across sessions.
  Shipped, in-progress, blocked (needs user), backlog, wontdo. Replaces
  the mental list we kept carrying between sessions.

### Live performance snapshot (after the polish)

Measured on `https://jorgesalgadomiranda.com/` with a cache-busted URL,
1440 x 900 viewport, warm DNS, cold CF edge for versioned assets.

| Metric | Value |
|---|---|
| TTFB | 347 ms |
| First Contentful Paint | 640 ms |
| DOMContentLoaded | 776 ms |
| Load event | 777 ms |
| Page weight (request tree) | 37 KB |
| HTML gzip | 39 KB |
| CSS gzip | 14 KB |
| i18n.js gzip | 21 KB |
| Console errors post-fix | 0 (was 55) |
| Broken images | 0 (was 27) |

### What is blocked on the user

Tracked in `docs/TICKETS.md` under BLOCKED. The short list:

- Paste LinkedIn certifications list (T-101).
- Validate the 66 percent latency claim for IngenieriaTracker (T-102).
- Capture real Udemy reviews with an authenticated session (T-103).
- Optional but easy: Cloudflare Cache Rule for `*.css?*` and `*.js?*`
  to restore edge caching on versioned URLs (T-104).

---

## Latest round (2026-04-20, extended)

Shipped in commits `3b64f8f`, `59ee084`, `3cdf862`, `004cb0b`.

- **Mobile horizontal scroll fixed.** Root cause: `.tech-tip` tooltip
  (280px wide, centered on 108px chip) extended past the viewport in
  the engineering section, pushing `documentElement.scrollWidth` to
  410 on a 390 viewport. Fix: `html` and `body` now both use
  `overflow-x: clip` instead of only `body { overflow-x: hidden }`.
  Verified 375 on 390 iPhone 12 viewport post-fix.
- **Hamburger drawer for mobile nav.** New `.nav-burger` button appears
  at `<=1060px` alongside the existing language/theme toggles. Opens a
  right-side `.nav-drawer` with backdrop blur, 9 section links in serif
  large type, focus trap, Escape to close, backdrop click to close,
  auto-close on resize back to desktop. Hamburger icon animates into an
  X when expanded. `prefers-reduced-motion` honored.
- **JSON panel typewriter.** The `.panel-body` now reveals characters
  one by one via a text-node walker that preserves the existing span
  coloring (accent for keys, fg for strings, number color for nums).
  Total duration capped at 4.8s, measured 3.45s for current 313-char
  content. Caret blinks faster while typing, slower when done. Old
  per-span stagger fade-in CSS removed to avoid competing with the
  char reveal.
- **Section anchor top whitespace fix.** Click-to-section was leaving
  ~170px of dead space between the nav and the section heading (nav
  height 69 + scroll-margin-top 96 + section padding-top 144 stacking).
  Fix: set `section[id] { scroll-margin-top: 0 }` so hash-scroll aligns
  section top with viewport top, letting the section's own padding-top
  provide the visual gap under the nav. Tuned padding to
  `clamp(104px, 8vw, 132px)` so the gap between nav bottom and heading
  lands around 43-46px on mobile and desktop.
- **Hero scramble vs JSON typewriter de-conflict.** User reported the
  JSON panel flickered during the hero title scramble. Root cause: the
  hero grid was `1fr 400px`, so serif characters with varying widths
  (chars like `#$%&@` during scramble) pushed the 400px panel column
  sideways. Fix: `minmax(0, 1fr) 400px`, plus `contain: layout paint
  style` on `.hero-panel` to isolate its render tree. Typewriter start
  bumped from 250ms to 2000ms so the two motion surfaces never overlap.
  Also only mutate text nodes whose visible char count actually changed.
  Measured jitter: 0px across the whole scramble window, down from
  visible shake.
- **Secondary warm accent.** Added `--accent-warm` tokens (dark and
  light themes) for callouts. Warm takes over the "in development"
  pill; a soft warm/cyan radial gradient pair now sits under the hero
  JSON panel so it reads less flat without fighting the primary cyan.
- **Microanimations pass (H1).** `.btn:active`, `.cal-cta:active`,
  `.form-submit:active`, `.test-arrow:active` all scale to 0.96-0.97
  for 80ms so taps feel physical. `.app-card` now lifts -3px with soft
  shadow on hover to match the rest of the card vocabulary. Timeline
  `.tl-body-inner > *` children fade in with an 80ms stagger when
  `.is-open` is added.
- **Stack inline logos (H2).** Every `.stack-list li` gets an 18x18
  logo slot before the name. Brand marks via devicon CDN
  (Kotlin, Swift, Flutter, Go, Postgres, AWS, Firebase, Docker, GitHub,
  Linux, Neovim, Android Studio, Figma, Git, TypeScript, Next.js,
  Tailwind, React, Vite). Abstract concepts get inline Lucide-style
  SVG marks in currentColor so they tint with theme. 36/36 items
  covered. New `.stack-logo` (img) and `.stack-logo-mark` (svg wrapper)
  styles.
- **Stack additions (H6).** Added Riverpod next to BLoC on the Flutter
  line. Added RxSwift on the reactive-streams line alongside RxJava,
  Kotlin Flows, Combine. Tooltips updated.
- **CV sync EN + ES (H8).** Venmo job title is now `Senior Mobile
  Engineer, Venmo Credit Card`; blurb reflects the Android-first
  reality; added VCC 2.0, XML to Compose, GraphQL client, accessibility
  pass bullets; stack trimmed to the tools actually used (Kotlin /
  Compose / Flows / GraphQL). Udemy 6 courses with C++/Kotlin to 4
  real courses (Go, C, Git and GitHub, free Intro to Programming).
  Kafka dropped from Flexera bullets and tools (Redis kept). Skills
  `Linux (Arch)` to `Linux (Debian, Ubuntu, Kali)`. Kafka dropped from
  the Backend and Cloud skill line too.
- **Design system doc (H3).** New `docs/DESIGN_SYSTEM.md` with tokens,
  interaction primitives (hover, press, focus, reveal, caret),
  components (section head, title, buttons, cards, stack list,
  timeline, testimonial, nav), breakpoints, and the "when to extend
  this document" policy. Single source of truth for visual vocabulary.

## Where the site stands right now

- Architecture split complete
  - `index.html` ~2000 lines (HTML shell + one inline app IIFE)
  - `assets/styles.css` (all CSS)
  - `assets/i18n.js` (EN + ES dicts, 335/335 keys with parity)
  - Fonts self-hosted in `fonts/`, referenced from CSS with `../fonts/`
- Hostinger deploy via GitHub Actions FTPS. Intermittent control-socket
  timeouts from Hostinger are known; rerun the workflow and it passes.

## What was done this session (summary of the last rounds)

### Content accuracy
- Removed fabricated certifications from the Earned list. Kept only
  `B.S. Computer Engineering, UNAM` and `Google Play Store Listing`.
  Meta Developer / Google Developer / Mobile Architecture were
  invented and have been dropped. A "More on LinkedIn" placeholder
  row now points to the profile.
- PayPal / Venmo timeline rewritten to reflect the real scope:
  - Role now reads `Senior Mobile Engineer, Venmo Credit Card`
  - Blurb ends in `Current performance rating: Exceeds Expectations`
  - Bullets cover Auth Users, Push Provisioning, `VCC 2.0 (Virtual
    Credit Card)` (fix: it was wrongly labelled BCC), XML-to-Compose
    migration, feature flags, GraphQL client, accessibility pass
- Flexera rewritten to Go + Postgres + AWS. Kafka dropped from
  everywhere because it is not used in production. Kotlin attribution
  removed from Flexera too, Jorge never used it there.
- Tienda UNAM kept but the native-mobile framing is preserved
- UNAM iOS Development Lab kept (mentor + student)
- Udemy normalized to 4 real courses across every surface
  (blurb, tag, contact link description, stats strip, course list)
  - Go, C, Git & GitHub, and the free Intro to Programming in Multiple
    Languages. C++ and Kotlin courses removed because they are not
    published under Jorge.
  - Stats strip: 54K+ students, 4 courses, 4.5 instructor rating,
    3,462 reviews. Course list renders with real Udemy URLs.
- Capdesis apps grid now has `Live` or `In development` status pills.
  Descriptions rewritten from the actual capdesis.com client pages
  (IngenieríaTracker, Formulae Pro & Community, CapMenu, CapLiving,
  Lo Más Fresh, CapTienda). Web projects (León Entertainment, OPUS,
  Artipublimex, Ancare, Xun-kaab, Finca SANRO) now carry the exact
  copy from their capdesis.com client pages, not fabrications.
- "And more in the lab: GestiónInventarioQR, IoT de domótica, ARKit
  prototypes, internal tools for clients" line was invented; removed.
  Only the "See the full portfolio on capdesis.com" link remains.
- "Senior team behind every project" dropped from Capdesis descriptions
  (social link + contact tier card + exp timeline were all fabricating
  an internal team). Replaced with specialist freelancers framing.
- Google Developers social link still shown (URL is real) but
  description rewritten to not claim credentials, since none of the
  earned badges were real.

### Testimonials
- Section reframed from "Testimonials" to "Feedback themes" with a
  lede clarifying the quotes are paraphrased recurring patterns, not
  direct quotes from named people, and that the cited numbers are
  verifiable.
- Six themes covering PayPal/Venmo, Tienda UNAM, Udemy students,
  Capdesis clients, Flexera, UNAM iOS Lab.
- Rotator has prev/next circular buttons, hairline dots, keyboard
  arrow nav, auto-rotate 9s, pauses on hover/focus/offscreen.
- Viewport min-height tuned so the controls stay put between slides.

### Social links
- Bare name list replaced with icon + serif name + description + CTA
  per platform. LinkedIn, GitHub, Capdesis (real logo), Udemy, YouTube,
  Google Developers (four-color G), WhatsApp.
- "Where you'll find me online" intro above the list.

### Direct email block
- Moved under the Cal.com CTA and Capdesis tier card inside the left
  column so the form no longer has dead space next to a short left
  column.
- Kicker `Direct email`, the email as a serif italic link, hint
  underneath.

### Form TOPIC select
- Native chrome stripped (`appearance: none`), custom SVG chevron,
  `padding-right: 44px`. Fixes the pegged-to-the-right arrow.

### Tech logo strip (section 05 proper)
- Grid of 20 chips with hover tooltips attributing each tech to real
  projects. Keyboard accessible via focus button overlay.
- gRPC and Next.js removed (not in use).
- Linux tooltip mentions Debian, Ubuntu, Kali specifically (not Arch).

### Stack section 05 overhaul
- Every `.stack-list li` now carries a `.stack-tip` tooltip with:
  short domain label (e.g. "Android core") and a one-paragraph
  description naming the real projects + context (e.g. Kotlin / Compose
  is attributed to Venmo Credit Card and Tienda UNAM, with the XML to
  Compose migration called out; Self-hosted VPS + Tailscale describes
  the actual 2-VPS Capdesis mesh; AWS lists the real services used at
  Flexera One).
- 36 tooltips injected via a Python one-shot. All 6 columns covered.

### Experience timeline, collapsible
- Each `.tl-item` is now expandable. Default state is the first (most
  recent) item open, the rest collapsed showing only the meta +
  role + blurb.
- Click or keyboard Enter/Space toggles. `aria-expanded` and
  `aria-controls` wired. CSS uses `grid-template-rows: 0fr` -> `1fr`
  trick for smooth height animation, with `prefers-reduced-motion`
  opt-out.
- Udemy item also got 3 bullets + chips so every card has something to
  expand.

### Hero JSON panel
- `runScramble` duration extended (min 900ms, scales with length).
- `.panel-body::after` blinking caret, CSS `@keyframes blink`.
- Staggered fade-in of each code key/string inside the panel so it
  animates in like it's being populated progressively.
- New `runTypewriter` helper available for future use (not yet
  wired to any element).

### Responsive + grammar pass
- Nav: transitional breakpoint at 1100px tightens link padding; collapse
  at 1060px so ES/EN + theme toggle no longer overflow at iPad landscape.
  Brand text hides below 620px.
- Section kicker: switched to `flex-wrap`, tighter at <=480px. Fixes
  horizontal scroll at 360 and 390.
- Removed redundant `.web-thumb-tag` overlay (both it and `.web-badge`
  were rendering, looked duplicated).
- Grammar: `Lead a team` -> `Leading a team`. `toda México` -> `todo
  México`. `Cap Living` -> `CapLiving`. Oss intro comma splice fixed.
- `cert.title2` HTML fallback aligned with i18n value.

### Marquee
- Two explicit `.marquee-group` containers with identical content, grid
  sized so `translateX(-50%)` lands pixel-perfect. Pauses on hover.

## Known pending work (for next session)

Priority ordered. High at top. H1, H2, H3, H6, H8, H9 shipped
2026-04-20 (see Latest round). Blockers and remaining items below.

### H1, micro-polish (done, tiny remainders)
- JSON panel typewriter, button press states, card hover lifts and
  timeline stagger all shipped 2026-04-20.
- Optional extension: section titles with a letter-by-letter reveal
  using the same text-node-walker pattern pointed at `.section-title
  em`. Not essential.

### H2, stack inline logos (shipped)
- 36/36 stack items now carry a logo. Brand marks via devicon CDN
  (Kotlin, Swift, Flutter, Go, Postgres, AWS, Firebase, Docker, GitHub,
  Linux, Neovim, Android Studio, Figma, Git, TypeScript, Next.js,
  Tailwind, React, Vite); inline Lucide-style SVGs for abstract
  concepts (Accessibility, OAuth, Biometric, Threat modeling, etc).
- Next-session nice-to-have: self-host the devicon SVGs under
  `assets/logos/` so the CDN is not a runtime dependency.

### H3, design system doc (shipped)
- `docs/DESIGN_SYSTEM.md` now ships with tokens (color, type, spacing,
  shadow), interaction primitives (hover, press, focus, reveal),
  component specs (section head, title, buttons, cards, stack list,
  timeline, testimonial, nav), breakpoints, watermarks, and the
  extension policy.
- Future extension (not urgent): move all `:root` tokens into
  `assets/tokens.css` imported first so component CSS only consumes
  tokens, never hardcodes colors. Today tokens live inside
  `assets/styles.css`.

### H4, responsive granularity
- **Mobile horizontal scroll + hamburger drawer shipped 2026-04-20**
  (see Latest round). Mobile is now scroll-free at 390 and the
  hamburger covers all 9 section links.
- User called out that the contact social list and the web projects
  grid could go 2-column in intermediate widths (850 to 1100) instead
  of staying 1-column. Audit and add auto-fill / auto-fit grids where
  they make sense.
- Audit log in `.playwright-mcp/` has screenshots at 360, 390, 768,
  1024, 1280, 1920, 2560, 3440 from the previous responsive sweep.
- Remaining issues from that audit:
  - Web project cards at 768 have ~450px of empty gradient space,
    single-column looks too padded.
  - Content locked at ~1280 max on 2560 and 3440 ultrawide. Decide
    whether to let the layout breathe on ultrawide or keep the
    editorial look.

### H5, LinkedIn certs sync
- Agents cannot scrape LinkedIn without auth (blocked by authwall).
- User will paste the cert list from
  `https://linkedin.com/in/jorge-salgado-miranda-74023b181/details/certifications/`
- Once pasted, replace the placeholder "More on LinkedIn" row with
  the real entries, keep the B.S. UNAM and Google Play Store Listing
  rows that are already correct.

### H6, stack copy updates from the CV (shipped)
- Riverpod added to Flutter line. RxSwift added to reactive-streams
  line alongside RxJava, Kotlin Flows, Combine. Tooltips updated.
- React Native still sits in the CV skills list. Not surfaced on the
  landing stack yet. Add only if a public project uses it.

### H7, Udemy review capture
- Udemy blocks HTTP scrapers. To pull real 5-star reviews verbatim the
  next session should try Playwright MCP with a signed-in session
  (user has to authorize), fetch 2-3 reviews per course, replace the
  Feedback-theme 3rd slide with a real quote.

### H8, CV update (shipped)
- Both CV files now match the landing:
  - Venmo job title: `Senior Mobile Engineer, Venmo Credit Card`;
    Android-first blurb; new bullets for VCC 2.0, XML to Compose
    migration, GraphQL client, accessibility pass.
  - Udemy: 4 real courses (Go, C, Git and GitHub, free Intro to
    Programming in Multiple Languages).
  - Flexera: Kafka dropped from bullets and tools. Redis kept.
  - Skills: Kafka dropped from Backend and Cloud. Linux tooling
    reads `Linux (Debian, Ubuntu, Kali)`.
- Still to do next session: rebuild `cv/*.pdf` via
  `bash scripts/build-cv-pdfs.sh` and verify the extracted text
  carries the same keywords.
- The 66% latency reduction at IngenieríaTracker is still in the CV.
  User has not yet confirmed the measurement source. Either validate
  or soften the copy.

### H9, color + depth (shipped)
- `--accent-warm` tokens added for dark and light themes.
- Warm accent drives the "in development" status pill and the hero
  panel gradient (soft dual-radial cyan and warm). Cyan remains the
  primary accent for every interactive state. Rule documented in
  `docs/DESIGN_SYSTEM.md` so it does not get mixed.
- Future extension: apply a muted warm glow to the Cal.com tier card
  on hover, and consider a warm secondary on the cases kicker.

### H10, Design System ticket discipline
- User mentioned they've already been writing tickets per sprint.
  Consider adding a `docs/TICKETS.md` or a Linear import list so the
  landing repo has visibility into the backlog.

## Placeholders still in `index.html` that require user-side action

See `docs/MANUAL_SETUP.md` for the full list and how to set each one.
Snapshot:
- `YOUR_UMAMI_WEBSITE_ID`, analytics
- `YOUR_CF_BEACON_TOKEN`, analytics
- `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` → `api/secrets.php`
- `jorgesalgadomiranda/30min`, Cal.com slug may need update

Every one of these is behind an `if (!startsWith("YOUR_"))` guard so
the page runs without them, just without analytics or a working form.

## Session-to-session hygiene

- `CLAUDE.md` at repo root is gitignored, up to date with the new
  architecture (2000-line shell + external CSS/JS) and with the i18n
  parity check that reads from `assets/i18n.js`.
- The auto-memory at `~/.claude/.../memory/project_personal_landing.md`
  was updated earlier in this session to reflect the new architecture
  and the redesign pass.
- Commits are authored by chochy2001, no AI references, no em or
  en-dashes in shipped copy.
