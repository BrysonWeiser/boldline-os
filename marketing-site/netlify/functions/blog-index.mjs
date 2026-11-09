// Public blog listing, paginated newest-first. Page 1 lives at /blog/, every
// page after that at /blog/page/:n/ (see marketing-site/netlify.toml for the
// redirects that feed both shapes into this one function via ?page=).

import {
  getSupabase, html, esc, headerHTML, footerHTML, headTags, notFoundPage, SITE_URL, pageWindow, pageNumbers,
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
  // Every topic that has a published post, so the topic buttons cover the whole blog, not just this page. A topic in
  // the address that isn't one of these is ignored rather than trusted.
  const { data: catRows } = await supabase.from("blog_posts").select("category").eq("status", "published");
  const cats = [...new Set((catRows || []).map((r) => r.category).filter(Boolean))].sort();
  const rawTopic = String(url.searchParams.get("topic") || "").trim();
  const topic = cats.includes(rawTopic) ? rawTopic : "";
  const withTopic = (href) => (topic ? `${href}?topic=${encodeURIComponent(topic)}` : href);
  const pageHref = (n) => withTopic(n === 1 ? "/blog/" : `/blog/page/${n}/`);

  // Count first, so a page past the end is a 404 and the window is right for this topic.
  let countQ = supabase.from("blog_posts").select("slug", { count: "exact", head: true }).eq("status", "published");
  if (topic) countQ = countQ.eq("category", topic);
  const { count, error: countErr } = await countQ;
  if (countErr) return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);
  const { from, to, totalPages } = pageWindow(page, count);
  if (page > totalPages) return notFoundPage();
  let listQ = supabase
    .from("blog_posts")
    .select("slug, title, category, excerpt, published_at, read_minutes")
    .eq("status", "published");
  if (topic) listQ = listQ.eq("category", topic);
  const { data: posts, error } = await listQ.order("published_at", { ascending: false }).range(from, to);

  if (error) return html("<!DOCTYPE html><html><body><p>Blog temporarily unavailable.</p></body></html>", 500);

  const canonical = SITE_URL + pageHref(page);
  const title = `Blog${topic ? ` | ${topic}` : ""}${page > 1 ? ` | Page ${page}` : ""} | BoldLine Media`;
  const description = "Straight answers on Google and Meta ads, websites and getting more calls, from the team that builds and runs them.";

  // Numbered pages, Newer and Older either side, every link keeping the topic. Big enough to tap.
  const pagination = totalPages > 1 ? `
<nav class="bx-pages" aria-label="Blog pages">
  ${page > 1 ? `<a class="bx-pg bx-pg-step" href="${esc(pageHref(page - 1))}" rel="prev"><span aria-hidden="true">&larr;</span> Newer</a>` : `<span class="bx-pg bx-pg-step bx-pg-off" aria-hidden="true"><span>&larr;</span> Newer</span>`}
  <span class="bx-pg-nums">${pageNumbers(page, totalPages).map((n) => n === null ? `<span class="bx-pg-gap" aria-hidden="true">&hellip;</span>`
    : n === page ? `<span class="bx-pg bx-pg-on" aria-current="page">${n}</span>` : `<a class="bx-pg" href="${esc(pageHref(n))}" aria-label="Page ${n}">${n}</a>`).join("")}</span>
  ${page < totalPages ? `<a class="bx-pg bx-pg-step" href="${esc(pageHref(page + 1))}" rel="next">Older <span aria-hidden="true">&rarr;</span></a>` : `<span class="bx-pg bx-pg-step bx-pg-off" aria-hidden="true">Older <span>&rarr;</span></span>`}
</nav>` : "";
  const list = posts || [];
  // Topics are links now (the whole blog, paged), not a filter over the posts already on screen.
  const chips = cats.length > 1 ? `<nav class="bx-chips reveal" aria-label="Topics">
    <a class="bx-chip${topic ? "" : " on"}" href="/blog/"${topic ? "" : ' aria-current="page"'}>All</a>${cats.map((c) => `<a class="bx-chip${c === topic ? " on" : ""}" href="/blog/?topic=${encodeURIComponent(c)}"${c === topic ? ' aria-current="page"' : ""}>${esc(c)}</a>`).join("")}
  </nav>` : "";
  const where = page > 1 ? `<div class="bx-where">Page ${page} of ${totalPages}${topic ? ` &middot; ${esc(topic)}` : ""}</div>` : "";
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
  ${where}
  ${top}
  <div class="bx-grid">
  ${rest.map(postCard).join("\n  ")}
  </div>
  ${list.length ? "" : `<p class="bx-empty">No posts here yet.</p>`}
  ${pagination}
</div></section>

${footerHTML()}

</body>
</html>
`);
};
