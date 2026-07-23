---
name: ga4-analytics
topic: Marketing site
task: manage GA4 analytics on the marketing site and (pending) surface GA4 data inside the OS
keywords: [ga4, google-analytics, gtag, measurement-id, G-MG7T0687RT, analytics-data-api, marketing-site]
status: partial
summary: GA4 web tracking set up 2026-07-22 for boldlinemedia.com — property "BoldLine Media", Web stream "BoldLine Media Web" (Stream ID 15301155601, Measurement ID G-MG7T0687RT), Enhanced measurement ON. gtag hardcoded in marketing-site/index.html <head> (measurement IDs are PUBLIC). GA4-DATA-IN-THE-OS is now BUILT (2026-07-23): a "Site Analytics" card on the OS Website tab pulls last-28-day traffic via the Analytics Data API. Awaits two Netlify env vars (GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON) + service-account added as Viewer on the property to go live.
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

**✅ BUILT — "GA4 data inside the OS" (2026-07-23).** A **"📊 Site Analytics"** card on the OS **Website tab** (above the blog manager — the Website tab is "everything for boldlinemedia.com," so site analytics belong there). Shows last-28-days **Users / Sessions / Page Views / Conversions** each with a **% trend vs the prior 28 days** (green ▲ / red ▼), plus **Top Channels** (by sessions) and **Top Pages** (by views), and an "Open full GA4 ↗" link. Read-only. Verified: OS compiles clean, 0px overflow at 390/768/1280/1600, full-width on desktop (no cramped column).

**Code:**
- `netlify/functions/ga4.mjs` — action `summary`. Auth is a **Google Cloud SERVICE ACCOUNT** (not the OAuth refresh-token flow google-ads uses): signs a short-lived RS256 JWT with the service-account private key using Node's built-in `crypto` (NO external library), exchanges it at `oauth2.googleapis.com/token` (grant_type `urn:ietf:params:oauth:grant-type:jwt-bearer`, scope `analytics.readonly`) for an access token, then calls the **Analytics Data API** `properties/{id}:batchRunReports` (4 reports: current totals, prior totals, top channels, top pages). Owner Supabase-session gated like the other integration fns.
- `index.html` — `GA4AnalyticsCard` component (in WebsiteScreen). loading / ok / error states; the **error state teaches the setup** (which two env vars + the Viewer step) with a Retry button, so an un-configured card is self-documenting.

**TO GO LIVE — two Netlify env vars on the OS site + one GA4 permission (still TODO, needs Bryson):**
1. `GA4_PROPERTY_ID` — the GA4 **numeric** Property ID (GA4 → Admin → Property settings; NOT the `G-` Measurement ID).
2. `GA4_SERVICE_ACCOUNT_JSON` — a **Google Cloud service-account key file**, pasted as one value. Create it: Google Cloud Console → the project → APIs & Services → **enable "Google Analytics Data API"** → IAM & Admin → Service Accounts → Create → then Keys → Add key → JSON → download → paste the whole file's contents as the env-var value. (It's a JSON blob with `client_email` + `private_key`; the code `JSON.parse`s it. Keep the value out of the repo — env var only.)
3. In **GA4 → Admin → Property → Property Access Management**, add the service-account's `client_email` as a **Viewer**.
Then redeploy the OS site. Until all three are done the card shows the "Analytics not connected yet" state with these exact instructions. No code change needed to flip it on.
- **Gotcha to watch on first live load:** if `batchRunReports` returns a 403, it's almost always step 3 (service account not added as a Viewer on the property) or step 2's API not enabled. The card surfaces the API's error message under the `report`/`auth` stage.
