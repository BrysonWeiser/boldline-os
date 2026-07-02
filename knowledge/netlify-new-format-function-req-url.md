---
name: netlify-new-format-function-req-url
topic: Netlify
task: debug why a Netlify function behind a redirect or rewrite is not receiving its query params, and read path params correctly
keywords: [export-default, exports.handler, req.url, queryStringParameters, netlify-rewrite, cb141a7]
status: verified
summary: Netlify NEW-format functions (export default async (req)) receive the ORIGINAL request URL in req.url, NOT the rewrite target's query. OLD-format (exports.handler + event.queryStringParameters) DO get the rewrite target's query. For new-format functions behind a rewrite, parse params from req.url's PATH.
verified: 2026-07-02
---

Two function styles coexist in this repo and behave differently behind a `netlify.toml` rewrite:

- **NEW format:** `export default async (req) => …` (used by `blog-*.mjs`). `req.url` is the **original request URL**, so a `?slug=:slug` added by a rewrite *target* **never reaches the function** — `new URL(req.url).searchParams.get("slug")` comes back empty.
- **OLD format:** `exports.handler = async (event) => …` with `event.queryStringParameters` (used by OS `landing.js` / `portal.js`). These **do** receive the rewrite target's query string.

This asymmetry was the root cause of the blog-post 404 (see `blog-404-force-redirect-deadend`). The blog *index* appeared to work only because it defaults to page 1 when `?page` is missing. The OS's old-format functions never hit this.

**Durable rule:** for NEW-format (`export default`) functions behind a rewrite, parse path params from `req.url`'s **path** (e.g. `/blog/<slug>/`, `/blog/page/<n>/`), and keep the query param only as a fallback for direct function calls. Real fix landed in commit `cb141a7`: `blog-post.mjs` reads the slug from `/blog/<slug>/` and `blog-index.mjs` reads the page from `/blog/page/<n>/`.
