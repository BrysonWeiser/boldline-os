// The blog listing is paged (Bryson, 2026-11-09: "every blog just makes me scroll ... only a handful of the top most
// recent blogs and then a way to see the next page"). Run: node tests/verify-blog-pages.mjs
//
// What has to stay true:
//  1. Page one is the newest post shown big plus six more; every later page is nine. No post is skipped or repeated.
//  2. There is a pager (Newer, numbered pages, Older) whenever there is more than one page, and none when there isn't.
//  3. A page past the end is a 404, not an empty page Google can index.
//  4. Topics are links over the WHOLE blog (not a filter over the seven on screen), and paging keeps the topic.
//     A made-up topic in the address is ignored, never echoed into the page.
//  5. On a phone the older posts are compact rows, so a page is not seven screens tall.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const eq = (what, a, b) => ok(what, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const R = await import("../marketing-site/netlify/lib/blog-render.mjs");

// ── 1. The window maths ──────────────────────────────────────────────────────────────────────────
eq("first page holds 7", [R.FIRST_PAGE_SIZE, R.PAGE_SIZE], [7, 9]);
eq("no posts is one page", R.pageWindow(1, 0).totalPages, 1);
eq("7 posts is one page", R.pageWindow(1, 7).totalPages, 1);
eq("8 posts is two pages", R.pageWindow(1, 8).totalPages, 2);
eq("16 posts is two pages", R.pageWindow(1, 16).totalPages, 2);
eq("17 posts is three pages", R.pageWindow(1, 17).totalPages, 3);
eq("page 1 window", R.pageWindow(1, 30), { from: 0, to: 6, totalPages: 4 });
eq("page 2 window", R.pageWindow(2, 30), { from: 7, to: 15, totalPages: 4 });
eq("page 3 window", R.pageWindow(3, 30), { from: 16, to: 24, totalPages: 4 });
for (const n of [0, 1, 7, 8, 16, 17, 23, 61]) {
  const { totalPages } = R.pageWindow(1, n), seen = [];
  for (let p = 1; p <= totalPages; p++) { const w = R.pageWindow(p, n); for (let i = w.from; i <= Math.min(w.to, n - 1); i++) seen.push(i); }
  eq(`every one of ${n} posts appears exactly once`, seen, Array.from({ length: n }, (_, i) => i));
}
eq("few pages: all numbers", R.pageNumbers(2, 5), [1, 2, 3, 4, 5]);
eq("many pages: ends, neighbours, gaps", R.pageNumbers(6, 12), [1, null, 5, 6, 7, null, 12]);
eq("many pages from the start", R.pageNumbers(1, 12), [1, 2, null, 12]);

// ── 2-4. The real listing, rendered against a fake database of 23 posts ───────────────────────────
const CATS = ["Google Ads", "Websites", "Meta Ads", "Lead follow-up"];
const POSTS = Array.from({ length: 23 }, (_, i) => ({ slug: `post-${i + 1}`, title: `Sample post ${i + 1}`, category: CATS[i % 4],
  excerpt: "A plain look at what moves the phone.", published_at: new Date(Date.UTC(2026, 10, 9 - i)).toISOString(), read_minutes: 4 }));
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://fake.supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "test";
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  const q = u.searchParams, cat = (q.get("category") || "").replace(/^eq\./, "");
  const pool = POSTS.filter((p) => !cat || p.category === cat);
  if ((init.method || "GET") === "HEAD") return new Response(null, { status: 200, headers: { "content-range": `*/${pool.length}` } });
  if ((q.get("select") || "") === "category") return new Response(JSON.stringify(POSTS.map((p) => ({ category: p.category }))), { status: 200, headers: { "content-type": "application/json" } });
  const off = Number(q.get("offset") || 0), lim = Number(q.get("limit") || 1000);
  return new Response(JSON.stringify(pool.slice(off, off + lim)), { status: 200, headers: { "content-type": "application/json" } });
};
const { default: blogIndex } = await import("../marketing-site/netlify/functions/blog-index.mjs");
const get = async (path) => { const r = await blogIndex(new Request("https://boldlinemedia.com" + path)); return { status: r.status, body: await r.text() }; };
const slugs = (b) => [...b.matchAll(/class="bx-(?:card|feature) reveal" href="\/blog\/([^/]+)\//g)].map((m) => m[1]);

const p1 = await get("/blog/"), p2 = await get("/blog/page/2/"), p3 = await get("/blog/page/3/"), p4 = await get("/blog/page/4/");
eq("page 1 shows the 7 newest", slugs(p1.body), POSTS.slice(0, 7).map((p) => p.slug));
eq("page 2 shows the next 9", slugs(p2.body), POSTS.slice(7, 16).map((p) => p.slug));
eq("page 3 shows the last 7", slugs(p3.body), POSTS.slice(16).map((p) => p.slug));
eq("page 4 does not exist", p4.status, 404);
ok("page 1 has the pager with numbers", /class="bx-pages"/.test(p1.body) && /aria-current="page">1</.test(p1.body) && /href="\/blog\/page\/2\/" aria-label="Page 2"/.test(p1.body) && /href="\/blog\/page\/2\/" rel="next"/.test(p1.body));
ok("page 1 has no Newer link", !/rel="prev"/.test(p1.body));
ok("page 2 links back to the plain /blog/", /href="\/blog\/" rel="prev"/.test(p2.body) && /Page 2 of 3/.test(p2.body));
ok("the last page has no Older link", !/rel="next"/.test(p3.body));
ok("canonical names the page", /rel="canonical" href="[^"]*\/blog\/page\/2\/"/.test(p2.body));
ok("the old on-screen filter script is gone", !/data-cat'\);items\.forEach/.test(p1.body) && !/<button class="bx-chip/.test(p1.body));

const t1 = await get("/blog/?topic=Websites");
eq("a topic covers the whole blog", slugs(t1.body), POSTS.filter((p) => p.category === "Websites").map((p) => p.slug));
ok("the topic's link is marked current", /class="bx-chip on" href="\/blog\/\?topic=Websites" aria-current="page"/.test(t1.body));
ok("one page of a topic has no pager", !/class="bx-pages"/.test(t1.body));
const all = await get("/blog/?topic=Google%20Ads");
ok("topic links are real links", /<a class="bx-chip" href="\/blog\/\?topic=Meta%20Ads">/.test(all.body));
const bogus = await get("/blog/?topic=%3Cscript%3Ex");
eq("a made-up topic is ignored", slugs(bogus.body), slugs(p1.body));
ok("and never echoed", !/<script>x/.test(bogus.body) && !/%3Cscript/i.test(bogus.body));
POSTS.push(...Array.from({ length: 8 }, (_, i) => ({ ...POSTS[1], slug: `web-${i}`, published_at: new Date(Date.UTC(2026, 8, 1 - i)).toISOString() })));
const t2 = await get("/blog/page/2/?topic=Websites");
ok("paging keeps the topic", t2.status === 200 && /href="\/blog\/\?topic=Websites" rel="prev"/.test(t2.body) && slugs(t2.body).every((s) => s.startsWith("web-") || POSTS.find((p) => p.slug === s).category === "Websites"));
globalThis.fetch = realFetch;

// ── 5. Phone layout ───────────────────────────────────────────────────────────────────────────────
const css = readFileSync(join(ROOT, "marketing-src/blog.css"), "utf8");
const phone = css.slice(css.indexOf("@media (max-width:640px)"));
ok("phone: older posts are compact rows", /\.bx-grid \.bx-card\{flex-direction:row/.test(phone) && /\.bx-grid \.bx-card p\{display:none\}/.test(phone));
ok("pager buttons are thumb-sized (44px)", /\.bx-pg\{[^}]*min-width:44px;height:44px/.test(css));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-blog-pages: ${pass} checks passed`);
