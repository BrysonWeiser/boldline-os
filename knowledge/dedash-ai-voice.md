---
name: dedash-ai-voice
topic: Marketing site
task: remove em-dashes and de-AI the copy, and keep future AI blog posts clean
keywords: [em-dash, deDash, dedash-posts.sql, writing-style, regexp_replace, on-conflict-do-nothing]
status: verified
summary: All em-dashes and AI-sounding phrasing were stripped site-wide (homepage, glossary, blog chrome, legal). blog-shared.mjs got a WRITING STYLE prompt block + a deterministic deDash() that strips "—" before save. Live posts fixed via docs/sql/dedash-posts.sql (the seed's ON CONFLICT DO NOTHING won't update them).
verified: 2026-07-02
---

A reviewer flagged two AI tells that lower trust: **em-dashes (—)** and generally "AI-sounding" voice. Fixes (v3.3):

- **Homepage `index.html`:** removed all 60+ em-dashes; killed the "it's not X, it's Y" construction, trimmed rule-of-three triads, cut repeated "honestly/actually," softened the founder quote; rewrote SEO `<title>` + meta/OG/Twitter + JSON-LD (Organization + FAQ) to match. 0 em-dashes in visible copy.
- **`glossary.js`:** all 13 definitions rewritten dash-free and plainer.
- **Blog chrome:** de-dashed the blog index hero, post CTA, page `<title>`s (now use `|` not `—`), and meta descriptions in `blog-render.mjs` / `blog-index.mjs` / `blog-post.mjs`.
- **Legal:** `privacy.html` / `terms.html` / `404.html` de-dashed.
- **Future AI posts (`netlify/lib/blog-shared.mjs`):** added an explicit **WRITING STYLE** block to the generation system prompt (never use em-dashes; vary sentence length; avoid the listed AI tics) **plus a deterministic safety net** — `deDash()` strips any "—" from the generated title/excerpt/meta/body **before save**. Covers both weekly auto-publish and the "Rewrite all" button.
- **Existing 3 live posts:** the seed uses `ON CONFLICT DO NOTHING`, so re-running it won't update them. Added **`docs/sql/dedash-posts.sql`** — a one-paste `UPDATE` (uses `regexp_replace` with clean spacing) to strip em-dashes from the live rows (run once in Supabase). Optional fuller refresh: click "Rewrite all" in the OS Blog panel. (Ran 2026-06-30; 0 em-dashes live.)
