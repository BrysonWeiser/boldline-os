// On-demand "send me today's agenda now" — owner-JWT gated (same auth as
// calendar.mjs / calendly.mjs). Powers the "Send today's agenda" button on the
// OS Calendar. Scheduled functions can't be triggered by HTTP in production
// (Netlify returns 403), so this normal function is how a manual send happens.
// force:true → sends even on an empty day, since the owner explicitly asked.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { runDigest } from "../lib/calendar-digest-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  const result = await runDigest({ force: true });
  return json(result, result && result.ok === false ? 500 : 200);
};
