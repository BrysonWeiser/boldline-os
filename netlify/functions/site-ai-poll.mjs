// The OS asks here whether the AI website editor has answered (see site-ai-background.mjs). Signed-in only.
// POST { clientId, jobId } -> { ok, job } where job is null until the answer for THAT job id is on the record.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not signed in" }, 401);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: ae } = await db.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
  let body = {}; try { body = await req.json(); } catch (e) {}
  const { data: row, error } = await db.from("clients").select("data").eq("id", String(body.clientId || "")).maybeSingle();
  if (error) return json({ ok: false, error: "Could not check just now." }, 500);
  const job = row && row.data && row.data.siteAiJob;
  return json({ ok: true, job: job && job.id === String(body.jobId || "") ? job : null });
};
