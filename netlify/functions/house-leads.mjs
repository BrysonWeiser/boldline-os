// BoldLine's OWN leads have to reach BoldLine's own account, not just the Leads screen.
//
// Bryson, 2026-08-21, looking at the My Ads overview while his first Meta ad was live and
// serving: "the os isnt taking the data from the live ad". He was right, and the reason was
// a seam rather than a failure. BoldLine's ads point at /get-started on the marketing site.
// Everything that lands there — the contact form, the quiz, and (since 2026-08-20) a booked
// Calendly call — is written to the `website_leads` table, which feeds the OS's global Leads
// screen. The HOUSE ACCOUNT ("BoldLine Media", the client record flagged `internal`) keeps
// its leads on the record itself, in `leadsLog`, exactly like a paying client does.
//
// Nothing ever joined the two. So the house account read `leads: 0` forever, and everything
// derived from that number was wrong with it:
//   • the Overview "Leads" tile said 0 while real leads were sitting in the OS
//   • "Avg CPL" could never be computed, because the divisor was always zero
//   • the Ad Health Score docked 2 of 10 points for "No leads yet"
//   • the pipeline's Lead Quality Analyst stage stayed "waiting" forever
//   • the Acquisition ROI funnel on the Campaigns tab had nothing to draw
//
// 🔴 WHY MIRROR THE DATA INSTEAD OF JUST FIXING THE SCREEN. Every one of those readers is a
// different piece of code, and two of them (the health score's inputs and the alert job)
// run on a server with no access to the browser. Deriving the number in the UI would have
// fixed one tile and left the other five wrong. One write fixes all of them.
//
// The house Leads tab was always BUILT for these leads — it has a five-stage sales pipeline
// with "Meeting Booked" and a book-a-call outreach tool that a real client's leads tab does
// not. It was simply never fed.
//
// DEDUPE is on the website lead's row id, stored as `websiteLeadId` on the mirrored entry.
// This runs every 15 minutes over the whole table, so it sees every lead many times.
//
// STATUS SYNC IS ONE-WAY, AND ONLY WHILE HE HASN'T TOUCHED IT. The mirrored entry remembers
// the status it was last given (`mirroredStatus`). If the house copy still matches that, the
// website lead's status wins. The moment he moves it by hand in the house Leads tab, the two
// differ and this job stops overwriting him. Without that rule, marking a lead "Meeting
// Booked" on the house account would silently revert within fifteen minutes.
//
// DELETION follows too: he deletes test leads from the Leads screen, and the mirrored copies
// should not survive that. Only pruned when the full table was read (see PRUNE_LIMIT).
//
// Env: SUPABASE_SERVICE_ROLE_KEY. Read-only against `website_leads`; the only write is to
// the single internal client row. The merge itself lives in ../lib/house-leads-merge.mjs so
// the test suite can run the real code rather than a copy of it.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { mergeHouseLeads, PRUNE_LIMIT } from "../lib/house-leads-merge.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// 🔴 EVERY FAILURE IN HERE USED TO REPORT SUCCESS. Bryson, 2026-09-02: *"also make sure
// the lead check is running."* His My Ads card was saying the check had not run in FOUR
// hours, against a fifteen-minute schedule.
//
// The heartbeat design was right and it is what told him: it refreshes at least hourly, so
// a stale timestamp means the job is not completing. But every error path below returned
// `json({ ok: true, error: ... })` — HTTP 200, ok TRUE. Netlify saw ninety-six successful
// runs a day. Nothing retried, nothing alerted, and the failure dashboard stayed clean.
// The only surviving signal was one line of amber text on one card, which happened to be
// noticed. This file's own comment says a failed read must never look like a real zero;
// that held for the SCREEN and not for the alerting.
//
// So: wrapped so a throw alerts, and each swallowed error now raises one too, naming the
// step that failed. The returns stay 200 on purpose — a scheduled function that 500s gets
// retried by Netlify, and re-running a merge that already half-wrote is worse than waiting
// fifteen minutes for the next clean pass.
const warn = async (step, detail) => {
  console.error(`house-leads: ${step}: ${detail}`);
  try {
    await dispatchAlert({
      title: "Lead check is not running",
      body: `The 15-minute job that mirrors website leads onto My Ads failed at "${step}": ${detail}. While this is failing the lead count on My Ads is frozen and new leads will not appear there. Check Netlify, Logs, Functions, house-leads.`,
      severity: "red",
    });
  } catch (e) { console.error("house-leads: alert failed:", e && e.message); }
};

export default withFailureAlert("house-leads", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await warn("startup", "SUPABASE_SERVICE_ROLE_KEY is missing");
    return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // The house account. No internal client means nothing to mirror into, which is a
    // normal state (he can delete and re-add it), not an error.
    const { data: houses, error: clErr } = await supabase
      .from("clients").select("id, data").eq("data->>internal", "true").limit(1);
    if (clErr) { await warn("reading the client list", clErr.message); return json({ ok: true, error: `clients read failed: ${clErr.message}`, added: 0 }); }
    const house = (houses || [])[0];
    if (!house) return json({ ok: true, house: false, added: 0 });

    const { data: rows, error: wlErr } = await supabase
      .from("website_leads").select("id, created_at, form, name, business, email, message, status, payload")
      .order("created_at", { ascending: false }).limit(PRUNE_LIMIT);
    if (wlErr) { await warn("reading website_leads", wlErr.message); return json({ ok: true, error: `website_leads read failed: ${wlErr.message}`, added: 0 }); }

    const leads = rows || [];
    const cl = house.data || {};
    const { kept, added, updated, pruned, changed } = mergeHouseLeads(cl.leadsLog, leads, { limit: PRUNE_LIMIT });

    // 🔴 A HEARTBEAT, SO "NO LEADS YET" AND "THIS STOPPED WORKING" LOOK DIFFERENT.
    // Bryson, 2026-08-24: "I also want to make sure the actual lead count works (i havent
    // gotten any yet but i still want to test that itll work)". He cannot test it with no
    // leads, and that is exactly the state where a broken mirror is invisible: the screen
    // reads 0, which is also the correct answer, so nothing looks wrong. Every screen that
    // shows a lead count now also shows when this last checked, and says so when it has
    // not run in a while. Same reasoning as the "These numbers are stale" panel on the ad
    // card: a failed read must never be indistinguishable from a real zero.
    const prevSync = cl.leadSync || {};
    const staleBeat = !prevSync.at || (Date.now() - new Date(prevSync.at).getTime()) > 55 * 60e3;
    const leadSync = { at: new Date().toISOString(), scanned: leads.length, total: kept.length };

    // Nothing changed and the heartbeat is fresh: no write at all. Without this the job
    // would touch the client row 96 times a day purely to record that it did nothing.
    if (!changed && !staleBeat) {
      return json({ ok: true, house: true, scanned: leads.length, added: 0, updated: 0, pruned: 0, total: kept.length, beat: false });
    }

    const { error: upErr } = await supabase.from("clients")
      .update({ data: { ...cl, leadsLog: kept, leads: kept.length, leadSync }, updated_at: new Date().toISOString() })
      .eq("id", house.id);
    if (upErr) { await warn("saving the mirrored leads", upErr.message); return json({ ok: true, error: `client update failed: ${upErr.message}`, added: 0 }); }

    console.log(`house-leads: ${leads.length} website lead(s) scanned \u2014 ${added} added, ${updated} status-synced, ${pruned} pruned.`);
    return json({ ok: true, house: true, scanned: leads.length, added, updated, pruned, total: kept.length });
  } catch (e) {
    await warn("the run itself", String((e && e.message) || e));
    return json({ ok: true, error: String((e && e.message) || e), added: 0 });
  }
});
