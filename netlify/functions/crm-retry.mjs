// The scheduled sweep that re-sends leads whose forward to the client's own system failed.
//
// Bryson told Shaun Smith on 2026-09-03 that this would exist, while declining his request to
// have the visitor's browser post straight to Sebastian's site as a second path. That request
// was spoofable, it let a lead reach the client without reaching the OS (which breaks the
// attribution the whole campaign is billed on), and its fallback could not run in the cases
// it was meant to cover, because a dead browser cannot execute a browser-side fallback.
//
// This is the honest version of what he actually wanted: a blip on our side DELAYS a lead
// instead of losing it. All the rules and their reasoning live in ../lib/crm-retry.mjs.
//
// 🔴 IT RUNS EVERY FIFTEEN MINUTES AND DOES NOTHING ON ALMOST ALL OF THEM. That is correct.
// The delays live on each lead, so a sweep with no lead due exits having read a handful of
// rows. The frequency is there so the FIRST retry, five minutes after a blip, actually
// happens five minutes after the blip rather than an hour later.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { sweepClientLeads } from "../lib/crm-retry.mjs";
import { crmTarget } from "../lib/crm-forward.mjs";

// One client with a large stuck backlog must not starve every other client's single stuck
// lead, and a function has a wall-clock limit it is not worth discovering the hard way.
const MAX_PER_CLIENT = 25;

export default withFailureAlert("crm-retry", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("crm-retry: no service role key, nothing to do");
    return new Response("skipped", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) throw new Error(`client read failed: ${error.message}`);

  const now = Date.now();
  const summary = { clients: 0, sent: 0, failed: 0, gaveUp: 0 };
  const alerts = [];

  for (const row of rows || []) {
    const client = (row && row.data) || {};
    if (!crmTarget(client)) continue;           // no CRM configured, nothing to retry into

    const res = await sweepClientLeads(client, { now, max: MAX_PER_CLIENT });
    if (!res.changed) continue;

    // 🔴 WRITE ONLY THE LEAD LOG. Reading a whole client record, holding it while the network
    // calls run, and then writing the whole thing back would clobber anything else that
    // changed in the meantime: an approval, a campaign, a billing field. Only the one key
    // this job owns is written, merged onto the row as it is NOW.
    const { data: fresh, error: reErr } = await supabase
      .from("clients").select("data").eq("id", row.id).maybeSingle();
    if (reErr || !fresh) { console.error("crm-retry: re-read failed for", row.id); continue; }
    const next = { ...(fresh.data || {}), leadsLog: res.leadsLog };
    const { error: wErr } = await supabase.from("clients").update({ data: next }).eq("id", row.id);
    if (wErr) { console.error("crm-retry: write failed for", row.id, wErr.message); continue; }

    summary.clients++;
    summary.sent += res.sent;
    summary.failed += res.failed;
    summary.gaveUp += res.gaveUp;

    const who = client.name || "A client";
    // 🔴 THE TWO THINGS WORTH WAKING SOMEBODY FOR, and nothing else. A retry that worked is
    // the system doing its job quietly; an alert for it would train him to ignore the ones
    // that matter.
    if (res.needsAHuman) {
      alerts.push({
        title: `${who}: their system is rejecting our leads`,
        body: `Leads for ${who} are being turned away by their own system, which usually means the password we hold does not match theirs. `
          + `Nothing is lost yet, we keep trying for about a day. Fix it in the OS under Edit, then Campaign, in "Password for that link".\n\n`
          + `What their system said: ${res.lastError}`,
        severity: "red",
        smsText: `BoldLine: ${who}'s system is rejecting our leads. Check the password under Edit, Campaign.`,
      });
    }
    if (res.gaveUp > 0) {
      alerts.push({
        title: `${who}: ${res.gaveUp} lead${res.gaveUp === 1 ? "" : "s"} never reached their system`,
        body: `We tried for over a day and their system never accepted ${res.gaveUp === 1 ? "it" : "them"}. `
          + `${res.gaveUp === 1 ? "The lead is" : "The leads are"} safe in the OS, so nobody has lost a customer, but ${res.gaveUp === 1 ? "it is" : "they are"} not in ${who}'s own system and will not arrive on their own now.\n\n`
          + `Last thing their system said: ${res.lastError}`,
        severity: "red",
        smsText: `BoldLine: ${res.gaveUp} lead(s) for ${who} never reached their system. They are safe in the OS.`,
      });
    }
    // 🔴 STUCK, BUT NOT YET GIVEN UP. Shaun Smith, 2026-09-04: *"alert yourself if anything
    // sits in it longer than a few minutes"*. Between the wrong-password case above and the
    // gave-up case, an ordinary outage was silent for over a DAY while the ladder ran. A
    // lead is a person who has just asked to be called back, so a day of silence is the
    // customer. Reported once per lead, never once per sweep.
    if (res.stuck.length) {
      const n = res.stuck.length;
      const oldest = res.stuck.reduce((a, b) => (b.minutes > a.minutes ? b : a), res.stuck[0]);
      alerts.push({
        title: `${who}: ${n} lead${n === 1 ? "" : "s"} waiting to reach their system`,
        body: `${n === 1 ? `${oldest.name} has` : `${n} leads have`} been waiting ${oldest.minutes} minutes to reach ${who}'s system and ${n === 1 ? "has" : "have"} not arrived yet. `
          + `We are still trying and nothing is lost, but ${n === 1 ? "nobody has" : "nobody has"} followed up with them on their side.\n\n`
          + `What their system said: ${oldest.error}\n\n`
          + `${n === 1 ? "The lead is" : "The leads are"} safe in the OS and can be worked from the Leads screen in the meantime.`,
        severity: "amber",
        smsText: `BoldLine: ${n} lead(s) for ${who} stuck ${oldest.minutes} min trying to reach their system. Safe in the OS.`,
      });
    }
  }

  // 🔴 Alerts go out AFTER every client is swept, not during. An alert that threw mid-loop
  // used to leave the remaining clients unswept, which turned one client's misconfiguration
  // into everybody's outage.
  for (const a of alerts) {
    try { await dispatchAlert(a); } catch (e) { console.error("crm-retry alert failed:", e && e.message); }
  }

  const line = `crm-retry: ${summary.clients} client(s) touched, ${summary.sent} delivered, ${summary.failed} still failing, ${summary.gaveUp} given up`;
  console.log(line);
  return new Response(line, { status: 200 });
});
