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

**HARD RULE — no full-width band backgrounds (Bryson, 2026-07-03):** no section or other
full-width structural element may paint its own opaque background ("black boxes" that
interrupt the ambient background). Bryson has now flagged this three times (.boutique band,
.alt bands, then .trust + #contact) — all flattened to transparent. Structure/contrast comes
from **contained cards only**; sections sit directly on the flowing ambient background. When
adding any new section, background stays transparent.

**Takeaway:** to keep the site uniform, restyle any odd component into the contained-card vocabulary above rather than inventing a new treatment.

**Assets + performance (2026-07-04 audit):** the brand logo is `/logo.png` (292×342, palette-
quantized to ~14.5KB — do NOT re-export a huge RGBA original; quantize flat-color art) and it is
REFERENCED, never inlined as base64 (an inline base64 copy in the nav once made index.html 218KB;
base64 defeats brotli). og-image.png is also quantized (~25KB). `marketing-site/_headers` gives
both images 1-week caching; HTML/CSS/JS stay on Netlify's default ETag revalidation so edits show
immediately. Third-party CSS (Calendly widget.css) loads via the media="print" → onload swap so it
never blocks first paint. Meta description target ≤160 chars. Heading ladder: one h1, sections h2,
cards h3 (no h2→h4 skips). og-image was regenerated 2026-07-04 as **og-image.jpg** (57KB — JPEG, because
quantized PNG posterizes the soft glows) with current hero copy and no dash; metas point at the
.jpg (old .png kept for previously scraped shares). **Recipe to regenerate:** curl the Google
Fonts css2 URL with a Chrome UA, download the woff2s, build a 1200×630 card.html with local
@font-face, screenshot via Playwright at deviceScaleFactor 1, save as JPEG q85.
**Founder section (2026-07-04):** real headshot at `/founder.jpg` (EXIF-upright via
ImageOps.exif_transpose — phone uploads arrive rotated; square crop ~(790,1030,1690,1930) of the
original upload; 240px, q82 progressive, lazy, alt "Bryson, founder of BoldLine Media").
**To revert to the monogram** (Bryson wants this option kept open): replace the
`<div class="founder-avatar"><img …></div>` with `<div class="founder-avatar">B</div>` — the
circle/monogram CSS still supports both.
## Pricing-section notes: card treatment, not a pale filler band (2026-09-14)

Bryson, filming his monitor: *"Can we do something about these text boxes to make them look better
instead of just a filler? The way they are it makes the website look cheap."* He meant the note
that closes the pricing section ("You pay one number, not two…") and its twin above the Combined
Systems cards.

**What was wrong.** They had a container rule, but a token one: a 2.8%-white fill, a hairline
border, 14px of padding, **and no max-width at all**. So on a wide monitor the note ran the full
section width, wider than the package cards above it, with lines long enough to lose your place.
Three stacked blocks at three different widths read as filler because nothing lined up with
anything.

**How they read now**, in the site's own vocabulary rather than a new one:
- The note is a real card: `var(--card)` under a faint gold top-tint gradient, `var(--line)` border,
  14px radius, 24/28px padding, a soft drop shadow, and a **2px gold spine** down the left edge
  (`::before`, gold fading to nothing downward) so it reads as a deliberate callout.
- **It takes the width of the grid it sits with.** `.rule-note:has(+ .pkg-grid)` → 1100px,
  `:has(+ .pkg-grid.cols-2)` → 760px, and the closing copy (`.rule-note.foot`) caps at 820px for a
  readable measure. This is the standing "cards that share a container share a width" rule; before
  it, the Combined note was 60px wider than the two cards under it.
- **Not every block became a box.** `.equal-effort` stays open centered text, separated by a 76px
  gold hairline (`::before`), and `.cap-note` stays small and quiet at 560px. Boxed fact → open
  promise → quiet link is a hierarchy; three boxes would have been three more slabs.

Verified at 390 / 768 / 1280 / 1600 with the reveal animations forced on: no horizontal scroll at
any width, note and grid identical width and x-offset on both the Combined panel and the section
close.

## Answer rows are a GRID, never wrapping flex (2026-09-14)

Bryson, photographing his monitor: *"for the thing at the bottom of the website can you make sure
they are all uniform and formatted right now its 3 on top then one on the left."*

🔴 **The layout differed between machines on identical CSS.** The five answer rows on the site (the
contact wizard's two, the recommender modal's three) were `display:flex;flex-wrap:wrap`, which sizes
each chip to its own text. The four platform chips came within a few pixels of the 440px wizard
column, so the row broke 4-up in headless Chrome here and ragged **3-then-1** on his monitor,
purely on how each machine rendered Inter. **A screenshot from one machine would have said it was
fine.** So would reading the stylesheet.

**Now:** `.opts{display:grid;grid-template-columns:repeat(2,1fr)}` on the shared base class, so all
five rows fix at two-across with equal cells on every machine, plus
`.opts button:last-child:nth-child(odd){grid-column:1/-1}` — a fifth option spans the full width
instead of stranding itself in the left column. Buttons keep `line-height:1.35` and **no
`white-space:nowrap`**: a label that outgrows its cell should wrap (the grid equalises row heights,
so it stays uniform) rather than silently spill out of it.

**Pinned by `tests/verify-answer-rows.mjs`**, which measures in a real browser at 390/768/1280/1600:
within a row every chip is the same width, a full row holds exactly two, a chip alone on a row must
be an odd last one, no label is clipped, and the page never scrolls sideways. It also **clicks
through the wizard**, because the five-option budget row — the one that needs the span — is on
step 2 and is invisible to anything that only looks at step 1. 123 checks; mutations caught:
reverting to wrapping flex (47 failures), dropping the odd-last span (1), three-across (33), and a
label too long for its cell (4).

**The rule to carry forward:** when a layout's correctness depends on text fitting, assert the
geometry, not the CSS. Font metrics are not portable.
