// What happens the moment someone enquires on boldlinemedia.com (Bryson, 2026-10-07: "add both of
// those things", after the client-journey walkthrough found two gaps).
//
//  1. 🔴 THE CONTACT FORM ANSWERED NOBODY. BoldLine sells instant lead follow-up, and its own
//     contact form sent the person nothing. Now they get a reply within a minute (ackEnquiry).
//  2. 🔴 HIS PHONE HEARD ABOUT IT UP TO 15 MINUTES LATER. The push came from the 15-minute
//     mirror. The website now tells the OS the instant a lead is saved (lead-arrived-background),
//     which runs the same mirror, so the same push fires within seconds. The 15-minute job stays
//     as the safety net for both.
//  3. 🔴 THE FREE CHECK DEPENDED ON A PASSWORD SET ON TWO SITES. Its report takes well over 30
//     seconds, so only the background function can write it, and the only thing that started that
//     function was a request carrying AUDIT_TRIGGER_SECRET. The 10-minute safety net ran the
//     report INSIDE a scheduled function, which Netlify stops at 30 seconds, so it could not
//     finish one either (same trap as the blog, KB blog-redesign-2026-10). Both now start the
//     background function with a key derived from a secret the OS already holds.
import crypto from "node:crypto";
import { sendEmail } from "./report-shared.mjs";

export const BOOK_URL = "https://calendly.com/theboldlinemedia/30min";
// A lead is "just arrived" for this long. The instant endpoint is public, so it only ever acts
// on a row that is genuinely new, and everything it does is idempotent anyway.
export const LEAD_FRESH_MS = 15 * 60e3;
// The safety net replies within this window and never later: "got your message" three days on
// is worse than nothing.
export const ACK_WINDOW_MS = 2 * 3600e3;
export const MAX_ACK_TRIES = 3;
const CLAIM_STALE_MS = 10 * 60e3;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// OS to OS only: proves a request to a background function came from our own code.
export const leadJobKey = () => crypto.createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}:lead-jobs`).digest("hex");
export const keyOk = (got) => {
  const want = leadJobKey(), g = String(got || "");
  return g.length === want.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(want));
};

export const isFresh = (row, now = Date.now()) => {
  const age = now - new Date((row && row.created_at) || 0).getTime();
  return age >= -60e3 && age <= LEAD_FRESH_MS;
};

// Does this enquiry still need its instant reply? Only the contact form (the free check gets its
// report, a booking gets Calendly's own confirmation), only to a real address, only while recent,
// never twice, and never once Bryson has already moved the lead on.
// The contact form and the pricing quiz's "email me a plan" box both promised a follow-up.
export const ACK_FORMS = ["contact", "recommendation"];
export function needsAck(row, now = Date.now()) {
  if (!row || !ACK_FORMS.includes(String(row.form || ""))) return false;
  if (!EMAIL_RE.test(String(row.email || "").trim())) return false;
  const age = now - new Date(row.created_at || 0).getTime();
  if (!(age >= -60e3 && age <= ACK_WINDOW_MS)) return false;
  if (row.status && row.status !== "new") return false;
  const p = row.payload || {};
  if (p.ackSentAt) return false;
  if (Number(p.ackTries || 0) >= MAX_ACK_TRIES) return false;
  if (p.ackClaimAt && now - new Date(p.ackClaimAt).getTime() < CLAIM_STALE_MS) return false;
  return true;
}

// Send the reply once. The row is CLAIMED first with a conditional update, so the instant path
// and the 15-minute safety net cannot both send it.
export async function ackEnquiry(supabase, row, { send = sendEmail, now = Date.now() } = {}) {
  if (!needsAck(row, now)) return { ok: true, skipped: "not due" };
  const p = row.payload || {};
  const tries = Number(p.ackTries || 0) + 1;
  const claimAt = new Date(now).toISOString();
  const staleBefore = new Date(now - CLAIM_STALE_MS).toISOString();
  const claimQuery = (allowStale) => {
    let q = supabase.from("website_leads")
      .update({ payload: { ...p, ackClaimAt: claimAt, ackTries: tries } })
      .eq("id", row.id);
    q = allowStale
      ? q.or(`payload->>ackClaimAt.is.null,payload->>ackClaimAt.lt."${staleBefore}"`)
      : q.is("payload->>ackClaimAt", null);
    return q.is("payload->>ackSentAt", null).select("id");
  };
  // The fuller claim also takes over one abandoned more than ten minutes ago. If the database
  // ever refuses that filter, the plain claim still works, so a filter quirk can never mean
  // that nobody gets their reply.
  let { data: claimed, error: cErr } = await claimQuery(true);
  if (cErr) ({ data: claimed, error: cErr } = await claimQuery(false));
  if (cErr) return { ok: false, error: cErr.message };
  if (!claimed || !claimed.length) return { ok: true, skipped: "claimed elsewhere" };
  try {
    const { renderEnquiryAck } = await import("./client-emails-shared.mjs");
    const mail = renderEnquiryAck({ name: row.name, bookUrl: BOOK_URL, recommended: row.form === "recommendation" ? row.recommended : "" });
    await send({ to: String(row.email).trim(), subject: mail.subject, html: mail.html,
      text: `Thanks for reaching out to BoldLine Media. I'll get back to you within one business day, usually a lot sooner. If you'd rather not wait, pick a time here: ${BOOK_URL}\n\nBryson, BoldLine Media`,
      fromName: "Bryson at BoldLine Media" });
    await supabase.from("website_leads").update({ payload: { ...p, ackClaimAt: claimAt, ackTries: tries, ackSentAt: new Date().toISOString() } }).eq("id", row.id);
    return { ok: true, sent: true };
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 300);
    await supabase.from("website_leads").update({ payload: { ...p, ackClaimAt: null, ackTries: tries, ackError: msg } }).eq("id", row.id);
    return { ok: false, error: msg };
  }
}

// The safety net: any contact enquiry from the last two hours still owed its reply.
export async function sendPendingAcks(supabase, { now = Date.now(), send } = {}) {
  const since = new Date(now - ACK_WINDOW_MS).toISOString();
  const { data, error } = await supabase.from("website_leads").select("id, created_at, form, name, email, status, recommended, payload")
    .in("form", ACK_FORMS).gte("created_at", since).limit(50);
  if (error) return { ok: false, error: error.message, sent: 0 };
  let sent = 0;
  for (const row of data || []) {
    if (!needsAck(row, now)) continue;
    const r = await ackEnquiry(supabase, row, { now, ...(send ? { send } : {}) });
    if (r.sent) sent++;
  }
  return { ok: true, sent };
}

// Start the free-check report in the background function (15 minutes), from inside the OS.
export async function startAudit(leadId, { base = process.env.URL, fetchImpl = fetch } = {}) {
  const url = `${String(base || "").replace(/\/$/, "")}/.netlify/functions/lead-leak-audit-background`;
  const r = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", "x-lead-job-key": leadJobKey() }, body: JSON.stringify({ leadId }) });
  return r.status === 202 || r.ok;
}
