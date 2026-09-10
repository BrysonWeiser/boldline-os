// Daily major-issue watch for BoldLine OS (Bryson, 2026-07-25: "if something
// major comes up I should get an alert about it").
//
// Evaluates each active client against a few "major" conditions using data the
// OS already stores (no extra ad-API calls), and PUSHES an SMS + email the
// moment a condition first trips — de-duped via cl.alertState so there is no
// daily repeat. The matching IN-APP alerts are derived live in index.html's
// getAlerts(), so the bell shows the same things without persistence.
//
// Conditions (from stored fields):
//   • perfCrash   — active-stage client whose health score has crashed (< 5/10)
//   • noLeads     — campaign live 14+ days, budget set, still zero leads
//   • cplBlowout  — cost per lead is 2x+ the client's target (runaway/inefficient spend)
//
// NOTE: precise real-time ad-SPEND-spike detection (spend far above the set
// budget/pace) needs live per-client spend pulled from the Google/Meta APIs,
// which only flows once campaigns are actually running. cplBlowout + noLeads are
// the stored-data proxies for it today; wire the true budget check in here when
// campaign spend is live (see KB major-issue-alerts).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, calcHealth, PER_LEAD, daysUntil, liveStats, hasAdActivity } from "../lib/report-shared.mjs";
import { countFoundingClients, FOUNDING_CLIENT_COUNT } from "../lib/founding.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";

const ACTIVE_STAGES = ["active", "optimizing", "scaling"];
// How long a signed client may go without their ads ever starting before it is raised.
// Matches the point in the chase ladder where a phone call replaces another text.
const NEVER_LAUNCHED_DAYS = 7;

// ─── CHASING THE CLIENT, NOT JUST TELLING BRYSON ─────────────────────────────
// Bryson, 2026-09-09, asked what happens if his first real client goes quiet on a campaign
// approval again. The honest answer was: almost nothing. This watcher alerted HIM on day 3,
// once, and then never again, and the CLIENT was never contacted by the OS at all. So a
// signed client could sit on a built, paused campaign indefinitely while the system that is
// supposed to be automating follow-up said one thing to one person on one day.
//
// 🔴 A stalled approval costs BoldLine everything and the client nothing on results-only
// terms: no leads means no invoice, so every quiet week is unpaid time with no clock running
// on them. That is the reason this escalates rather than repeating.
//
// Days since the approval was sent on which the CLIENT is emailed. Matches the chase ladder
// already written down for Stencil & Thread: a couple of reminders, then a human phones them.
const APPROVAL_CHASE_DAYS = [3, 7, 14];
// How many chases have actually gone out. Read off the record of sends, never a counter kept
// beside it, so a failed send cannot leave the count ahead of reality.
export const chasesSent = (a) => (Array.isArray(a && a.chases) ? a.chases.length : 0);
// Which chase is due for an approval this many days old, or null. Returns the LAST unsent
// step that is due, so a watcher that missed a day catches up rather than skipping a rung.
export const chaseDue = (a, ageDays) => {
  const sent = chasesSent(a);
  if (sent >= APPROVAL_CHASE_DAYS.length) return null;         // ladder finished
  const day = APPROVAL_CHASE_DAYS[sent];
  return ageDays >= day ? { step: sent + 1, of: APPROVAL_CHASE_DAYS.length, day } : null;
};
// 🔴 Only an UNANSWERED approval is chased. "changes" is an answer, and chasing a client who
// asked for changes to approve the thing they asked to change is how you lose one.
export const chaseable = (cl, a) => !!cl && !cl.internal && !cl.demo && !!cl.email && !!cl.portalToken
  && !!a && a.status === "pending" && !!a.createdAt;
const daysSince = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 864e5) : null);

// Returns the set of currently-tripped conditions for a client (stored data only).
export const evalConditions = (cl) => {
  if (cl.internal || cl.contractStatus !== "active" || !ACTIVE_STAGES.includes(cl.stage)) return {};
  const health = calcHealth(cl);
  const target = PER_LEAD[cl.niche] || 50;
  // 🔴 `cl.cpl` is never written by anything, so this alarm could never fire — a warning
  // he believes is watching his money that structurally could not go off. `liveStats`
  // computes it from the lead log and the ad-spend snapshot, the same two sources the
  // OS screens use.
  const lv = liveStats(cl);
  const leads = lv.leads;
  const live = daysSince(cl.contractStart);
  return {
    perfCrash: health < 5,
    // 🔴 `noLeads` NOW REQUIRES THE ADS TO HAVE ACTUALLY RUN. Without that test it fires on
    // a client whose campaign never started and tells Bryson to "check targeting/tracking",
    // which is the wrong diagnosis pointed at the wrong system. Never launched and launched
    // but failing are different problems with different fixes, and `neverLaunched` below is
    // the other one.
    noLeads: !!cl.adBudget && hasAdActivity(cl) && leads === 0 && live != null && live >= 14,
    cplBlowout: leads > 0 && lv.cpl > 0 && lv.cpl >= 2 * target,
    // 🔴 SIGNED, PAID FOR OR NOT, AND NOTHING EVER STARTED. Added 2026-09-07.
    //
    // Stencil & Thread signed 30 August. By 7 September the ads had still never run, because
    // the client had not sent his Google Ads account number or put a card on it. NOTHING IN
    // THE OS SAID SO. Eight days of BoldLine's first and only client going nowhere, caught
    // only because Bryson happened to be thinking about it, and the alert that looks closest
    // (`noLeads`) could not fire because two fake test leads were sitting in the record.
    //
    // A client who signs and then never launches is the most expensive silence in this
    // business: it burns the case-study window that the whole founding offer exists to buy,
    // and it looks exactly like a client who is simply doing fine.
    //
    // Seven days, because the honest chase ladder starts around then, and once only: this is
    // a state that persists for weeks, so it must alert on the transition, never daily.
    neverLaunched: live != null && live >= NEVER_LAUNCHED_DAYS && !hasAdActivity(cl),
  };
};

const MESSAGES = {
  perfCrash: (cl) => `health score has crashed to ${calcHealth(cl).toFixed(1)}/10`,
  noLeads: (cl) => `campaign has been live ${daysSince(cl.contractStart)} days with a budget set but ZERO leads — check targeting/tracking`,
  neverLaunched: (cl) => `signed ${daysSince(cl.contractStart)} days ago and the ads have NEVER run — no ad account linked, or no spend yet. Nothing is being delivered and the clock is running`,
  cplBlowout: (cl) => `cost per lead is $${liveStats(cl).cpl} — 2x+ the $${PER_LEAD[cl.niche] || 50} target (spend is inefficient)`,
};

export default withFailureAlert("alerts-watch", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("alerts-watch aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) { console.error("alerts-watch: clients load failed:", error.message); return new Response("db error", { status: 200 }); }

  let checked = 0, alerted = 0;
  const STALE_APPROVAL_DAYS = 3;

  // 🔴 THE FOUNDING OFFER IS SPENT — tell him the day it happens, once.
  //
  // Bryson, 2026-09-07: the offer must come down by itself when the third client signs. The
  // site and the OS now do that on their own, from the live client count. This alert exists
  // because a thing that changes silently is a thing he finds out about from a prospect: he
  // needs to know his pitch just changed, and that the free build is no longer his to offer.
  //
  // Once, ever, on the transition. Stored on the house/internal record so it is not attached
  // to any one client, and never re-fires if a client later churns (the offer is spent on
  // history, not on the current headcount).
  {
    const all = (rows || []).map((r) => r.data).filter(Boolean);
    const signed = countFoundingClients(all);
    const houseRow = (rows || []).find((r) => r.data && r.data.internal);
    const flagged = !!(houseRow && houseRow.data && houseRow.data.foundingOfferSpentAlerted);
    if (signed >= FOUNDING_CLIENT_COUNT && !flagged && houseRow) {
      await dispatchAlert({
        title: "Founding offer is now spent",
        body: `You have ${signed} signed clients, so the founding offer has been fully taken up.\n\nThe website banner and the pricing shown in Deal Prep have already switched themselves off, so nothing is still advertising a free build. From here, new prospects get the standard pricing: the setup fee applies and the monthly minimum is back.\n\nWorth deciding whether you want a new offer in its place.`,
        severity: "yellow",
      });
      alerted++;
      await supabase.from("clients")
        .update({ data: { ...houseRow.data, foundingOfferSpentAlerted: new Date().toISOString() }, updated_at: new Date().toISOString() })
        .eq("id", houseRow.id);
    }
  }

  for (const row of rows || []) {
    const cl = row.data || {};

    // Stale client-approval nudge: a deliverable sent for the client's approval
    // that they haven't acted on after a few days — remind the owner to follow up.
    // Runs for EVERY client (not just active ones). De-duped via nudgedAt.
    const approvals = Array.isArray(cl.approvals) ? cl.approvals : [];
    const nowMs = Date.now();
    const staleUnnudged = approvals.filter((a) => a && a.status === "pending" && !a.nudgedAt && a.createdAt && (nowMs - new Date(a.createdAt).getTime()) > STALE_APPROVAL_DAYS * 864e5);
    if (staleUnnudged.length) {
      for (const a of staleUnnudged) {
        const days = Math.floor((nowMs - new Date(a.createdAt).getTime()) / 864e5);
        await dispatchAlert({
          title: `⏳ ${cl.name} hasn't approved "${a.title}" yet (${days} days)`,
          body: `${cl.name} still hasn't approved "${a.title}" — it's been ${days} days since it was sent to them. Reach out to nudge them so their campaign isn't held up.`,
          severity: "yellow",
        });
        alerted++;
      }
      const nudgedIds = new Set(staleUnnudged.map((a) => a.id));
      cl.approvals = approvals.map((a) => (nudgedIds.has(a.id) ? { ...a, nudgedAt: new Date().toISOString() } : a));
      await supabase.from("clients").update({ data: cl, updated_at: new Date().toISOString() }).eq("id", row.id);
    }

    // ── Chase the CLIENT, on a ladder, then hand it to a human ────────────────
    // 🔴 The record of what was sent is written only AFTER the send succeeds. Recording
    // first would burn a rung of the ladder on an email that never left, and the client
    // would get two chases instead of three with nothing anywhere saying why.
    {
      const live = Array.isArray(cl.approvals) ? cl.approvals : [];
      let changed = false;
      for (const a of live) {
        if (!chaseable(cl, a)) continue;
        const age = Math.floor((nowMs - new Date(a.createdAt).getTime()) / 864e5);
        const due = chaseDue(a, age);
        if (due) {
          const res = await autoSendClientEmail(cl, "approval_request", {
            approvalTitle: a.title, reminderDays: age,
          });
          if (!res.sent) { console.error(`approval chase to ${cl.name} failed: ${res.reason}`); continue; }
          a.chases = [...(a.chases || []), { at: new Date().toISOString(), day: due.day, age }];
          cl.commLog = [{ ...res.logEntry, note: `Auto-reminded ${cl.name} about "${a.title}" (day ${age}, reminder ${due.step} of ${due.of})` }, ...(cl.commLog || [])];
          changed = true;
          await dispatchAlert({
            title: `📨 Reminded ${cl.name} about "${a.title}" (${due.step} of ${due.of})`,
            body: `${cl.name} still hasn't approved "${a.title}" after ${age} days, so the OS emailed them a reminder. ${due.step === due.of ? "That was the last automatic reminder. Nothing else will be sent, so this is yours to chase by phone now." : `The next one goes out around day ${APPROVAL_CHASE_DAYS[due.step]}.`}`,
            severity: "yellow",
          });
          alerted++;
          continue;
        }
        // 🔴 THE LADDER ENDS. Emailing someone forever is not persistence, it is noise they
        // learn to ignore, and it stops Bryson realising the thing needs a human. One
        // hand-off alert, once, and then the OS stays quiet about this approval.
        if (chasesSent(a) >= APPROVAL_CHASE_DAYS.length && !a.handedOffAt) {
          a.handedOffAt = new Date().toISOString();
          changed = true;
          await dispatchAlert({
            title: `🔴 ${cl.name} has not answered "${a.title}" in ${age} days`,
            body: `All ${APPROVAL_CHASE_DAYS.length} automatic reminders have gone to ${cl.name} and "${a.title}" is still unanswered after ${age} days. The OS will not email them again about it. Phone them, or ask straight out whether the timing has changed.`,
            severity: "red",
          });
          alerted++;
        }
      }
      if (changed) {
        const { error } = await supabase.from("clients").update({ data: cl, updated_at: new Date().toISOString() }).eq("id", row.id);
        // 🔴 A failed write means the chase record is lost and the same email goes again
        // tomorrow. Say so, rather than letting a client get the same reminder every day.
        if (error) console.error(`approval chase bookkeeping failed for ${cl.name}: ${error.message}`);
      }
    }

    const cur = evalConditions(cl);
    const keys = ["perfCrash", "noLeads", "cplBlowout", "neverLaunched"];
    if (keys.every((k) => cur[k] === undefined)) continue; // not an active reportable client
    checked++;

    const prev = cl.alertState || {};
    const newlyTripped = keys.filter((k) => cur[k] && !prev[k]);
    const stateChanged = keys.some((k) => !!cur[k] !== !!prev[k]);

    if (newlyTripped.length) {
      const issues = newlyTripped.map((k) => `- ${cl.name}: ${MESSAGES[k](cl)}`);
      await dispatchAlert({
        title: `${cl.name} needs attention`,
        body: `A major issue just tripped on ${cl.name}:\n${issues.join("\n")}\nOpen the client in BoldLine OS for details.`,
        severity: "red",
        smsText: `BoldLine ALERT — ${cl.name}: ${newlyTripped.map((k) => MESSAGES[k](cl)).join("; ")}`.slice(0, 300),
      });
      alerted++;
    }

    if (stateChanged) {
      const nextState = { perfCrash: !!cur.perfCrash, noLeads: !!cur.noLeads, cplBlowout: !!cur.cplBlowout, neverLaunched: !!cur.neverLaunched };
      await supabase.from("clients").update({ data: { ...cl, alertState: nextState }, updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }

  console.log(`alerts-watch: checked ${checked} active client(s), sent ${alerted} new alert(s).`);
  return new Response(JSON.stringify({ ok: true, checked, alerted }), { status: 200 });
});
