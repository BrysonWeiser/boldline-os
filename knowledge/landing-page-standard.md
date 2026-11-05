---
name: landing-page-standard
topic: Ads
task: make the ad landing pages (clients, his own businesses, BoldLine's /for/ pages) look better and feel alive
keywords: [landing page standard, landing page design, more alive, landing animations, headline words, hero drift, glint, mood font, lrate, rating on landing page, STD_CSS, aliveJS, landing upgrade 2026-11]
status: built
summary: Bryson, 2026-11-05 - "update them to our new standard like we did for the websites. I dont want anything crazy but I want the landing pages to look better and be more alive". Layered on top of landing.mjs (STD_CSS + aliveJS), every older rule intact - bigger type and room, headline rises word by word (script only, full line kept for screen readers), hero photo settles in and drifts with the scroll, gallery photos open as they arrive, step tops and section-label lines draw in, the hero button glints now and then, their REAL rating up top when known, and a proper typeface by the page's mood when there is no website or Brand kit font. Test copy first; tests in verify-landing-standard.
verified: 2026-11-05
---

## What changed (one renderer: netlify/functions/landing.mjs)
Covers every page it renders: client pages at /lp/<slug> and their own domains, Bryson's own businesses, BoldLine's
audience pages at boldlinemedia.com/for/<name>, and the four sample landing pages on the marketing site.
NOT boldlinemedia.com/get-started: that one is hand-built in marketing-site/ and already follows the marketing site's style.

- **`STD_CSS`** (after the base css, before kit/brand/mood fonts so those still win): wrap 1200px, headline up to 66px,
  sections 64 to 104px, bigger card/step/review text, section labels with a line that draws in, step cards with a top edge
  that draws in, gallery tiles grow into place (scale .94 to 1 on the TILE, not the img: an img scaled past its frame failed verify-gallery-uniform, which measures img vs frame), hero photo `settle` keyframe then `translate:0 var(--py)` drift,
  hero CTA `glint` every 7s (a shine, exempt from the no-sideways rule like `sheen`; phones never hover so never saw sheen),
  taller hero on computers.
- **`aliveJS`** (ES5, no comments: shipped verbatim to hand-off domains): splits the headline into `.hw` words with
  `aria-label` on the h1 (the HTML stays the whole line, so no-JS and crawlers read it normally); hero photo drift via rAF.
  Both skip for reduce motion; the reduced-motion block also nails the new transforms to none.
- **Rating chip** (`.lrate`) beside the eyebrow from `ratingOf` (site-render): Google profile stats or a typed rating with
  count and source, never invented.
- **Mood font** when there is no website kit and no Brand kit font: modern Plus Jakarta Sans (body too), bold Archivo,
  elegant Playfair Display (not Fraunces, see website-builder). Loaded without blocking first paint. A business with a
  website keeps the website's typefaces (siteBrandKit); verify-brand-match now asserts "no borrowed website look" instead of
  "no Google Fonts at all".

## Rules it keeps (all still green)
verify-landing-motion (nothing rests invisible; loops on transform/opacity only; `glint` added to EXEMPT with the reason),
verify-lead-handoff (no BoldLine links, no relative hrefs, no emojis, no `//` comments in shipped script),
verify-landing-grid/variants/pages/target, verify-store-mode, verify-preview-safety.
