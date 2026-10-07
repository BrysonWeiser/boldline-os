---
name: marketing-site-pages
topic: Marketing site
task: edit, add or restyle a page on boldlinemedia.com (BoldLine's own marketing site), or change its menu, footer, homepage or the test-copy guard
keywords: [scroll motion, scroll animations, pinned hero, word fill, view transitions, lenis, smooth scroll, mo-pin, hero headline, We only earn more when your phone rings more, multi-page site, marketing-src, build-marketing-site, generator, site.css, site.js, test-copy.js, pages, /ads/, /websites/, /pricing/, /how-it-works/, /about/, /free-check/, /contact/, nav, menu, footer, homepage redesign, homepage refresh, h-hero, bento, cta band, old hash links, HOME_REDIRECTS, sitemap pages, llms.txt, readSite, tests/helpers/marketing-site.mjs, verify-marketing-pages, test copy, branch deploy, not live]
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
