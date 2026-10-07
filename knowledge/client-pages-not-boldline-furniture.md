---
name: client-pages-not-boldline-furniture
topic: Working preferences
task: design, build or change a client's landing page or website, add a default trust line, chip, badge or tick row to the landing renderer, or decide what furniture every client page gets
keywords: [checkmark, check mark, tick, trust row, chip row, chips, free quotes, fast response, free quote no obligation, secure checkout, ships straight to you, feels cheap, client landing page, landing renderer, default furniture, looks like boldline]
status: standing rule
summary: Bryson, 2026-10-07, on the handyman sample landing page - client pages had bits that look like BoldLine's own site and "it feels cheap". He named the little checkmark lines - the hero trust row ("Mesa, AZ ✓ Free quotes Fast response") and the pill row ("✓ Free quote, no obligation"). Both default rows are now gone from every client landing page (a page only shows them if it writes its own, as BoldLine's audience pages do), and the ✓ benefit tiles and photo-badge tick became brand-colour accents. Live 2026-10-07. Pinned in verify-landing-pages.
verified: 2026-10-07
---

## What he said
*"Something I noticed is on the websites we are building that some of the things are like how my
website is and I don't want that for all websites if any because it feels cheap."* Asked which parts,
he picked only **"Little checkmark lines"**.

## What changed (2026-10-07, dev branch first)
- `renderLandingPage` (`netlify/functions/landing.mjs`) no longer writes a DEFAULT hero trust row or
  a DEFAULT chip row, for lead pages or store pages. Gone: "✓ Free quotes", "Fast response",
  "✓ Free quote, no obligation", "Serving <town>" chip, the differentiator chip, "✓ Ships straight to
  you", "✓ Cancel any time", "✓ Secure checkout", "Questions? Call us".
- `lp.trust` / `lp.chips` written on the page itself still render (escaped, de-duplicated as before).
  BoldLine's own audience pages (`audienceFurniture` in `netlify/lib/landing-pages-shared.mjs`) use
  that and keep their rows: that is HIS site's look, which is the point.
- The town still appears once, in the footer ("Name · Serving Eugene, OR · phone"), and national
  businesses still get "Working with businesses nationwide" there instead.
- Real client effect: Stencil & Thread's live page loses both rows the moment this reaches `main`.

## Guard
`tests/verify-landing-pages.mjs` "a client's page carries none of BoldLine's checkmark lines" renders a
lead page and a store page and fails if either row, any of the old default lines, or a stray tick is
back. Mutation-proven (restoring the old renderer fails it). Store-mode, market-research and motion
checks were re-pointed at page-written rows.

## Then the benefit ticks too (2026-10-07, Bryson said "Yes")
- The big ✓ tiles on "Why choose us" (`.bico`) are now a short brand-colour accent bar (a 28px line
  above each card's heading; a 3px vertical bar in the list layout). The ✓ in the hero photo badge
  (`.bdot`) is now a small brand-colour dot. BoldLine's own site still uses its own ticks.
- The guard now fails on ANY ✓ outside the stylesheet on a client page, across cards and list
  layouts, and asserts the fixture really renders the tiles and the badge (so it can't pass on nothing).

## Rule going forward
Don't add BoldLine-style furniture (tick rows, "Free quote, no obligation" pills, generic trust
strips) as a default on client pages. Anything like that has to be written for that client, or not
be there.
