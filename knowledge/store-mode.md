---
name: store-mode
topic: Landing pages
task: build or change a landing page for a client who sells online (e-commerce / Shopify) instead of taking enquiries
keywords: [store mode, storeUrl, shopify, ecommerce, e-commerce, shop link, buy, product page, no form, utm, fbclid, gclid, attribution, air suds, constantine, forwarding, discount code, checkout]
status: verified
summary: ONE FIELD (`cl.storeUrl`) turns a lead-gen landing page into a shop page — buttons go to the client's store with the ad's tracking attached, the enquiry form is removed entirely, and every default (button, steps, trust row, chips, eyebrow, closing block) switches from quoting language to buying language. The AI copy writer is told too, so a shop client's draft never comes back asking for a quote. Tracking forwarding is a NAMED LIST (STORE_FORWARD_KEYS in attribution.mjs), never a pass-through, because Shopify applies `?discount=CODE` straight off a storefront URL. Settable by the client in the portal and by Bryson in the OS edit sheet. Pinned by tests/verify-store-mode.mjs (140 checks) + shop rows in verify-lead-handoff.
verified: 2026-09-16
---

## Why it exists

Air Suds (Constantine, closed 2026-09-16) sells a bottle of waterless car wash straight off a
fresh Shopify store. Bryson: *"i still think we build a landing page and then connect it to his
Shopify"* and *"make sure everything is done right so it's automated as much as possible and the
parts that either party has to do is as simple as possible"*. Most e-commerce clients from here
on are this shape, so it is a MODE, not a one-off page.

Every default in `landing.mjs` was written for a local service business. On a shop each one is a
promise nobody is going to keep: "Get a fast, free quote" on a page selling an $11 bottle is not
slightly off, it is describing a different business.

## The switch

`cl.storeUrl` — the page where the visitor can actually buy. Present = shop mode. Absent =
nothing about any existing client's page changes, which is half of what the test file guards.

What flips, all from that one field:

| Thing | Lead page | Shop page |
|---|---|---|
| Buttons | `#lead-form` or booking URL | the store, tagged, `data-store="1"` |
| Enquiry form | rendered | **removed entirely** (not hidden) |
| Capture layout | form in the hero | falls back to split (no empty panel) |
| Button text default | Get My Free Quote | Shop Now |
| Eyebrow default | Trusted local service | Shop direct |
| Steps default | Tell us what you need / free quote / we handle the rest | Pick what you need / Check out in a minute / It arrives, and keeps arriving |
| Trust row | Free quotes, Fast response | Ships straight to you, Cancel any time |
| Chips | Free quote no obligation, Fast response | Secure checkout, Questions? Call us |
| Closing block | form + "no pressure, no obligation" | "Ready when you are" + buy button |

🔴 **The quote promise is written in FOUR places** (trust row, chip row, steps, closing block).
The first pass fixed the trust row only and the page still printed "Free quote, no obligation"
from the chip row. Fix one, check the other three.

## The tracking, which is what the billing rests on

The agreement counts a Qualified Sale from the **client's own order records**. Meta and Google
hang their click ids (`fbclid`, `gclid`, `wbraid`, `gbraid`) on the ad's URL, which lands on OUR
page, not on the shop. Drop them there and the shop records an unattributed order, the platform
cannot match the purchase, and there is no evidence a sale came from the ads.

So there are **three sources of tracking on a store link, and the order between them matters**:

1. **What the client typed** into their own shop link — always wins, they meant it.
2. **What the visitor arrived with** — beats our defaults, because it names the real campaign.
3. **Our defaults** (`utm_source=boldline`, `utm_medium=paid`, `utm_campaign=<page slug>`) —
   baked into the href so a visitor with JavaScript off is still attributed at all.

🔴 The first version got 2 vs 3 backwards: the baked-in `utm_source=boldline` sat in the way of
the real `utm_source=google` on every click, so every sale in the client's shop would have been
credited to "boldline" and none of them to the campaign that produced it. `withTags()` now
returns the list of keys **we** invented (`filled`), the page ships it as `SD`, and the script
may replace only those.

🔴 **FORWARDING IS A NAMED LIST, NOT A PASS-THROUGH.** `STORE_FORWARD_KEYS` in
`netlify/lib/attribution.mjs` = the click ids + the five UTM tags + `fbclid`, `ttclid`,
`msclkid`. Copying the whole query string would let anyone who can write a URL append a
parameter to a link our ads pay for, and **Shopify applies `?discount=CODE` straight off a
storefront URL** — one posted link and the client's margin is gone, out of a budget they paid
for. The test proves `?discount=FREESTUFF` does not survive.

## Where it gets set (both sides, deliberately)

- **Client, in the portal:** a card "If People Buy Straight From Your Website". They are the only
  one who knows which page they want the money spent sending people to.
  🔴 `storeUrl` has its OWN line in `sanitizeFields` with a 500-character clip. The ad-account ID
  loop clips to 60, and a product link with a collection path runs well past that — a clipped one
  looks saved and goes nowhere, and every paid click lands on a broken address.
  🔴 The portal exists in TWO files (`portal.mjs` + the preview inside `index.html`). Change both.
- **Bryson, in the OS:** "Where people buy (turns the page into a shop)" under Campaign Details
  on the client edit sheet. Top level (like `bookingUrl`), not inside `campaignSetup`.

## The copy writer knows too

`generate-landing.mjs` takes `storeUrl` and, when present, swaps in a `shopBlock`: no quote /
enquiry / callback language, ctaText is a buying button, the 3 steps are the buying path, FAQs
are a shopper's questions. Only the PRESENCE of the link is used — the address never reaches the
model, because a model handed a URL writes the URL into the copy. **All three callers pass it**
(the options writer, the single Generate button, and the overnight autobuild draft); miss one and
the mode is on for the page and off for the words.

## Tests

- `tests/verify-store-mode.mjs` — 140 checks across all four layouts plus hand-off, booking and
  national. Runs the forwarding script against a DOM stub rather than reading the source, because
  reading it is how a dead script passes for a working one. 11 mutations verified: pass-through
  forwarding, capture layout keeping its form, each of the four quote-language defaults, our
  placeholder blocking the real source, portal dropping or clipping the field, mode never turning
  on, booking beating the shop.
- `tests/verify-lead-handoff.mjs` — shop rows added to the standing safety fixtures (no BoldLine
  link, no relative hrefs, no emojis, no `//` comments). 🔴 **One narrow exemption:** those checks
  now read the DESTINATION of each link with the query string stripped, because a store link
  legitimately carries `utm_source=boldline`. That tag is not a link back to us and a visitor
  cannot follow it anywhere; it is the evidence the per-sale billing rests on. Page COPY is still
  checked for our name exactly as strictly as before, with only the tracking tags de-tagged.
- `tests/verify-field-formats.mjs` — its "three carrier-filed pages" check used to count
  `blUrl` boxes and assert exactly 3, which quietly meant "no other box on this page may ever ask
  for a link". Now checked per field by name.

## Verified

No horizontal scroll, no page errors, zero forms and every section rendering at 390 / 768 / 1280
/ 1600 on all four layouts (headless Chromium, 2026-09-16). Full suite 104 suites / 0 failures.

## Still open

- The landing page and the Shopify store are two different domains, so Shopify's own analytics
  sees a referral rather than a direct ad click unless the client's Meta dataset is connected
  (portal step already asks for it, data sharing Maximum). Worth checking on Constantine's store
  once it exists.
- Nothing yet reads sales BACK from Shopify. Billing is still on the client's own order records,
  as the contract says. A Shopify read would need an app, which is parked.
