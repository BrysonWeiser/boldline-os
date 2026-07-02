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
