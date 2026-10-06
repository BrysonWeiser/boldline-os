// Client websites: serving them, previewing them, and reading back a build job.
//
//   GET  /site/<slug>/[page]/        the live website (published), or a preview link (?preview=key)
//   POST { action:"preview", client, page, theme }   owner only: the exact page, for the OS preview
//   POST { action:"poll", clientId }                  owner only: the background build's result
//
// Rendering lives in ../lib/site-render.mjs; the copy is written by site-build-background.
// KB `website-builder`.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { isBillingPaused } from "../lib/late-payment.mjs";
import { renderSite, pageById, THEME_IDS, siteReady, brandName, pageByPath, pagesFor } from "../lib/site-render.mjs";
import { supabaseStore, loadIndex, loadPost, publishedPosts, isPublished, setHeld, removePost } from "../lib/site-blog.mjs";
import { publishLock } from "../lib/website-deal.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const html = (body, status = 200, extra = {}) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60", ...extra } });

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plain = (title, msg, status) => html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F3F3F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:clamp(30px,6vw,56px);letter-spacing:-.03em;margin:0 0 10px">${esc(title)}</h1><p style="color:#9A9A95;margin:0">${esc(msg)}</p></div></body></html>`, status, { "cache-control": "no-store" });

// The address a site's links are built from. Always https and absolute (rule 2 in site-render).
export const siteBase = (host, slug) => `https://${String(host || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/site/${encodeURIComponent(slug)}`;

// `page` is set for the five core pages; `seg` is the raw segment, which may name an extra page or the
// blog once the client is known; `post` is a blog article's slug.
export const parsePath = (pathname) => {
  const m = String(pathname || "").match(/^\/site\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const seg = m[2] ? decodeURIComponent(m[2]) : "";
  const post = m[3] ? decodeURIComponent(m[3]) : "";
  const page = seg ? (pageById(seg) ? seg : null) : "home";
  return { slug: decodeURIComponent(m[1]), page: post && seg !== "blog" ? null : page, seg, post: seg === "blog" ? post : "", bad: !!post && seg !== "blog" };
};

// 🔴 Who may see what. Published: everyone, in the chosen design. Unpublished: only someone holding
// the site's own preview key (never the portal token, which would leak in the referrer header to
// every font host), and only then may a different design be shown via ?theme=.
export function viewFor(website, query) {
  const w = website || {};
  const key = String(query.get("preview") || "");
  const previewing = !!key && !!w.previewKey && key === String(w.previewKey);
  if (!w.published && !previewing) return { show: false };
  const t = String(query.get("theme") || "");
  return { show: true, previewing, theme: previewing && THEME_IDS.includes(t) ? t : undefined };
}

export const gateView = (view, cl) => (view.show && !view.previewing && publishLock(cl) ? { show: false } : view);

async function owner(req, supabase) {
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  return !error && !!(data && data.user);
}

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === "POST") {
    if (!(await owner(req, supabase))) return json({ ok: false, error: "Not authenticated" }, 401);
    let body;
    try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    if (body.action === "poll") {
      const id = String(body.clientId || "");
      if (!id) return json({ ok: false, error: "clientId required" }, 400);
      const { data: row, error } = await supabase.from("clients").select("data").eq("id", id).maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, job: (row && row.data && row.data.siteJob) || null });
    }
    // Blog articles, for the OS: the full list (scheduled and held too), one article, hold, delete.
    if (["blog-list", "blog-post", "blog-hold", "blog-delete"].includes(body.action)) {
      const id = String(body.clientId || "");
      if (!id) return json({ ok: false, error: "clientId required" }, 400);
      const store = supabaseStore(supabase);
      try {
        if (body.action === "blog-list") return json({ ok: true, posts: await loadIndex(store, id) });
        if (body.action === "blog-post") return json({ ok: true, post: await loadPost(store, id, String(body.slug || "")) });
        if (body.action === "blog-hold") return json({ ok: true, posts: await setHeld(store, id, String(body.slug || ""), !!body.held) });
        return json({ ok: true, posts: await removePost(store, id, String(body.slug || "")) });
      } catch (e) { return json({ ok: false, error: String(e.message || e) }, 400); }
    }
    if (body.action === "preview") {
      const cl = body.client || {};
      const slug = String(cl.landingSlug || "preview");
      // The OS preview of the blog shows what is published and what is coming up, but never a held one.
      let posts = [];
      if (String(body.page || "") === "blog" && cl.id) {
        try { posts = (await loadIndex(supabaseStore(supabase), String(cl.id))).filter((p) => !p.held).sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt)); } catch { posts = []; }
      }
      try {
        return new Response(renderSite(cl, String(body.page || "home"), { base: siteBase(url.host, slug), theme: body.theme, noindex: true, posts }),
          { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
      } catch (e) { return json({ ok: false, error: String(e.message || e) }, 400); }
    }
    return json({ ok: false, error: "unknown action" }, 400);
  }

  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  // Reached either directly (/site/<slug>/<page>) or through the netlify.toml rewrite (?slug=&page=).
  const qp = url.searchParams.get("page") || "";
  const qpost = url.searchParams.get("post") || "";
  const where = parsePath(url.pathname) || (url.searchParams.get("slug") ? { slug: url.searchParams.get("slug"), seg: qp, post: qp === "blog" ? qpost : "", bad: !!qpost && qp !== "blog" } : null);
  if (!where || where.bad) return plain("Page not found", "This page doesn't exist.", 404);

  const { data, error } = await supabase.from("clients").select("id, data").eq("data->>landingSlug", where.slug).maybeSingle();
  if (error) { console.error("site lookup failed:", error.message); return plain("Something went wrong", "Please try again in a moment.", 500); }
  if (!data || !data.data) return plain("Page not found", "This page doesn't exist.", 404);
  const cl = { ...data.data, id: data.id };
  if (isBillingPaused(cl)) return plain(brandName(cl), "This website is temporarily unavailable.", 503);
  // 🔴 Live only once it is fully paid (the second half is due BEFORE launch). Enforced here, not just by
  // greying out "Put it live", because the published flag is written by the browser. Preview links still
  // work, so the client can see and approve the finished site before paying the balance.
  const view = gateView(viewFor(cl.website, url.searchParams), cl);
  if (!view.show || !siteReady(cl)) return plain(brandName(cl), "Our new website is almost ready. Check back soon.", 200);
  const query = view.previewing ? `?preview=${encodeURIComponent(url.searchParams.get("preview"))}${view.theme ? `&theme=${view.theme}` : ""}` : "";
  // The five core pages, an extra page the client paid for, or the blog. Anything else is a 404.
  const pg = where.seg ? pageByPath(cl, where.seg) : pagesFor(cl)[0];
  if (!pg) return plain("Page not found", "This page doesn't exist.", 404);
  let posts, post;
  if (pg.id === "blog") {
    try {
      const store = supabaseStore(supabase);
      if (where.post) {
        post = await loadPost(store, cl.id, where.post);
        // 🔴 A held or not-yet-published article is invisible to the public, whatever its address.
        if (!post || !isPublished(post)) return plain("Page not found", "This article doesn't exist.", 404);
      } else posts = publishedPosts(await loadIndex(store, cl.id));
    } catch (e) { console.error("site blog read failed:", e.message); posts = []; }
  }
  // Count the visit only on the live public site (never a preview link).
  const track = !view.previewing && cl.website.published ? { url: `https://${url.host}/site-hit`, slug: where.slug } : null;
  return html(renderSite(cl, pg.id, { base: siteBase(url.host, where.slug), theme: view.theme, query, posts, post, track, noindex: !!view.previewing || !cl.website.published }),
    200, view.previewing ? { "cache-control": "no-store" } : {});
};
