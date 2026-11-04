// Builds a demo website for a business Bryson is about to meet (KB `demo-sites`).
//
// A `-background` function: Netlify answers 202 straight away and lets this run, because writing five pages of copy
// takes far longer than a normal function's ~10 seconds. The result goes on the PROSPECT's own record at
// `data.demoSite` (read-merge-write of that one key, no table to migrate), and the OS polls demo-site action "poll".
//
// POST { prospectId } with the owner's session.  Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
// PEXELS_API_KEY (optional: without it the demo uses colour and light instead of photos).

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { writeCopy, stockPhotos } from "./site-build-background.mjs";
import { demoClientOf, newDemoToken, validToken, DEMO_THEME_DEFAULT, pitchWriterOf } from "../lib/demo-site.mjs";
import { PICK_THEMES } from "../lib/site-render.mjs";
import { brandFromSite, currentSiteOf } from "../lib/brand-scrape.mjs";
import { isBlocked } from "../lib/outreach.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A saved company is addressed by its id; a fresh search result by its dedupe key (KB lead-scout). Both work.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function findProspect(supabase, idOrKey, cols = "*") {
  const k = String(idOrKey || "");
  if (!k) return null;
  const { data } = await supabase.from("scout_prospects").select(cols).eq(UUID.test(k) ? "id" : "dedupe_key", k).maybeSingle();
  return data || null;
}

// Merge one key into the prospect's data, re-reading first so a note or label saved meanwhile is kept.
export async function saveDemo(supabase, id, patch) {
  const { data: row, error } = await supabase.from("scout_prospects").select("data").eq("id", id).maybeSingle();
  if (error || !row) return false;
  const data = row.data || {};
  const next = { ...data, demoSite: { ...(data.demoSite || {}), ...patch } };
  const { error: e2 } = await supabase.from("scout_prospects").update({ data: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (e2) console.error("demo-site-background: could not store:", e2.message);
  return !e2;
}

// The same for a pitch preview on an existing CLIENT: only `pitchSite` is touched (KB demo-sites, "pitch previews").
export async function savePitch(supabase, id, patch) {
  const { data: row, error } = await supabase.from("clients").select("data").eq("id", id).maybeSingle();
  if (error || !row) return false;
  const data = row.data || {};
  const { error: e2 } = await supabase.from("clients").update({ data: { ...data, pitchSite: { ...(data.pitchSite || {}), ...patch } }, updated_at: new Date().toISOString() }).eq("id", id);
  if (e2) console.error("demo-site-background: could not store pitch:", e2.message);
  return !e2;
}

// What their current website looks like, kept on the client for their real site and landing page (server-owned).
export async function saveSiteBrand(supabase, id, brand) {
  const { data: row } = await supabase.from("clients").select("data").eq("id", id).maybeSingle();
  if (!row) return false;
  const { error } = await supabase.from("clients").update({ data: { ...(row.data || {}), siteBrand: brand }, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

// A design that suits the trade, unless Bryson already picked one for this business.
// A demo already on the retired Aurora moves to Showcase when it is rebuilt.
export const demoThemeFor = (niche, current) => (PICK_THEMES.includes(current) ? current
  : /pool|roof|epoxy|floor|concrete|construct|remodel/i.test(String(niche || "")) ? "cinematic"
  : /law|account|clinic|chiro|dental|wellness|therap|salon|spa/i.test(String(niche || "")) ? "editorial"
  : DEMO_THEME_DEFAULT);

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: ae } = await supabase.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  if (body.clientId) return buildPitch(supabase, String(body.clientId));
  const id = String(body.prospectId || "");
  if (!id) return json({ ok: false, error: "prospectId required" }, 400);
  const p = await findProspect(supabase, id);
  if (!p) return json({ ok: false, error: "Save this company to your call list first." }, 404);
  // 🔴 Never a website with the name of a business that asked not to be contacted.
  if (isBlocked(p)) return json({ ok: false, error: "They asked not to be contacted." }, 409);

  const prev = (p.data && p.data.demoSite) || {};
  // A rebuild keeps the same link, so one already texted to them still works.
  const token = validToken(prev.token) ? prev.token : newDemoToken();
  const theme = demoThemeFor(p.niche, prev.theme);
  const jobId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await saveDemo(supabase, p.id, { jobId, token, theme, status: "running", startedAt: new Date().toISOString(), error: null });
  try {
    const cl = demoClientOf(p);
    // Their colours, logo and fonts from the website they have now, read at the same time as the words are written.
    const site = currentSiteOf(p);
    const [content, stock, brand] = await Promise.all([writeCopy(cl, new Anthropic()), stockPhotos(p.niche), site ? brandFromSite(site).catch(() => null) : null]);
    await saveDemo(supabase, p.id, { jobId, status: "done", content, stock, brand: brand || prev.brand || null, builtAt: new Date().toISOString(), startedAt: null, error: null });
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("demo-site-background failed:", msg);
    const friendly = /credit balance|billing/i.test(msg) ? "The AI account is out of credits. Add credits in the Anthropic console, then try again." : msg.slice(0, 240);
    await saveDemo(supabase, p.id, { jobId, status: "error", startedAt: null, error: friendly });
  }
  return json({ ok: true, id: jobId }, 202);
};

// A pitch preview for an existing client: written from their own record (minus private notes), stored on `pitchSite`.
async function buildPitch(supabase, clientId) {
  const { data: row } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
  if (!row || !row.data) return json({ ok: false, error: "That client could not be found." }, 404);
  if (row.data.internal) return json({ ok: false, error: "Your own businesses build their website straight from the Website tab." }, 409);
  const prev = row.data.pitchSite || {};
  const token = validToken(prev.token) ? prev.token : newDemoToken();
  const theme = demoThemeFor(row.data.niche, prev.theme);
  const jobId = `pitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await savePitch(supabase, row.id, { jobId, token, theme, status: "running", startedAt: new Date().toISOString(), error: null });
  try {
    const site = currentSiteOf(row.data);
    const [content, stock, brand] = await Promise.all([writeCopy(pitchWriterOf(row.data), new Anthropic()), stockPhotos(row.data.niche), site ? brandFromSite(site).catch(() => null) : null]);
    await savePitch(supabase, row.id, { jobId, status: "done", content, stock, brand: brand || prev.brand || null, builtAt: new Date().toISOString(), startedAt: null, error: null });
    if (brand) await saveSiteBrand(supabase, row.id, brand);
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("demo-site-background pitch failed:", msg);
    const friendly = /credit balance|billing/i.test(msg) ? "The AI account is out of credits. Add credits in the Anthropic console, then try again." : msg.slice(0, 240);
    await savePitch(supabase, row.id, { jobId, status: "error", startedAt: null, error: friendly });
  }
  return json({ ok: true, id: jobId }, 202);
}
