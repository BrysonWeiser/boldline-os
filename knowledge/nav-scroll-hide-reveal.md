---
name: nav-scroll-hide-reveal
topic: Marketing site
task: change or tune how the header/nav bar behaves while the page is scrolled (not nav-link clicks)
keywords: [nav-hidden, onScroll, lastY, runStartY, runDir, header.scrolled, translateY, auto-hide nav, sticky header, momentum scrolling, per-event delta, animation-fill-mode, nav-in, navDown, fill-mode both, animation overrides transform]
status: verified
summary: Header auto-hides (slides up) on >60px continuous scroll-down and reveals on >10px scroll-up or near top. Two shipped bugs fixed same day — per-event delta (never tripped on trackpads) AND the intro animation's fill-mode:both permanently overriding the hide transform. See Gotchas.
verified: 2026-07-02
---
Bryson didn't want the pill nav permanently glued to the top of the viewport while
scrolling (felt "out of place"), but still wanted it reachable without hunting. Fix:
auto-hide-on-scroll-down / reveal-on-scroll-up, same pattern as most modern sites.

**Where it lives:** `marketing-site/index.html`.
- CSS: `header{...transform:translateY(0);transition:transform .35s cubic-bezier(.4,0,.2,1)}`
  and `header.nav-hidden{transform:translateY(-140%)}` near the top `<style>` block (~line 56).
- The one-time intro drop animation is on **`header.nav-in .nav-inner`** (the pill), NOT on
  `header` itself — this is deliberate, see bug #2 below.
- JS: the `onScroll` handler in the `header.scrolled` script (~line 1145–1175) tracks
  `lastY` (previous scroll position), `runStartY` (where the current continuous up/down
  run began) and `runDir` (1 = down, -1 = up). Each event: recompute `dir`; if it flipped,
  reset `runStartY = lastY` and `runDir = dir`; then `traveled = y - runStartY`.
  - `y < 80` or mobile menu open → always show (removes `.nav-hidden`).
  - `dir===1 && traveled > 60` (60px+ continuous down) → add `.nav-hidden`.
  - `dir===-1 && traveled < -10` (10px+ continuous up) → remove `.nav-hidden`.
  - Otherwise leave the class untouched (sticky — no flicker right at the threshold).

**Gotchas / history — this feature shipped broken TWICE before it worked. Two independent bugs:**

- **Bug #1 — per-event delta never tripped on trackpads (fixed same day):** the first
  version compared each scroll event only to the *immediately previous* event
  (`delta = y - lastY`, threshold ±4px), updating `lastY` every single event. Real
  trackpad/momentum scrolling fires many events of just 1–3px each, so that per-event delta
  almost never crossed 4px. Reproduced only by simulating scroll as many small ticks
  (`mouse.wheel(0,2)` × hundreds), not one big jump. Fixed by tracking cumulative distance
  since the last direction reversal (`runStartY`/`runDir`).

- **Bug #2 — the intro animation permanently overrode the hide transform (the one that
  actually mattered; fixed on Opus):** even after bug #1, Bryson still saw "it still doesn't
  work." Cause: the header's intro drop was `header.nav-in{animation:navDown … both}`. CSS
  **`animation-fill-mode: both` keeps applying the animation's final keyframe forever**, and
  **a running/filled animation's property value wins over a normal class-based declaration.**
  navDown's `to{transform:translateY(0)}` therefore permanently overrode
  `.nav-hidden{transform:translateY(-140%)}` — the class toggled but the header never moved.
  Fix: move the intro animation off `header` onto the inner pill (`header.nav-in .nav-inner`,
  and the matching `prefers-reduced-motion` selector) so the header's own `transform` is free
  for the scroll hide/show. Two elements, no conflict.
  - **THE key testing lesson:** bug #2 hid behind bug #1's test because *both* Playwright
    checks only asserted `header.classList.contains('nav-hidden')` — which was `true` the
    whole time. **When testing a show/hide, assert the element's ACTUAL rendered position**
    (`getBoundingClientRect().top` going negative/off-screen, or
    `getComputedStyle(el).transform` becoming a non-identity matrix), never just the class
    that's *supposed* to cause the movement. A class toggling is not proof the pixels moved.
  - General rule this burned in: **`animation-fill-mode: forwards/both` will silently beat
    any `transform`/`opacity`/etc. you set elsewhere on the same element via class or inline
    style.** If an element needs both a one-shot intro animation AND a later toggled
    transform, put them on different elements (or remove the animating class once it's done).
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
