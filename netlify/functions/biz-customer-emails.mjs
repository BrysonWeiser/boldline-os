// Every hour: the emails a business Bryson owns sends its customers on its own (KB `business-emails`):
// a reminder before the job, a review request after it, and "time for another" for one-off customers.
// Who is due what is decided by dueCustomerEmails (pure, tested); this only sends and records.
// 🔴 Sent first, then recorded, then the record is merged into a fresh read: a failed send is tried again
// next hour, and a booking or opt-out that landed meanwhile is never written over.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, retryQuery } from "../lib/report-shared.mjs";
import { isOwned } from "../lib/owned.mjs";
import { dueCustomerEmails, buildCustomerEmail, sendAsBusiness, senderOf } from "../lib/biz-email.mjs";

export default async () => {
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const key = process.env.OPTOUT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.URL || "";
  const { data: rows, error } = await retryQuery(() => db.from("clients").select("id, data"), { job: "biz-customer-emails", step: "clients load" });
  if (error) { console.error("biz-customer-emails: could not load", error.message); return; }
  for (const row of rows || []) {
    const cl = { ...(row.data || {}), id: (row.data && row.data.id) || row.id };
    if (!isOwned(cl) || cl.demo) continue;
    const due = dueCustomerEmails(cl, Date.now());
    if (!due.length) continue;
    const log = {}; let senderBroke = null;
    for (const { kind, booking } of due) {
      const mail = buildCustomerEmail(cl, kind, booking, { base, key });
      const r = await sendAsBusiness(cl, { to: booking.email, subject: mail.subject, html: mail.html, text: mail.text }, { send: sendEmail, strict: true });
      if (r.sent) log[`${booking.id}:${kind}`] = new Date().toISOString();
      else { console.error(`biz-customer-emails: ${cl.name} ${kind} not sent:`, r.error); if (r.senderFailed) { senderBroke = r.error; break; } }
    }
    if (!Object.keys(log).length && !senderBroke) continue;
    const { data: fresh } = await db.from("clients").select("data").eq("id", row.id).maybeSingle();
    if (!fresh || !fresh.data) continue;
    const next = { ...fresh.data, customerEmailLog: { ...(fresh.data.customerEmailLog || {}), ...log } };
    // The business's address stopped working (its domain was removed from the email service): stop sending
    // as it, so the OS shows it needs a new test, rather than failing quietly every hour.
    if (senderBroke) next.emailSenderStatus = { ...(fresh.data.emailSenderStatus || {}), address: senderOf(cl), verified: false, failedAt: new Date().toISOString(), error: String(senderBroke).slice(0, 300) };
    const { error: wErr } = await db.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (wErr) console.error("biz-customer-emails: could not record", wErr.message);
  }
};
