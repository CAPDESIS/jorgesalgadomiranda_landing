# Manual Setup Checklist

Everything that lives outside git (account creation, dashboard clicks,
repository secrets, DNS/edge toggles) is tracked here.

After code changes land on `main`, trigger **Deploy to production**
(`.github/workflows/deploy.yml`) manually via `workflow_dispatch` with the
exact 40-character `release_sha` and `confirm_no_p0_p1_alerts=yes`. Pushes
and PRs run validation only and do not deploy automatically.

---

## 1. Umami website ID (analytics)

Stats live at the self-hosted Umami instance on `stats.capdesis.com`.

1. Open `https://stats.capdesis.com/` and sign in.
2. Go to **Settings > Websites > Add website**.
3. Name: `jorgesalgadomiranda.com`. Domain: `jorgesalgadomiranda.com`.
4. Save. Umami shows a Website ID (looks like `a1b2c3d4-...`).
5. Add it as GitHub Actions secret `UMAMI_WEBSITE_ID` (keep `YOUR_UMAMI_WEBSITE_ID` in `index.html`; `deploy.yml` injects the real value at deploy time).
6. Run `Deploy to production` (`workflow_dispatch`). Visits should appear on the Umami dashboard within about 60 seconds after visitor consent.

---

## 2. Cloudflare Web Analytics token

DNS is hosted on Cloudflare. Two layers of analytics:

### 2a. Zone-level (zero-config, already works)

Cloudflare > Analytics & Logs > **Traffic**. No code needed. This is
the server-side view (requests that hit the edge) and works because
DNS is proxied.

### 2b. Beacon-level (adds client-side RUM: page views, paint timings)

1. Cloudflare dashboard > **Analytics & Logs > Web Analytics**.
2. **Add a site** > `jorgesalgadomiranda.com`.
3. Cloudflare generates a JS snippet with a `token` value.
4. Save that token string in GitHub Actions secret `CF_BEACON_TOKEN` (keep `YOUR_CF_BEACON_TOKEN` in `index.html`; `deploy.yml` injects it at deploy time).
5. Run `Deploy to production` (`workflow_dispatch`). Data appears within ~5 minutes after visitor consent.

(Optional PostHog analytics works the same way via `PUBLIC_POSTHOG_KEY` replacing `YOUR_POSTHOG_KEY` at deploy time.)

---

## 3. Cloudflare security toggles

The dashboard setup uses **Client-side security**, **Bot Fight Mode**, and **Speed optimizations**. Worth verifying:

1. Cloudflare > **Security > Settings > Leaked credentials detection**
   > click **Activate**. This defends against automated probing.

### 3a. Turn OFF Cloudflare's "AI Scrapers and Crawlers" block

Cloudflare can prepend a managed policy to `robots.txt` that
**disallows** GPTBot, ClaudeBot, Google-Extended, Perplexity, Applebot
Extended, Bytespider, Meta External, etc. Our `robots.txt` explicitly welcomes
them so Jorge appears in AI answers. Keep the CF block OFF:

1. Cloudflare dashboard > **Security > Bots**.
2. Scroll to **AI Scrapers and Crawlers** (or "Block AI Bots").
3. Switch to **Off** and save.
4. Verify: `curl -s https://jorgesalgadomiranda.com/robots.txt | grep GPTBot -A 1` should show `Allow: /`.

Other one-time settings worth checking:

- **SSL/TLS > Overview** > mode: **Full (strict)**. Anything lower leaves a window for man-in-the-middle between Cloudflare and Hostinger.
- **SSL/TLS > Edge Certificates > Always Use HTTPS**: **On**.
- **SSL/TLS > Edge Certificates > Automatic HTTPS Rewrites**: **On**.
- **SSL/TLS > Edge Certificates > Minimum TLS Version**: **1.2**.
- **Rules > Cache Rules**: optionally cache `*.css?*` and `*.js?*` (`http.request.uri.path.extension in {"css" "js"}`) for 1 week so versioned assets hit edge cache (`docs/TICKETS.md` `T-104`).

---

## 4. Resend contact delivery (and optional Turnstile)

1. Create a Resend API key and verify the From domain.
2. Add GitHub Actions secrets: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_TO` (and optional `RESEND_REPLY_TO`).
3. Run `Deploy to production` (`workflow_dispatch`). CI writes `api/secrets.php` (never commit it).
4. Optional bot protection: provision `TURNSTILE_SECRET_KEY` (in `api/secrets.php` or host env) and set `<meta name="jsm-turnstile-site-key" content="..." />` in `index.html` to enforce Cloudflare Turnstile on `/api/contact.php`.

See [`RESEND_SETUP.md`](./RESEND_SETUP.md) and [`GITHUB_SECRETS.md`](./GITHUB_SECRETS.md).

---

## 5. Cal.com event type

The live Cal.com slug `jorge-salgado-miranda-lt3qxa/30min` is already wired into `index.html` (`#cal-cta`) and `assets/js/welcome-modal.js`. For a fork or future slug update:

1. Sign in at `https://cal.com/` and create a 30-minute event type.
2. Update `https://cal.com/jorge-salgado-miranda-lt3qxa/30min` in `index.html` and `assets/js/welcome-modal.js` with your slug.
3. Under **Availability**, set working hours and connect Google/iCloud Calendar.
4. Optional: under **Event > Advanced**, set `Redirect on booking` to `https://jorgesalgadomiranda.com/#contact`.

---

## 6. Google Search Console

1. `https://search.google.com/search-console/`
2. **Add property > URL prefix** > `https://jorgesalgadomiranda.com/`.
3. Verification method: **HTML tag** (or DNS TXT on Cloudflare).
4. Submit `https://jorgesalgadomiranda.com/sitemap.xml` via **Sitemaps > Add a new sitemap**.
5. Check **URL Inspection** on the apex URL once indexed.

---

## 7. Bing Webmaster Tools

1. `https://www.bing.com/webmasters/`
2. Import from Google Search Console (or verify via meta tag).
3. Submit `https://jorgesalgadomiranda.com/sitemap.xml`.

---

## 8. Rotate secrets

Do this on a calendar reminder every 3-6 months:

- Hostinger **hPanel > Files > FTP Accounts** > change password.
- GitHub **Settings > Secrets and variables > Actions** > update `FTP_PASSWORD`.
- Run `Deploy to production` (`workflow_dispatch`) once to confirm it passes end to end.

---

## 9. LinkedIn + GitHub profile alignment

- LinkedIn headline: include `Software Architect · Mobile, Web & Security · Auditorias de arquitectura`.
- LinkedIn "Contact info" > add `https://jorgesalgadomiranda.com/`.
- GitHub profile (`github.com/chochy2001`) > bio pointing to `jorgesalgadomiranda.com`, pinning key repos (`IngenieriaTracker`, `Formulae`, `CapTienda`, `openai-kotlin`, `ubuntu2kali`, `Neovim-Vim_Configuration`).

---

## 10. Legal pages

Published bilingual legal pages already ship with the site and are listed in `sitemap.xml` and the footer:

- `/legal/privacy.html` (301 aliases: `/privacidad`, `/privacy`)
- `/legal/terms.html` (301 aliases: `/terminos`, `/terms`)
- `/legal/cookies.html`

---

## Current code placeholders quick reference

```text
YOUR_UMAMI_WEBSITE_ID      -> index.html (replaced at deploy by UMAMI_WEBSITE_ID)
YOUR_CF_BEACON_TOKEN       -> index.html (replaced at deploy by CF_BEACON_TOKEN)
YOUR_POSTHOG_KEY           -> index.html (replaced at deploy by PUBLIC_POSTHOG_KEY)
RESEND_* secrets           -> api/secrets.php at deploy (section 4)
jsm-turnstile-site-key     -> index.html meta tag (empty until Turnstile widget is enabled)
```

Grep for `YOUR_` at any time to see what placeholders exist in `index.html`.
