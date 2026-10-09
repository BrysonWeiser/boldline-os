// A business's bookings as a calendar a phone subscribes to (see ../lib/biz-portal.mjs bookingsIcs).
// GET /biz-cal?t=<portal token>. Read only, like the portal it belongs to.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { portalOn, bookingsIcs } from "../lib/biz-portal.mjs";

const TOKEN_RE = /^[0-9a-f-]{32,64}$/i;
export default async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("View only", { status: 405 });
  const token = String(new URL(req.url).searchParams.get("t") || "");
  const gone = () => new Response("This calendar link is turned off.", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  if (!TOKEN_RE.test(token)) return gone();
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from("clients").select("id, data").eq("data->portal->>token", token).limit(2);
  if (error) return new Response("Try again in a minute.", { status: 500 });
  const row = (data || []).find((r) => r && r.data && r.data.portal && r.data.portal.token === token);
  if (!row || !portalOn(row.data)) return gone();
  return new Response(bookingsIcs(row.data), { status: 200, headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" } });
};
