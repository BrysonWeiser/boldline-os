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
import { SUPABASE_URL, calcHealth, PER_LEAD, daysUntil } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";

const ACTIVE_STAGES = ["active", "optimizing", "scaling"];
const daysSince = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 864e5) : null);

// Returns the set of currently-tripped conditions for a client (stored data only).
export const evalConditions = (cl) => {
  if (cl.internal || cl.contractStatus !== "active" || !ACTIVE_STAGES.includes(cl.stage)) return {};
  const health = calcHealth(cl);
  const target = PER_LEAD[cl.niche] || 50;
  const leads = cl.leads || 0;
  const live = daysSince(cl.contractStart);
  return {
    perfCrash: health < 5,
    noLeads: !!cl.adBudget && leads === 0 && live != null && live >= 14,
    cplBlowout: leads > 0 && cl.cpl > 0 && cl.cpl >= 2 * target,
  };
};

const MESSAGES = {
  perfCrash: (cl) => `health score has crashed to ${calcHealth(cl).toFixed(1)}/10`,
  noLeads: (cl) => `campaign has been live ${daysSince(cl.contractStart)} days with a budget set but ZERO leads — check targeting/tracking`,
  cplBlowout: (cl) => `cost per lead is $${cl.cpl} — 2x+ the $${PER_LEAD[cl.niche] || 50} target (spend is inefficient)`,
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

    const cur = evalConditions(cl);
    const keys = ["perfCrash", "noLeads", "cplBlowout"];
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
      const nextState = { perfCrash: !!cur.perfCrash, noLeads: !!cur.noLeads, cplBlowout: !!cur.cplBlowout };
      await supabase.from("clients").update({ data: { ...cl, alertState: nextState }, updated_at: new Date().toISOString() }).eq("id", row.id);
    }
  }

  console.log(`alerts-watch: checked ${checked} active client(s), sent ${alerted} new alert(s).`);
  return new Response(JSON.stringify({ ok: true, checked, alerted }), { status: 200 });
});
