---
name: os-portal-aesthetic
topic: OS app
task: change the visual style / aesthetic of the client portal or the OS interface
keywords: [aesthetic, ambient, orbs, glass, backdrop-filter, progress-ring, tracker, os-card, os-ambient, prog-hero, ringGlow, topglow, conic-gradient]
status: verified
summary: 2026-07-06 visual refresh. Client portal got a "living" gold aesthetic (ambient aurora orbs + top halo + grain, glass cards, a gold conic progress ring "N/8" + an 8-node stage tracker, welcome hero, tab fade-in). The OS app got a lighter shared-layer pass (subtle ambient behind the app, card depth + hover, screen fade, gold scrollbar/focus). Brand stays dark + gold.
verified: 2026-07-06
---

**Context:** Bryson asked to make the portal, then the OS, "more aesthetic" while keeping info clear and easy to use. Brand palette stays dark + gold (see `brand-palette-decision`). Approved and deployed 2026-07-06.

## Client portal (both copies — see `os-portal-dual-copy`)
Applied identically to **`netlify/functions/portal.js`** (live) and **`makePortalHTML` in `index.html`** (owner preview). What was added:
- **Ambient background** — `.topglow` gold halo + three drifting `.ambient .orb`s + faint `.grain`; markup injected right after `<body>`. `.hdr/.nav/.main` set `position:relative;z-index:1` so content sits above it.
- **Glass cards** — `.card` overridden to `rgba(14,16,24,.5)` + `backdrop-filter:blur(14px)` + a gold hairline `::before`, so the aurora glows through.
- **Progress ring** — replaced the flat `.stage-cur` text with `.prog-hero`: a **gold** `conic-gradient` `.ring` (`--p` = round((si+1)/8*100)) showing "N/8", `animation:ringGlow`. Ring is intentionally **gold, not the stage color** (stage rainbow read as random/boring — Bryson's feedback).
- **Stage tracker** — `.tracker` (8 `.tk` nodes, gold rail fills to `--pf = si/(len-1)`, current node `.tk-cur` pulses). Built from `const trackerHTML` + `const pf`.
- **Welcome hero** + `.prog-stage`/`.prog-tag`; small stage-color dot kept as the only rainbow accent.
- **Motion** — `show()` toggles `.tab-anim` (re-added on every tab switch via `void offsetWidth`) → cards fade up; init adds it to `t-status`.
- New consts near the top of makePortalHTML: `scol, prog, firstName, trackerHTML, pf`.

**Gotcha:** the appended CSS lives in a **single-quoted** JS string. Escape single quotes in the grain SVG data-URI as `\'`, and the string must CLOSE with `';` — an accidental `\';` escapes the quote and breaks the whole file (hit this once). Verify with `node --check portal.js` and Babel-compile the index.html app script.

## OS app (root `index.html` React app)
Lighter, conservative pass in the **shared design layer** so it propagates without hurting the dense-data readability:
- Extended the existing app `<style>` block with `.os-ambient` (fixed, `z-index:-1`, gold `.t` halo + two drifting `.ob`s), `.os-content{animation:fadeIn}`, `.os-card` hover, a 6px gold scrollbar, and gold input-focus.
- Root `<div>` background set to `transparent` (body is `#070810`) so the ambient shows; added the `.os-ambient` div; content `<div>` got `key={screen} className="os-content"` (fades on tab change).
- Shared `card` object gained a depth `boxShadow` (inset gold top edge + soft drop). `Card` component gets `className="os-card"` (hover lift). Many inline `C.bg3` cards don't use `Card`, so they get depth from the ambient but not the hover — a fuller pass would need classes on those.

**Verify OS edits** by Babel-compiling the `text/babel` script (in-browser Babel 7.23.5) — a syntax slip there blanks the whole app.
