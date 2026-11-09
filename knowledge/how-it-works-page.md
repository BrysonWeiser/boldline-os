---
name: how-it-works-page
topic: Marketing site
task: change the How it works page (/how-it-works/): its steps, the your-part/our-part box, the three ways in, the fit check, or its scroll motion
keywords: [how it works, how-it-works, process page, hw-steps, hw-step, hw-rail, hw-split, hw-ways, hw-fit, how.html, howPage, fit section, timeline, step pictures, Example label]
status: LIVE 2026-11-09 (Bryson said go)
summary: Bryson, 2026-11-09 - How it works was "the only page where it doesnt look nor feel like its at the same level as the rest of the website". Old page was a plain five-line timeline, a row of icons and a checklist, and still said clients start around $1,000/month with no mention of websites or Complete. Rebuilt as marketing-src/how.html: a hero with a "Your part / Our part" box (call, approve + connect ad account, answer the phone vs everything else), a six-step timeline (call, plan, build, launch, every week, every month) where a gold line fills as you scroll and each step's small picture plays once (invite, written plan, checklist ticking, leads arriving, the week's change log, monthly report), three ways in (Ads / Complete / Website, prices from pricing-shared), a two-sided fit check (strong fit / probably not yet) with the trades strip, and the FAQ in the same header style as other pages.
verified: 2026-11-09
---

## How it is built
- Markup: `marketing-src/how.html`. The build (`howPage()` in `scripts/build-marketing-site.mjs`) strips its top comment
  and fills `{{MIN_AD}} {{COMPLETE}} {{BUILD}} {{CARE}} {{TRADES}} {{CAL}}` from `pricing-shared.mjs` and the TRADES list;
  an unknown placeholder fails the build. The old `process.html` and `fit.html` parts were deleted.
- Styles: the `hw-` block near the end of `marketing-src/new.css`. Motion: a few lines in the scroll loop in
  `marketing-src/site.js` set `--hp` on `.hw-steps` and add `.lit` to each step once (it stays lit).
- 🔴 Motion is additive. Without `html.mo` (reduce motion, data saver, slow or low-memory phones) the rail is full,
  nodes are gold and nothing is dimmed. Keep every dimming/animation rule prefixed `html.mo`.
- Every picture with made-up numbers carries an "Example" pill; pictures are `aria-hidden`.
- The budget line keeps the exact sentence "You always own and pay for your own ad account" because
  `verify-landing-pages` checks the site still promises what BoldLine's own landing page claims.
- No dates in comments in `new.css` (it ships publicly: `verify-public-source`). No hyphenated marketing words
  (`verify-no-dashes` flagged "same-day").

## Guard
`tests/verify-how-it-works.mjs` (29 checks): prices from the price list, copy rules, Example labels, the no-motion
page is finished, one h1, and the anchors other pages link to (#process, #fit, #faq, plus #plans).
