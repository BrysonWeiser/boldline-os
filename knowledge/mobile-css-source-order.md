---
name: mobile-css-source-order
topic: Mobile/CSS
task: fix mobile CSS overrides that aren't taking effect because a later base rule wins
keywords: [source-order, media-query, specificity-tie, max-width-640, override-before-base, authoritative-block]
status: dead-end
summary: DEAD-END approach — placing a mobile @media override block BEFORE the component's base rules fails: at equal specificity, the later base rule wins by source order, so the override silently doesn't apply. Fix: put the authoritative mobile/override @media block LAST in the stylesheet.
verified: 2026-07-02
---

**The failed approach (do not retry):** placing a mobile `@media` override *before* the component's base rules. At **equal specificity, source order decides**, so a base rule defined **later** in the stylesheet silently beats the earlier media-query override — the mobile override appears to "do nothing."

Hit twice:
- v3.0: new sections' mobile overrides sat *before* their base rules → the "leads show up sorted" showcase wouldn't stack and the sticky bar stayed hidden.
- v3.8 density pass: `#fit` / `#included` / `#process` didn't shrink because their component base rules are defined *later* in the stylesheet than the mobile media query.

**Fix:** consolidate mobile overrides into **one authoritative `@media(max-width:640px)` block at the very END of `<style>`** so the overrides reliably win.

**Durable lesson:** put mobile/override media queries **LAST** in the stylesheet (or raise their specificity), or later base rules silently beat them. (Payoff of the density pass: mobile homepage ~10,476 → ~8,560px, about 18% shorter.)

**BOTTOM-SHEET SAVE BAR FELL BELOW THE FOLD (2026-08-13, Bryson on Android: the Save button in Edit → My Ads was unreachable).** The sheet already had a correctly PINNED action bar — `flexShrink:0`, outside the scrolling section — so the bug was never the bar; it was the geometry underneath it. `Sheet` renders an overlay at `position:fixed; inset:0` with `alignItems:"flex-end"`, and sizes the sheet itself in **dvh** (`.os-sheet{height:var(--sh-dvh)!important}`, e.g. 93dvh). Those are two DIFFERENT viewports on mobile: `inset:0` can resolve against the **large** viewport (the area behind the browser's chrome), while dvh tracks the **dynamic/visible** one. Anchoring to the overlay's flex-end therefore parked the sheet's bottom edge — and the Save bar with it — under the browser chrome, off-screen.
**Fix:** give the overlay the same viewport basis, `.os-sheet-overlay{height:100vh;height:100dvh;max-height:100vh;max-height:100dvh}` (plain-vh first as the fallback), and add `.os-sheet-actions{padding-bottom:calc(16px + env(safe-area-inset-bottom))!important}` so the bar also clears the home-indicator / gesture bar. Applied to BOTH sheet overlays and BOTH action bars (EditClientSheet + AddClientSheet — the markup was duplicated).
**LESSON:** if a modal is sized in `dvh`, everything positioning it must be too — mixing `vh`/`inset:0` with `dvh` silently shifts the bottom edge off-screen, and it only reproduces on a real phone (desktop viewports have no chrome to hide behind).
**GOTCHA while fixing it:** the OS's CSS lives inside a JS template literal (`<style>{`…`}</style>`), so **backticks in a CSS comment terminate the literal** and break the whole Babel parse. Never use backticks in that stylesheet's comments.
**Verified 2026-08-13** headlessly at 390x844, 412x915 and 360x640 (mobile emulation): Save is fully in-viewport with no scrolling, the overlay height equals the viewport, the sheet bottom is not past the fold, the bar stays pinned after scrolling the form to the end, and clicking it fires onSave — 21 assertions, no page errors.
