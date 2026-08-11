---
name: microsoft-clarity
topic: Marketing site
task: use, debug, or change Microsoft Clarity session recordings / heatmaps on boldlinemedia.com
keywords: [clarity, microsoft-clarity, session-recordings, heatmaps, rage-clicks, dead-clicks, scroll-depth, y0tivdizq8, cro]
status: verified
summary: Microsoft Clarity installed 2026-08-11 on EVERY marketing-site page (project y0tivdizq8, B2B Services, under the brysonaweiser@gmail.com Microsoft account). Free + unlimited session recordings and heatmaps — the CRO tool GA4 can't replace. Ships alongside GA4 via the shared ANALYTICS const in blog-render.mjs (blog) and inline heads (static pages). Verified live on /, /blog/, /privacy.html.
verified: 2026-08-11
---

## What it is / why we added it
Clarity records real visitor sessions and builds click + scroll heatmaps, free and
unlimited. GA4 tells you 40 people visited and 1 booked; Clarity shows you the other 39
stopping halfway down the packages section and leaving. For a site whose only job is
turning visitors into booked calls, that is the higher-value signal.

**Project:** `y0tivdizq8` · name "BoldLine Media" · category **B2B Services** (chosen so
Clarity benchmarks against B2B behavior — fewer visitors, longer consideration, more repeat
visits before converting — not retail).
**Login:** the Microsoft account `brysonaweiser@gmail.com` (same one as Bing Places /
Webmaster Tools — see `account-email-map`).

## Where the tag lives
Installed on **every** marketing page, same two places as GA4:
- **Blog pages** → the `ANALYTICS` const injected into `headTags()` in
  `marketing-site/netlify/lib/blog-render.mjs` (one edit covers blog-index + blog-post)
- **Static pages** → inline `<head>` in `index.html`, `404.html`, `privacy.html`,
  `terms.html`, `get-started/index.html`

The project ID is **public by design** (it ships in client-side script to every visitor),
so it is inline, not an env var — nothing for Netlify's secret scanner to catch. No CSP on
the marketing site, so `clarity.ms` needs no allowlisting.

**Verified live** (curl after deploy): `/`, `/blog/`, `/privacy.html` all return the tag.

## How Bryson should actually use it (told 2026-08-11)
Give it a couple of days of traffic first, then at `clarity.microsoft.com`:
- **Recordings** — watch 5-10 real sessions. More learning in 20 minutes than a month of GA4.
- **Heatmaps → Scroll** — how far down people get. If most stop before the packages
  section, that section effectively doesn't exist.
- **Dashboard → Rage clicks / Dead clicks** — repeated or dead clicks mark things visitors
  *expect* to be interactive. Highest-signal fix list on the whole tool.

## Related
Installing this is what surfaced the **GA4 coverage bug** — GA4 had only ever been on the
homepage, leaving the entire blog and `/get-started` unmeasured since 2026-07-22. Fixed in
the same deploy; details in `ga4-analytics`.
