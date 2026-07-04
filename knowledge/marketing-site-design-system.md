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