// Public blog post renderer. Mirrors the main OS's landing.mjs: query-param
// driven lookup fed by a Netlify redirect (/blog/:slug -> ?slug=:slug),
// server-rendered HTML, no client JS required to read a post.

import {
  getSupabase, html, esc, isoDate,
  headerHTML, footerHTML, offerHTML, authorHTML, headTags, notFoundPage, SITE_URL,
} from "../lib/blog-render.mjs";
import { coverSVG } from "../lib/blog-cover.mjs";

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Phoenix", month: "long", day: "numeric", year: "numeric" });
const short = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric" });
const anchor = (t) => String(t).toLowerCase().replace(/<[^>]*>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
// Section headings get anchors, so the contents list on the side can jump to them. Empty headings are dropped.
const withAnchors = (body) => {
  const toc = [];
  const out = String(body || "").replace(/<h2[^>]*>\s*<\/h2>/g, "").replace(/<h2>([\s\S]*?)<\/h2>/g, (m, t) => {
    let id = anchor(t) || `s${toc.length + 1}`; if (toc.some((x) => x.id === id)) id += `-${toc.length + 1}`;
    toc.push({ id, t: t.replace(/<[^>]*>/g, "") }); return `<h2 id="${id}">${t}</h2>`;
  });
  return { out, toc };
};
const card = (p) => `<a class="bx-card reveal" href="/blog/${esc(p.slug)}/"><div class="bx-cover">${coverSVG(p)}</div>
    <div class="bx-body"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><div class="bx-meta">${short(p.published_at)}<i></i>${esc(p.read_minutes || 5)} min read</div></div></a>`;

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
  const { out: body, toc } = withAnchors(post.body_html);
  // Keep reading: the same topic first, then the newest.
  const { data: others } = await supabase.from("blog_posts").select("slug, title, category, excerpt, published_at, read_minutes")
    .eq("status", "published").neq("slug", post.slug).order("published_at", { ascending: false }).limit(30);
  const more = [...(others || []).filter((p) => p.category === post.category), ...(others || []).filter((p) => p.category !== post.category)].slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description,
    image: `${SITE_URL}/og-boldline.jpg`,
    datePublished: isoDate(post.published_at),
    dateModified: isoDate(post.updated_at || post.published_at),
    author: { "@type": "Person", name: "Bryson Weiser", url: `${SITE_URL}/about/` },
    publisher: { "@type": "Organization", name: "BoldLine Media", logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` } },
    mainEntityOfPage: canonical,
  };

  return html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({
  title: `${post.title} | BoldLine Media`,
  ogTitle: post.title,
  description: post.meta_description,
  canonical,
  ogType: "article",
  jsonLd,
})}
</head>
<body class="page" data-page="blog">
${headerHTML()}
<section class="art-hero"><div class="wrap-x reveal">
  <a class="art-crumb" href="/blog/">&larr; All posts</a><br>
  <span class="eyebrow">${esc(post.category)}</span>
  <h1>${esc(post.title)}</h1>
  ${post.excerpt ? `<p class="art-dek">${esc(post.excerpt)}</p>` : ""}
  <div class="art-by"><img src="/founder.jpg" alt="" width="42" height="42"><div><b>Bryson Weiser</b>${day(post.published_at)} &middot; ${esc(post.read_minutes)} min read</div></div>
</div></section>
<div class="art-cover reveal">${coverSVG(post, { label: false })}</div>

<div class="art-layout">
  ${toc.length > 2 ? `<nav class="art-toc" aria-label="In this post"><b>In this post</b>${toc.map((x) => `<a href="#${x.id}">${esc(x.t)}</a>`).join("")}</nav>` : "<div></div>"}
  <article class="art-body">
${body}
  </article>
</div>

<div class="art-end">
${authorHTML()}
${offerHTML(post.category, post.title)}
</div>

${more.length ? `<section class="art-more"><div class="wrap-x">
  <div class="x-head reveal"><div><div class="eyebrow">Keep reading</div><h2>More from the blog.</h2></div><a class="x-link" href="/blog/">All posts <span>&rarr;</span></a></div>
  <div class="bx-grid">${more.map(card).join("")}</div>
</div></section>` : ""}
<script>
(function(){var links=[].slice.call(document.querySelectorAll('.art-toc a'));if(!links.length||!window.IntersectionObserver)return;
var map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a;});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.remove('on');});var a=map[e.target.id];if(a)a.classList.add('on');}});},{rootMargin:'-20% 0px -70% 0px'});
Object.keys(map).forEach(function(id){var h=document.getElementById(id);if(h)io.observe(h);});})();
</script>

${footerHTML()}

</body>
</html>
`);
};
