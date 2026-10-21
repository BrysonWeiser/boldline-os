---
name: own-site-booking
topic: Website
task: change how a client who BOUGHT their website outright lets customers book and pay (their own booking app, phone, request form, payment link), or how they switch apps later without contacting us
keywords: [outright booking, bought outright, own booking app, square appointments, calendly, booksy, payment link, paypal, venmo, pay online, switch booking app, site files booking, download card, siteSetup, handover booking, blFiles]
status: built 2026-10-21
summary: Bryson 2026-10-21 - "make sure they dont get a website they cant use because they cant book people or take payments and make sure its fully automated so i dont have to do anything on my end", and asked whether they should be able to switch apps (Square to PayPal) without contacting us. Our Book page and card payments run on our servers (the monthly plan), so they can't go in handed-over files. The portal download card now asks, before the download: how customers book (their booking app link / they call me / they send a request) plus an optional payment link shown as "Pay online". Nothing is preselected (unless they chose before, or Bryson set a booking link or phone in the OS); both links are opened server-side first (404 or no such site refused, 403 and slow pages allowed); BoldLine links refused. Saved on websiteDeal.siteSetup (server-owned). Switching later = change it on the same card and download again, then drag the folder onto Netlify Deploys. Deliberately NOT a live redirect through us. Also fixed: the Download button (and Have BoldLine host it) read the server answer twice and showed "That did not work" on EVERY successful download.
verified: 2026-10-21
---

## What the client sees (portal, Website tab, "Your website files", once paid in full)
1. Your web address (typed twice).
2. How will customers book? Three choices, none ticked by default:
   - **Online, with my booking app** (Square, Calendly, Booksy, Housecall Pro, Urable...) reveals "Your booking page
     link" with "look for Share or Booking link".
   - **They call or text me**: every Book button calls the business phone (asks them to add it under Your
     Information if missing).
   - **They send a request and I reply**: the form opens the visitor's email app addressed to them.
3. Take payments online too? (optional) payment link (PayPal, Venmo, Square or Stripe), shown on the site as
   "Pay online" in every page's footer and on the contact page.
Then Download. Under the guide: "Switching apps later" (change it above, download again, Netlify > your site >
Deploys > drag the new folder). The card remembers their choice.

## Why a fresh download and not a live link through us (Bryson's question)
If their buttons ran through our servers, their site would break the day anything changed on our side, and they
would depend on us for a site they paid to own. Agreement WA-8 section 7 already says after handover nothing is ours
to keep running, and that changes WE make are quoted. A change THEY make themselves on the card is neither, so no
agreement change was needed. Cost to us: nothing, it's automatic.

## Where it lives
- `netlify/lib/own-site-setup.mjs`: cleanLink, cleanSetup (throws plain sentences), checkLinks (GET, 5s, refuses
  only 404/410/network failure), setupOf (saved > OS intake link/call > nothing), applySetup (sets `intake` +
  `__payLink`), setupWords, appName (Square/Calendly/PayPal... for plain words).
- `site-export.mjs`: `setup` option, read-me "Booking and payments" section with the exact links for a developer.
- `site-render.mjs`: `payLinkOf(cl)` renders "Pay online" only when `__payLink` is set (export only; hosted sites
  take payment through their Book page).
- `portal.mjs` siteFiles handler: cleanSetup + checkLinks BEFORE exportSiteFiles; saves `websiteDeal.siteSetup`
  {how, link, pay, savedAt}; commLog line every download ("Changed how customers book or pay..." when switched);
  green alert only on first download / new domain, now saying "nothing for you to do". Returns `words`.
- `site.mjs` export (Bryson's OS download) uses the saved choice too. OS Website tab shows `setupLine` under the
  handover step.

## 🔴 The bug found while building this
`blFiles` and `blHostAsk` did `blPost(...).then(r => r.json())`, but `blPost` already returns parsed JSON, so every
successful download threw and showed "That did not work. Please try again." Never caught because tests only grepped
the script. `tests/verify-own-site-booking.mjs` now RUNS the button in a fake browser (success downloads, server
error shown word for word, no choice never calls the server). Lesson: a portal button needs a run-it test, not a regex.

## Tests
`tests/verify-own-site-booking.mjs` (53 checks): link cleaning, refusals (no choice, BoldLine links, dead links),
files use the choice on every page, read-me, card states, the button in a fake browser, server order of checks.
Four widths checked (390/768/1280/1600): no sideways scroll, nothing spills out of the card.
