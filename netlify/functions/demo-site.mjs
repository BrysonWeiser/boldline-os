// Demo websites: showing one, and telling the OS how a build is going (KB `demo-sites`).
//
//   GET  /demo/<token>/[page]/            on the OS: sent on to the demo host (DEMO_HOST); the page itself is served
//                                         there by sites/functions/demo.mjs through serveDemoPage below
//   POST { action:"poll", id }            owner only: the demo's status and link (never its copy)
//   POST { action:"theme", id, theme }    owner only: which design the link opens on
//   POST { action:"content", id }         owner only: the finished copy, for turning the demo into their website
//   POST { action:"list" }                owner only: every demo and pitch preview, with whether they opened it
//   GET  /demo/<token>/__seen             public: "they opened it" (recordOpen), passed on by the demo host
//
// Built by demo-site-background; rendered by the real site renderer (../lib/site-render.mjs).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { THEME_IDS, THEME_DEFAULT, MODES } from "../lib/site-render.mjs";
import { parseDemoPath, renderDemo, serveDemoPage, plain } from "../lib/demo-page.mjs";
export { parseDemoPath, renderDemo, serveDemoPage };
import { demoClientOf, demoExpired, demoSummary, decorateDemo, validToken, pitchClientOf, PREVIEW_BOT, DEMO_HOST, DEMO_ORIGIN } from "../lib/demo-site.mjs";
import { isBlocked, waitingForContact } from "../lib/outreach.mjs";
import { saveDemo, findProspect, savePitch, saveSiteBrand } from "./demo-site-background.mjs";
import { brandFromSite, currentSiteOf, brandFromPicked } from "../lib/brand-scrape.mjs";
import { safePublicUrl } from "../lib/biz-email.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
async function owner(req, supabase) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  return !error && !!(data && data.user);
}

// ── "They opened it" (KB demo-sites, "opened signal") ─────────────────────────────────
// Records an open sent by demoOpenJS: a count, the first and the last time. Repeats within 10 minutes are one visit.
// The first open ever sends Bryson a push notification (push only: a quiet nudge, not an email and a text). Writes only
// those three fields, and on a prospect without touching `updated_at`, so an open never reorders his call list.
const OPEN_GAP_MS = 10 * 60 * 1000;
export async function recordOpen(supabase, token, { ua = "", now = Date.now(), notify } = {}) {
  if (!validToken(token) || PREVIEW_BOT.test(String(ua))) return { recorded: false };
  const at = new Date(now).toISOString();
  const bump = (d) => {
    if (!d || d.status !== "done" || demoExpired(d, now)) return null;
    const last = Date.parse(d.lastOpenedAt || "");
    if (Number.isFinite(last) && now - last < OPEN_GAP_MS) return null;
    return { opens: (Number(d.opens) || 0) + 1, firstOpenedAt: d.firstOpenedAt || at, lastOpenedAt: at };
  };
  const { data: rows } = await supabase.from("scout_prospects").select("id, name, blocked_at, data").eq("data->demoSite->>token", token).limit(1);
  const p = rows && rows[0];
  if (p) {
    if (isBlocked(p)) return { recorded: false };
    const patch = bump(p.data && p.data.demoSite);
    if (!patch) return { recorded: false };
    const data = { ...(p.data || {}), demoSite: { ...(p.data.demoSite || {}), ...patch } };
    const { error } = await supabase.from("scout_prospects").update({ data }).eq("id", p.id);
    if (error) { console.error("demo open not stored:", error.message); return { recorded: false }; }
    if (patch.opens === 1 && notify) await notify({ name: (p.data && (p.data.dba || p.data.name)) || p.name, pitch: false });
    return { recorded: true, opens: patch.opens };
  }
  const { data: crows } = await supabase.from("clients").select("id, data").eq("data->pitchSite->>token", token).limit(1);
  const c = crows && crows[0];
  if (!c) return { recorded: false };
  const patch = bump(c.data && c.data.pitchSite);
  if (!patch) return { recorded: false };
  if (!(await savePitch(supabase, c.id, patch))) return { recorded: false };
  if (patch.opens === 1 && notify) await notify({ name: (c.data && (c.data.reviewSenderName || c.data.name)) || "A client", pitch: true });
  return { recorded: true, opens: patch.opens };
}
const notifyFirstOpen = async ({ name, pitch }) => {
  try {
    const { sendPushToAll } = await import("../lib/push-shared.mjs");
    await sendPushToAll({ title: `${name} opened their ${pitch ? "website preview" : "demo website"}`, body: "Good time to call while it's fresh.", severity: "yellow", url: "/" });
  } catch (e) { console.error("demo open push failed:", e.message); }
};

// Every demo and pitch preview, for the Website demos screen: who, the state of the build, and whether they opened it.
// Picked field by field, never the whole record: a demo's words run to 15KB each and the list holds all of them.
const DEMO_LIST_PROSPECT = "id, name, niche, area, status, blocked_at, pitch:data->>pitch, phones:data->phones, emails:data->emails, phone1:data->>phone, email1:data->>email, dba:data->>dba, city:data->>city, state:data->>state, address:data->>address, owner:data->>ownerName, noContact:data->>noContactYet, socials:data->socials, ig:data->>instagram, domain, d_status:data->demoSite->>status, d_token:data->demoSite->>token, d_theme:data->demoSite->>theme, d_mode:data->demoSite->>mode, d_builtAt:data->demoSite->>builtAt, d_startedAt:data->demoSite->>startedAt, d_error:data->demoSite->>error, d_opens:data->demoSite->>opens, d_first:data->demoSite->>firstOpenedAt, d_last:data->demoSite->>lastOpenedAt";
const DEMO_LIST_CLIENT = "id, c_name:data->>name, c_niche:data->>niche, d_status:data->pitchSite->>status, d_token:data->pitchSite->>token, d_theme:data->pitchSite->>theme, d_mode:data->pitchSite->>mode, d_builtAt:data->pitchSite->>builtAt, d_startedAt:data->pitchSite->>startedAt, d_error:data->pitchSite->>error, d_opens:data->pitchSite->>opens, d_first:data->pitchSite->>firstOpenedAt, d_last:data->pitchSite->>lastOpenedAt";
const demoOfRow = (r) => ({ status: r.d_status, token: r.d_token, theme: r.d_theme, mode: r.d_mode, builtAt: r.d_builtAt, startedAt: r.d_startedAt, error: r.d_error, opens: r.d_opens, firstOpenedAt: r.d_first, lastOpenedAt: r.d_last });
export async function listDemos(supabase, origin) {
  const [{ data: prows, error: e1 }, { data: crows, error: e2 }] = await Promise.all([
    supabase.from("scout_prospects").select(DEMO_LIST_PROSPECT).not("data->demoSite->>status", "is", null).limit(500),
    supabase.from("clients").select(DEMO_LIST_CLIENT).not("data->pitchSite->>status", "is", null).limit(200),
  ]);
  if (e1 || e2) throw new Error((e1 || e2).message);
  const out = [];
  for (const r of prows || []) {
    if (isBlocked(r)) continue;
    const ph = Array.isArray(r.phones) && r.phones[0] && r.phones[0].number;
    const em = Array.isArray(r.emails) && r.emails[0] && r.emails[0].address;
    // What "They want it" needs to start their client record (index.html clientFromDemo), no more.
    const info = { name: r.name, dba: r.dba || "", city: r.city || "", state: r.state || "", address: r.address || "", ownerName: r.owner || "", phone: r.phone1 || ph || "", email: r.email1 || em || "" };
    // No way to reach them yet (built for a business just starting out): the card asks for one.
    const waiting = waitingForContact({ domain: r.domain, data: { noContactYet: r.noContact === "true", phones: r.phones, emails: r.emails, socials: r.socials, instagram: r.ig } });
    const social = Array.isArray(r.socials) && r.socials[0] ? { platform: r.socials[0].platform, url: r.socials[0].url } : null;
    out.push({ kind: "prospect", id: r.id, name: r.name, niche: r.niche || "", area: r.area || "", phone: info.phone, pitch: r.pitch || "ads", stage: r.status || "", info, noContact: waiting, social, demo: demoSummary(demoOfRow(r), origin) });
  }
  for (const r of crows || []) out.push({ kind: "client", id: r.id, name: r.c_name || "", niche: r.c_niche || "", area: "", phone: "", pitch: "website", stage: "client", demo: demoSummary(demoOfRow(r), origin) });
  return out;
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
      // Picked by hand from a screenshot (or the colour picker) when their site won't let us read it. Keeps any logo
      // and fonts an earlier read found; only the colours change.
      const manual = body.colors != null || body.primary != null;
      const picked = manual ? brandFromPicked(body.colors, body.primary) : null;
      if (manual && !picked) return json({ ok: false, error: "Pick their main colour first." }, 400);
      const withPicked = (old) => ({ ...(old && typeof old === "object" ? { logo: old.logo || "", headingFont: old.headingFont || "", bodyFont: old.bodyFont || "" } : {}), ...picked, from: "screenshot", at: new Date().toISOString() });
      const BLOCKED = "Their website doesn't let us read it automatically. Add a screenshot of it instead and we'll take the colours from that.";
      const typed = body.url ? safePublicUrl(/^https?:\/\//i.test(String(body.url)) ? String(body.url).replace(/^http:/i, "https:") : `https://${String(body.url).trim()}`) : "";
      if (body.url && !typed) return json({ ok: false, error: "That doesn't look like a website address." }, 400);
      if (body.clientId) {
        const { data: crow } = await supabase.from("clients").select("id, data").eq("id", String(body.clientId)).maybeSingle();
        if (!crow) return json({ ok: false, error: "That client could not be found." }, 404);
        let brand;
        if (picked) brand = withPicked(crow.data.siteBrand || (crow.data.pitchSite && crow.data.pitchSite.brand));
        else {
          const site = typed || currentSiteOf(crow.data);
          if (!site) return json({ ok: false, needUrl: true, error: "What's their current website address?" });
          brand = await brandFromSite(site);
          if (!brand) return json({ ok: false, blocked: true, error: BLOCKED });
        }
        await saveSiteBrand(supabase, crow.id, brand);
        if (crow.data.pitchSite) await savePitch(supabase, crow.id, { brand });
        return json({ ok: true, brand });
      }
      const pr = await findProspect(supabase, String(body.id || ""), "*");
      if (!pr) return json({ ok: false, error: "That company could not be found." }, 404);
      let brand;
      if (picked) brand = withPicked(pr.data && pr.data.demoSite && pr.data.demoSite.brand);
      else {
        const site = typed || currentSiteOf(pr);
        if (!site) return json({ ok: false, needUrl: true, error: "What's their current website address?" });
        brand = await brandFromSite(site);
        if (!brand) return json({ ok: false, blocked: true, error: BLOCKED });
      }
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
      return json({ ok: true, demo: demoSummary(pd, DEMO_ORIGIN) });
    }
    if (body.action === "list") {
      try { return json({ ok: true, demos: await listDemos(supabase, DEMO_ORIGIN) }); }
      catch (e) { return json({ ok: false, error: e.message }, 500); }
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
    return json({ ok: true, demo: demoSummary(row && row.data && row.data.demoSite, DEMO_ORIGIN) });
  }

  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  const { token, seg } = parseDemoPath(url);
  if (seg === "__seen") {
    try { await recordOpen(supabase, token, { ua: req.headers.get("user-agent") || "", notify: notifyFirstOpen }); } catch (e) { console.error("demo open failed:", e.message); }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  // 🔴 THE OS NEVER SHOWS A DEMO ITSELF. Every link already sent on this address goes to the demo's own home (see
  // DEMO_HOST), so a prospect never lands on the OS's address and a demo never runs on the OS's origin.
  if (!validToken(token)) return plain("Page not found", "This page doesn't exist.", 404);
  return demoRedirect(url, token, seg);
};

// The same page on the demo host, keeping the design asked for. Temporary (302), so a browser never remembers it.
export function demoRedirect(url, token, seg) {
  const q = new URLSearchParams(url.search); q.delete("token"); q.delete("page");
  const qs = q.toString();
  const to = `${DEMO_ORIGIN}/demo/${encodeURIComponent(token)}/${seg ? encodeURIComponent(seg) + "/" : ""}${qs ? "?" + qs : ""}`;
  return new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

