// Daily client-nurture job — the automatic onboarding + retention email touches
// that aren't tied to a Stripe event. Runs once a day on a Netlify schedule.
//
//   0. Welcome           — the moment a client is SIGNED, not when they pay.
//   1. Ad-Account Access — ~1 day after the Welcome email (once), so onboarding
//      flows on its own instead of waiting for a manual send.
//   2. Onboarding nudge  — day 2 and day 5 after Welcome IF the client still
//      hasn't finished their intake, so a stalled onboarding gets chased.
//   3. Lead milestone     — a celebratory email when a client crosses
//      10/25/50/100/… leads. Seeded on first sight so existing clients are never
//      spammed about counts they already had; only FUTURE crossings email.
//   4. Review request     — once, after a client has had a genuinely good month.
//
// Every step is gated on a cl.emailAuto flag, so each fires once per client and a
// re-run is a no-op. Milestones apply to every active client.
// Fail-soft per client. No new env vars.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { hasAdActivity } from "../lib/report-shared.mjs";

const DAY = 864e5;
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : null);
const ONBOARD_STEPS = [{ id: "d2", after: 2 }, { id: "d5", after: 5 }];
// A review is worth asking for only once there is something to review. Ten leads is the
// first milestone, so it is already the point at which the OS considers a client to be
// getting somewhere; six weeks is long enough to have an opinion worth writing down.
const REVIEW_MIN_LEADS = 10;
const REVIEW_MIN_DAYS = 45;

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
      // 🔴 0. WELCOME ON SIGNING, NOT ON PAYMENT (Bryson, 2026-09-07: *"Signing that way
      //    nothing is blocked and doesn't send even if payment isn't processed"*).
      //
      //    Until now the entire onboarding sequence waited on `emailAuto.welcome`, which
      //    only `stripe-webhook` ever set, and only on `checkout.session.completed`. So a
      //    client who signs but has not paid received NOTHING automatic, and every step
      //    after it stayed locked behind the same flag.
      //
      //    That is not an edge case, it is the founding offer. Founding terms are results
      //    only with no monthly minimum, so a client can be fully signed and correctly owe
      //    nothing for weeks. Stencil & Thread signed 30 August and by 7 September had had
      //    no welcome, no portal link, and no ad-account-access email, while the one thing
      //    blocking their launch was ad-account access. The automation that exists to chase
      //    exactly that had never been allowed to start.
      //
      //    Signing is also the honest trigger: it is the moment BoldLine owes them
      //    something. Payment is a billing event, not a relationship one.
      //
      //    Idempotent and race-free with Stripe: both paths set the same flag and both check
      //    it first, so whichever happens first sends, and the other becomes a no-op. A
      //    client who pays at signing is unaffected.
      if (!ea.welcome && (cl.contractSigned || cl.contractStatus === "active")) {
        const r = await autoSendClientEmail(cl, "welcome");
        if (r.sent) {
          ea.welcome = true;
          ea.welcomeAt = new Date().toISOString();
          logs.push(r.logEntry);
          changed = true;
        }
      }

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
      let crossedMilestone = false;
      if (ea.milestonesSent === undefined) {
        ea.milestonesSent = MILESTONES.filter((m) => leads >= m); // seed, no email
        changed = true;
      } else {
        const already = new Set(ea.milestonesSent);
        const crossed = MILESTONES.filter((m) => leads >= m && !already.has(m));
        if (crossed.length) {
          const r = await autoSendClientEmail(cl, "lead_milestone", { milestone: Math.max(...crossed) });
          if (r.sent) { ea.milestonesSent = [...ea.milestonesSent, ...crossed]; logs.push(r.logEntry); changed = true; crossedMilestone = true; }
        }
      }
      // 🔴 4. ASK FOR A REVIEW, ONCE, AFTER A GOOD STRETCH. Added 2026-09-07.
      //
      // The review system was fully built and nothing ever asked anybody. A review wall
      // nobody is invited to fill in stays empty forever, and no social proof is the single
      // biggest weakness in the sales conversation while BoldLine has one client.
      //
      // The conditions are deliberately conservative, because a badly timed ask is worse
      // than no ask: it has to be a real client, their ads have to have actually run (not
      // merely be signed up), they need enough delivered leads to have an opinion, and
      // enough time to have formed it. `!crossedMilestone` keeps this out of the same run
      // as a celebration email, so nobody gets two of ours in one morning.
      //
      // Once per client, ever. There is no second ask: a client who ignored it once has
      // answered, and chasing a favour is how a favour becomes an imposition.
      const contractAgeDays = daysSince(cl.contractStart);
      if (!ea.reviewAsked && ea.welcome && !crossedMilestone
          && cl.contractStatus === "active"
          && hasAdActivity(cl)
          && leads >= REVIEW_MIN_LEADS
          && contractAgeDays != null && contractAgeDays >= REVIEW_MIN_DAYS) {
        const r = await autoSendClientEmail(cl, "review_request");
        if (r.sent) { ea.reviewAsked = true; ea.reviewAskedAt = new Date().toISOString(); logs.push(r.logEntry); changed = true; }
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
