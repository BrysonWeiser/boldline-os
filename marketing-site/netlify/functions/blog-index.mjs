// Public blog listing, paginated newest-first. Page 1 lives at /blog/, every
// page after that at /blog/page/:n/ (see marketing-site/netlify.toml for the
// redirects that feed both shapes into this one function via ?page=).

import {
  getSupabase, html, esc, headerHTML, footerHTML, headTags, notFoundPage, SITE_URL, PAGE_SIZE,
} from "../lib/blog-render.mjs";
import { coverSVG } from "../lib/blog-cover.mjs";

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric" });
const meta = (p) => `<div class="bx-meta">${day(p.published_at)}<i></i>${esc(p.read_minutes || 5)} min read</div>`;
const postCard = (p) => `<a class="bx-card reveal" href="/blog/${esc(p.slug)}/" data-cat="${esc(p.category)}">
    <div class="bx-cover">${coverSVG(p)}</div>
    <div class="bx-body"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>${meta(p)}</div>
  </a>`;
const featured = (p) => `<a class="bx-feature reveal" href="/blog/${esc(p.slug)}/" data-cat="${esc(p.category)}">
    <div class="bx-cover">${coverSVG(p)}</div>
    <div class="bx-txt"><span class="bx-new">Latest</span><h2>${esc(p.title)}</h2><p>${esc(p.excerpt)}</p>${meta(p)}</div>
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
    .select("slug, title, category, excerpt, published_at, read_minutes", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(from, to);

  if (error) return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);

  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  if (page > 1 && (!posts || posts.length === 0)) return notFoundPage();

  const canonical = page === 1 ? `${SITE_URL}/blog/` : `${SITE_URL}/blog/page/${page}/`;
  const title = page === 1 ? "Blog | BoldLine Media" : `Blog | Page ${page} | BoldLine Media`;
  const description = "Straight answers on Google and Meta ads, websites and getting more calls, from the team that builds and runs them.";

  const prevHref = page <= 1 ? null : page - 1 === 1 ? "/blog/" : `/blog/page/${page - 1}/`;
  const nextHref = page >= totalPages ? null : `/blog/page/${page + 1}/`;

  const pagination = totalPages > 1 ? `
<nav class="bx-pages" aria-label="Blog pages">
  ${prevHref ? `<a href="${prevHref}">Newer posts</a>` : ""}
  <span>Page ${page} of ${totalPages}</span>
  ${nextHref ? `<a href="${nextHref}">Older posts</a>` : ""}
</nav>` : "";
  const list = posts || [];
  const cats = [...new Set(list.map((p) => p.category).filter(Boolean))].sort();
  const chips = cats.length > 1 ? `<div class="bx-chips reveal" role="toolbar" aria-label="Filter by topic">
    <button class="bx-chip on" type="button" data-cat="">All</button>${cats.map((c) => `<button class="bx-chip" type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
  </div>` : "";
  const top = page === 1 && list.length ? featured(list[0]) : "";
  const rest = page === 1 ? list.slice(1) : list;

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
<body class="page" data-page="blog">

${headerHTML()}

<section class="page-hero ph-centre"><div class="wrap-x reveal">
  <div class="eyebrow">Blog</div>
  <h1>Straight answers on ads, websites and <em>more calls.</em></h1>
  <p>What we've learned building and running Google and Meta ads and websites for service businesses, written the way we'd say it across the table.</p>
</div>
${chips}
</section>

<section class="bx-sec"><div class="wrap-x">
  ${top}
  <div class="bx-grid">
  ${rest.map(postCard).join("\n  ")}
  </div>
  <p class="bx-empty" hidden>Nothing on this page in that topic yet.</p>
  ${pagination}
</div></section>
<script>
(function(){var bar=document.querySelector('.bx-chips');if(!bar)return;var items=[].slice.call(document.querySelectorAll('.bx-card,.bx-feature')),empty=document.querySelector('.bx-empty');
bar.addEventListener('click',function(e){var b=e.target.closest('.bx-chip');if(!b)return;[].forEach.call(bar.children,function(x){x.classList.toggle('on',x===b);});
var c=b.getAttribute('data-cat'),n=0;items.forEach(function(it){var show=!c||it.getAttribute('data-cat')===c;it.hidden=!show;if(show)n++;});if(empty)empty.hidden=n>0;});})();
</script>

${footerHTML()}

</body>
</html>
`);
};
