---
name: os-overlay-mobile-gotchas
topic: OS app
task: debug or build modals / bottom sheets / popups in the OS, or fix mobile fit
keywords: [sheet, modal, popup, position-fixed, transform, containing-block, dvh, vh, viewport, mobile, os-sheet, os-content, backdrop-filter]
status: verified
summary: Two overlay gotchas hit during the 2026-07 OS restyle. (1) A transform on an ancestor (even a leftover from an animation with fill:both) makes position:fixed children anchor to THAT element, not the viewport — it shifted the bot-detail sheet down into the content area. (2) Bottom sheets sized in `vh` clip their header behind mobile browser chrome; use `dvh`.
verified: 2026-07-07
---

**(1) A transformed ancestor breaks `position:fixed` overlays.**
`.os-content` (the screen wrapper) had `animation:fadeIn` whose keyframes ended on `transform:translateY(0)`. With `animation-fill-mode:both`, the element KEEPS a non-`none` transform after the animation — and any element with a transform (also `filter`, `perspective`, `will-change:transform`, `backdrop-filter`, `contain:paint`) becomes the **containing block for its `position:fixed` descendants**. So the bot-detail `Sheet` (rendered inside `ClientHub` → inside `.os-content`) anchored to `.os-content` and opened shifted down instead of covering the viewport. **Fix:** made the screen fade **opacity-only** (`@keyframes osIn`, no transform). Rule of thumb: never leave a lingering transform on a wrapper that can contain a fixed overlay. Overlays rendered at the App root (siblings of `.os-content`) were unaffected.

**(2) Bottom sheets must use `dvh`, not `vh`, on mobile.**
The shared `Sheet` component (and a manual bottom sheet + the recommender modal) sized with `vh`. On phones `vh` = the LARGE viewport (counts the area behind the retractable address bar), so a bottom-anchored `96vh` sheet pushed its header up behind the browser chrome and clipped it (Bryson's ARIA-panel screenshot). **Fix:** switched to `dvh` (dynamic viewport height) with a `vh` fallback:
- `Sheet` inner div gets `className="os-sheet"` + inline `"--sh-dvh": height.replace("vh","dvh")` (keeps inline `height` in vh as the base).
- CSS: `.os-sheet{height:var(--sh-dvh)!important}` — the `!important` class beats the inline `vh`; if the browser lacks `dvh` the value is invalid and it falls back to the inline `vh`.
- Centered modal used `maxHeight:"88dvh"` directly.

**Verify OS edits** by Babel-compiling the `text/babel` script (Babel 7.23.5) — a syntax slip blanks the whole app. Can't click the live OS from here, so mobile-overlay bugs surface from Bryson's screenshots — ask for one when an overlay "isn't in the right position."
