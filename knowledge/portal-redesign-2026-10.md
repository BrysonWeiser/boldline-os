---
name: portal-redesign-2026-10
topic: Client portal
task: change the client portal's look, its Status/results screen, reports, leads list, or the OS's Live Client View preview of it
keywords: [client portal, portal redesign, results first, kpi, cost per lead, leads per day, report history, reportHistory, portal preview, PortalPreview, live client view, one portal, makePortalHTML]
status: built 2026-10-07 on the dev branch, waiting on Bryson's OK before it goes live
summary: Bryson, 2026-10-07, "now lets look at the client portal" then "yes start". Portal now opens on RESULTS for a live client (leads 30 days + qualified, leads this month vs the same point last month, ad spend 30 days labelled "paid by you straight to Google/Meta", cost per lead, a 30-day leads-per-day bar chart, newest 3 leads, latest report teaser), with campaign progress below. New look matching the site (Inter, bigger text, full 1112px width on a computer, 2x2 tiles on a phone). Reports tab keeps past reports (new reportHistory on the client, written by report-shared). Leads show where they came from and the client's local time. Two emojis removed. The OS's second copy of the portal was DELETED; the OS preview now fetches and shows the real page.
verified: 2026-10-07
---

## What the client sees now
- **Status, once live** (stage active or later, OR any lead, OR any synced spend): four tiles, then the chart, then
  Newest leads + Your latest report side by side (stacked on a phone), then Campaign Progress and Your Campaign.
  Before launch the old progress-first screen still shows (no empty dashboard). Website-only clients never get it.
- **Numbers and where they come from** (nothing estimated):
  - Leads = `leadsLog` (our own form + call line, so complete). 30 days = rolling; months = Phoenix calendar months.
  - Month tile compares with the SAME POINT last month (`day <= today's day`), because on the 7th "7 fewer than all of
    September" made a good start read as a bad month.
  - Spend + clicks = `adPerf.totals.spend30d` / `.clicks` (ads-sync, both 30-day windows). No adPerf = a dash and
    "Shows once your ad account is connected", never $0.
  - Cost per lead = spend / leads in 30 days. Under $100 shows cents.
  - Chart: one gold series, no legend (title names it), 30 bars, each focusable with an aria-label and a hover/tap tip.
- **Reports**: latest in full, "Earlier reports" as tap-to-open rows. `withHistory()` in `netlify/lib/report-shared.mjs`
  keeps newest first, de-duplicates by sentAt, backfills from `latestReport`, caps at 26. Weekly and monthly both write it.
- **Leads**: source line ("Google ad" from gclid/wbraid/gbraid/utm_source, "Facebook or Instagram ad" from fbclid/utm,
  "Phone call from your ad" for call_tracking) and `<time data-ts>` rewritten by the page script into the client's own
  time zone. Two columns on screens 900px+.
- Look: Inter from Google Fonts, labels #8A90A2 (old #4B5563 failed contrast), every inline font size scaled up one step.
- Emojis removed: the "changes requested" card and the screenshot-attached chat bubble.

## 🔴 ONE PORTAL (the structural change)
- The OS's `makePortalHTML` copy (~210 lines) is gone. `PortalPreview` fetches `/.netlify/functions/portal?token=` and
  puts the HTML in an `<iframe srcDoc>`. srcdoc matters: the frame's address is `about:srcdoc`, which arms the portal's
  own `BL_PREVIEW` guard (blocks every non-GET, shows "Preview only"). A `src=` frame would disarm it.
- The portal's GET path must stay write-free because the OS now loads it on every view. Pinned in verify-preview-safety
  (both mutations proven caught: src= frame, and a write added to GET).
- `osShowsServedPortal()` in `tests/helpers/portal-script.mjs` replaced ~40 "both copies agree" checks across 14 suites.
  The daily health check's preview test became `previewIsLivePortal` (fails if a copy creeps back).
- The preview's caption now honestly says "Exactly what X sees ... buttons are switched off".

## Tests
`verify-portal-results` (31 checks) is new. Full suite 143/143.
