---
name: marketing-site-pages
topic: Marketing site
task: edit, add or restyle a page on boldlinemedia.com (BoldLine's own marketing site), or change its menu, footer, homepage or the test-copy guard
keywords: [multi-page site, marketing-src, build-marketing-site, generator, site.css, site.js, test-copy.js, pages, /ads/, /websites/, /pricing/, /how-it-works/, /about/, /free-check/, /contact/, nav, menu, footer, homepage redesign, homepage refresh, h-hero, bento, cta band, old hash links, HOME_REDIRECTS, sitemap pages, llms.txt, readSite, tests/helpers/marketing-site.mjs, verify-marketing-pages, test copy, branch deploy, not live]
status: built on the dev branch 2026-10-06/07, NOT LIVE. Waiting on Bryson's "go" before merging to main.
summary: boldlinemedia.com went from one long page to eight pages (Home, Ads, Websites, Pricing, How it works, About, Free Lead-Leak Check, Contact) built by scripts/build-marketing-site.mjs from pieces in marketing-src/. Edit the pieces, never the generated pages; verify-marketing-pages fails if they drift. Not merged: Bryson must say "go" after seeing the test copy.
verified: 2026-10-07
---

## Why
Bryson, 2026-10-06: *"it still feel old and outdated and like there is a lot of scrolling. What if we also add
pages ... I want people to be able to quickly get to spots and have dedicated pages instead of quickly scrolling
to them."* Then: *"Yes start on it."* Colours stayed black and gold on purpose (a rebrand means redoing the logo,
OS, portal and every email).

## 🔴 Not live yet
All of this sits on the dev branch only, together with the earlier homepage re-skin. **Do not merge dev into
main until Bryson says "go"** on the homepage. He reviews it on the Netlify test copy
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
