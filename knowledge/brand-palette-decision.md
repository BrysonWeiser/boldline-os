---
name: brand-palette-decision
topic: Marketing site / brand
task: change, rebrand, or recolor the site palette / brand colors
keywords: [rebrand, palette, recolor, green, beige, earth-tone, brass, gold, C8A84B, brand-colors, quiet-luxury, dark-green]
status: verified
summary: DECISION (2026-07-05) — keep the current dark + gold brand palette. A green/beige earth-tone rebrand was explored in depth and Bryson rejected it ("let's just stick with the colors we have"). Do NOT re-propose a rebrand unless he asks.
verified: 2026-07-05
---

**The brand palette stays as-is: dark + gold.** The live tokens (`marketing-site/index.html` `:root`)
remain the source of truth — `--gold:#C8A84B` on `--bg:#080A0F` / `--card:#0D0F16`, `--ink:#F5F3ED`,
`--muted:#9CA3AF`, `--faint:#6B7280`, Playfair Display + Inter.

**What was explored and rejected (2026-07-05):** Bryson floated wanting a more unique "quiet luxury"
feel (green + beige). We iterated through several previews — palette studies, full-homepage mockups,
and finally a faithful recolor of the *actual* site (only the color tokens swapped) using his own
Coolors "Dark Green" set: near-black `#0A0B07` ground, olive `#292E1F` panels, coffee `#7A6A5E` /
greige `#B4A596` neutrals, cream `#ECE3D7`/`#F4EEE9`, brass `#BFA167` accent, with green rationed to a
"new lead" cue and the ambient Google/Meta line-art recolored. He viewed the real-site recolor and
said he didn't like it — **keeping dark + gold.**

**Gotchas learned in that thread (useful if palette work ever resumes):**
- The marketing site is fully **token-driven**, so a recolor is ~20 find/replace values on the `:root`
  tokens + a few hardcoded literals (`#C8A84B`, `rgba(200,168,75,…)`, `#15110A` button text, `#F0DCA0`
  shimmer, the cool-blue ambient glow `rgba(120,150,255,…)`/`rgba(99,116,255,…)`).
- The "we work with a limited number of businesses" box is a normal **dark card** (`background:var(--card)`),
  NOT a bright band — earlier bright-cream mockups were an invention and read as "too bright" to Bryson.
- Preview lesson: hand-built mockups drift from the real layout; if he wants to see a restyle, recolor
  the **real** `marketing-site/index.html` (token swap), don't reconstruct the page.

No repo or site files were changed by this exploration — it produced preview artifacts only.
