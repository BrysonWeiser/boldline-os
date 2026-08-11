---
name: site-performance
topic: Marketing site
task: diagnose or change boldlinemedia.com page speed, Core Web Vitals, fonts, analytics loading, or Lighthouse accessibility
keywords: [pagespeed, lighthouse, core-web-vitals, LCP, FCP, TBT, self-hosted-fonts, woff2, variable-font, render-blocking, deferred-analytics, contrast, wcag, main-landmark, aria-checked, icon-png]
status: verified
summary: 2026-08-11 performance + accessibility pass. Baseline was mobile 60 (FCP 3.9s / LCP 5.4s) vs desktop 94 — the gap was render-blocking Google Fonts plus a 499KB gtag.js on a throttled CPU. Fixed by self-hosting Inter + Playfair as variable woff2, deferring GA4/Clarity to first-interaction-or-idle behind synchronous command-queue shims, shrinking icon.png 79KB→15KB, and closing the Lighthouse a11y gaps (main landmark, aria-checked, three WCAG-AA contrast lifts). Verified live.
verified: 2026-08-11
---

## Baseline (2026-08-11, before)
| | Mobile | Desktop |
|---|---|---|
| Performance | **60** | 94 |
| FCP / LCP | 3.9s / 5.4s | 1.0s / 1.2s |
| TBT | 330ms | 90ms |
| CLS | **0** | **0** |
| Accessibility | 91 | 91 |
| Best Practices | 100 | 96 |
| SEO | 100 | 100 |

Mobile is emulated **Moto G Power on Slow 4G** — deliberately punishing. Desktop being
fine confirmed the bottleneck was CPU + critical-path, not payload size.

## The four fixes

**1. Self-hosted fonts (the ~900ms render-block).** The Google Fonts `<link>` blocked
first paint and cost two extra DNS+TLS handshakes (fonts.googleapis.com then
fonts.gstatic.com). **Both Inter and Playfair Display are VARIABLE fonts** — Google serves
one woff2 per subset covering the whole weight range, so self-hosting is only 2 files per
family (latin + latin-ext), not one per weight. Files live in `marketing-site/fonts/`;
`@font-face` blocks are duplicated in `index.html`'s inline `<style>` and in `blog.css`
(the two stylesheets). The two latin files are `<link rel=preload as=font crossorigin>`.
`latin-ext` ships but only downloads when a page actually contains those characters
(unicode-range), so an English visitor pays 86KB — the same bytes Google served.
**To change a font: rename the file** (the cache header is `immutable`, 1 year).

**2. Deferred analytics.** `gtag.js` is **~499KB** — most of the mobile main-thread time.
The `dataLayer`/`gtag` and `window.clarity` **command queues are still defined
synchronously**, so any early call is buffered and replayed; only the network fetch waits.
Loading starts on the first `pointerdown`/`keydown`/`touchstart`/`scroll`, or
`requestIdleCallback` after `load`, whichever fires first. Verified by request timeline:
load at 12906ms, gtag at 12943ms. **Trade-off Bryson accepted:** visitors who leave inside
~2s won't be counted.

**3. `icon.png` 79KB → 15.6KB** via `Image.quantize(colors=64, method=FASTOCTREE)`. The
mark is flat black + gold so mean error is 0.86/255 (a max-channel delta of 20 exists but
only on a few anti-aliased edge pixels — a side-by-side at 180px is indistinguishable).
Still 512×512 RGBA, still valid as favicon / apple-touch-icon / JSON-LD logo.

**4. Cache headers** (`marketing-site/_headers`): `/fonts/*` immutable 1 year; images 30
days (NOT a year — these filenames aren't content-hashed, so a logo swap still needs to
propagate).

## Accessibility 91 → the three real defects
- **No `<main>` landmark on any page.** Added to `index.html`, `404.html`, `privacy.html`,
  `terms.html`, and to blog pages by emitting `<main id="main">` at the end of
  `headerHTML()` and `</main>` at the start of `footerHTML()` in `blog-render.mjs` (placed
  so the newsletter signup stays *inside* the landmark). This is also the likely cause of
  the **"Agentic Browsing: accessibility tree is not well-formed"** 2/3 flag.
- **`role="radio"` requires `aria-checked`.** The review star-rating spans only had
  `aria-label`. `paint()` did set `aria-checked`, but not until it ran — so the initial
  HTML was invalid. Now hardcoded `aria-checked="false"` in the markup.
- **Three WCAG-AA contrast failures** (computed against the real backgrounds
  `#080a0f` / `#0d0f16` / `#0f121a`):
  | Element | Was | Ratio | Now | Ratio |
  |---|---|---|---|---|
  | `--faint` body/caption grey | `#6B7280` | 4.10 | `#7D8394` | 4.55-4.81 |
  | footer copyright | `#4B5260` | 2.52 | `var(--faint)` | 4.55+ |
  | empty review stars (30px) | `#3A3F55` | 1.91 | `#5B6171` | 3.02 (large-text needs 3.0) |

  ⚠️ One `#6B7280` was **injected by JS** (the Google-review-button caption in the reviews
  script), so it bypassed the CSS variable entirely. Grep for hardcoded hexes, not just vars.

## Gotchas for next time
- **A naive contrast checker produces false positives on translucent and gradient
  backgrounds.** Two "failures" survived to the end and both were fine: gold text on
  `rgba(200,168,75,0.12)` (checker read the tint as opaque gold → ratio 1.0), and the
  newsletter Subscribe button's dark text on a `linear-gradient` gold fill (checker only
  reads `backgroundColor`, which is transparent). **Always confirm against computed styles
  or a screenshot before changing a colour.**
- **Chromium in this sandbox has no outbound network** (`ERR_CONNECTION_RESET`), and the
  gcloud proxy port doesn't work for it. Verify against a LOCAL `python3 -m http.server`
  instead; third-party scripts simply won't load, which is usually fine.
- **The Bash tool's cwd resets between calls.** A `cd marketing-site` in one call does not
  persist reliably — a grey replacement silently landed in the **OS app's** root
  `index.html` instead of the marketing site's. Caught by `git status` and reverted.
  **Use absolute paths in every command.**

## Still open
- **Desktop Best Practices 96: "Browser errors were logged to the console."** Not
  reproducible from here (no outbound network in headless Chromium) and not
  `reviews-list` (that returns 200 live). Bryson needs to open the site, F12 → Console,
  and report what's red.
- Re-run PageSpeed after this deploy to confirm the mobile score.
