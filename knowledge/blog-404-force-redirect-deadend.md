---
name: blog-404-force-redirect-deadend
topic: Blog
task: fix blog post pages returning 404 in production while the blog index still works
keywords: [blog.css, force=true, soft-404, notFoundPage, redirect-shadowing, blog-post.mjs]
status: dead-end
summary: DEAD-END — the first blog-404 fix (moving blog.css out of /blog/ plus adding force=true to the blog redirects) did NOT fix it. The real cause was new-format functions not seeing the rewrite's ?slug= query (see netlify-new-format-function-req-url).
verified: 2026-07-02
---

**Symptom:** after the marketing site went live, `/blog/` (index) worked but every `/blog/:slug/` returned 404 — yet calling `/.netlify/functions/blog-post?slug=…` directly returned the article fine.

**Wrong theory (the dead-end, do not retry):** that a real `marketing-site/blog/` directory (it held `blog.css`) was shadowing the `/blog/:slug` redirect. Attempted fix: moved `blog.css` to the site root (`/blog.css`), updated its 4 references (blog-render `headTags`, privacy/terms/404), and added `force = true` to the blog redirects. **This did NOT fix the 404.**

Worth keeping anyway: nothing real should live under `/blog/`, and the change flipped the symptom from a bare 404 to our *styled* `notFoundPage`, which proved the redirect WAS reaching the function — narrowing the bug to the function itself.

**Real root cause + fix:** Netlify new-format (`export default`) functions get the ORIGINAL `req.url`, not the rewrite target's `?slug=`/`?page=` query — so parse the slug/page from the URL path instead. See `netlify-new-format-function-req-url`. (Rollback points: attempt #1 = `dcf2828`; real fix = `f709686` / commit `cb141a7`. Blog is fully working in production.)
