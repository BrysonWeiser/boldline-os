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

**GOTCHA — `flexShrink:0` on a `flexWrap:wrap` action row clips instead of wrapping
(2026-07-19).** A right-side button group with `flexShrink:0` sizes to its full single-line
(max-content) width and overflows a narrow card instead of wrapping — the last buttons get
clipped at the card edge (hit on the Blog Scheduled-post row: Publish Now/Delete clipped at
~390px). Fix: **drop `flexShrink:0`** (so the group can shrink to the parent and its
`flexWrap` actually kicks in) and add `justifyContent:flex-end`. Any wide flex child in such
a row (e.g. a `datetime-local` input) also needs `flex:1 1 <basis>; minWidth:0` so it can
shrink rather than force overflow.

**When something SHOULD stay narrow:** forms and reading-width text can cap ~600–700px on
desktop — that's intentional typography, not "cramped" — but center it and balance the page
(e.g. the OS caps client detail at 1000px). The rule bans *accidental* narrowness, not
deliberate reading measures.


## 🔴 2026-08-30 — the page-level check misses container scroll (Lead Scout call list)

Bryson, on his phone: *"in the lead scout tab when I go to my call list I can scroll
horizontally which I shouldn't be able to do"*. He was right, and **the audit recipe above
would never have caught it.**

`document.documentElement.scrollWidth <= clientWidth` read **zero the whole time the bug was
live.** The page did not scroll. A container inside it did: the Lead Scout screen was 507px
of content inside a 390px viewport, with the overflow contained by an ancestor that scrolls.

**New tool: `tools/audit-sideways-scroll.js`.** Checks what he actually did — any element
the USER CAN SCROLL horizontally (`overflow-x` auto/scroll AND real overflow inside it).
It deliberately ignores the ambient background orbs, which are wider than the screen at every
width by design and are clipped by `overflow:hidden`, so they can never be swiped. Exits
non-zero, so it can gate a merge. Verified both ways: it reports the container with the bug
restored, and nothing once fixed.

### The cause, which is worth recognising on sight

```
gridTemplateColumns: isDesktop ? "repeat(2,minmax(0,1fr))" : "1fr"
```

**A bare `1fr` is `minmax(AUTO,1fr)`**, so the track floors at the item's *min-content* width.
An email address has no break opportunity, so its min-content width is the entire string, and
one long address widened the whole row to 418px. **Desktop already used `minmax(0,…)`, which
is exactly why it only ever appeared on his phone.** Fixed in both grids in `ProspectCard`,
plus `overflowWrap:"anywhere"` on the address so capping the track does not just move the
overflow inside the box.

**Rule of thumb: never write a bare `1fr` for a track holding user-supplied text.** Write
`minmax(0,1fr)`. The `minmax(0,…)` form is already used correctly elsewhere in the file, so
a bare one is a slip rather than a decision.

### Three harness traps hit building the audit, all of which looked like app bugs
1. The supabase stub lacked `.insert` and the app died before mounting. **A stub narrower
   than production fails exactly as badly as one that is wider.**
2. **Playwright matches the most recently added route first.** A broad catch-all registered
   last shadowed the specific one, every call returned `{"ok":true}`, and the screen crashed
   on `facets.niches`. Register the catch-all FIRST.
3. The fixture omitted `kind` on a phone, which the server normalises to `"unknown"` and
   never stores missing. **Copy fixtures from what the server WRITES, not from what the
   component reads.**


## 🔴 2026-08-31 — a clipped breakout is invisible to the horizontal-scroll check

The client portal's contract uses `.cwide` to break out of `.main`'s 600px cap to 980px on a
desktop, so a legal document is readable. When it moved inside the Account tab's accordion,
which sets `overflow:hidden` for its rounded corners, the **card stayed 572px while the
contract still grew to 980px: 204px cut off each side** at 1280 and 1600.

**Two blind spots stacked, and both are worth naming.**

1. **It was only checked on a phone.** Below 960px the breakout never applies, so every
   phone-width check passed honestly.
2. **`documentElement.scrollWidth - clientWidth` read ZERO the entire time.** The content was
   not overflowing the page, it was being *destroyed* by `overflow:hidden`. That metric, and
   the `tools/audit-sideways-scroll.js` check that replaced it, both see scrollable overflow.
   **Neither can see clipped overflow.**

**So for any element that deliberately breaks out of its container, measure the child's
rect against its clipping ancestor's rect** rather than trusting a page-level scroll number:

```js
clippedLeft  = ancestor.left  - child.left
clippedRight = child.right - ancestor.right   // either > 1 means content is being cut off
```

**The fix shape:** widen the PANE, not an element inside the clipped card, so the card grows
to hold it. Widening only the one card would have left a 980px card between two 572px ones,
against the sibling-width rule at the top of this file. And do NOT reach for "remove
`overflow:hidden`": that stops the clipping by letting content spill outside the card's own
border, which looks broken in a different way.
