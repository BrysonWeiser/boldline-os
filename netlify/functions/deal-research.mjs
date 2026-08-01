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
    const { data, error } = await supabase.from("deal_briefs").select("id, status, result, error, created_at").eq("id", id).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: true, status: "unknown" });
    return json({ ok: true, status: data.status, result: data.result || null, error: data.error || null });
  }

  if (action === "recent") {
    const { data, error } = await supabase.from("deal_briefs").select("id, status, input, created_at").order("created_at", { ascending: false }).limit(10);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, briefs: data || [] });
  }

  return json({ ok: false, error: "unknown action" }, 400);
};
