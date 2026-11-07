// Daily client-nurture job — the automatic onboarding + retention email touches
// that aren't tied to a Stripe event. Runs once a day on a Netlify schedule.
//
//   0. Welcome           — the moment a client is SIGNED, not when they pay.
//   1. Ad-Account Access — ~1 day after the Welcome email (once), so onboarding
//      flows on its own instead of waiting for a manual send.
//   2. Onboarding nudge  — day 2 and day 5 after Welcome IF the client still
//      hasn't finished their intake, so a stalled onboarding gets chased.
//   3. Results milestone  — a celebratory email when a client crosses
//      10/25/50/100/… leads, or recorded sales for a store client. Seeded on first sight so existing clients are never
//      spammed about counts they already had; only FUTURE crossings email.
//   4. Review request     — once, a month after they bought something from us (ads with leads coming in, a
//      website live, or a website bought outright). Rules in lib/review-ask.mjs.
//
// Every step is gated on a cl.emailAuto flag, so each fires once per client and a
// re-run is a no-op. Milestones apply to every active client.
// Fail-soft per client. No new env vars.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, retryQuery } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail, isWebsiteOnly } from "../lib/client-email-auto.mjs";
import { liveStats } from "../lib/report-shared.mjs";
import { reviewAskDue, boldlineReviewUrlFrom } from "../lib/review-ask.mjs";

const DAY = 864e5;
const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : null);
const ONBOARD_STEPS = [{ id: "d2", after: 2 }, { id: "d5", after: 5 }];
// When to ask for a review moved to lib/review-ask.mjs (2026-11-06: one month, every way a client buys from us).

export default withFailureAlert("client-nurture", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("client-nurture aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await retryQuery(() => supabase.from("clients").select("id, data"), { job: "client-nurture", step: "clients load" });
  if (error) { console.error("client-nurture: clients load failed:", error.message); return new Response("db error", { status: 200 }); }

  // BoldLine's own Google "write a review" link, from the house account's connected profile (KB google-listing).
  const reviewGoogleUrl = boldlineReviewUrlFrom(rows);
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

      // 3. Results milestone — baseline-seed on first sight, then celebrate crossings.
      //
      // 🔴 COUNTED FROM THE LOG, NOT FROM `cl.leads`. Two reasons, and the second is the one
      // that made this a live gap rather than a tidy-up:
      //   • `cl.leads` is a lagging counter bumped by the lead webhook, and `liveStats` already
      //     treats the log as the truth when the two disagree. Every other screen in the OS
      //     reads the log, so this was the only place quoting a different number.
      //   • A STORE CLIENT NEVER TOUCHES THAT COUNTER AT ALL. Their sales are recorded by hand
      //     from their own order records straight into `leadsLog`, so `cl.leads` stays 0 for
      //     ever and a client who made 500 sales would never once be told so. The review
      //     request below is gated on the same number, so it could never fire for them either.
      const leads = liveStats(cl).leads;
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
      // 🔴 4. ASK FOR A REVIEW, ONCE, A MONTH AFTER THEY BOUGHT SOMETHING FROM US. Added 2026-09-07 (45 days and 10
      // leads, ads and hosted websites only); since 2026-11-06 one month, on every path, including a website bought
      // outright (Bryson: "after a month of running ads or selling a website or service etc"). The rules, and why an
      // ads client with almost no leads is not asked yet, are in lib/review-ask.mjs.
      // `!crossedMilestone` keeps it out of the same run as a celebration email, so nobody gets two of ours in one
      // morning. Once per client, ever: a client who ignored it once has answered.
      const ask = !crossedMilestone ? reviewAskDue(cl, ea) : { due: false };
      if (ask.due) {
        const r = await autoSendClientEmail(cl, "review_request", { reviewGoogleUrl, reviewWhy: ask.path });
        if (r.sent) { ea.reviewAsked = true; ea.reviewAskedAt = new Date().toISOString(); ea.reviewAskedFor = ask.path; logs.push(r.logEntry); changed = true; }
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
