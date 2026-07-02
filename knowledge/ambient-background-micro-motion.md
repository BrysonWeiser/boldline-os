---
name: ambient-background-micro-motion
topic: Marketing site
task: change or tune the site background graphics (orbs, constellation, grain) or the scroll micro-animations
keywords: [ambient, bgNet, constellation, orb, orbDrift, grain, feTurbulence, sr-in, scroll-settle, progress hairline, parallax, rootMargin, stagger, srd, glyphs, ow-g, glFloat, ad icons]
status: verified
summary: Site-wide "living canvas" background (3 aurora orbs + gold constellation canvas + film grain + 9 floating ad-ecosystem glyphs, fixed z-index -1) plus a micro-motion pass (safe scroll-settle reveals, divider draw-in, progress hairline, parallax, hover polish). All decorative/additive — no-JS and reduced-motion get a fully visible static page.
verified: 2026-07-02
---
Bryson asked (2026-07-02) for background graphics instead of the flat black screen —
"maybe even a video... but not the main attraction" — plus a smoother feel with more
micro-animations. Built as a zero-asset "living canvas" in `marketing-site/index.html`.

**The three background layers** (one `.ambient` fixed div right after `<body>`, `z-index:-1`,
`aria-hidden`, pointer-events none):
- **Aurora orbs** — 3 absolutely-positioned wrappers (`.ow-a/.ow-b/.ow-c`) each holding an
  `.orb` div with a huge soft `radial-gradient` (gold .10 / indigo .07 / gold .06) drifting on
  the `orbDrift` keyframes (46–72s, alternate). Wrapper vs child split is deliberate: JS
  parallax transforms the **wrapper** while the keyframe animates the **child**, so they never
  fight (same animation-vs-transform conflict class as the nav-hide bug).
- **Constellation canvas** (`#bgNet`) — ~80 max drifting points joined by thin gold lines when
  <130px apart (alpha ≤ .09, canvas itself `opacity:.6`). ~30fps via frame-skip, DPR capped
  1.5, desktop-only (`innerWidth >= 720`), skipped under reduced-motion. No visibilitychange
  handling needed — **rAF self-pauses in hidden tabs; adding manual resume logic can
  double-schedule the loop.**
- **Film grain** (`.grain`) — static inline-SVG `feTurbulence` tile (170px, URL-encoded data
  URI) at `opacity:.05`. Static on purpose; animated grain burns CPU for no benefit.
- **Ad-ecosystem glyphs** (`.ow-g` layer, added same day at Bryson's request for "more stuff
  related to ads") — nine inline-SVG gold line-art icons (search magnifier, click cursor,
  rising bar chart, trend line, location pin, bullseye, lead speech-bubble, megaphone, "AD"
  badge) at `opacity:.11`, each positioned in the **desktop side gutters only** (left 3.5–8%,
  right 3.5–8% — never inside the centered 1100px content column; a Playwright check asserts
  zero overlap). Each floats on its own slow loop (`glFloat`/`glFloat2`, 18–27s, staggered
  negative delays via `--gd`/`--gde` inline vars). The layer carries class `.ow` so it rides
  the existing parallax loop (its factor is the 4th entry in `factors`). Hidden `<900px`
  (phones have no gutters); `animation:none` under reduced-motion (static faint icons are
  fine — they're aria-hidden decoration). The AD-badge text uses `stroke:none;fill:currentColor`
  (`.gl-ad text`) or it renders as double-drawn outline mush. Deliberately NO fabricated
  metric text (e.g. "+38% CTR") — background numbers could read as implied performance claims.

`.alt` bands went `background:rgba(13,15,22,.88)` so a hint of orb glow bleeds through.

**Micro-motion** (CSS block is the LAST thing before `</style>` so its media queries win
source order; JS is the last `<script>` before `</body>`):
- **Scroll-settle reveals — the safe pattern (per content-visibility-no-js):** default DOM has
  NO hidden state. JS arms `.sr` (opacity 0, translateY 22px, transition w/ `--srd` stagger
  delay) **only on elements below the viewport at arm time**, so no-JS visitors, crawlers, and
  screenshots always see everything, and nothing above the fold ever flashes. IO adds `.sr-in`
  on entry. Two hard-won details:
  1. **Strip `.reveal` when arming** — its finished `fadeUp` (fill-mode both) pins opacity:1
     forever and silently defeats `.sr` (same fill-mode trap as the nav bug).
  2. **IO rootMargin `12000px 0px -7% 0px`** — the huge TOP margin means anything jumped past
     (End key, nav glide) counts as intersecting once at/above the viewport, so content can
     never get stuck hidden. Caught by testing an instant `scrollTo(bottom)`: 20 elements stuck
     with a normal rootMargin.
- **Also fixed pre-existing no-JS gap:** `.tstep` (process timeline) rested at opacity:0
  ungated → invisible for no-JS visitors. Now `html.js-tabs .tstep{opacity:0...}` (head inline
  script sets the class pre-paint, so no flash). NOTE: that selector is specificity (0,2,1) —
  the reduced-motion visibility override had to be bumped to `html.js-tabs .tstep` too.
- Divider draw-in (`.sr-in .divider` scaleX animation; default = full width), sibling stagger
  via `--srd` (index*70ms cap 420), scroll-progress hairline `#progress` (2px gold, scaleX in
  the same rAF paint as orb parallax), unified `.incl`/`.faq-item` hover, `.btn` sheen sweep
  (::after skew sweep — `.btn` got position:relative+overflow:hidden).

**Tuning knobs:** orb colors/opacities in `.ow-* .orb` gradients; drift speed = orbDrift
durations; constellation density `W*H/26000` (cap 80) + link distance 130 + line alpha .09;
grain `opacity:.05`; reveal distance/duration in `.sr`; stagger in the enhancer; parallax
factors `[.06,-.045,.09]`.

**Testing recipe (reuse this):** Playwright suite asserting (1) no pageerror; (2) canvas has
painted pixels AND the count changes between samples (i.e. actually animating); (3) no `.sr`
element inside the initial viewport; (4) settle ends at computed opacity '1'; (5) **instant
jump to bottom → zero stuck-hidden elements**; (6) `javaScriptEnabled:false` → every
section-head/pkg/tstep/faq/contact at opacity 1 (wait ~2s for the load fadeUp to finish before
measuring or you get 0.99 false-fails); (7) `emulateMedia reducedMotion` → canvas+bar
display:none, 0 armed, orb animation none; (8) 390px viewport → no canvas init, no horizontal
overflow. Gotcha: don't check the progress bar with a `'matrix(0'` substring — `matrix(0.15…)`
matches it; parse the scaleX number.

**Shell gotcha from this session:** `pkill -f "http.server 8931"` inside a compound Bash call
kills the calling shell itself (pattern matches its own command line; exit 144). Use
`kill $(lsof -ti :8931)` instead.
