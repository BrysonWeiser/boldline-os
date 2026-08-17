// Ad Generator, long-running half. Netlify runs any function whose name ends in
// `-background` for up to 15 minutes and returns 202 immediately, which is what the
// Google campaign action needs: 3-5 ad groups x 15 headlines x 4 descriptions blew
// the ~10s synchronous limit and returned a 504 on its first real use.
//
// RESULT STORAGE: on the CLIENT RECORD at `data.adGenJob`, not a new table. That is
// deliberate — the `deal_briefs` pattern needs a Supabase migration, and a migration
// nobody ran is exactly what made Lead Scout hang silently. The OS polls
// `ad-generator` action:"poll" to read it back.
//
// POST { action:"google"|"meta", clientId, ...brief } with the owner's session.
//
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import {
  TOOL_FOR, MAX_TOKENS_FOR, runTool, cleanGoogle, cleanMeta, brief, systemFor, promptFor, friendlyError,
} from "../lib/ad-gen-shared.mjs";
import { getLocalConditions } from "../lib/local-conditions.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Read, merge, write. Only the adGenJob key is touched so a concurrent edit to the
// rest of the client record is not clobbered.
async function writeJob(supabase, clientId, job) {
  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  const next = { ...((row && row.data) || {}), adGenJob: job };
  const { error } = await supabase.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", clientId);
  if (error) console.error("ad-generator-background: could not store job:", error.message);
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);
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

  const action = String(body.action || "google");
  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
  if (action !== "google" && action !== "meta") return json({ ok: false, error: `Unknown action "${action}"` }, 400);

  // A job id lets the OS ignore the result of a run it already abandoned.
  const id = `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await writeJob(supabase, clientId, { id, action, status: "running", startedAt: new Date().toISOString(), result: null, error: null });

  try {
    // What is actually happening in the service area right now, so the copy can lead on
    // real demand (an active heat warning, the season) instead of generic benefits. Facts
    // only, fetched here because the model has no live data of its own. Never fatal.
    const cond = await getLocalConditions({ locations: body.locations });
    const { data, model } = await runTool({
      tool: TOOL_FOR[action], maxTokens: MAX_TOKENS_FOR[action],
      system: systemFor(!!body.agency),
      prompt: `${promptFor(action, brief(body))}

WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW:
${cond.block}`,
    });

    let result;
    if (action === "google") {
      const out = cleanGoogle(data);
      if (!out.adGroups.length) throw new Error("The model returned no usable ad groups. Try again.");
      result = { ...out, totals: {
        adGroups: out.adGroups.length,
        keywords: out.adGroups.reduce((n, g) => n + g.keywords.length, 0),
        headlines: out.adGroups.reduce((n, g) => n + g.headlines.length, 0),
        negatives: out.negativeKeywords.length,
      } };
    } else {
      const variants = cleanMeta(data);
      if (!variants.length) throw new Error("The model returned no usable variants. Try again.");
      result = { variants };
    }

    await writeJob(supabase, clientId, { id, action, status: "done", model, finishedAt: new Date().toISOString(), result, error: null });
    return json({ ok: true, id, status: "done" });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error("ad-generator-background failed:", m);
    await writeJob(supabase, clientId, { id, action, status: "error", finishedAt: new Date().toISOString(), result: null, error: friendlyError(m) });
    return json({ ok: false, id, error: friendlyError(m) }, 500);
  }
};
