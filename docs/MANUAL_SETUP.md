# Manual Setup Checklist

Everything I couldn't automate (account creation, dashboard clicks,
private tokens) lives here. Work top-to-bottom; each section says what
to paste into the code once you've got the value.

After any change, commit and push. GitHub Actions redeploys to
Hostinger automatically.

---

## 1 · Umami website ID (analytics)

Stats live at the self-hosted Umami you already run on
`stats.capdesis.com`.

1. Open https://stats.capdesis.com/ and sign in.
2. Go to **Settings → Websites → Add website**.
3. Name: `jorgesalgadomiranda.com`. Domain: `jorgesalgadomiranda.com`.
4. Save. Umami shows a Website ID (looks like `a1b2c3d4-...`).
5. Open `index.html`, search for `YOUR_UMAMI_WEBSITE_ID`, replace with
   the ID.
6. Commit + push. Visits should appear on the Umami dashboard within
   about 60 seconds.

---

## 2 · Cloudflare Web Analytics token

You already moved DNS to Cloudflare. Two layers of analytics:

### 2a. Zone-level (zero-config, already works)

Cloudflare → Analytics & Logs → **Traffic**. No code needed. This is
the server-side view (requests that hit the edge) and works because
DNS is proxied.

### 2b. Beacon-level (adds client-side RUM: page views, paint timings)

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics**.
2. **Add a site** → `jorgesalgadomiranda.com`.
3. Cloudflare generates a JS snippet with a `token` value.
4. Open `index.html`, search for `YOUR_CF_BEACON_TOKEN`, replace with
   just the token string (not the whole snippet: the `<script>` tag
   is already in the file).
5. Commit + push. Data appears within ~5 minutes.

---

## 3 · Cloudflare security toggles

The dashboard shots you sent show **Client-side security**, **Bot Fight
Mode**, and **Speed optimizations** already ON. The missing toggle is:

1. Cloudflare → **Security → Settings → Leaked credentials detection**
   → click **Activate**. This rate-limits IPs that hammer login forms
   with stolen passwords (you don't have a login form today, but it
   defends against automated probing against WordPress/admin paths that
   scanners blindly try).

### 2c. Turn OFF Cloudflare's "AI Scrapers and Crawlers" block

Cloudflare now prepends a managed policy to your `robots.txt` that
**disallows** GPTBot, ClaudeBot, Google-Extended, Perplexity, Applebot
Extended, Bytespider, Meta External, etc. This overrides your own
`Allow: /` rules for those bots. Our robots.txt explicitly welcomes
them so Jorge appears in AI answers. Turn the CF block OFF:

1. Cloudflare dashboard → **Security → Bots**.
2. Scroll to **AI Scrapers and Crawlers** (or "Block AI Bots", same
   toggle).
3. Switch to **Off**. Save.
4. Verify: `curl -s https://jorgesalgadomiranda.com/robots.txt | grep
   GPTBot -A 1` should now show your `Allow: /` rule (not the CF
   managed `Disallow: /`).

Why: the whole point of the section 5 copy and the expanded keywords
is to make AI answer engines recommend Jorge when people ask about
"software architect in Mexico" or "mobile security audit". The CF
block defeats that.

Other one-time settings worth checking:

- **SSL/TLS → Overview** → mode: **Full (strict)**. Anything lower
  leaves a window for man-in-the-middle on the hop between Cloudflare
  and Hostinger.
- **SSL/TLS → Edge Certificates → Always Use HTTPS**: **On**.
- **SSL/TLS → Edge Certificates → Automatic HTTPS Rewrites**: **On**.
- **SSL/TLS → Edge Certificates → Minimum TLS Version**: **1.2**.
- **Rules → Page Rules** (or the new **Rules → Cache Rules**): cache
  `*.woff2`, `*.png`, `*.jpg`, `*.webp`, `*.svg` for a long TTL
  (1 month+). Our `.htaccess` already sets this, but Cloudflare's
  setting is authoritative when proxied.

---

## 4 · Resend contact delivery

1. Create a Resend API key and verify the From domain.
2. Add GitHub Actions secrets: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO`.
3. Redeploy. CI writes `api/secrets.php` (never commit it).
4. Optional SMTP fallback: `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`.

See [`RESEND_SETUP.md`](./RESEND_SETUP.md) and [`GITHUB_SECRETS.md`](./GITHUB_SECRETS.md).


## 5 · Cal.com event type

1. Sign in at https://cal.com/ (or create account).
2. **Event Types → New** → create "30-min technical review" (or
   similar). Duration: 30 min.
3. Copy the event slug. Looks like `your-username/30min`.
4. Open `index.html`, find the CTA button:

   ```html
   <a href="https://cal.com/jorgesalgadomiranda/30min" ...>
   ```

   Replace `jorgesalgadomiranda/30min` with your actual slug.

5. Commit + push.
6. Inside Cal.com, under **Availability** set your working hours so
   the booking page reflects real slots.
7. Optional: connect Google Calendar / iCloud Calendar so busy times
   sync automatically.
8. Optional: under **Event → Advanced**, set `Redirect on booking` to
   `https://jorgesalgadomiranda.com/#contact` so confirmed bookings
   bounce back to your site.

---

## 6 · Google Search Console

Without this, Google won't tell you about crawl errors or index
problems.

1. https://search.google.com/search-console/
2. **Add property → URL prefix** → `https://jorgesalgadomiranda.com/`.
3. Verification method: **HTML tag**. Copy the `content="..."` value.
4. Tell me (or open `index.html` in your editor) and I'll add
   `<meta name="google-site-verification" content="..." />` to the
   `<head>`.
5. After verification, submit `https://jorgesalgadomiranda.com/sitemap.xml`
   via **Sitemaps → Add a new sitemap**.
6. Check back in 2-3 days. **URL Inspection** on the apex URL should
   say "URL is on Google" once indexed.

---

## 7 · Bing Webmaster Tools (free, gets you Duck/Yahoo for free)

1. https://www.bing.com/webmasters/
2. Option A: sign in with Google → import from Search Console (one
   click, easiest).
3. Option B: verify with the same meta-tag flow as Google.
4. Submit `https://jorgesalgadomiranda.com/sitemap.xml`.

---

## 8 · Rotate secrets

Do this on a calendar reminder every 3-6 months:

- Hostinger **hPanel → Files → FTP Accounts** → change password.
- GitHub **Settings → Secrets and variables → Actions** → update
  `FTP_PASSWORD`.
- Run the `workflow_dispatch` deploy once to confirm it still works.

---

## 9 · LinkedIn + GitHub profile polish

- Linkedin headline: include `Software Architect · Mobile, Web &
  Security · Auditorías de arquitectura`, so recruiter searches
  match.
- Linkedin "Contact info" → add `https://jorgesalgadomiranda.com/`
  as the personal website (counts as a backlink for SEO).
- GitHub profile (`github.com/chochy2001`) → bio: point to
  jorgesalgadomiranda.com. Pin 3-6 repos that match what the CV
  claims (IngenieriaTracker, Formulae, CapTienda, openai-kotlin,
  ubuntu2kali, Neovim-Vim_Configuration).

---

## 10 · Legal page (light-touch, only if you start taking paid engagements)

Not strictly required for a portfolio. If you start invoicing from
the site, you'll want:

- `/legal/privacy.html` (what data do analytics collect, right to
  deletion).
- `/legal/terms.html` (boilerplate for engagements).
- Mention both in the footer.

I can generate templates when you're ready. Ping me.

---

## Current code placeholders quick reference

```
YOUR_UMAMI_WEBSITE_ID      → index.html (section 1)
YOUR_CF_BEACON_TOKEN       → index.html (section 2)
RESEND_* secrets → api/secrets.php at deploy (section 4)
jorgesalgadomiranda/30min  → index.html, cal-cta href (section 5)
```

Grep for `YOUR_` at any time to see what's still pending.
