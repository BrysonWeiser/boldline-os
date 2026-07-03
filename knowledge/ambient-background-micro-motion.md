---
name: ambient-background-micro-motion
topic: Marketing site
task: change or tune the site background graphics (orbs, constellation, grain) or the scroll micro-animations
keywords: [ambient, bgNet, constellation, orb, orbDrift, grain, feTurbulence, sr-in, scroll-settle, progress hairline, parallax, rootMargin, stagger, srd, blueprint, bp-card, bp-ret, bp-fun, bp-cur, ow-g, alt band]
status: verified
summary: Site-wide "living canvas" background (3 aurora orbs + gold constellation canvas + film grain + 4 large "campaign blueprint" wireframes, fixed z-index -1) plus a micro-motion pass (safe scroll-settle reveals, divider draw-in, progress hairline, parallax, hover polish). .alt bands are transparent — the background flows uniformly. All decorative/additive — no-JS and reduced-motion get a fully visible static page.
verified: 2026-07-03
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
  <130px apart (alpha ≤ .09, canvas itself `opacity:.6`). ~30fps via frame-skip, skipped under
  reduced-motion. **Runs on mobile too** (Bryson 2026-07-03: phones looked plain) with a
  lighter profile chosen in `size()`: <720px → 20–26 points, LINK 110, DPR ≤1.25; desktop →
  area/26000 capped 80, LINK 130, DPR ≤1.5. No visibilitychange
  handling needed — **rAF self-pauses in hidden tabs; adding manual resume logic can
  double-schedule the loop.**
- **Film grain** (`.grain`) — static inline-SVG `feTurbulence` tile (170px, URL-encoded data
  URI) at `opacity:.05`. Static on purpose; animated grain burns CPU for no benefit.
- **Campaign-blueprint wireframes** (`.ow-g` layer). **History:** v2 was nine small floating
  ad icons (magnifier, cursor, megaphone, "AD" badge…) on bobbing float loops — **Bryson
  rejected them as "lazy and childish"** (2026-07-03). The premium replacement (v3): **four
  LARGE fine-line wireframes, nearly still** — a ghost search-ad skeleton (`.bp-card`, rotated
  -4°, top-left), a targeting reticle whose dashed inner ring rotates once per 120s
  (`.bp-ret`, top-right), a conversion funnel whose dots narrow 5→3→1 gold lead (`.bp-fun`,
  mid-left), and a rising performance curve with soft gradient area fill, pulsing endpoint
  rings, and a dashed projection line (`.bp-cur`, bottom-right). Stroke-width 1, opacity
  .08–.10; slight bleed under the content column edges is fine at that opacity.
  **Design lesson: fewer/larger/finer/stiller reads expensive; many small bobbing icons read
  clip-art.** Motion is limited to the reticle spin, endpoint pulse, and dash drift — depth
  comes from the layer riding the parallax loop (class `.ow`; its factor is the 4th `factors`
  entry). Under reduced-motion the spin/dash stop and the pulse rings are `display:none`
  (their resting keyframe would show as stray circles). **Mobile (<900px): reticle + curve
  STAY** at reduced size/opacity, deliberately cropped off the right edge (negative right
  offsets — safe because `.ambient` is fixed + overflow:hidden, per mobile-glow-overflow);
  only the busier ghost-ad card + funnel are hidden (phones have no gutters).
  **v4 additions (2026-07-03, Bryson asked for platform logos + ad dashboards):** an
  ads-manager dashboard wireframe (`.bp-dash`, right gutter ~44%) and Instagram + Meta marks
  as hairline OUTLINES (`.bp-ig`/`.bp-meta`, left gutter) — deliberately line-art references,
  not brand-color logos (fits the blueprint language and avoids trademark-styling issues).
  7 desktop pieces total; the three new ones are hidden `<900px`. All still — the "no bobbing"
  rule holds. The dashboard bleeds ~40px under the wide content column edge like the other
  large pieces; that's by design (invisible behind opaque cards, whisper opacity in gaps) —
  only the small logos must stay strictly inside the gutters. Skeleton "text" bars
  use `class="fl"` (`fill:currentColor;stroke:none`). Deliberately NO fabricated metric text
  (e.g. "+38% CTR") — background numbers could read as implied performance claims.
- **`.alt` bands are transparent** (same session): #included/#founder previously drew a
  card-colored full-width band with top/bottom borders — the only blocks interrupting the
  ambient flow, and Bryson flagged the "one black block." Cards inside carry their own
  contained styling, so the band was pure legacy. If a new section needs distinction, use
  contained cards, not full-width bands.

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
display:none, 0 armed, orb animation none; (8) 390px viewport → lighter canvas drawing+animating, reticle+curve visible
(card+funnel hidden), no horizontal overflow. Gotcha: don't check the progress bar with a `'matrix(0'` substring — `matrix(0.15…)`
matches it; parse the scaleX number.

**Shell gotcha from this session:** `pkill -f "http.server 8931"` inside a compound Bash call
kills the calling shell itself (pattern matches its own command line; exit 144). Use
`kill $(lsof -ti :8931)` instead.
