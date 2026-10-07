// The website calls this the moment it saves an enquiry (marketing-site submission-created for the
// contact form, audit.mjs for the free check). See ../lib/lead-arrival.mjs for the why.
//
// It is a BACKGROUND function so the website never waits on it, and it is public, because the
// website is a separate Netlify site and a shared password between the two is exactly what failed
// before. So it trusts nothing it is sent except a lead id, reads everything else from the saved
// row, acts only on a row created in the last 15 minutes, and every step is idempotent:
//   - the mirror only writes and buzzes for leads it has not seen (the same code the 15-minute job runs)
//   - the instant reply is claimed on the row before it is sent, so it can never go twice
//   - the free check starts only if the row still needs one (needsAudit, the sweep's own rule)
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { syncHouseLeads } from "../lib/house-leads-run.mjs";
import { UUID_RE, isFresh, ackEnquiry, startAudit, ACK_FORMS } from "../lib/lead-arrival.mjs";
import { needsAudit } from "./lead-leak-sweep.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "not configured" }, 500);
  let body = {};
  try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const leadId = String(body.leadId || "").trim();
  if (!UUID_RE.test(leadId)) return json({ ok: false, error: "leadId required" }, 400);

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: row, error } = await supabase.from("website_leads").select("id, created_at, form, name, email, status, recommended, payload").eq("id", leadId).maybeSingle();
  if (error || !row) return json({ ok: false, error: "not found" }, 404);
  if (!isFresh(row)) return json({ ok: true, skipped: "not a new lead" });

  const done = [];
  // 1. His phone, now rather than at the next 15-minute run.
  try { const m = await syncHouseLeads(supabase); if (m && m.added) done.push("pushed"); }
  catch (e) { console.error("lead-arrived: mirror failed:", e && e.message); }
  // 2. The instant reply to a contact-form enquiry.
  if (ACK_FORMS.includes(row.form)) {
    try { const a = await ackEnquiry(supabase, row); if (a.sent) done.push("replied"); else if (!a.ok) console.error("lead-arrived: reply failed:", a.error); }
    catch (e) { console.error("lead-arrived: reply failed:", e && e.message); }
  }
  // 3. The free check, started from inside the OS.
  if (row.form === "lead_leak" && needsAudit(row)) {
    try { if (await startAudit(row.id)) done.push("audit started"); }
    catch (e) { console.error("lead-arrived: could not start the audit:", e && e.message); }
  }
  console.log(`lead-arrived: ${row.form} ${leadId}: ${done.join(", ") || "nothing new to do"}`);
  return json({ ok: true, done });
};
