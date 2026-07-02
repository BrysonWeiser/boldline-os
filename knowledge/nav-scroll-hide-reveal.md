---
name: nav-scroll-hide-reveal
topic: Marketing site
task: change or tune how the header/nav bar behaves while the page is scrolled (not nav-link clicks)
keywords: [nav-hidden, onScroll, lastY, runStartY, runDir, header.scrolled, translateY, auto-hide nav, sticky header, momentum scrolling, per-event delta]
status: verified
summary: Header auto-hides (slides up) on >60px continuous scroll-down and reveals on >10px scroll-up or near top, instead of staying permanently fixed/visible. Uses cumulative run-distance, NOT per-event delta (that was a shipped bug — see Gotchas).
verified: 2026-07-02
---
Bryson didn't want the pill nav permanently glued to the top of the viewport while
scrolling (felt "out of place"), but still wanted it reachable without hunting. Fix:
auto-hide-on-scroll-down / reveal-on-scroll-up, same pattern as most modern sites.

**Where it lives:** `marketing-site/index.html`.
- CSS: `header{...transform:translateY(0);transition:transform .35s cubic-bezier(.4,0,.2,1)}`
  and `header.nav-hidden{transform:translateY(-140%)}` near the top `<style>` block (by the
  existing `header`/`header.nav-in` rules, ~line 56).
- JS: the `onScroll` handler in the `header.scrolled` script (~line 1145–1175) tracks
  `lastY` (previous scroll position), `runStartY` (where the current continuous up/down
  run began) and `runDir` (1 = down, -1 = up). Each event: recompute `dir`; if it flipped,
  reset `runStartY = lastY` and `runDir = dir`; then `traveled = y - runStartY`.
  - `y < 80` or mobile menu open → always show (removes `.nav-hidden`).
  - `dir===1 && traveled > 60` (60px+ continuous down) → add `.nav-hidden`.
  - `dir===-1 && traveled < -10` (10px+ continuous up) → remove `.nav-hidden`.
  - Otherwise leave the class untouched (sticky — no flicker right at the threshold).

**Gotchas / history:**
- **v1 shipped bug (fixed same day):** the first version compared each scroll event only
  to the *immediately previous* event (`delta = y - lastY`, threshold ±4px), updating
  `lastY` every single event. Real trackpad/momentum scrolling fires many events of just
  1–3px each, so that per-event delta almost never crossed 4px and **the nav never hid in
  real use** — Bryson reported "nav bar is still there when I scroll, nothing has changed"
  even though the deploy had gone out correctly (verified live HTML matched the repo).
  Root cause only reproduced by simulating scroll as many small ticks (`mouse.wheel(0,2)`
  × hundreds) instead of one big jump — a single large jump (what the original test used)
  masked the bug. **Lesson: always test scroll-based JS with fine-grained simulated
  ticks, not one big wheel jump** — real input devices rarely move the scroll position in
  one shot. Fixed by tracking cumulative distance since the last direction reversal
  instead of frame-to-frame delta.
- This is a *different* script/concern from `nav-scroll-transition` (that one is the
  eased-glide + fade veil that runs when you *click* a nav link; this one is about the
  header's own visibility while the user free-scrolls). Don't conflate the two — they
  coexist in the same file but don't interact.
- Mobile menu (`.nav-mobile.open`) forces the header visible so opening the menu never
  gets hidden mid-interaction.
- To sanity-check a live deploy actually shipped (vs. a logic bug), `curl -s
  https://boldlinemedia.com/ | grep -o nav-hidden` and diff the served `<script>` block
  against the repo — faster than guessing browser-cache vs. code issues.
- Verify with Playwright: simulate BOTH a fine-grained scroll (many `mouse.wheel(0,2)`
  ticks, no waits) and a coarse jump, in both directions, plus near-top behavior.
  Playwright itself isn't in this repo's node_modules; it's only globally available at
  `/opt/node22/lib/node_modules/playwright` — run test scripts from that directory (`cd`
  there) so ESM resolution finds it, since `NODE_PATH` doesn't affect ESM resolution.
