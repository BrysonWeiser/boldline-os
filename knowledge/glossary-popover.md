---
name: glossary-popover
topic: Marketing site
task: work on the plain-English jargon popover glossary on the marketing site or blog
keywords: [glossary.js, glossary.css, data-term, autolink, article-body, term-span]
status: verified
summary: Marketing jargon gets a gold dotted underline; hover (desktop) or tap (mobile) opens a plain-English popover. Shared marketing-site/glossary.css + glossary.js (one dict/runtime). Homepage terms are pre-wrapped in markup; blog posts get them via glossary.js autolink() wrapping the first occurrence of each known term.
verified: 2026-07-02
---

- Every piece of marketing jargon shows a subtle **gold dotted underline**; hovering (desktop) or tapping (mobile) opens a small popover with a 1-2 sentence plain-English definition. Desktop anchors the bubble next to the word; mobile centers it as a card with the page dimmed/blurred behind (close button + tap-outside to dismiss). Keyboard-accessible (`tabindex`, Enter/Esc). ~13 terms (landing page, optimization & reporting, custom design, call tracking, attribution, retargeting, audience building, CRM integration, split testing, multi-campaign structure, ROAS, Google/Meta Ads).
- **Refactored to shared assets** (v3.2): the CSS/JS were pulled out of `index.html`'s inline blocks into `marketing-site/glossary.css` + `marketing-site/glossary.js` (one dictionary, one runtime, one stylesheet — no drift between homepage and blog). The homepage loads them via `<link href="/glossary.css">` + `<script src="/glossary.js" defer>`; its package terms stay **pre-wrapped** in markup. (The `.equal-effort` style stayed inline — homepage-only.)
- **Blog auto-linking:** `glossary.js` includes an `autolink()` that runs only on pages with an `.article-body` (blog posts). It walks the article's text nodes and wraps the **first occurrence** of each known term in a `.term` span, **skipping links, headings, code, and already-wrapped terms**, so prose stays clean. Wired site-wide on the blog via `blog-render.mjs` `headTags` (index, posts, and 404 all pull the same two files; autolink no-ops where there's no article body).
- **No-JS readers get clean prose** (SEO-safe). A lightweight popover was chosen over a full-screen takeover on purpose — less friction, better conversion.
