// Deal Prep poll/get endpoint — the OS polls this after kicking off
// deal-research-background, until the brief's status flips to done (or error).
// Owner-JWT auth; reads the service-role-only deal_briefs table.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "get";

  if (action === "get") {
    const id = url.searchParams.get("id") || "";
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { data, error } = await supabase.from("deal_briefs").select("id, status, result, error, input, created_at").eq("id", id).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: true, status: "unknown" });
    // The answers come back with the brief, or reopening one shows an empty form and he
    // retypes a call he has already had.
    return json({ ok: true, status: data.status, result: data.result || null, error: data.error || null,
      answers: ((data.input || {}).meetingAnswers) || null, input: data.input || null });
  }

  if (action === "recent") {
    const { data, error } = await supabase.from("deal_briefs").select("id, status, input, created_at").order("created_at", { ascending: false }).limit(50);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, briefs: data || [] });
  }

  // 🔴 MEETING ANSWERS LIVE IN `input`, AND THAT IS DELIBERATE.
  //
  // Bryson types these while he is on a call, so losing them to a page reload is not
  // acceptable, which rules out keeping them in the browser. The obvious home would be a new
  // column, and a new column means a Supabase migration he has to remember to run. A feature
  // that silently does nothing until somebody pastes SQL is exactly how Lead Scout hung
  // (KB `lead-scout-schema-hang`), so no migration.
  //
  // `input` is the right half of the row: the background job writes it ONCE when the brief is
  // created and never touches it again, while `result` is overwritten by the research run. So
  // answers parked here cannot be clobbered by anything, and they sit with the prospect they
  // belong to. Read, merge, write, so a second save never drops the first one's fields.
  if (action === "notes") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    const id = url.searchParams.get("id") || "";
    if (!id) return json({ ok: false, error: "id required" }, 400);
    let body;
    try { body = JSON.parse((await req.text()) || "{}"); }
    catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    const { data: row, error: readErr } = await supabase.from("deal_briefs").select("input").eq("id", id).maybeSingle();
    if (readErr) return json({ ok: false, error: readErr.message }, 500);
    if (!row) return json({ ok: false, error: "That briefing is not there any more." }, 404);
    const input = { ...(row.input || {}), meetingAnswers: { ...(body.answers || {}) }, notesSavedAt: new Date().toISOString() };
    const { error } = await supabase.from("deal_briefs").update({ input, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, savedAt: input.notesSavedAt });
  }

  if (action === "delete") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    const id = url.searchParams.get("id") || "";
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { error } = await supabase.from("deal_briefs").delete().eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "unknown action" }, 400);
};
