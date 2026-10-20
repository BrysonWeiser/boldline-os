// Demo websites: showing one, and telling the OS how a build is going (KB `demo-sites`).
//
//   GET  /demo/<token>/[page]/            the demo, with the preview strip and the send-nothing guard
//   POST { action:"poll", id }            owner only: the demo's status and link (never its copy)
//   POST { action:"theme", id, theme }    owner only: which design the link opens on
//   POST { action:"content", id }         owner only: the finished copy, for turning the demo into their website
//
// Built by demo-site-background; rendered by the real site renderer (../lib/site-render.mjs).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { renderSite, pageById, THEME_IDS, SITE_THEMES, siteReady } from "../lib/site-render.mjs";
import { demoClientOf, demoExpired, demoSummary, decorateDemo, validToken } from "../lib/demo-site.mjs";
import { isBlocked } from "../lib/outreach.mjs";
import { saveDemo, findProspect } from "./demo-site-background.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Every answer is private: never cached by anyone in between, never indexed.
const page = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
const plain = (title, msg, status = 200) => page(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F3F3F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:clamp(28px,5vw,48px);letter-spacing:-.03em;margin:0 0 10px">${esc(title)}</h1><p style="color:#9A9A95;margin:0;max-width:440px">${esc(msg)}</p></div></body></html>`, status);

// /demo/<token>/[page]/ or the netlify.toml rewrite (?token=&page=).
export const parseDemoPath = (url) => {
  const m = String(url.pathname || "").match(/^\/demo\/([^/]+)(?:\/([^/]+))?\/?$/);
  const token = m ? decodeURIComponent(m[1]) : String(url.searchParams.get("token") || "");
  const seg = m ? (m[2] ? decodeURIComponent(m[2]) : "") : String(url.searchParams.get("page") || "");
  return { token, seg };
};

async function owner(req, supabase) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  return !error && !!(data && data.user);
}

// The demo page itself. Exported for the tests, which render it without a database.
export function renderDemo(prospect, seg, { host, theme: asked } = {}) {
  const demo = (prospect && prospect.data && prospect.data.demoSite) || {};
  const cl = demoClientOf(prospect, demo);
  const pageId = seg ? (pageById(seg) && seg !== "book" ? seg : null) : "home";
  if (!pageId) return { status: 404, html: null };
  const theme = THEME_IDS.includes(asked) ? asked : cl.website.theme;
  const base = `https://${String(host).replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/demo/${encodeURIComponent(demo.token)}`;
  const query = theme !== cl.website.theme ? `?theme=${theme}` : "";
  const html = renderSite(cl, pageId, { base, theme, query, noindex: true });
  const designs = THEME_IDS.map((t) => ({ id: t, label: SITE_THEMES[t].label, current: t === theme,
    href: `${base}/${pageId === "home" ? "" : pageId + "/"}${t === cl.website.theme ? "" : `?theme=${t}`}` }));
  return { status: 200, html: decorateDemo(html, { name: cl.name, designs }) };
}

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === "POST") {
    if (!(await owner(req, supabase))) return json({ ok: false, error: "Not authenticated" }, 401);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    const id = String(body.id || "");
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const found = await findProspect(supabase, id, "id");
    if (!found) return json({ ok: true, demo: null });
    if (body.action === "theme") {
      if (!THEME_IDS.includes(body.theme)) return json({ ok: false, error: "Unknown design" }, 400);
      await saveDemo(supabase, found.id, { theme: body.theme });
    } else if (body.action === "content") {
      // "They want it": the finished copy, photos and design, carried onto their new client record.
      const row = await findProspect(supabase, found.id, "data");
      const d = (row && row.data && row.data.demoSite) || {};
      if (d.status !== "done" || !d.content) return json({ ok: false, error: "Their demo isn't finished yet." }, 409);
      return json({ ok: true, content: d.content, stock: d.stock || [], theme: d.theme || "aurora", builtAt: d.builtAt || null });
    } else if (body.action !== "poll") return json({ ok: false, error: "unknown action" }, 400);
    const row = await findProspect(supabase, found.id, "data");
    return json({ ok: true, demo: demoSummary(row && row.data && row.data.demoSite, `https://${url.host}`) });
  }

  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const { token, seg } = parseDemoPath(url);
  if (!validToken(token)) return plain("Page not found", "This page doesn't exist.", 404);
  const { data: rows, error } = await supabase.from("scout_prospects").select("*").eq("data->demoSite->>token", token).limit(1);
  if (error) { console.error("demo lookup failed:", error.message); return plain("Something went wrong", "Please try again in a moment.", 500); }
  const p = rows && rows[0];
  const demo = p && p.data && p.data.demoSite;
  // 🔴 A business that asked not to be contacted never has a site with its name on it, even an old link.
  if (!p || !demo || isBlocked(p)) return plain("Page not found", "This page doesn't exist.", 404);
  if (demo.status !== "done" || !siteReady(demoClientOf(p, demo))) return plain("Almost ready", "This preview is still being put together. Try again in a minute.");
  if (demoExpired(demo)) return plain("This preview has ended", "Ask for a fresh link and we'll send one over.");
  const out = renderDemo(p, seg, { host: url.host, theme: String(url.searchParams.get("theme") || "") });
  if (!out.html) return plain("Page not found", "This page doesn't exist.", 404);
  return page(out.html, out.status);
};
