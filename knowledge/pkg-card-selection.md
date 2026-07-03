---
name: pkg-card-selection
topic: Marketing site
task: change how package cards highlight, select, or show the Most Popular state
keywords: [pkg, .sel, most popular, tag, sticky hover, :has, featured ring, tap selection]
status: verified
summary: Tapping/clicking a package card is a single selection (.sel via delegated JS). The featured "Most Popular" ring is a DEFAULT that steps aside (via :has rules) whenever another card is selected or hovered — its pill badge stays. Never two rings at once.
verified: 2026-07-03
---
Bryson (2026-07-03, mobile): tapping a package next to the always-ringed "Most Popular" card
looked like TWO packages were selected — a tap applies sticky `:hover` on touch and the
featured card's permanent ring stayed.

**How it works now** (`marketing-site/index.html`, `.pkg` CSS block ~line 186 + a delegated
click listener at the end of the ambient script):
- Delegated `document` click: `closest('.pkg')` → remove `.sel` from all other cards, add to
  this one. Works across all tab panels; clicks on glossary terms inside a card still open
  the popover (selection also applies — harmless).
- `.pkg.sel` wears the gold ring (`0 0 0 1px var(--gold-line)` + soft gold shadow).
- The featured card's default ring (`.pkg:has(.tag)`) is suppressed by
  `.pkg-grid:has(.pkg.sel) .pkg:has(.tag):not(.sel){box-shadow:none}` and the same for
  `:hover` — so the "Most Popular" ring is only a *default*, never a competitor. The pill
  badge (`.tag`) always stays: it's a label, not a state.
- `:has()` is already a site dependency (the featured ring itself uses it), so no new
  compatibility surface.

**Test recipe:** Playwright 390px + `hasTouch:true`; count cards in `[data-panel="google"]`
whose computed boxShadow contains `0px 0px 0px 1px` — expect exactly 1 at default (index 1),
after tapping 0 (→0), 2 (→2), then featured (→1). **Tap card headings (`.pkg h3`), not list
items** — list text contains glossary-linked terms and the popover backdrop will intercept
subsequent taps (that cost a test run).
