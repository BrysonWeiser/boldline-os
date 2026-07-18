---
name: marketing-aesthetic-pass-2
topic: Marketing site
task: change the section dividers, mobile sticky CTA, featured-package ring, platform marquee, founder quote, or lead-feed ticker on the marketing site
keywords: [sxd, divider, sticky-cta, sticky CTA, marquee, hero-mq, mq-track, mq-set, pkgOrbit, conic-gradient, featured package, most popular ring, founder blockquote, pull quote, lead ticker, inbox-row, tick-in, timeline observer, stuck hidden, rootMargin]
status: verified
summary: Aesthetic pass 2 — BUILT+VERIFIED 2026-07-18 (Bryson approved all 7 proposals). Timeline stuck-hidden IO fix, gold .sxd section dividers (8), mobile sticky Book-a-Call pill, rotating conic gold ring on the featured package, hero platform marquee (replaced static pills), founder pull-quote glow-up, live lead ticker in the showcase inbox. All additive + reduced-motion-safe; verified headless 390/768/1280/1600 incl. behavioral asserts.
verified: 2026-07-18
---

All in `marketing-site/index.html`. New CSS lives in the "Aesthetic pass 2" block placed BEFORE
the mobile-density block (which must stay last to win source order).

**0. Timeline observer fix (real bug, caught by a full-page screenshot).** The process timeline
had its own IO with `threshold:.25` and no top rootMargin — the exact stuck-hidden trap
`content-visibility-no-js` documents; an instant jump past it left the whole "How an engagement
actually runs" section blank. Now `{rootMargin:'12000px 0px -7% 0px', threshold:.06}`, same as
the `.sr` system. Regression-tested: jump to bottom → `.timeline.in` + step opacity 1.

**1. Mobile sticky CTA** (`.sticky-cta`, an `<a>` right after `</footer>`): fixed bottom-center
gold pill, `display:block` only ≤720px, `z-index:90` (above nav 70, below modal 100). JS in the
ambient engine's rAF `paint()`: `.on` when `y>620` AND the #contact section is NOT on screen
(its own CTA takes over; one `getBoundingClientRect` read per scroll frame is fine). Without JS
it never gets `.on` → invisible, pure progressive enhancement.

**2. Gold section dividers** (`.sxd`, 8 of them): hairline gradient flanks meeting a small
rotated-square diamond. Inserted before #included, #system, #showcase, #process, #fit, .trust,
#faq, #contact. Static on purpose (no reveal animation). Add one before any NEW section.

**3. Featured package ring:** `.pkg:has(.tag)::after` = inset -1px conic-gradient arc rotating
via `@property --pkga` + `pkgOrbit 7s linear` with the padding+mask-composite ring trick.
**Mirrors the existing :has() step-aside rules** — the ::after fades (opacity 0) when another
card is hovered/selected, matching the static-ring behavior that fixed the old "two packages
look selected" complaint. Reduced-motion: `display:none` (falls back to the static box-shadow
ring). Old-Firefox note: without @property the angle animates discretely (arc jumps) — cosmetic,
acceptable.

**4. Platform marquee** (`.hero-mq` replaced `.hero-pills` — the pills CSS was removed, the
entrance-cascade + reduced-motion + mobile-density selectors all updated): `.mq-track` holds TWO
identical `.mq-set` copies and slides `translateX(-50%)` (= exactly one set) per 28s loop; edge
fade via mask-image. THE SEAMLESS RULE: track must be exactly 2 identical sets, each ending with
a separator `<i>`, or the loop pops. A11y: `role="img"` + aria-label on the wrapper, track
aria-hidden. Reduced-motion: animation off, second set hidden, first set wraps → looks like the
old static pills.

**5. Founder pull-quote:** `blockquote::before` renders a 64px serif "\201C" between avatar and
quote (block-flow, NOT absolute — no positioning fragility), avatar gets a gold ring + glow
box-shadow, quote bumped 22→23px **edited in place at the base rule** — do NOT restate font-size
in the appended block or it would override the 840px/640px media-query sizes (those appear
earlier in source).

**6. Live lead ticker** (in the ambient engine IIFE, reuses its `reduce` var): every 4.6s while
the `.inbox` is on-screen (IO flag) and the tab visible, the BOTTOM `.inbox-row` node is moved
to the top (`insertBefore(last, inboxHead.nextSibling)`), re-animated via `.tick-in` (remove
class → force reflow `void offsetWidth` → re-add), and all `.inbox-time` labels are rewritten to
the fixed ladder ['Just now','6m ago','18m ago',…] so timestamps always read newest-first.
Recycling REAL rows means no-JS/reduced-motion keep the exact static list, and no fabricated
lead content is ever introduced.

**Verification recipe (reuse):** scratchpad Playwright script asserts per width — no pageerror,
no horizontal overflow, 8 `.sxd`, marquee + pkgOrbit animations present, quote-mark ::before
content; behavioral: sticky pill off at top / on mid-scroll / off at #contact, ticker first-row
text changes after one 5s cycle, and the timeline jump-to-bottom regression. file:// runs show
ERR_FILE_NOT_FOUND for /founder.jpg etc. — external-resource noise, filter it out.
