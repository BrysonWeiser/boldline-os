---
name: adblock-safe-names
topic: Marketing site
task: a page or part of a page shows blank or white for some visitors only, or naming classes/ids on the marketing site, landing pages or client websites
keywords: [white screen, blank page, ad blocker, adblock, ublock, adguard, page-ads, g-ad, ads page white, class names, cosmetic filter, hidden element]
status: fixed and live 2026-10-07; guarded by tests/verify-adblock-safe.mjs
summary: The /ads/ page was a white screen on Bryson's Chrome but fine on his girlfriend's computer and his phone. Cause - ad blockers' generic hide rule `.page-ads`, and the builder stamped `page-<id>` on every page's body, so the Ads page's whole body was hidden for anyone with a blocker. Body now carries `data-page="<id>"` instead; the mock Google result `.g-ad` became `.serp-card`, the homepage card `.b-ads` became `.b-paid`. A test fails on any class/id segment like ad/ads/advert/sponsor/banner across built pages, site styles/scripts, and the client landing/website templates.
verified: 2026-10-07
---

## How it was found
- The first guess (Chrome's page cross-fade) was removed on 2026-10-06 and did not fix it, because the real cause only
  shows with an ad blocker installed. The tell: one person's Chrome fails, another computer and phones are fine.
- Checked the page URL against EasyList, AdGuard Base, EasyPrivacy, uBlock filters: `/ads/` itself is NOT blocked
  (only `/ads/index.` is, and nothing links there). Then applied every generic `##selector` hide rule (~41k) to each
  built page in headless Chrome: `/ads/` hit `.page-ads` on BODY (7,652px tall) and `.g-ad`. All other pages clean.
- Recipe (scratchpad, re-creatable): download the lists, collect `##` rules without domains, run
  `document.querySelectorAll(sel)` for each on each page, print hits.

## Rule going forward
- Never name a class or id with an ad-like segment (ad, ads, advert*, sponsor*, banner, adbox, adslot, adunit), on our
  site, landing pages, or client websites. Visitors are business owners and many run blockers. Words that merely
  contain the letters (head, badge, shadow, add-on) are fine; the test splits on - and _.

## Same day: blurry homepage zoom
- Bryson said the site looked low resolution on his computer. The source pictures are sharp (2880px). The blur was
  `will-change:transform` on `.h-visual`, the sample site that grows on scroll: Chrome paints a will-change layer once
  at its starting size and stretches that bitmap as it scales up. Removed the hint so it repaints at the shown size.
  Headless Chrome does not reproduce the stretch (software raster), so it can only be confirmed on a real GPU.
- Also: the About page hero was left-aligned above a centred story; `pageHero(..., centred=true)` adds `ph-centre`.
