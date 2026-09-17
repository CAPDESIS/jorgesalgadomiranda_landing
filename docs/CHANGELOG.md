# Changelog

Reverse-chronological log of what shipped, why, and what to verify next time.

---

## 2026-09-11: Legal and 404 consume site tokens

Privacy, Terms, and 404 now link `/assets/styles.css` and keep their
document chrome. Loose hex `--ink` / `--paper` palettes are gone.
`bun run lint` and `bun run build` run the static validator. GitHub
Actions force Node 24. Contact validation no longer requires Web3Forms.
See `audits/2026-09-11-ola.md` (`9bc232f` plus this docs commit).
Live HTML was not redeployed in this change.

---

## 2026-04-19: Open Source section (OmniMon + GitHub)

**New section 06: Open Source** between Engineering and Certifications.
The old concern was that the page made Jorge look like someone who only
ships private work for clients. Now a dedicated section proves real
OSS activity.

**Featured card: OmniMon** (`omnimon.com.mx` + `github.com/chochy2001/omnimon`)
- Cross-platform system monitor built with Rust, Tauri 2 and Svelte 5.
- Metadata badges: `v6.6.6`, `MIT`, `474+ commits`.
- Description highlights MITRE ATT&CK threat detection and AI analysis.
- Two CTAs: primary button to the live site, ghost button with GitHub
  icon to the repo.

**Three secondary cards** (all linking to their GitHub repo):
- `ubuntu2kali` (Shell): transforms Ubuntu 24.04 into a pentesting
  workstation with 500+ Kali tools.
- `openai-kotlin` (Kotlin): OpenAI API client for Kotlin, multiplatform.
- `Neovim config` (Lua): daily editor setup.

**Footer link** to `github.com/chochy2001?tab=repositories`: "See all
60+ public repos on GitHub".

**Renumber subsequent sections**: Certifications 06 to 07, Udemy 07 to 08,
Testimonials 08 to 09, Contact 09 to 10. Added nav link "Open Source" /
"Open Source" (same word in ES, technical term).

**Security sweep**: confirmed no secrets, no internal IPs, no private
emails, no `.env` staged. Repo is safe to keep public.

i18n parity: adds 10 new keys per dict.

---

## 2026-04-19: Auto-update tenure, CapTienda, YouTube, GitHub Actions deploy

**Tenure auto-updates each new year**
- `[data-years-since="2018"]` spans in the HTML (and i18n dicts) now
  render as `new Date().getFullYear()` minus `2018`. 2026 shows "8",
  2027 will show "9", 2028 "10", all without touching code.
- Hero "Years shipping at scale" stat: `data-count-since="2018"` drives
  the count-up animation to the current number.
- `{{yearsSince:YYYY}}` tokens substituted at apply-lang time for meta
  description and document title (where HTML spans don't render).
- Both CVs (EN + ES) get a tiny inline script that does the same
  substitution for the print-ready pages.

**CapTienda added to Capdesis apps**
- Flutter + POS + Retail card with the official product logo from
  `capdesis.com/images/products/captienda_logo.svg` and link to
  `captienda.com`. App icon gradient in the same red-orange family used
  on retail-ish brands.
- The old "And more in the lab" dashed card replaced with a single-line
  note below the grid that links to `capdesis.com/#portfolio`, so the
  grid stays a clean 2x3 of real products.

**Ownership framing for Capdesis**
- `cap.lede` now reads "I founded Capdesis in 2019 and I still ship for
  it every week ... every product below, built and maintained by me."
  Same tone in ES. Makes the ownership explicit instead of implicit.

**YouTube channel**
- Added to the contact links (4th item), JSON-LD `sameAs`, and both CVs.

**GitHub Actions FTP deploy**
- New `.github/workflows/deploy.yml` mirrors the site to Hostinger FTP on
  every push to `main` and on manual dispatch. Uses
  `SamKirkland/FTP-Deploy-Action@v4.3.5`.
- Four secrets required (docs/DEPLOY.md has the full setup guide):
  `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `FTP_REMOTE_DIR`.
- Exclude list matches the local `scripts/deploy.sh` exactly, so the two
  deploy paths produce byte-identical remotes. No password leaves the
  local machine or the repo; lives only in GitHub Actions Secrets.

i18n parity 209 / 209.

---

## 2026-04-19: Google Play Store Listing certificate earned

Passed the Google Play Academy *Play Store Listing* certificate exam
(65/68). Added to the Earned column on the landing (top of the list with
the 2026 issue year) and to both CVs.

Rationale updated in `docs/CERTIFICATIONS.md`: this is a smaller cert than
CISSP or AWS Pro, but it's a real signal that the release path (listing,
metadata, screenshots, ASO) is owned end to end, not just the code.

---

## 2026-04-19: Certifications revamp + self-hosted fonts + WhatsApp CTA

**Certifications section rewritten around a real path**
- Removed AWS Cloud Practitioner (foundational tier, below the level of a
  Senior Architect, more noise than signal).
- Earned (4): Meta Developer, Google Developer, Mobile Architecture,
  B.S. Computer Engineering UNAM.
- In progress (5): AWS Solutions Architect Professional, AWS Security
  Specialty, CISSP (ISC2), Meta iOS Developer Professional, Meta Android
  Developer Professional. All with progress bars and links to the
  official exam pages.
- On the roadmap (3): AWS DevOps Engineer Professional, AWS Generative AI
  Developer Professional, ISSAP (ISC2). Separate badge style (arrow).
- Rationale for every choice documented in [CERTIFICATIONS.md](CERTIFICATIONS.md),
  including what was considered and left out (CISA, OSCP, CKA).
- Grid bumped from 2 columns to 3 at >=1100px, with responsive step-downs.
- CVs (EN + ES) updated to the same cert list.

**Self-hosted fonts**
- Downloaded 4 woff2 files from Google Fonts (latin subset only):
  Instrument Serif normal + italic, Geist (variable 300-700), Geist Mono
  (variable 400-500). Total ~90 KB.
- Inlined `@font-face` declarations in index.html, og.html and both CVs.
- Removed the Google Fonts `<link>` tag and both preconnects. No more
  external font dependency; no runtime call to Google servers.
- Added `<link rel="preload">` hints for the two critical fonts
  (Instrument Serif and Geist).
- CVs previously used Inter + JetBrains Mono + Instrument Serif from
  Google Fonts; swapped Inter for Geist and JetBrains Mono for Geist Mono
  so the whole project runs on one local font system.
- Verified via Playwright: `document.fonts.check('16px "Instrument Serif"')`,
  `Geist`, `Geist Mono` all return `true` after load.

**Contact CTA**
- Phone link `tel:+525521982449` replaced with a WhatsApp deep link
  `https://wa.me/525521982449?text=Hola%20Jorge%2C`. Label reads
  "WhatsApp · messages preferred" / "WhatsApp · prefiero mensajes" so
  contacts default to messaging, not cold-calling.

i18n parity 208 / 208.

---

## 2026-04-19: `b33cd70` Engineering: senior-architect rewrite + audit fixes

**Why:** the Engineering section read like a homelab logbook (Contabo VPS by
name, "31 rules on CapLiving", repo file paths). Recasted as
capability-first copy that lands as senior-architect work.

**Visible**
- New section title: "From the first sketch / to the last deploy."
- Six cards now lead with an outcome kicker (BACKBONE, REACH, FOUNDATION,
  POSTURE, VELOCITY, CONFIDENCE) and a serif title.
- Hero stat font size bumped from `clamp(32, 4vw, 52)` to
  `clamp(40, 5vw, 64)` so the numbers anchor like the Udemy stats already do.
- Hero stat label "Developers mentored" changed to "trained" / "formados"
  (54K is enrollments, not 1:1 mentees).

**Performance & a11y**
- Google Fonts loaded with `media="print" onload="this.media='all'"` plus
  `<noscript>` fallback. No longer render-blocking.
- Above-fold portrait switched to `loading="eager" fetchpriority="high"`.
- Marquee + tech-strip images now have explicit `width`/`height` to avoid
  CLS during image fetch.
- Hero panel on mobile (<= 480px) gets `white-space: pre-wrap` so the
  JSON code block doesn't get silently truncated by the outer
  `overflow: hidden`.
- Contact email gets `overflow-wrap: anywhere` + `word-break: break-word`
  so the long ProtonMail address never overflows narrow viewports.

i18n parity remains 202 / 202.

---

## 2026-04-19: `79b4373` Stack 6th column + timeline locations translated

**Why:** screenshot showed the Stack section with 5 categories in a 2-column
grid, leaving an empty cell at row 3 col 2. Also the timeline location
strings ("Remote · Fintech", etc.) never translated to ES.

**Changes**
- Added 6th category: **Web & Frontend** with TypeScript, Astro, Next.js,
  React, Tailwind, Vite, Bun, Lighthouse. Real stacks across
  CapdesisWebLanding (Astro) and lo_mas_fresh (Next.js).
- Wired `data-i18n` on every `.tl-loc` span with new keys
  `exp.j1.loc` ... `exp.j6.loc` in both EN and ES dicts.

i18n parity 196 / 196.

---

## 2026-04-19: `03a57c0` About: rebalance, quick facts, cards row

**Why:** screenshot showed empty whitespace under the prose (left column
ended after 3 paragraphs while right column held portrait + 4 stacked cards).

**Changes**
- Moved the 4 about-cards out of `.about-side` into a new `.about-cards`
  row that sits below the prose+portrait grid (4 / 2 / 1 columns by
  breakpoint).
- Added an `.about-quick` facts box under the prose (Based, Years
  shipping, Role, Open to) to fill the previously empty space.
- `.about-side` now wraps the portrait alone, heights balance naturally.
- 6 new keys per dict for the quick-facts labels.

---

## 2026-04-19: `df8799c` Fix UI/UX bugs reported in About + 8 systemic issues

**Why:** the About `<h2>` "Not just a mobile engineer..." was visually
absent in a screenshot. Root cause was grid auto-placement plus
implementation gaps that affected every section.

**About section**
- Moved the section-title `<h2>` outside `.about-grid` so it leads the
  section like every other section does.
- Portrait `aspect-ratio: 4/5` + `max-height: 480px` were fighting; dropped
  the max-height and capped width to 420px so the ratio is honored.

**Animations (affected the whole page)**
- Replaced 12 instances of malformed `cubic-bezier(.2.8.2,1)` with the
  valid form. The malformed value invalidated entire `transition`
  declarations, snapping nav, magnetic, tilt, reveal fade, etc. to
  instant state changes.

**Anchored navigation**
- Added `section[id], #main { scroll-margin-top: 96px; }` so clicking nav
  links lands sections below the fixed nav, not under it.

**Layout responsiveness**
- `.hero-stats` now goes 4 / 2 / 1 columns at 1100px and 480px
  breakpoints; was staying 4-column down to 780px.
- `.web-card` is flex-column with `flex: 1` on `.web-body` so cards
  equalize height in the 901-1200px 2-column grid.

**Contrast**
- `.cv-preview` decorative dots and pline-md were inheriting theme vars
  that go invisible on a hard-coded cream background. Replaced with a
  hard-coded document palette that's always legible.

**Pointer**
- Replaced dead compound selector
  `[data-magnetic].toggle.nav-links a.nav-brand` with comma-separated
  list. Added a `(pointer: coarse)` reset so touch devices keep their
  default cursor.

**Content**
- Web-card i18n keys 4-6 were copy-pasted from earlier card content
  (Ancare card showed entertainment-agency description, etc.). Rewrote
  each pair to match the actual brand on the card in EN and ES.

**Cleanup**
- Removed dead `.web-thumb-1.web-thumb-2.web-thumb-3...` chained selector
  rule (could never match any element).

---

## 2026-04-19: `57f88d4` Add real logos, fix client links, new Engineering section

**Why:** monogram placeholders (IT, Σ, CM, CL, LF and LE, OP, AP, AN, XK,
SR) made the page feel like a template. Client cards all linked to
`capdesis.com/` instead of the individual project pages. The page lacked
depth on engineering practice.

**Logos**
- Swapped every monogram for the real product / brand logo from
  `capdesis.com/images/products/` and `/images/clients/`. Kept the text
  monogram as graceful fallback via `img onerror`.
- Added a personal portrait in About from the Zyro CDN.
- Added a marquee with brand logos (PayPal, Capdesis, Tienda UNAM,
  Flexera, Udemy, iOS Lab UNAM).

**Links**
- Each web-card overlay now points to its own `capdesis.com/clientes/<slug>/`
  page, not the Capdesis root.
- Each Capdesis app card now has a visible URL+arrow link
  (ingenieriatrackerunam.com, formulaeapps.com, capmenu.app, capliving.mx,
  lomasfresh.com).

**Engineering section (new)**
- Inserted a new section between Stack and Certifications with 6 cards
  covering Clean Architecture backends, offline-first mobile, self-hosted
  VPS, layered security, CI/CD, observability. (This was the section that
  later got rewritten in `b33cd70`.)
- Added a tech logo strip with 12 tech icons.
- Renumbered subsequent sections (Certs 05 to 06, Udemy 06 to 07, Testimonials
  07 to 08, Contact 08 to 09). Added nav link to Engineering.

**Code quality**
- Wrapped `data-magnetic` and `data-tilt` registration behind
  `prefers-reduced-motion` and `pointer: coarse` so inline transforms
  don't override the a11y media query.
- Replaced `oklch(from ...)` relative color syntax with `color-mix()` for
  broader browser support.
- Fixed brand naming across CVs (Arty Publimex to Artipublimex, Opus to
  OPUS, Xunkaab to Apiario Xun-kaab, added "Analogic Care" to Ancare).
- Unified Capdesis student count at 51,000+ across the page.

---

## 2026-04-18: `976709e` Initial landing page

**Why:** bootstrap the public repo at
`github.com/chochy2001/jorgesalgadomiranda_landing`.

**Initial scope**
- Self-contained `index.html` with inline CSS, JavaScript, i18n dicts.
- Two CV pages (EN + ES), one PDF.
- ES + EN bilingual, dark + light theme, all toggle-driven and persisted.
- Microanimations: cursor blob, magnetic buttons, tilt cards, scramble,
  reveal, count-up, scroll progress, marquee.
- SEO: JSON-LD Person schema, Open Graph, Twitter card, canonical,
  hreflang via `<html lang>`.
- Security + a11y + content review before commit:
  `rel="noopener noreferrer"` on all `target="_blank"`, frozen `__I18N__`
  global, fixed `.stack-col, .cert-col` selector, added 6 missing EN i18n
  keys, gated reduce-motion blob cursor, added `og:image`/`twitter:image`,
  fixed JSON-LD email format, added `aria-pressed` toggles, scrubbed
  broken sentences and date ranges in CVs.
