---
name: blog-dynamic-rendering
topic: Blog
task: understand how marketing-site blog pages are server-rendered, paginated, and mapped from URL slugs
keywords: [blog-index.mjs, blog-post.mjs, sitemap.mjs, blog-render.mjs, slug-from-path, pagination]
status: verified
summary: The marketing blog is server-rendered by new-format functions — blog-index.mjs (paginated 6/page, newest first), blog-post.mjs (single by slug, 404 for unknown/deleted), sitemap.mjs (dynamic) — all via shared marketing-site/netlify/lib/blog-render.mjs helpers. Slug/page are read from the URL PATH.
verified: 2026-07-02
---

The old hand-coded static blog (`marketing-site/blog/index.html`, 3 static post pages, static `sitemap.xml`) was deleted and replaced with dynamic functions under `marketing-site/netlify/functions/`:

- `blog-index.mjs` — paginated listing, **6 posts/page, newest always top-left**; page number read from path `/blog/page/<n>/`.
- `blog-post.mjs` — single post by slug read from path `/blog/<slug>/`; returns a styled 404 for unknown/deleted slugs.
- `sitemap.mjs` — dynamic sitemap.

All backed by `marketing-site/netlify/lib/blog-render.mjs` shared render helpers (header/footer/post-CTA/head-tags including JSON-LD, all HTML-escaped). Its `headerHTML()` / `headTags` / `footerHTML()` keep blog chrome in sync with the homepage.

`blog.css` lives at the **site root** (`/blog.css`), not under `/blog/` (moved during the 404 investigation; cleaner — nothing real under `/blog/`).

**Reading slug/page from the PATH (not the rewrite query) is load-bearing** — these are new-format functions; see `netlify-new-format-function-req-url` and `blog-404-force-redirect-deadend`. These functions are what let AI-written DB posts appear live with correct pagination, Article JSON-LD, sitemap, and 404s.
