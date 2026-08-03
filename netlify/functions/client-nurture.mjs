// Daily client-nurture job — the automatic onboarding + retention email touches
// that aren't tied to a Stripe event. Runs once a day on a Netlify schedule.
//
//   1. Ad-Account Access — ~1 day after the Welcome email (once), so onboarding
//      flows on its own instead of waiting for a manual send.
//   2. Onboarding nudge  — day 2 and day 5 after Welcome IF the client still
//      hasn't finished their intake, so a stalled onboarding gets chased.
//   3. Lead milestone     — a celebratory email when a client crosses
//      10/25/50/100/… leads. Seeded on first sight so existing clients are never
//      spammed about counts they already had; only FUTURE crossings email.
//
// Onboarding steps (1 + 2) are gated on cl.emailAuto.welcome — set by
// stripe-webhook when a client is actually onboarded — so they never back-fill
// onto pre-existing/live clients. Milestones apply to every active client.
// Idempotent via cl.emailAuto flags; fail-soft per client. No new env vars.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";

const DAY = 864e5;
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : null);
const ONBOARD_STEPS = [{ id: "d2", after: 2 }, { id: "d5", after: 5 }];

export default withFailureAlert("client-nurture", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("client-nurture aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) { console.error("client-nurture: clients load failed:", error.message); return new Response("db error", { status: 200 }); }

  let checked = 0, sent = 0;
  for (const row of rows || []) {
    const cl = row.data || {};
    if (cl.internal || !cl.email) continue;
    checked++;

    const ea = { ...(cl.emailAuto || {}) };
    const logs = [];
    let changed = false;
    const age = daysSince(ea.welcomeAt); // days since Welcome (null if unknown)

    try {
      // 1. Ad-Account Access — ~1 day after Welcome, once (post-onboarding only).
      if (ea.welcome && !ea.access && (age == null || age >= 1)) {
        const r = await autoSendClientEmail(cl, "onboarding_access");
        if (r.sent) { ea.access = true; logs.push(r.logEntry); changed = true; }
      }

      // 2. Onboarding intake nudge — day 2 + day 5, while intake is incomplete.
      if (ea.welcome && !cl.intakeComplete && age != null) {
        const done = new Set(ea.onboardingNudges || []);
        const due = ONBOARD_STEPS.find((s) => age >= s.after && !done.has(s.id));
        if (due) {
          const r = await autoSendClientEmail(cl, "onboarding_nudge");
          if (r.sent) { ea.onboardingNudges = [...(ea.onboardingNudges || []), due.id]; logs.push(r.logEntry); changed = true; }
        }
      }

      // 3. Lead milestone — baseline-seed on first sight, then celebrate crossings.
      const leads = Number(cl.leads || 0);
      if (ea.milestonesSent === undefined) {
        ea.milestonesSent = MILESTONES.filter((m) => leads >= m); // seed, no email
        changed = true;
      } else {
        const already = new Set(ea.milestonesSent);
        const crossed = MILESTONES.filter((m) => leads >= m && !already.has(m));
        if (crossed.length) {
          const r = await autoSendClientEmail(cl, "lead_milestone", { milestone: Math.max(...crossed) });
          if (r.sent) { ea.milestonesSent = [...ea.milestonesSent, ...crossed]; logs.push(r.logEntry); changed = true; }
        }
      }
    } catch (e) { console.error(`client-nurture: ${cl.name || row.id} failed:`, e.message); }

    if (changed) {
      const nextData = { ...cl, emailAuto: ea, ...(logs.length ? { commLog: [...logs, ...(cl.commLog || [])] } : {}) };
      try {
        await supabase.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
        sent += logs.length;
      } catch (e) { console.error(`client-nurture: ${cl.name || row.id} save failed:`, e.message); }
    }
  }
  console.log(`client-nurture: checked ${checked} client(s), sent ${sent} email(s).`);
  return new Response(JSON.stringify({ ok: true, checked, sent }), { status: 200 });
});
