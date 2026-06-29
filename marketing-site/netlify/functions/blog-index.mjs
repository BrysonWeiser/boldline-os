// Public blog listing, paginated newest-first. Page 1 lives at /blog/, every
// page after that at /blog/page/:n/ (see marketing-site/netlify.toml for the
// redirects that feed both shapes into this one function via ?page=).

import {
  getSupabase, html, esc, headerHTML, footerHTML, headTags, notFoundPage, SITE_URL, PAGE_SIZE,
} from "../lib/blog-render.mjs";

const postCard = (p) => `<a class="post-card" href="/blog/${esc(p.slug)}/">
    <div class="pmeta">${esc(p.category)}</div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.excerpt)}</p>
    <span class="read-more">Read the post →</span>
  </a>`;

export default async (req) => {
  // Netlify NEW-format functions get the ORIGINAL request URL in req.url, not
  // the redirect target — so the `?page=` from netlify.toml isn't here. Read
  // the page number from the path (/blog/page/<n>/) first; query as fallback.
  const url = new URL(req.url);
  let rawPage = parseInt(url.searchParams.get("page"), 10);
  if (!Number.isFinite(rawPage)) {
    const m = url.pathname.match(/\/blog\/page\/(\d+)/);
    if (m) rawPage = parseInt(m[1], 10);
  }
  const page = Number.isFinite(rawPage) && rawPage > 1 ? rawPage : 1;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);
  }

  const supabase = getSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: posts, count, error } = await supabase
    .from("blog_posts")
    .select("slug, title, category, excerpt, published_at", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  if (page > 1 && (!posts || posts.length === 0)) return notFoundPage();

  const canonical = page === 1 ? `${SITE_URL}/blog/` : `${SITE_URL}/blog/page/${page}/`;
  const title = page === 1 ? "Blog — BoldLine Media" : `Blog — Page ${page} — BoldLine Media`;
  const description = "Straight answers on Google Ads, Meta Ads, and landing pages for small and mid-size businesses — from the team that runs them day to day.";

  const prevHref = page <= 1 ? null : page - 1 === 1 ? "/blog/" : `/blog/page/${page - 1}/`;
  const nextHref = page >= totalPages ? null : `/blog/page/${page + 1}/`;

  const pagination = totalPages > 1 ? `
<nav class="pagination reveal" aria-label="Blog pages">
  ${prevHref ? `<a href="${prevHref}">← Newer</a>` : `<span class="page-disabled">← Newer</span>`}
  <span class="page-current">Page ${page} of ${totalPages}</span>
  ${nextHref ? `<a href="${nextHref}">Older →</a>` : `<span class="page-disabled">Older →</span>`}
</nav>` : "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "BoldLine Media Blog",
    url: canonical,
    description,
    publisher: { "@type": "Organization", name: "BoldLine Media", url: SITE_URL, logo: `${SITE_URL}/logo.png` },
  };

  return html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({ title, description, canonical, jsonLd })}
</head>
<body>

${headerHTML()}

<div class="blog-hero">
  <div class="blog-hero-inner reveal">
    <div class="eyebrow">From BoldLine Media</div>
    <h1>Notes on running ads that actually work.</h1>
    <p>No fluff, no recycled "10 tips" lists — just straight answers to the questions we hear most from business owners before they ever sign with us.</p>
  </div>
</div>

<div class="post-grid reveal">
  ${(posts || []).map(postCard).join("\n  ")}
</div>
${pagination}

${footerHTML()}

</body>
</html>
`);
};
