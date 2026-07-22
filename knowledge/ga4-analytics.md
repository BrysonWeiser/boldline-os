---
name: ga4-analytics
topic: Marketing site
task: manage GA4 analytics on the marketing site and (pending) surface GA4 data inside the OS
keywords: [ga4, google-analytics, gtag, measurement-id, G-MG7T0687RT, analytics-data-api, marketing-site]
status: partial
summary: GA4 web tracking set up 2026-07-22 for boldlinemedia.com — property "BoldLine Media", Web stream "BoldLine Media Web" (Stream ID 15301155601, Measurement ID G-MG7T0687RT), Enhanced measurement ON. The gtag snippet is hardcoded in marketing-site/index.html <head> (measurement IDs are PUBLIC, not a secret). PENDING (deferred until after Meta App Review submit): surface GA4 data INSIDE the OS via the Analytics Data API (needs the numeric Property ID + a GCP service account added as a Viewer).
verified: 2026-07-22
---

**Property (created 2026-07-22, same Google account as Search Console / Google Ads):**
- Account/Property name: **BoldLine Media**
- Web data stream: **BoldLine Media Web** → `https://boldlinemedia.com`
- **Stream ID:** `15301155601`
- **Measurement ID:** `G-MG7T0687RT` (PUBLIC — appears in page HTML on every GA site; fine to commit, NOT a secret-scan concern since it's inline, not an env var)
- Enhanced measurement **ON** (page views, scrolls, outbound clicks, site search, video, file downloads, form interactions)
- Time zone Arizona (MST), currency USD, industry "Business & Industrial", size Small, objective "Generate leads".

**Tag install:** gtag snippet added to **`marketing-site/index.html`** `<head>` (right after the js-tabs inline, before `<title>`). No CSP on the marketing site (`_headers`/`netlify.toml`) so nothing to allowlist. Deployed via main. Verify live: GA4 → Reports → Realtime while visiting boldlinemedia.com (or the stream's "View tag instructions" flips from "No data received" to green).

**Scope decision:** tag is on the **marketing site only** (public visitor/lead tracking), NOT the OS app. That was the right call — GA4 is for marketing traffic.

**PENDING — "GA4 data inside the OS" (Bryson asked 2026-07-22, deferred until after the Meta demo submit):** display GA4 metrics (users/sessions/traffic sources/conversions/top pages) on an OS dashboard card. Build = a Netlify function calling the **GA4 Analytics Data API** (`runReport`) + an OS card, mirroring the google-ads.mjs pattern. Requirements to gather when we build:
1. The GA4 **numeric Property ID** (Admin → Property settings — different from the `G-` Measurement ID).
2. A **Google Cloud service account** with the Analytics Data API enabled, its email added as a **Viewer** on the GA4 property; store its key as a Netlify env var (name it, keep the value out of the repo).
This is genuinely Opus-worthy multi-file work — schedule it as its own unit after Meta is submitted.
