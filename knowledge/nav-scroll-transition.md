---
name: nav-scroll-transition
topic: Marketing site
task: change or tune the nav-link scroll animation and fade transition on the marketing site
keywords: [veilPeak, navFade, nav-arrive, glide, blScrollTo, easeInOutCubic, scroll-padding-top, scroll-behavior]
status: verified
summary: Nav-link clicks glide (custom eased scroll) + soft fade veil to the section. Tune it via the NAV config object in a script near the end of marketing-site/index.html.
verified: 2026-07-02
---
Clicking an in-page anchor (#services / #process / #contact, the FAQ "see packages" link, the recommender "see package" button) is intercepted by a delegated click handler that does a custom requestAnimationFrame eased scroll (easeInOutCubic) instead of the browser's smooth-scroll, plus a dark **fade veil** (`#navFade`) that ramps 0 → peak → 0 during the glide, and a **"settle"** animation on the arrived heading (`.nav-arrive`).

**Where it lives:** one `<script>` near `</body>` in `marketing-site/index.html`; its CSS (`#navFade`, `@keyframes navSettle`, `.nav-arrive>...`) sits near the top of `<style>` by the `html{scroll-behavior...}` rule.

**Tune via the `NAV` object** at the top of that script:
- `veilPeak` — max dim of the fade (0 = none … 1 = black). **Currently 0.7.** On this dark site a dark veil mostly mutes the bright text/cards, so ~0.5 reads subtle, ~0.7 is a clear dip. Stills look heavier than it feels live (the dim flashes past).
- `fade:false` → "Option 1": glide + settle, NO veil (the fallback Bryson asked to keep).
- `duration` (~820ms base, scales with distance), `arriveCue` (heading settle on/off), `glide`.

**Gotchas / rules:**
- JS sets `scroll-behavior:auto` on load so the rAF loop isn't fought by CSS smooth-scroll; CSS keeps `scroll-behavior:smooth` + `scroll-padding-top:96px` as the no-JS fallback (also stops anchors tucking under the fixed pill nav).
- SEO-safe: only the transition animates, content is never hidden (see content-visibility-no-js). Honors `prefers-reduced-motion` (instant jump, no veil). User wheel/touch/keys interrupt the glide.
- Exposed as `window.blScrollTo(el)`; the recommender button reuses it.
- Verify with a scratchpad Playwright script: glide lands ~offset below the nav, veil peaks then returns to 0, reduced-motion jumps instantly with no veil, mobile menu closes then glides.
