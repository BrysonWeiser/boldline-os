---
name: marketing-site-design-system
topic: Marketing site
task: keep the marketing site visually uniform or restyle a component to match the rest of the site
keywords: [design-tokens, card, boutique, section-head, eyebrow, uniform, border-radius]
status: verified
summary: The homepage's visual language — dark --card boxes with a --line border, rounded corners, gold accents. Match this vocabulary when adding or restyling a component so nothing looks out of place.
verified: 2026-07-02
---
`marketing-site/index.html` `:root` tokens: `--bg #080A0F`, `--card #0D0F16`, `--line rgba(255,255,255,.08)`, text `--ink/--muted/--faint`, `--gold #C8A84B` (+ `--gold-soft`, `--gold-line`). Fonts: Playfair Display (serif headings) + Inter (sans body).

**"Box" convention:** contained, centered, `background:var(--card)`, `border:1px solid var(--line)`, `border-radius:14–16px`, generous padding, often a small gold accent. Section intros use `.eyebrow` (gold uppercase label) + `<h2>` + sometimes `.divider`. Blocks animate in on load via `.reveal` (fadeUp) — animate-on-load, never hide-until-scroll (see content-visibility-no-js).

**Lesson (2026-07-02):** the "We work with a limited number of businesses…" band (`.boutique`) originally used a full-width top/bottom-bordered stripe with a faint white wash — the only element doing that, so it read as out of place. Fixed by rebuilding it as a contained `.boutique-card` matching the package/included cards.

**Takeaway:** to keep the site uniform, restyle any odd component into the contained-card vocabulary above rather than inventing a new treatment.
