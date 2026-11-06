// A demo page and nothing else (KB demo-sites): what the demo host serves (sites/functions/demo.mjs) and what the
// tests render. Kept apart from the OS's demo function on purpose: that one also writes demos and reaches the OS's
// report and notification code, and the client-websites site must never be built from those (verify-sites-split).
import { renderSite, pageById, THEME_IDS, SITE_THEMES, siteReady, pickThemesFor } from "./site-render.mjs";
import { demoClientOf, demoExpired, decorateDemo, validToken, pitchClientOf, DEMO_HOST } from "./demo-site.mjs";
import { isBlocked } from "./outreach.mjs";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Every answer is private: never cached by anyone in between, never indexed.
export const page = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
export const plain = (title, msg, status = 200) => page(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F3F3F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-align:center;padding:24px">
<div><h1 style="font-size:clamp(28px,5vw,48px);letter-spacing:-.03em;margin:0 0 10px">${esc(title)}</h1><p style="color:#9A9A95;margin:0;max-width:440px">${esc(msg)}</p></div></body></html>`, status);

// /demo/<token>/[page]/ or the netlify.toml rewrite (?token=&page=).
export const parseDemoPath = (url) => {
  const m = String(url.pathname || "").match(/^\/demo\/([^/]+)(?:\/([^/]+))?\/?$/);
  const token = m ? decodeURIComponent(m[1]) : String(url.searchParams.get("token") || "");
  const seg = m ? (m[2] ? decodeURIComponent(m[2]) : "") : String(url.searchParams.get("page") || "");
  return { token, seg };
};

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
  return { status: 200, html: decorateDemo(html, { name: cl.name, designs, modeKey: `bl-mode:${demo.token}`, seenUrl: `${base}/__seen`, seenKey: `bl-seen:${demo.token}` }) };
}

// A demo page, served on the demo host by sites/functions/demo.mjs. `host` is the address it was asked on, so every
// link on the page stays there.
export async function serveDemoPage(supabase, url, host = DEMO_HOST) {
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
  const out = renderDemo(p, seg, { host, theme: String(url.searchParams.get("theme") || ""), pitch });
  if (!out.html) return plain("Page not found", "This page doesn't exist.", 404);
  return page(out.html, out.status);
}
