// Ad Generator — real campaign structure written by a model, not string templates.
//
// SYNC actions only. The Google campaign action moved to `ad-generator-background`
// after it returned a 504 on first real use: a synchronous Netlify function gets
// roughly 10 seconds, and 3-5 ad groups x 15 headlines is far more output than that.
// Creative angles are small enough to answer inline, so they stayed here.
//
// POST { action, ... } with the owner's Supabase session:
//   "creatives" -> creative angles for the Ad Creative Studio, built from the real
//                  niche rather than the five fixed templates. Answers inline.
//   "poll"      -> { clientId } read the background job's result off the client
//                  record. No new Supabase table, so there is no migration to
//                  forget — a missing one is what silently hung Lead Scout.
//
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import {
  TOOL_FOR, MAX_TOKENS_FOR, runTool, cleanCreatives, brief, systemFor, promptFor, friendlyError,
} from "../lib/ad-gen-shared.mjs";
import { getLocalConditions } from "../lib/local-conditions.mjs";
export { LIMITS, fitWords, fitSentence, cleanGoogle } from "../lib/ad-gen-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const action = String(body.action || "creatives");

  // ── Poll: hand back whatever the background job has written so far ──────────
  if (action === "poll") {
    const clientId = String(body.clientId || "");
    if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
    const { data: row, error } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    // No job yet is a legitimate answer, not an error: the OS polls before the
    // background function has had time to write its first row.
    return json({ ok: true, job: (row && row.data && row.data.adGenJob) || null });
  }

  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);

  if (action === "creatives") {
    try {
      // Same live context the campaign builder gets: a creative angle about beating the
      // heat is only worth writing when it is actually hot where the ads run.
      const cond = await getLocalConditions({ locations: body.locations });
      const { data, model } = await runTool({
        tool: TOOL_FOR.creatives, maxTokens: MAX_TOKENS_FOR.creatives,
        system: systemFor(!!body.agency),
        prompt: `${promptFor("creatives", brief(body))}

WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW:
${cond.block}`,
      });
      const angles = cleanCreatives(data);
      if (!angles.length) return json({ ok: false, error: "The model returned no usable angles. Try again." }, 502);
      return json({ ok: true, model, angles });
    } catch (e) {
      const m = String((e && e.message) || e);
      console.error("ad-generator creatives failed:", m);
      return json({ ok: false, error: friendlyError(m) }, 500);
    }
  }

  if (action === "google" || action === "meta") {
    return json({ ok: false, error: `"${action}" runs as a background job. Post to ad-generator-background, then poll here.` }, 400);
  }

  return json({ ok: false, error: `Unknown action "${action}"` }, 400);
};
