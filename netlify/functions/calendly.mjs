// Calendly meetings for the OS Calendar. Owner-JWT gated. Reads
// CALENDLY_API_TOKEN (a Calendly Personal Access Token). Returns scheduled
// events in a window around now, normalized for the calendar.
//
// Fail-soft: if the token is missing OR Calendly errors, returns meetings:[]
// plus a `configured` flag, so the calendar always renders (just without
// meetings) and the UI can prompt to connect Calendly.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const CAL = "https://api.calendly.com";

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  const token = process.env.CALENDLY_API_TOKEN;
  if (!token) return json({ ok: true, configured: false, meetings: [] });

  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    // 1) whoami → the user URI to scope the event query to this account
    const meRes = await fetch(`${CAL}/users/me`, { headers: H });
    if (!meRes.ok) return json({ ok: true, configured: true, meetings: [], error: `Calendly /users/me ${meRes.status}` });
    const me = await meRes.json();
    const userUri = me && me.resource && me.resource.uri;
    if (!userUri) return json({ ok: true, configured: true, meetings: [], error: "no user uri" });

    // 2) scheduled events in a window that covers the calendar's usual range
    const now = Date.now();
    const min = new Date(now - 45 * 864e5).toISOString();
    const max = new Date(now + 120 * 864e5).toISOString();
    const q = new URLSearchParams({ user: userUri, min_start_time: min, max_start_time: max, status: "active", sort: "start_time:asc", count: "100" });
    const evRes = await fetch(`${CAL}/scheduled_events?${q.toString()}`, { headers: H });
    if (!evRes.ok) return json({ ok: true, configured: true, meetings: [], error: `Calendly events ${evRes.status}` });
    const ev = await evRes.json();
    const events = (ev && ev.collection) || [];

    // 3) invitee name per event (capped + parallel so latency stays bounded)
    const capped = events.slice(0, 40);
    const meetings = await Promise.all(capped.map(async (e) => {
      let inviteeName = null;
      try {
        const invRes = await fetch(`${e.uri}/invitees`, { headers: H });
        if (invRes.ok) { const inv = await invRes.json(); const first = (inv.collection || [])[0]; inviteeName = first ? (first.name || first.email || null) : null; }
      } catch { /* invitee name is best-effort */ }
      const loc = e.location || {};
      return {
        id: e.uri,
        name: e.name || "Meeting",
        start: e.start_time,
        end: e.end_time,
        inviteeName,
        joinUrl: loc.join_url || (typeof loc.location === "string" ? loc.location : null) || null,
        locationType: loc.type || null,
      };
    }));

    return json({ ok: true, configured: true, meetings });
  } catch (e) {
    return json({ ok: true, configured: true, meetings: [], error: String((e && e.message) || e) });
  }
};
