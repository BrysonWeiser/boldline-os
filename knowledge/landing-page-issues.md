---
name: landing-page-issues
topic: Pending
task: fix the client landing-page generator — broken /lp/ link (404) and weak AI output
keywords: [landing.mjs, landingSlug, landingPage, notFoundPage, comingSoonPage, /lp/, landing-generator, two-netlify-sites]
status: resolved
summary: The OS AI landing-page generator had two problems (flagged 2026-07-21) — both FIXED 2026-07-22. (1) The live /lp/<slug> link 404'd because landing.mjs is a NEW-format function (req.url = original URL) so the /lp/:slug rewrite's ?slug= never arrived — now parses the slug from the path (per KB netlify-new-format-function-req-url). (2) The template was a bare 480px phone-column at every width — rebuilt into a full responsive page (split hero, trust chips, benefit-card grid, work-photo gallery, offer CTA band, card lead form, OG meta). Live renderer landing.mjs + OS preview makeLandingHTML updated together (dual copy). Verified live at 390/768/1280/1600 — zero horizontal overflow.
verified: 2026-07-22
---

**✅ RESOLVED 2026-07-22.** Both problems fixed + deployed to production; live page verified headless at all four breakpoints (0px overflow). Details below.

**THE FIXES (2026-07-22):**
- **404 → fixed:** root cause was the new-format-function req.url gotcha (NOT unpublished, NOT a missing slug). `landing.mjs` now does `url.pathname.match(/^\/lp\/([^/]+)\/?$/)` and falls back to `?slug=` for direct calls. Confirmed: the exact URL that returned 404 now serves HTTP 200 with the client's page.
- **Quality → fixed:** replaced the 480px single-column template with a responsive, data-rich page that pulls from existing client fields (campaignSetup.serviceArea/mainOffer, brandVoice.differentiator, mediaLibrary photos). Sections: top bar (name + tap-to-call), split hero (copy | hero image on ≥940px), trust chips, benefit-card grid, "Recent work" photo gallery (≥2 photos), dark offer-CTA band, card lead form, footer. Lead-form POST to `lead-intake?token=` unchanged. **DUAL COPY like the portal:** live renderer = `netlify/functions/landing.mjs`; OS preview = `makeLandingHTML` in `index.html` — edit both together.
- The AI copy generator (`generate-landing.mjs`) was left as-is — its output was fine; the page just had nowhere good to *show* it. Richer client data (fill serviceArea/mainOffer/differentiator + upload work photos) now automatically makes a fuller page.

**(historical) Two problems (surfaced 2026-07-21 on client DetailKing ATL):**

1. **Live link 404s.** Opening the generated landing URL returns the **`notFoundPage()`** in `netlify/functions/landing.mjs` — the exact copy "**Page not found / This link may have expired or is no longer active**".
   - CRITICAL diagnostic: that is the **slug-didn't-resolve** branch (landing.mjs ~L23–31: no slug, OR no client row matches `data->>landingSlug`, OR a Supabase lookup error). It is **NOT** the unpublished branch — an existing-but-unpublished page renders **`comingSoonPage()`** ("*This page is being finished up. Check back shortly.*", L35, gated on `!lp.published || !lp.headline`). So this is not merely "hit Publish."
   - Leading hypotheses to check first:
     a. The generator isn't saving a **`landingSlug`** onto the client record (so the slug in the URL matches no row). Verify the client's `data.landingSlug` in Supabase vs the slug in the URL that was opened.
     b. The `/lp/<slug>` link is built as `window.location.origin + "/lp/" + slug` in the OS (see MetaLaunchCard `landingDefault`), which uses the **OS origin**. Landing pages may be intended to serve from a different Netlify site / origin (see `two-netlify-sites`) or the `/lp/:slug → /.netlify/functions/landing?slug=:slug` redirect may be missing on the origin being hit. Confirm which site owns the `/lp/` route and that the redirect exists there.
     c. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set on the site serving `landing.mjs` (a lookup error also falls to `notFoundPage`).

2. **Generated content quality is weak** (Bryson: "the landing page sucked"). Revisit the generation prompt / structure once the link works. Generator sees the client's actual images (vision) and can pick a hero — see `os-client-media-upload`.

**When resuming:** reproduce with the exact client + slug, check (a)/(b)/(c) above in order, fix the routing/slug-save first (so the link resolves), then improve the AI output. Re-verify the rendered page headless at the four standard breakpoints (`responsive-standards`).
