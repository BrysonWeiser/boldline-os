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

**Book-a-call = on-site Calendly popup + package tracking (2026-07-04):** Calendly's widget
assets (assets.calendly.com widget.css/js) are loaded in <head>; a delegated click handler on
`a[href*="calendly.com/theboldlinemedia"]` calls `Calendly.initPopupWidget({url})` so booking
stays in an on-site modal instead of navigating away. Falls back to the plain link if the widget
didn't load (progressive enhancement). **Excludes `#openRecommender`** (that Calendly-href link
actually opens the recommender modal — its own handler + mine are both document listeners, so it
must be skipped explicitly). For a click inside a `.pkg`, the handler reads the card's `<h3>`
text and books with `utm_content=<package name>` (no per-button markup) so the package shows on
the Calendly event. Package CTA buttons (`.pkg-cta`) start non-highlighted and fill gold on
`:hover` or `.pkg.sel` (card selected).

**Calendly custom-answer prefill (2026-07-04):** besides utm_content, the handler prefills the
"Which package are you interested in?" question via `prefill:{customAnswers:{a3:name}}`.
**Calendly keys custom questions a1/a2/... by their position on the booking form; Bryson's form
order is a1 = "Briefly describe your business", a2 = "What is your budget", a3 = the package
question** (took three test bookings to land — always test-book after reordering questions).
The key lives in the `PKG_ANSWER_KEY` constant in the book-a-call script.