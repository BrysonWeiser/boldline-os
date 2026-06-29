// Public blog post renderer. Mirrors the main OS's landing.mjs: query-param
// driven lookup fed by a Netlify redirect (/blog/:slug -> ?slug=:slug),
// server-rendered HTML, no client JS required to read a post.

import {
  getSupabase, html, esc, formatMonthYear, isoDate,
  headerHTML, footerHTML, postCtaHTML, headTags, notFoundPage, SITE_URL,
} from "../lib/blog-render.mjs";

export default async (req) => {
  // Netlify NEW-format functions (export default) receive the ORIGINAL request
  // URL in req.url, NOT the redirect target — so the `?slug=` we set in
  // netlify.toml's rewrite is NOT here. Read the slug from the path
  // (/blog/<slug>/) first; fall back to the query param for direct calls.
  const url = new URL(req.url);
  let slug = url.searchParams.get("slug") || "";
  if (!slug) {
    const parts = url.pathname.split("/").filter(Boolean);
    const bi = parts.indexOf("blog");
    if (bi !== -1 && parts[bi + 1]) slug = decodeURIComponent(parts[bi + 1]);
  }
  slug = slug.replace(/\/+$/, "").trim();
  if (!slug) return notFoundPage();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);
  }

  const supabase = getSupabase();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) return notFoundPage();

  const canonical = `${SITE_URL}/blog/${post.slug}/`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description,
    image: `${SITE_URL}/og-image.png`,
    datePublished: isoDate(post.published_at),
    dateModified: isoDate(post.published_at),
    author: { "@type": "Organization", name: "BoldLine Media" },
    publisher: { "@type": "Organization", name: "BoldLine Media", logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
    mainEntityOfPage: canonical,
  };

  return html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({
  title: `${post.title} — BoldLine Media`,
  ogTitle: post.title,
  description: post.meta_description,
  canonical,
  ogType: "article",
  jsonLd,
})}
</head>
<body>

${headerHTML()}

<div class="breadcrumb"><a href="/blog/">← Back to Blog</a></div>

<div class="article-head reveal">
  <div class="eyebrow">${esc(post.category)}</div>
  <h1>${esc(post.title)}</h1>
  <div class="article-meta">BoldLine Media · ${formatMonthYear(post.published_at)} · ${esc(post.read_minutes)} min read</div>
</div>

<div class="article-body reveal">
${post.body_html}
</div>

${postCtaHTML()}

${footerHTML()}

</body>
</html>
`);
};
