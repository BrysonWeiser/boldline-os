---
name: marketing-site-pages
topic: Marketing site
task: edit, add or restyle a page on boldlinemedia.com (BoldLine's own marketing site), or change its menu, footer, homepage or the test-copy guard
keywords: [plan finder, pricing slider, website pricing, trade pages, industries, car detailing, handyman, Northline, Cedar and Nail, lead journey, journey of one lead, compare, BoldLine vs a typical agency, sample websites, examples, /examples/, sample site, Saguaro Pool, sample-guard, sample-bar, verify-sample-sites, scroll motion, scroll animations, pinned hero, word fill, view transitions, lenis, smooth scroll, mo-pin, hero headline, We only earn more when your phone rings more, multi-page site, marketing-src, build-marketing-site, generator, site.css, site.js, test-copy.js, pages, /ads/, /websites/, /pricing/, /how-it-works/, /about/, /free-check/, /contact/, nav, menu, footer, homepage redesign, homepage refresh, h-hero, bento, cta band, old hash links, HOME_REDIRECTS, sitemap pages, llms.txt, readSite, tests/helpers/marketing-site.mjs, verify-marketing-pages, test copy, branch deploy, not live]
status: LIVE on boldlinemedia.com since 2026-10-06 ~5:30pm Phoenix (merge 44286da, rollback/20261007T003255Z). Test copy (Netlify branch deploy) still to be switched on, on the 10pm reminder, for FUTURE website changes.
summary: boldlinemedia.com went from one long page to eight pages (Home, Ads, Websites, Pricing, How it works, About, Free Lead-Leak Check, Contact) built by scripts/build-marketing-site.mjs from pieces in marketing-src/. Edit the pieces, never the generated pages; verify-marketing-pages fails if they drift. LIVE since 2026-10-06 evening (Phoenix). Future website changes go to the Netlify test copy first, once it is switched on.
verified: 2026-10-07
---

## Why
Bryson, 2026-10-06: *"it still feel old and outdated and like there is a lot of scrolling. What if we also add
pages ... I want people to be able to quickly get to spots and have dedicated pages instead of quickly scrolling
to them."* Then: *"Yes start on it."* Colours stayed black and gold on purpose (a rebrand means redoing the logo,
OS, portal and every email).

## ✅ Live (2026-10-06 evening, Phoenix)
Bryson: *"Let make it live but I still want to do that test site tonight."* Merged and verified: all eight pages,
/get-started/, /blog/, /privacy, sitemap (29 urls) answer 200; Netlify picked up the `contact` and `recommendation`
forms on their new pages (it injects `form-name`, and rewrites attributes with single quotes, so grep for
`name='contact'`). Rollback: `rollback/20261007T003255Z` (pre-merge `314a7cb`).
Going forward, website changes are meant to be looked at on the test copy before they go live, once it exists.
Previously: all of this sat on the dev branch, waiting for his "go". He reviews it on the Netlify test copy
(`<branch>--boldline-media.netlify.app`, branch deploys enabled via the 10pm Netlify reminder). Any other
unit of work that must ship before then has to be cherry-picked onto main on its own.

## How it is built
- `marketing-src/` (outside the published folder) holds the pieces: `base.css` (the original styles),
  `new.css` (the new design: `h-hero`, `bento`, `steps3`, `page-hero`, `cta-band`, `footer.x-foot`),
  `site.js` (every former inline script; each one bails out when its elements aren't on the page, so one
  shared file serves all pages), the head pieces, and one file per old homepage section
  (services, websites, process, faq, founder, reviews, leadleak, contact, newsletter ...).
- `scripts/build-marketing-site.mjs` defines the page list, the shared header/menu/footer, and the new
  homepage. `node scripts/build-marketing-site.mjs` writes the pages + `site.css`, `site.js`, `test-copy.js`.
  `--check` exits 1 if what is committed isn't what the pieces build.
- The first `<h2>` of a page that opens on an old section is promoted to its `<h1>`, so every page has one.
- `/how-it-works/` builds its FAQ structured data from the visible FAQ, so the two can't disagree.
- Old links like `boldlinemedia.com/#services` (ads, bookmarks, emails) are forwarded by a tiny script on
  the homepage to the page that now holds that section (`HOME_REDIRECTS`).
- The privacy, terms, 404 and blog pages are still hand-written; their menus were switched to the new pages.

## The test-copy guard on every page
Generated pages inline it straight after `<meta charset>`. The hand-written pages (privacy, terms, 404, every
blog page via `headTags` in `blog-render.mjs`) load the same code as `/test-copy.js`, first in `<head>`. Their
analytics `load()` now also checks `window.__TEST_COPY` (that gap existed before this work too).

## Tests
- `tests/helpers/marketing-site.mjs`: `readSite()` (every page + site.js), `SITE_PAGES`, `serveSite()` (a
  local server for browser tests, because pages load `/site.css` which a `file://` address can't resolve).
  The 15 suites that used to read the single homepage now read the whole site through it.
- `tests/verify-marketing-pages.mjs`: generated files match sources; every internal link resolves (Netlify
  serves `/privacy` from `privacy.html`); every `#jump` has a target on its page; no `/#section` links; one h1,
  own canonical, own title per page; every page in the sitemap; every old `/#x` link forwards to a real page.
  Mutation-checked (hand edit, broken link, page dropped from sitemap all fail it).

## Fixed along the way
- FAQ said management starts at **$350/month**; the real minimum is **$400**. Corrected, plus `llms.txt`
  (which also said "local businesses", against the standing rule, and didn't mention websites).

## Scroll motion (2026-10-07, also not live)
Bryson: *"Can you add some scroll animations."* Styles at the end of `marketing-src/new.css`, script at the end of
`marketing-src/site.js`. All of it hangs off `html.mo`, which the script adds ONLY when the visitor hasn't asked
for reduced motion and the device isn't on data saver, 2G or under 4GB memory. Without it the page is complete.
- **Homepage hero, wide screens (>=1060px):** the page holds for a moment while the sample site straightens and
  comes forward to fill the screen, then lets go (`html.mo-pin`, sticky inside `.h-pin`; `--e` 0..1 from scroll;
  `--dx/--dy/--s` measured on resize). Smaller screens: gentle parallax only, no hold.
- **Word by word:** section headings and the founder quote light up as they scroll through.
- **Steps:** a gold line draws through the three steps and each lights in turn (vertical on phones).
- **Tiles:** land one after another; the lead feed plays when you reach it; with a mouse they lean toward the
  pointer under a soft gold light.
- **Page to page:** cross-fade with the header held still (CSS view transitions, no script).
- **Smooth scrolling:** Lenis, mouse/trackpad only, loaded after the page is idle, pinned version + SRI hash
  (same one the client-site builder uses). Popups, the mobile menu and text boxes opt out.
- Gotchas hit while building: the `.reveal` load animation (`fill: both`) on `.h-visual` silently overrode the
  scroll transform (so nothing moved); `overflow:hidden` on `.h-hero` stopped `position:sticky` (use `clip`);
  the old homepage's `.float-toast{top;right}` in base.css plus the new `left;bottom` stretched the "New enquiry"
  bubble over the whole picture. Also: the gold gradient line (`background-clip:text`) clipped the tails of "p" and "g" at line-height .98 (Bryson spotted it); fixed with `padding-bottom:.16em;margin-bottom:-.16em` on `.h-title .g`. All of these are pinned by `tests/verify-marketing-motion.mjs` (browser, 4 widths,
  off-switches, every heading fully lit, steps lit, headline on 3 lines; mutation-checked).

## Hero copy (2026-10-07, proposed, not live)
Bryson felt the first thing you see was outdated. Agreed in part: "Slow weeks. Inconsistent leads. We fix both."
named the pain well but was written when BoldLine only sold ads, and it said nothing about why BoldLine over any
other agency. Replaced on the dev branch with the one thing competitors can't say, the pay model:
**"We only earn more when your phone rings more."** Accurate against the pricing model (the fee is the plan
minimum or the per-lead fee, whichever is higher, so it only rises with qualified leads). It does NOT say "we only
get paid when", because the minimum means we're paid either way and a prospect would catch that.
Sub: what we do + every call traced to the ad. The founder quote further down makes the same point in his words,
on purpose. Alternatives offered to him: "Your ads and your website, run by one team that's paid on results." and
keeping the pain line as the opener.

## 2026-10-07 bug: the example lead feed in the homepage ads tile was blank everywhere
Bryson spotted an empty Google and Meta ads tile on his phone. The motion CSS paused the feed until `.bento`
got `.sr-in`, but `.bento` is not in the scroll-reveal groups, so it never did (on any width, since motion
shipped). The motion script now watches `.bento` itself with threshold 0 (the grid is taller than a phone
screen, so a ratio-based reveal would never fire) and adds `.in` once. Also added the caption "An example of your
lead feed" so a prospect never reads the made-up rows as real client data. `verify-marketing-motion` now
requires all three rows visible at every width (mutation-checked).
Bryson asked about results in that tile: the feed stays as the placeholder; swap in a real result once a
client allows one to be shared (never an invented number).

## Sample websites (2026-10-07, BUILT on the dev branch, NOT LIVE until Bryson says "go" on the test copy)
Bryson: *"if someone click on it it not only shows that one specific home page but a full mini website with
animations and everything"*, then "Yes build that and we can eventually make a page showing real clients".
- `/examples/<cinematic|aurora|editorial>/` + services/about/reviews/contact: the made-up Saguaro Pool Co.
  (`scripts/site-showcase-demo.mjs`) rendered by the REAL builder (`renderSite`) inside
  `scripts/build-marketing-site.mjs`, so they always match what clients get (drift fails `--check`).
- Links rewritten to stay inside the sample (works on the test copy too); JSON-LD stripped (no fake
  LocalBusiness on our domain); photos served from `marketing-site/img/sample/` (downloaded from Pexels, free
  licence) instead of hot-linking; noindex meta + `X-Robots-Tag` for `/examples/*`; not in the sitemap.
- 🔴 `marketing-src/sample-guard.js` is the FIRST script: every non-GET fetch is faked, beacons are no-ops, and
  any submit is stopped with a plain note. Without it the contact form POSTs to /lead, which boldlinemedia.com
  forwards to the OS lead intake (proven by mutation).
- `marketing-src/sample-bar.html`: fixed 44px bar ("Sample site", "made-up business" line, design switcher,
  Back to BoldLine, Book a call); phones keep "Sample" + "Exit". Client header pushed down via `.hd{inset:44px..}`.
- Demo email changed to `hello@saguaropools.example` (reserved, can't be anyone's); phone is a 555-01xx number.
- Linked from each design card on /websites/ ("Open the full sample site") and the homepage hero caption.
- `tests/verify-sample-sites.mjs` (234 checks, browser + network watch, mutation-checked); sms-consent and
  privacy-disclosure scanners skip `examples/` with the reason written in.
- Later: a real-clients page, once a client agrees to be shown.
🔴 While this sits unmerged, the dev branch is ahead of main with unapproved site work. Don't merge dev into
main for other work until he says "go"; cherry-pick that work onto main instead.

## 2026-10-07: sample websites LIVE + new link preview picture
Bryson: "Make it live right now" (skipped the test copy). Merged; /examples/* answers 200 on boldlinemedia.com.
He also saw that sharing the URL still showed the OLD site ("Slow weeks. Inconsistent leads.") in iMessage. The
preview is a saved picture (`og-image.jpg/png`), not the page. New one: `marketing-src/og-card.html` rendered by
`scripts/build-og-image.cjs` to `marketing-site/og-boldline.jpg` (1200x630). NEW FILE NAME on purpose: iMessage,
Facebook and LinkedIn cache previews per image address (and `_headers` caches images 30 days), so overwriting the
old file would keep showing the old picture. All pages, blog pages and blog JSON-LD point at it.
`verify-marketing-pages` fails if the card's headline differs from the homepage's (mutation-checked): when the
headline changes, edit og-card.html, re-render, and rename the file again.
Note for Bryson: a phone that already showed the old preview for a link may keep it for that conversation; new
shares (and other phones) get the new one. Facebook/LinkedIn can be forced with their preview debuggers.

## 2026-10-07 evening: pricing redesign, trade pages, lead journey, comparison page (dev branch, NOT LIVE)
Bryson asked what more animation, pages and a pricing redesign would look like, then "Let's do all of that in your order".
1. **/pricing/**: plan finder (budget slider 500..30,000+, shows the plan + minimum, and the Google+Meta plan from
   $5,000) and a slow-month/busy-month bar visual of "whichever is higher". Plans come from `PACKAGES` as
   `data-plans` (no hand-typed prices). Website pricing block (`#website-pricing`) from `WEBSITE_OFFER`. The
   E-Commerce tab is hidden (`.tab-more`) behind "See the online store plans" (`data-open-tab`), cards untouched so
   the package tests still match.
2. **Trade pages**: `/industries/`, `/industries/car-detailing/`, `/industries/handyman/` (TRADES in the generator).
   Each opens its own sample site: `DEMO_DETAIL` "Northline Auto Detailing" (aurora, chrome scene) at
   `/examples/car-detailing/`, `DEMO_HANDY` "Cedar and Nail Home Repair" (editorial) at `/examples/handyman/`.
   Photos: Pexels (free licence) hosted in `img/sample/<trade>-<id>.jpg` (StockSnap and Unsplash block downloads;
   Wikimedia public-domain photos were too amateur). Gotcha: in the editorial design a long `lineB` gets clipped by
   the line-reveal mask, so keep hero lines short. Linked from the homepage strip, footer and mobile menu.
3. **Ads page**: `marketing-src/journey.html`, "the journey of one lead": six steps (search, ad, landing page, form,
   owner's lock screen, monthly report labelled "Example"), pinned 420vh under `html.mo`, tabs otherwise. Phone
   mockup keeps 320px proportions and uses `zoom` on small screens (shrinking width cut the contents off).
4. **/compare/**: BoldLine vs a typical agency, 8 rows, other column hedged ("often", "some"), names nobody.
Tests: plan finder checked at every budget step; website prices pinned; sample-site suite covers trade samples;
journey plays 0..5 in order at 390/1280 and is tappable tabs with motion off. Full suite 134/0.
- 2026-10-07: /compare/ on phones rebuilt after Bryson said it "looks a little crazy": no boxes or repeated labels;
  each row is a gold topic line, BoldLine's answer with a gold check, then one quiet "A typical agency:" line.
- 2026-10-07: trades 3 and 4 added: `/industries/epoxy-floors/` (sample `DEMO_EPOXY` "Ironwood Floor Coatings",
  cinematic, NO photos: no usable free epoxy-floor photos were found, and car-wash shots on tile floors would mislead;
  its trade-page picture is a render of the sample's own first screen, `img/sample/epoxy-hero.jpg`, made by
  `scripts/build-trade-shots.cjs`) and `/industries/window-tint/` (sample `DEMO_TINT` "Blackline Tint and Film",
  aurora, Pexels shots from the same car-care shoot as the detailer, `img/sample/tint-*.jpg`). Fixed: industry
  card images stretched tall because the width/height attributes beat aspect-ratio (added height:auto).
  Swap real floor photos into the epoxy sample when Bryson or a floor client provides some.
- 2026-10-07: epoxy sample now has images: RENDERINGS made in the browser (`marketing-src/epoxy-renders.html`, saved
  by `scripts/build-trade-shots.cjs` as `img/sample/epoxy-1..3.jpg`: flake swatch from above, metallic swirl shader,
  coated garage in perspective). Alt text says "Rendering of ...". Order in `DEMO_EPOXY.stock` matters: the builder
  pairs photos with services by position (garage, metallic, flake). Wikimedia/Openverse/StockSnap had nothing usable.
  Bryson then said make it live: the whole evening batch (pricing slider, four trade pages + samples, lead journey,
  comparison page, epoxy renders) merged to main.

## Sample LANDING pages (2026-10-07, dev branch, waiting on "go")
Bryson: *"Since we have full website previews let's also do landing page previews for the ads side."*
`/examples/<trade>/landing/` for detailers (split layout), handyman (capture), epoxy (centered), tint (overlay):
`LANDING_DEMOS` in `scripts/site-showcase-demo.mjs` feeds the four made-up businesses to the REAL
`renderLandingPage` (netlify/functions/landing.mjs). Same treatment as the sample sites: guard first, "Sample
landing page" bar (links: Its website / Landing page / Back to the trade page / Book a call), noindex, JSON-LD
stripped, photos local. The sample websites' bar now flips to their landing page too. Linked from each trade page
("Or see the landing page we'd send your ads to") and an Ads page gallery ("What your ads land on") whose card
pictures are `img/sample/lp-<trade>.jpg` from `scripts/build-trade-shots.cjs`. `.hdr` (sticky landing header) is
pushed below the bar.
🔴 Real-client bug found and fixed on the way: the OVERLAY layout's `.hero-ovc` set `padding:0 0 8px`, wiping the
wrap's 20px side padding, so on a phone the headline touched the screen edge on every overlay page. Now
`padding:0 20px 8px`. `verify-sample-sites` checks the headline margin at 390 on all four layouts (mutation-checked).
