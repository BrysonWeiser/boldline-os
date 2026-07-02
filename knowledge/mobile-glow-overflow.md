---
name: mobile-glow-overflow
topic: Mobile/CSS
task: fix a mobile layout that renders the wrong breakpoint or zoomed out because the viewport is wider than the device
keywords: [overflow-hidden, decorative-glow, layout-viewport, phone-breakpoint, 720px, viewport-zoom]
status: verified
summary: A 720px-wide decorative glow behind #services/#process (sections without overflow:hidden) bled to 555px on a 390px phone, expanding the layout viewport to 555px and disabling the ≤480px media query (phones got tablet styles). Fix: overflow:hidden on those sections + cap the glow at min(720px,100%). Always clip decorative overflow.
verified: 2026-07-02
---

**Symptom:** on phones the site rendered the *tablet* (≤840px) styles — oversized type/padding — because the layout viewport was wider than the device, so the `≤480px` media query never applied.

**Root cause:** the gold glow pseudo-elements behind `#services` and `#process` were **720px wide** on sections **without `overflow:hidden`**. On a 390px phone the glow bled to 555px, and a decorative element wider than the viewport makes the browser **expand the layout viewport** to fit it (here, to 555px), which disabled the phone breakpoint.

**Fix:** `#services,#process{overflow:hidden}` and cap the glow at `width:min(720px,100%)` (mirrors how `.hero` already clips its glow). After the fix, layout viewport == device width at every tested size and the phone styles apply. Verified 0 horizontal overflow at 320/360/390/414/430px.

**Durable lesson:** any element/pseudo wider than the viewport (especially centered decorative glows) silently zooms the whole mobile layout out — **always clip decorative overflow.**
