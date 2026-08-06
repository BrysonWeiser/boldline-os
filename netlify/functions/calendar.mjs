// Manual calendar events for the OS Calendar. Owner-JWT gated. CRUD over the
// calendar_events Supabase table (owner-only; service-role). Lets Bryson drop
// meetings/tasks/reminders on the calendar by hand — the main way to log
// meetings while Calendly stays on the free plan (no API sync).
//
// Needs the one-time migration docs/sql/calendar-schema.sql.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const KINDS = new Set(["meeting", "task", "reminder", "other"]);

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
  const action = String(body.action || "list");
  const COLS = "id, event_date, event_time, title, note, kind";

  try {
    if (action === "list") {
      const from = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10);
      const { data, error } = await supabase.from("calendar_events")
        .select(COLS).gte("event_date", from).lte("event_date", to)
        .order("event_date", { ascending: true });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, events: data || [] });
    }

    if (action === "add") {
      const event_date = String(body.event_date || "").slice(0, 10);
      const title = String(body.title || "").trim().slice(0, 200);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date) || !title) return json({ ok: false, error: "event_date (YYYY-MM-DD) and title are required" }, 400);
      const kind = KINDS.has(String(body.kind)) ? String(body.kind) : "other";
      const event_time = body.event_time ? String(body.event_time).slice(0, 8) : null;
      const note = body.note ? String(body.note).trim().slice(0, 1000) : null;
      const { data, error } = await supabase.from("calendar_events")
        .insert({ event_date, event_time, title, note, kind }).select(COLS).single();
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, event: data });
    }

    if (action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ ok: false, error: "id required" }, 400);
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || "Request failed" }, 500);
  }
};
