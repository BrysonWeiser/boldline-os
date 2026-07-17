---
name: responsive-standards
topic: OS app
task: build or review ANY UI change — the responsive breakpoints it must pass and how to verify headlessly
keywords: [responsive, breakpoints, mobile, tablet, laptop, desktop, viewport, horizontal scroll, media query, cwide, 390, 768, 1280, 1600, playwright verify]
status: verified
summary: STANDING RULE (Bryson 2026-07-17, in CLAUDE.md): every surface — OS, portal, marketing site, future — must look intentional at phone ~390px, tablet ~768px, laptop ~1280px, desktop ~1600px+. No horizontal scroll, no cramped narrow column on big screens, no giant empty gutters, no cut-off content; sibling cards share widths. Verify every UI change headlessly at all four widths before merging (Playwright recipe below). Coverage map of what each surface already does + the breakout-width gotcha (use negative-margin centering, NOT left+transform — that creates a phantom horizontal scrollbar).
verified: 2026-07-17
---

**The four checkpoints** (test at least these; exact device widths vary, these are the proxies):
phone **390×844** · tablet **768×1024** · laptop **1280×800** · desktop **1600×900**.
Pass = no `scrollWidth > clientWidth` on the document, content fills the screen sensibly (no
single skinny column swimming in dark space on desktop), nothing overlapping/cut off, and
sibling cards in the same stack have equal widths.

**Current coverage map (2026-07-17):**
- **OS app (index.html):** mobile-first; ≥1024px gets the real desktop shell (persistent left
  sidebar, KPI row, multi-column grids — built 2026-07-07, `useIsDesktop()` + display:contents
  wrapper; client detail capped 1000px). Sheets use dvh (mobile address-bar fix, 2026-07-07).
- **Client portal (portal.js + index.html makePortalHTML — ALWAYS change BOTH):** 600px
  centered `.main` column (right for phone/tablet); wide surfaces opt out via the `.cwide`
  wrapper — ≥960px it grows to `min(94vw, 980px)`. The whole Contract tab (status + agreement)
  is wrapped in one `.cwide` so all its cards match widths. Verified 390/768/1280/1600.
- **Marketing site:** responsive since build (grids stack under 900px, verified in past
  audits + headless renders).

**GOTCHA — breaking a card out of a narrow centered column:** do NOT use
`position:relative; left:50%; transform:translateX(-50%)` — both relative offsets and
transforms count toward scrollable overflow in Chrome, so it renders centered but adds a
phantom horizontal scrollbar. Use **negative-margin centering** instead, which changes the
real layout box: `.cwide{width:min(94vw,980px); margin-left:calc((100% - min(94vw,980px))/2)}`
inside a `@media(min-width:960px)` block. (Hit + fixed 2026-07-17 on the portal contract tab.)
Also remember `.card:hover` sets `transform` — never put a needed transform on a `.card`.

**Headless verify recipe (run before merging any UI change):** render the page (for the served
portal: require `portal.js` `_internal.makePortalHTML` with the supabase stub at
`<scratchpad>/stub/node_modules`, write sample HTML; for the OS: `tools/os-screenshot.js`
harness; for the marketing site: open the file directly). Then with the global Playwright
(`NODE_PATH=/opt/node22/lib/node_modules`, chromium at `/opt/pw-browsers`), loop the four
viewports and assert per page:
`document.documentElement.scrollWidth <= clientWidth` (no h-scroll), the widths of sibling
cards match, and screenshot the desktop + phone for eyeball checks. See the 2026-07-17 session
for a working loop (portal contract tab test).

**FULL AUDIT PASSED 2026-07-17** (existing surfaces, all four breakpoints, headless):
- OS app — home, client overview/package/contract/reports tabs, leads screen: no horizontal
  scroll at 390/768/1280/1600, no page errors. (Audited via the os-screenshot harness's
  supabase stub + a custom 4-viewport loop — `audit-os.js` recipe: extract the harness's
  CLIENTS/LEADS/STUB block with `new Function(seg+";return{...}")()`, swap CDN scripts for
  local react/react-dom/babel, serve over localhost, loop viewports.)
- Marketing site — home, privacy, terms, 404: clean at all four widths.
- Client portal — all tabs incl. the wide Contract tab: verified same day.

**When something SHOULD stay narrow:** forms and reading-width text can cap ~600–700px on
desktop — that's intentional typography, not "cramped" — but center it and balance the page
(e.g. the OS caps client detail at 1000px). The rule bans *accidental* narrowness, not
deliberate reading measures.
