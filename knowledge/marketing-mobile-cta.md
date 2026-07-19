---
name: marketing-mobile-cta
topic: Marketing Site
task: understand or change the mobile Book-a-Call CTAs on boldlinemedia.com
keywords: [sticky-cta, mobile-cta, pkg-cta, Book a Call, marketing-site, phone CTA, 720px]
status: verified
summary: On phones (≤720px) the marketing site shows exactly ONE Book-a-Call CTA — the floating .sticky-cta pill. The per-package in-card .pkg-cta buttons and the old full-width .mobile-cta bottom bar are both hidden on mobile so nothing stacks under the pill. Desktop keeps the in-card CTAs and never shows the pill.
verified: 2026-07-19
---

## The rule (Bryson, 2026-07-19)
On mobile the site must show **one** Book-a-Call button: the floating **`.sticky-cta`**
pill that docks bottom-center. Two other CTAs used to appear at the same time and stack:

- **`.pkg-cta`** — the in-card button on every pricing package. Hidden ≤720px via
  `@media (max-width:720px){.pkg-cta{display:none}}` (near the `.sticky-cta` rule). Desktop
  keeps them.
- **`.mobile-cta` / `#mobileCta`** — an older full-width gold bar flush to the very bottom
  (its own `@media` block, toggled `.show` when `scrollY>700`). Set to `display:none` in that
  block so it never renders. The `.show`/`a` sub-rules and the `#mobileCta` scroll JS are now
  inert (left in place, harmless). `body{padding-bottom:70px}` on mobile stays — it keeps the
  floating pill from covering the last line of content.

## The one that stays: `.sticky-cta` (aesthetic-pass-2)
- Shown only ≤720px (`display:block`), fades in (`.on`) once `scrollY>620`.
- **Yields** (slides away) while any `.btn`, `.tab`, or `.faq-item summary` is in its bottom
  ~18% band (IntersectionObserver, `rootMargin:-82% 0 0 0`), and hides at `#contact` (that
  section's own form CTA takes over). Because `.pkg-cta` is now `display:none` on mobile, the
  pill no longer yields to package cards — it stays visible through the pricing section, which
  is the intended single persistent CTA.

## Don't re-introduce the stack
If you add a mobile bottom CTA later, don't re-enable `.mobile-cta` or unhide `.pkg-cta` on
mobile — that's exactly the "Book a Call over another Book a Call" Bryson flagged. Verified
headless at 390 (pill only, no bar, no in-card) + 1280 (in-card CTAs, no pill). Deploy row
2026-07-19.
