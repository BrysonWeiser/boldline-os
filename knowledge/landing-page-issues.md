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

**➕ BRAND-THEMED PER CLIENT (2026-07-22, Bryson) — landing pages use the CLIENT's branding, never BoldLine's.**
- The template no longer hardcodes BoldLine gold or a white background. `landingTheme(cl)` (exported from `landing.mjs`) returns a full palette — accent color AND light/dark mode with matching background/text/surfaces/borders/form/inputs — derived from `landingPage.brandColor` + `landingPage.theme`.
- **Accent:** `brandColor` (6-hex). Neutral slate `#334155` default (NEVER gold). Text-on-brand auto-computed by luminance; soft tint for chips/checks; deep brand-tinted offer band.
- **Theme:** `theme` = `"light"|"dark"`. A dark/premium brand gets a DARK page (near-black bg, light text, dark surfaces) with its accent — Bryson's explicit ask: don't default bright. Light default when unset.
- **AI picks both:** `generate-landing.mjs` tool schema gained `brandColor` + `theme`; system+tool prompts tell it to MATCH the client's existing brand aesthetic (from the logo/photos it sees via vision + industry), not impose a generic bright look.
- **Rendering is DUAL COPY:** live `renderLandingPage(cl)` in `landing.mjs` and the OS preview `makeLandingHTML` in `index.html` — the CSS strings are kept byte-identical (both build the same `P` palette object). Edit both together.
- Verified: real **Ceramic Pro Phoenix** rendered via the production `renderLandingPage` in light AND dark, in their red — 0px overflow at 390/768/1280/1600.
- **KNOWN LIMITATION / future enhancement:** the AI infers color+theme from the client's UPLOADED logo/photos + business type — it does NOT fetch the client's real website/socials. So best results come from uploading the client's logo. A future upgrade could fetch the client's site URL and extract its actual palette/theme; not built yet.

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

**➕➕ RICH DESIGN + WEBSITE SCRAPING + DRIFT-PROOF PREVIEW (2026-07-22, Bryson) — landing pages no longer "bland"; the "not built yet" website-scraping limitation above is now BUILT.**
- **Website scraping (real brand extraction):** a `website` field was added to the client Edit sheet (Client Info). `generate-landing.mjs` `scrapeBrand(url)` fetches the client's site (6s timeout, best-effort, never throws), extracts theme-color meta + most-used non-neutral hex colors (accent candidates) + a light/dark feel, and feeds them to the AI as "WEBSITE BRANDING SIGNALS" so brandColor + theme are grounded in the client's REAL site, not a guess. `handleGenerateLanding` sends `website`.
- **Rich, converting design:** sticky blurred header (brand dot + name + call pill), announcement/offer bar, hero with branded ambient glow + grid pattern + entrance motion + floating trust badge, trust chips, benefit cards (icon + title/desc split on em-dash, hover-lift), AI-written 3-step "how it works" (new `steps` tool output), work-photo gallery (hover zoom), vibrant gradient offer band, 2-column form (reassurance steps + card form with focus states + privacy microcopy), sticky mobile call/quote CTA bar. Conversion: multiple CTAs, prominent click-to-call, optional `bookingUrl` (CTAs deep-link to a booking page when set), single goal.
- **GOTCHA — scroll-reveal must never leave content hidden.** Sections use `.reveal`->`.in` via IntersectionObserver, but IO never fires for below-the-fold elements in a non-scrolling context (full-page screenshot, the OS preview iframe, a user who doesn't scroll) so they'd stay opacity:0 = blank (classic stuck-hidden trap; hit it in the first screenshot). Fix: a `setTimeout(showAll,1500)` safety net reveals everything regardless; reduced-motion + no-JS both render fully visible. When headless-screenshotting a reveal page, WAIT >1.5s or sections look empty.
- **Preview is now DRIFT-PROOF (no more dual copy):** deleted `makeLandingHTML` from index.html. The OS preview is a new `LandingPreview` component that POSTs the client object to `/landing` (owner-authed via Supabase session; landing.mjs gained a POST branch rendering the SAME `renderLandingPage`) and shows the returned HTML in the iframe. Preview can never diverge from the live page again.
- Verified: Ceramic Pro Phoenix (real red) in light AND dark via production `renderLandingPage` — 0px overflow at 390/768/1280/1600, no JS errors; OS recompiles clean.

**➕➕➕ PER-CLIENT DESIGN VARIANTS (2026-07-22, Bryson) — no two landing pages are clones.**
- Problem Bryson flagged: the rich template was still ONE fixed structure — every client got the same layout/motion, just recolored. He wants each page genuinely unique (reusing ideas is fine; identical-but-recolored is not).
- `designConfig(cl)` (landing.mjs) resolves 7 variant tokens from `landingPage.design` (AI-picked) or, when absent, a deterministic per-client **FNV hash of the slug/name** — so even old/ungenerated pages differ from each other. Tokens: **layout** (split | centered | overlay full-bleed photo hero), **font** (modern | elegant serif | bold), **motion** (up | side | zoom — sets `--rv` reveal transform + hero keyframe), **background** (glowgrid | mesh | dots | clean hero treatment), **benefits** (cards | list | numbered), **shape** (rounded | soft | sharp — `--r` radius scale), **order** (a | b section order). Combinations = hundreds.
- Implementation: body gets classes `lay-* bg-* mo-* be-* font-* sh-*`; most variation is shared-CSS overrides gated on those classes; hero + benefits + section-order branch in the HTML. `generate-landing.mjs` outputs a validated `design` object (enums only) and the prompt tells the AI to pick tokens that fit each business and to VARY across clients.
- Funnel, brand-theme (color + light/dark), and the reveal safety net are unchanged and apply to every variant.
- Verified 3 deliberately-distinct clients render as clearly different pages (elegant purple med-spa: overlay + serif + list; bold dark-orange roofing: split + cards + sharp; navy law firm: centered + numbered + modern) — 0px overflow at 390 + 1280, no JS errors.
