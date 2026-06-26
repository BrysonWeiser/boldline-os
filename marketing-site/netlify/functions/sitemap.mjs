// Dynamic sitemap: homepage + blog index + every published post. Paginated
// listing pages (/blog/page/2/ etc.) are deliberately left out -- crawlers
// reach them via the on-page pagination links, and a sitemap should only
// list canonical content destinations.

import { getSupabase, esc, SITE_URL } from "../lib/blog-render.mjs";

const xml = (body) => new Response(body, { status: 200, headers: { "content-type": "application/xml; charset=utf-8" } });

const urlEntry = (loc, lastmod, changefreq, priority) =>
  `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${esc(lastmod)}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

export default async (req) => {
  const today = new Date().toISOString().slice(0, 10);

  let posts = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("blog_posts")
      .select("slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    posts = data || [];
  }

  const newestPostDate = posts.length ? posts[0].published_at.slice(0, 10) : today;

  const entries = [
    urlEntry(`${SITE_URL}/`, today, "monthly", "1.0"),
    urlEntry(`${SITE_URL}/blog/`, newestPostDate, "weekly", "0.8"),
    ...posts.map((p) => urlEntry(`${SITE_URL}/blog/${p.slug}/`, p.published_at.slice(0, 10), "yearly", "0.6")),
  ];

  return xml(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`);
};
