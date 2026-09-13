---
name: check-false-alarms
topic: OS app
task: debug a daily-check alert, or work out whether a reported landing page fault is real
keywords: [false alarm, daily check wrong, landing page 404, landing page loads returned 404, check is wrong, crying wolf, landingUrlFor, pageImages, lp slug, landingDomain, landing page images missing, images not loading, blank tile, gallery tile empty, photo did not load, alt text filename, IMG_6360-cropped, camera filename on page, reveal animation, gitem background]
status: built
summary: The daily check emailed "Stencil & Thread's landing page loads: returned 404" while the page was fine. It had been fetching `/.netlify/functions/landing?c=<id>` and `landing.mjs` HAS NO `c` PARAMETER — it resolves a client by `/lp/<slug>` or by host, so that URL 404s for every client forever: a check whose only possible outcome was failure. Now built by `landingUrlFor`, preferring the client's own domain (what the ads point at) and falling back to `/lp/<slug>`, skipping when neither is set. The check also now fetches the page's images, which is the thing Bryson was actually looking at and the one thing it never tested. On the missing photo: every image served 200 with valid pixels; what he caught was a tile laid out at full size with nothing in it yet, which on a dark page is a black square. Tiles now carry a surface colour and the first four load eagerly. 56 checks, 17 mutations caught.
verified: 2026-09-13
---

**Bryson, 2026-09-13**, on the 6:40am alert: *"I just got this email and I looked for myself and
the landing page is still working good it loads the only issue is not all the images loaded so
fix that but also make sure the checks are correct and not just throwing out problems to throw
them out"*.

## 🔴 The check could not have passed

It fetched `/.netlify/functions/landing?c=<client id>`. **`landing.mjs` has no `c` parameter.**
It resolves a client two ways and only two: `/lp/<slug>` on our domain, or the host header
(which is how a client's own subdomain reaches it). So `?c=` fell through to the host branch,
matched the Netlify hostname against nobody's `landingDomain`, and returned the 404 page.

That URL would have 404'd for **every client, every day, forever**. It was not detecting a
fault. It was reporting its own.

He is right that this is worse than no check at all. An alarm that cries wolf on day one is an
alarm nobody reads on the day it is telling the truth, and each false one costs him a morning.

**The rule now enforced:** the address the checker builds must be an address the router can
actually resolve. `tests/verify-false-alarms.mjs` reads the routing rules out of `landing.mjs`
and fails if they drift, including a direct assertion that no `?c=` parameter exists.

`landingUrlFor(client, base)` prefers the client's **own domain** when set, because that is what
the ads point at and the only address a visitor ever types. `/lp/<slug>` is the fallback.
Neither set is a **skip**, never a failure.

## The check now looks at the photos

Everything it did asked whether the HTML arrived. Nothing asked whether the pictures in it did,
which is exactly what he was looking at. `pageImages` pulls every `<img src>`, decodes `&amp;`
(fetching it verbatim sends a literal `amp;` and 400s on every resized photo — a brand new false
alarm of the same kind), skips `data:` and relative URLs, dedupes, and caps at 8 so a
thirty-photo gallery does not turn a health check into a crawl.

## The missing photo: nothing was broken

All four images on Sebastian's page returned **200 with valid JPEGs**, verified directly, at the
sizes the resizer produced. What he saw was a **gallery tile laid out at full size and faded in
on schedule with nothing in it yet**. Reproduced by holding one image back: the tile sits at full
opacity and full height, empty, beside two tiles showing photos. On a dark page that is a black
square, and a black square is what a dead image looks like.

Two changes, both honest about their size:
- **`.gitem` now has a surface background**, so an unfilled tile reads as a slot still filling
  rather than a hole. This is the one that matters.
- **The first four photos are not lazy.** Measured in Chrome this changes almost nothing (70ms
  versus 15ms; the gallery is near enough the viewport that lazy fetches it anyway), so it is
  **insurance, not the fix** — Safari's lazy threshold is its own and could not be tested here.

## 🔴 What was nearly broken while fixing this

The first diagnosis was that the scroll animation un-hides a tile and then **re-hides** it on the
way past, leaving loaded photos invisible. It was measured with a settle shorter than the 600ms
fade, so the "blank tiles" were the fade itself, mid-flight. Re-measured properly: **zero** tiles
are ever left settled-invisible.

That nearly reversed a feature Bryson explicitly asked for on 2026-09-02 (*"make sure the up and
down animation happens even after a person has scrolled through the whole page"*).
`verify-landing-motion` caught the attempt. **Measure past the animation before calling an
animation a bug**, and a suite asserting an old decision is the record of that decision.

## The camera filename on his client's live page

`alt="IMG_6360-cropped"` was on the advertised page. The filter existed; the crop editor's
suffix walked past it, because the pattern was fully anchored and `-cropped` broke the anchor.
Editor suffixes (`cropped`, `crop`, `edited`, `copy`, `final`, `resized`, `(2)`…) are now
stripped before the test. **The test stays fully anchored on purpose**: matching those ordinary
English words anywhere in a label would silently replace every properly written description with
the business name, which is a worse bug and an invisible one. Seven real descriptions containing
those words are pinned in the suite.
