// The partner's leads page for one of Bryson's own businesses (see ../lib/team-view.mjs).
// GET /team?t=<token>        the page
// POST /team?t=<token>       {action:"list"} or {action:"status", key, status}
// The token is the whole key, so it is long and random, it is never logged, and the page tells the
// browser not to send it anywhere as a referrer. Turning the link off in the OS removes the token.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { teamOn, teamLeads, applyTeamStatus, renderTeamPage, teamOffPage } from "../lib/team-view.mjs";

const HEAD = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...HEAD } });
const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...HEAD } });
const TOKEN_RE = /^[0-9a-f-]{32,64}$/i;

const load = async (db, token) => {
  const { data, error } = await db.from("clients").select("id, data").eq("data->team->>token", token).limit(2);
  if (error) throw new Error(error.message);
  const row = (data || []).find((r) => r && r.data && r.data.team && r.data.team.token === token);
  return row && teamOn(row.data) ? row : null;
};

export default async (req) => {
  const token = String(new URL(req.url).searchParams.get("t") || "");
  if (!TOKEN_RE.test(token)) return req.method === "GET" ? html(teamOffPage(), 404) : json({ ok: false, error: "This link is turned off." }, 404);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let row;
  try { row = await load(db, token); } catch (e) { return json({ ok: false, error: "Could not load the leads. Try again in a minute." }, 500); }
  if (!row) return req.method === "GET" ? html(teamOffPage(), 404) : json({ ok: false, error: "This link is turned off." }, 404);

  if (req.method === "GET") return html(renderTeamPage(row.data, { token }));
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body = {};
  try { body = await req.json(); } catch (e) { body = {}; }
  if (body.action === "list") return json({ ok: true, leads: teamLeads(row.data) });
  if (body.action !== "status") return json({ ok: false, error: "Unknown action" }, 400);

  // 🔴 READ AGAIN RIGHT BEFORE WRITING. The row was loaded a moment ago, and a lead can land (or
  // Bryson can change a status in the OS) in between. Writing the copy from above would erase it.
  let fresh;
  try { fresh = await load(db, token); } catch (e) { return json({ ok: false, error: "Could not save. Try again." }, 500); }
  if (!fresh) return json({ ok: false, error: "This link is turned off." }, 404);
  const next = applyTeamStatus(fresh.data, String(body.key || ""), String(body.status || ""));
  if (!next) return json({ ok: false, error: "That lead could not be found." }, 400);
  if (next !== fresh.data) {
    const { error } = await db.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", fresh.id);
    if (error) return json({ ok: false, error: "Could not save. Try again." }, 500);
  }
  return json({ ok: true, leads: teamLeads(next) });
};
