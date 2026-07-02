---
name: css-gold-on-gold-specificity
topic: Mobile/CSS
task: fix an invisible gold-on-gold button or link caused by CSS specificity ties
keywords: [specificity, hdr-cta, gold-on-gold, not-selector, article-body, type-selector]
status: verified
summary: Gold link/nav styles keep beating gold-button styles on specificity ties (a class-count tie is broken by type-selector count), rendering buttons as invisible gold-on-gold. Fix by excluding the button (:not(.hdr-cta)) or forcing the button's text color.
verified: 2026-07-02
---

A recurring bug: elements styled for gold links/text end up making a filled gold button's text **gold-on-gold / invisible**, because of CSS specificity ties.

- **Header "Book a Call" CTA:** `.hdr-row nav a{color:var(--muted)}` (1 class + 2 type-selectors) beat `.hdr-cta{color:#15110A}` (1 class + 0 type-selectors). When class counts tie, the **type-selector count breaks the tie**, so the nav rule won → the CTA rendered low-contrast gray (and gold-on-gold invisible on hover). Fix: the `:not(.hdr-cta)` exclusion pattern — `.hdr-row nav a:not(.hdr-cta){…}` / `:not(.hdr-cta):hover{…}`. Applied in both `index.html` and `blog/blog.css` so homepage and blog headers stay identical. (This predated the fix — it shipped with v2.1 but no earlier screenshot review zoomed in tight enough to catch it.)
- **Branded `404.html`:** `.article-body a` is gold, which made a `.btn`'s text gold-on-gold — fixed by **forcing the filled button's text color**.

**Durable lesson:** when a page has global gold link/`.article-body a` styling, any filled gold button inside that scope will collide — exclude it with `:not()` or set the button's text color explicitly, and always zoom in on CTAs during screenshot review.
