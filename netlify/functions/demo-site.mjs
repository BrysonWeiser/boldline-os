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
import { renderSite, pageById, THEME_IDS, SITE_THEMES, siteReady, pickThemesFor, THEME_DEFAULT, MODES } from "../lib/site-render.mjs";
import { demoClientOf, demoExpired, demoSummary, decorateDemo, validToken, pitchClientOf } from "../lib/demo-site.mjs";
import { isBlocked } from "../lib/outreach.mjs";
import { saveDemo, findProspect, savePitch, saveSiteBrand } from "./demo-site-background.mjs";
import { brandFromSite, currentSiteOf } from "../lib/brand-scrape.mjs";
import { safePublicUrl } from "../lib/biz-email.mjs";

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
// `pitch: true` = an existing client's pitch preview (`data.pitchSite`), rendered from a stripped-down copy of them.
export function renderDemo(prospect, seg, { host, theme: asked, pitch = false } = {}) {
  const demo = (prospect && prospect.data && (pitch ? prospect.data.pitchSite : prospect.data.demoSite)) || {};
  const cl = pitch ? pitchClientOf(prospect, demo) : demoClientOf(prospect, demo);
  const pageId = seg ? (pageById(seg) && seg !== "book" ? seg : null) : "home";
  if (!pageId) return { status: 404, html: null };
  const theme = THEME_IDS.includes(asked) ? asked : cl.website.theme;
  const base = `https://${String(host).replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/demo/${encodeURIComponent(demo.token)}`;
  const query = theme !== cl.website.theme ? `?theme=${theme}` : "";
  const html = renderSite(cl, pageId, { base, theme, query, noindex: true });
  const designs = pickThemesFor(cl.website.theme).map((t) => ({ id: t, label: SITE_THEMES[t].label, current: t === theme,
    href: `${base}/${pageId === "home" ? "" : pageId + "/"}${t === cl.website.theme ? "" : `?theme=${t}`}` }));
  return { status: 200, html: decorateDemo(html, { name: cl.name, designs, modeKey: `bl-mode:${demo.token}` }) };
}

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  if (req.method === "POST") {
    if (!(await owner(req, supabase))) return json({ ok: false, error: "Not authenticated" }, 401);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    // "Use their website's colours" (KB brand-kit): read their current site again, words untouched. `url` is an address
    // Bryson typed when the OS doesn't know one.
    if (body.action === "brand") {
      const typed = body.url ? safePublicUrl(/^https?:\/\//i.test(String(body.url)) ? String(body.url).replace(/^http:/i, "https:") : `https://${String(body.url).trim()}`) : "";
      if (body.url && !typed) return json({ ok: false, error: "That doesn't look like a website address." }, 400);
      if (body.clientId) {
        const { data: crow } = await supabase.from("clients").select("id, data").eq("id", String(body.clientId)).maybeSingle();
        if (!crow) return json({ ok: false, error: "That client could not be found." }, 404);
        const site = typed || currentSiteOf(crow.data);
        if (!site) return json({ ok: false, needUrl: true, error: "What's their current website address?" });
        const brand = await brandFromSite(site);
        if (!brand) return json({ ok: false, error: "Couldn't read colours from that site. Set them by hand in their Brand kit (Assets tab)." });
        await saveSiteBrand(supabase, crow.id, brand);
        if (crow.data.pitchSite) await savePitch(supabase, crow.id, { brand });
        return json({ ok: true, brand });
      }
      const pr = await findProspect(supabase, String(body.id || ""), "*");
      if (!pr) return json({ ok: false, error: "That company could not be found." }, 404);
      const site = typed || currentSiteOf(pr);
      if (!site) return json({ ok: false, needUrl: true, error: "What's their current website address?" });
      const brand = await brandFromSite(site);
      if (!brand) return json({ ok: false, error: "Couldn't read colours from that site." });
      await saveDemo(supabase, pr.id, { brand });
      return json({ ok: true, brand });
    }
    // A pitch preview on an existing client (KB demo-sites, "pitch previews"): poll, design, or the finished copy.
    if (body.clientId) {
      const { data: crow } = await supabase.from("clients").select("id, data").eq("id", String(body.clientId)).maybeSingle();
      if (!crow) return json({ ok: false, error: "That client could not be found." }, 404);
      let pd = (crow.data && crow.data.pitchSite) || null;
      if (body.action === "theme") {
        if (!THEME_IDS.includes(body.theme)) return json({ ok: false, error: "Unknown design" }, 400);
        await savePitch(supabase, crow.id, { theme: body.theme }); pd = { ...(pd || {}), theme: body.theme };
      } else if (body.action === "mode") {
        // Light or dark (Bryson, 2026-11-04). "" goes back to the design's own.
        if (!["", ...MODES].includes(body.mode)) return json({ ok: false, error: "Unknown mode" }, 400);
        await savePitch(supabase, crow.id, { mode: body.mode }); pd = { ...(pd || {}), mode: body.mode };
      } else if (body.action === "content") {
        if (!pd || pd.status !== "done" || !pd.content) return json({ ok: false, error: "The preview isn't finished yet." }, 409);
        return json({ ok: true, content: pd.content, stock: pd.stock || [], theme: pd.theme || THEME_DEFAULT, mode: MODES.includes(pd.mode) ? pd.mode : "", builtAt: pd.builtAt || null });
      } else if (body.action !== "poll") return json({ ok: false, error: "unknown action" }, 400);
      return json({ ok: true, demo: demoSummary(pd, `https://${url.host}`) });
    }
    const id = String(body.id || "");
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const found = await findProspect(supabase, id, "id");
    if (!found) return json({ ok: true, demo: null });
    if (body.action === "theme") {
      if (!THEME_IDS.includes(body.theme)) return json({ ok: false, error: "Unknown design" }, 400);
      await saveDemo(supabase, found.id, { theme: body.theme });
    } else if (body.action === "mode") {
      if (!["", ...MODES].includes(body.mode)) return json({ ok: false, error: "Unknown mode" }, 400);
      await saveDemo(supabase, found.id, { mode: body.mode });
    } else if (body.action === "content") {
      // "They want it": the finished copy, photos and design, carried onto their new client record.
      const row = await findProspect(supabase, found.id, "data");
      const d = (row && row.data && row.data.demoSite) || {};
      if (d.status !== "done" || !d.content) return json({ ok: false, error: "Their demo isn't finished yet." }, 409);
      return json({ ok: true, content: d.content, stock: d.stock || [], theme: d.theme || THEME_DEFAULT, mode: MODES.includes(d.mode) ? d.mode : "", builtAt: d.builtAt || null });
    } else if (body.action !== "poll") return json({ ok: false, error: "unknown action" }, 400);
    const row = await findProspect(supabase, found.id, "data");
    return json({ ok: true, demo: demoSummary(row && row.data && row.data.demoSite, `https://${url.host}`) });
  }

  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const { token, seg } = parseDemoPath(url);
  if (!validToken(token)) return plain("Page not found", "This page doesn't exist.", 404);
  const { data: rows, error } = await supabase.from("scout_prospects").select("*").eq("data->demoSite->>token", token).limit(1);
  if (error) { console.error("demo lookup failed:", error.message); return plain("Something went wrong", "Please try again in a moment.", 500); }
  let p = rows && rows[0], pitch = false;
  if (!p) {   // not a prospect's demo: maybe an existing client's pitch preview
    const { data: crows } = await supabase.from("clients").select("id, data").eq("data->pitchSite->>token", token).limit(1);
    if (crows && crows[0]) { p = crows[0]; pitch = true; }
  }
  const demo = p && p.data && (pitch ? p.data.pitchSite : p.data.demoSite);
  // 🔴 A business that asked not to be contacted never has a site with its name on it, even an old link.
  if (!p || !demo || (!pitch && isBlocked(p))) return plain("Page not found", "This page doesn't exist.", 404);
  if (demo.status !== "done" || !siteReady(pitch ? pitchClientOf(p, demo) : demoClientOf(p, demo))) return plain("Almost ready", "This preview is still being put together. Try again in a minute.");
  if (demoExpired(demo)) return plain("This preview has ended", "Ask for a fresh link and we'll send one over.");
  const out = renderDemo(p, seg, { host: url.host, theme: String(url.searchParams.get("theme") || ""), pitch });
  if (!out.html) return plain("Page not found", "This page doesn't exist.", 404);
  return page(out.html, out.status);
};
