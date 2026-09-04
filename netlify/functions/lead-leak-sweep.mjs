// The safety net under the free Lead-Leak Check, so a promise made to a prospect cannot be
// dropped in silence.
//
// Bryson, 2026-09-04: *"can we fix it so the lead thing automatically sends like it's
// supposed to"*, after a real prospect (a Scottsdale roofing company) asked for the free
// report at 1:20pm and, an hour later, had received nothing at all.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 WHAT ACTUALLY FAILED, AND WHY NOTHING NOTICED.
//
// The only way to start the audit bot was a POST from the MARKETING site to the OS site,
// gated on `AUDIT_TRIGGER_SECRET` being set IDENTICALLY on two separate Netlify sites. It
// was not set. So the gate on the marketing site was simply false: no request was made, the
// OS never heard about the lead, and NOTHING was written anywhere. Not an error, not a
// failed status, not a log line. The lead record carried no audit stamp at all, which is
// the only reason it was possible to work out afterwards what had happened.
//
// 🔴 A FEATURE WHOSE ONLY TRIGGER IS A CROSS-SITE CALL GATED ON A MANUALLY-COPIED SECRET IS
// A FEATURE THAT IS OFF BY DEFAULT. It cannot report its own absence, because the code that
// would do the reporting is the code that never runs. Telling him to go and set the env var
// fixes today and leaves the same trap for the next thing built this way.
//
// So the trigger no longer has to work. This runs INSIDE the OS, on a schedule, where the
// database credentials already exist and there is no secret to be missing. It finds any
// free-check request that has not been sent and sends it, using the SAME `auditLead`
// function the POST path calls, so there is one implementation and not two.
//
// The instant path is kept: with the secret set, the report goes out in about a minute. This
// turns "never" into "within ten minutes", which is the difference that matters.
//
// 🔴 AND WHEN IT GENUINELY CANNOT SEND, IT SAYS SO OUT LOUD. Three attempts, then an owner
// alert naming the prospect and the reason. The failure mode this replaces was silence.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import { auditLead } from "./lead-leak-audit-background.mjs";

// How many times to try one lead before it needs a person. An unfunded AI account or a
// prospect's site that refuses every request will never succeed, and retrying it every ten
// minutes forever would bury a real failure under noise.
export const MAX_AUDIT_TRIES = 3;

// Only recent requests. An old failure is history, and re-emailing a stranger about a
// website check they asked for a fortnight ago is worse than not sending at all.
export const SWEEP_WINDOW_MS = 24 * 3600e3;

// Which of the leads read back still need sending. Exported so the suite can run the real
// decision rather than a copy of it.
export function needsAudit(row, now = Date.now()) {
  if (!row || String(row.form || "") !== "lead_leak") return false;
  const p = (row && row.payload) || {};
  const age = now - new Date(row.created_at || 0).getTime();
  if (!(age >= 0 && age <= SWEEP_WINDOW_MS)) return false;
  // 🔴 A LEAD HE HAS ALREADY WORKED IS NOT WAITING ON A ROBOT. The first thing this sweep
  // would have done on the day it shipped is email an automated report to a prospect Bryson
  // had already written to by hand an hour earlier, because the record could not tell the
  // difference. Moving a lead off "new" is him saying he has it, and it is one tap.
  if (String(row.status || "new") !== "new") return false;
  const status = String(p.auditStatus || "");
  // Sent by the bot, sent by Bryson himself, or waiting on his review: done either way.
  //
  // 🔴 `sent_by_hand` IS THE DURABLE HALF OF THIS, and the status check above is the weak
  // one. A sales stage records what he is doing about a lead, not what the prospect has
  // received: move the lead back to New to work it again and the status guard reopens, and a
  // stranger gets a second report they never asked for once. This stamp does not.
  if (status === "sent" || status === "review_sent" || status === "sent_by_hand") return false;
  // 🔴 "running" is claimed by whoever is working on it right now, and `auditedAt` is that
  // claim. Picking it up again would email the same prospect twice. A claim older than the
  // longest a background function can live is a crash, not work in progress.
  if (p.auditedAt && now - new Date(p.auditedAt).getTime() < 20 * 60e3) return false;
  if (Number(p.auditTries || 0) >= MAX_AUDIT_TRIES) return false;
  return true;
}

export default withFailureAlert("lead-leak-sweep", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("lead-leak-sweep aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const since = new Date(Date.now() - SWEEP_WINDOW_MS).toISOString();
  const { data: rows, error } = await supabase
    .from("website_leads").select("id, created_at, form, name, email, status, payload")
    .eq("form", "lead_leak").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(50);
  if (error) {
    console.error("lead-leak-sweep: could not read website_leads:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200 });
  }

  const now = Date.now();
  const due = (rows || []).filter((r) => needsAudit(r, now));
  let sent = 0;
  const stuck = [];

  for (const row of due) {
    const p = row.payload || {};
    const r = await auditLead(supabase, {
      leadId: row.id,
      website: String(p.website || ""),
      email: String(row.email || "").toLowerCase(),
      name: String(row.name || p.name || ""),
    });
    if (r && r.ok && !r.skipped) { sent++; continue; }
    if (r && r.ok) continue;                       // already audited by the other path
    // Out of attempts, so this one is not going to fix itself.
    if (Number(r && r.tries) >= MAX_AUDIT_TRIES) {
      stuck.push({ email: row.email, website: p.website || "", reason: (r && r.error) || "unknown" });
    }
  }

  // 🔴 THE POINT OF THE WHOLE FILE. A prospect asked for something free and did not get it,
  // and until now that produced no signal anywhere.
  for (const s of stuck) {
    await dispatchAlert({
      title: "A free website check could not be sent",
      body: `${s.email} asked for the free Lead-Leak Check${s.website ? ` on ${s.website}` : ""} and it has failed `
        + `${MAX_AUDIT_TRIES} times, so they have received nothing.\n\nReason: ${s.reason}\n\n`
        + `They are still a real lead. Send them something by hand, and check the OS can write reports.`,
      severity: "red",
      smsText: `BoldLine: ${s.email} asked for the free website check and it failed to send. They got nothing.`.slice(0, 300),
    });
  }

  console.log(`lead-leak-sweep: ${(rows || []).length} recent request(s), ${due.length} due, ${sent} sent, ${stuck.length} stuck.`);
  return new Response(JSON.stringify({ ok: true, scanned: (rows || []).length, due: due.length, sent, stuck: stuck.length }),
    { status: 200, headers: { "content-type": "application/json" } });
});
