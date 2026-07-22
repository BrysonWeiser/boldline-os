---
name: landing-page-issues
topic: Pending
task: fix the client landing-page generator — broken /lp/ link (404) and weak AI output
keywords: [landing.mjs, landingSlug, landingPage, notFoundPage, comingSoonPage, /lp/, landing-generator, two-netlify-sites]
status: open
summary: The OS AI landing-page generator has two problems flagged by Bryson 2026-07-21 while prepping the Meta demo — (1) the live /lp/<slug> link returns the "Page not found / This link may have expired" page, and (2) the generated content quality is weak. PARKED BY CHOICE until after the Meta App Review screencast is submitted; then investigate + fix.
verified: 2026-07-21
---

**Status: OPEN — parked by choice until the Meta App Review demo is recorded + submitted** (Bryson's sequencing, 2026-07-21). Do not block the Meta demo on this; the demo ad points at `https://boldlinemedia.com` instead of a generated landing page.

**Two problems (surfaced 2026-07-21 on client DetailKing ATL):**

1. **Live link 404s.** Opening the generated landing URL returns the **`notFoundPage()`** in `netlify/functions/landing.mjs` — the exact copy "**Page not found / This link may have expired or is no longer active**".
   - CRITICAL diagnostic: that is the **slug-didn't-resolve** branch (landing.mjs ~L23–31: no slug, OR no client row matches `data->>landingSlug`, OR a Supabase lookup error). It is **NOT** the unpublished branch — an existing-but-unpublished page renders **`comingSoonPage()`** ("*This page is being finished up. Check back shortly.*", L35, gated on `!lp.published || !lp.headline`). So this is not merely "hit Publish."
   - Leading hypotheses to check first:
     a. The generator isn't saving a **`landingSlug`** onto the client record (so the slug in the URL matches no row). Verify the client's `data.landingSlug` in Supabase vs the slug in the URL that was opened.
     b. The `/lp/<slug>` link is built as `window.location.origin + "/lp/" + slug` in the OS (see MetaLaunchCard `landingDefault`), which uses the **OS origin**. Landing pages may be intended to serve from a different Netlify site / origin (see `two-netlify-sites`) or the `/lp/:slug → /.netlify/functions/landing?slug=:slug` redirect may be missing on the origin being hit. Confirm which site owns the `/lp/` route and that the redirect exists there.
     c. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set on the site serving `landing.mjs` (a lookup error also falls to `notFoundPage`).

2. **Generated content quality is weak** (Bryson: "the landing page sucked"). Revisit the generation prompt / structure once the link works. Generator sees the client's actual images (vision) and can pick a hero — see `os-client-media-upload`.

**When resuming:** reproduce with the exact client + slug, check (a)/(b)/(c) above in order, fix the routing/slug-save first (so the link resolves), then improve the AI output. Re-verify the rendered page headless at the four standard breakpoints (`responsive-standards`).
