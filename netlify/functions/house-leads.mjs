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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // The house account. No internal client means nothing to mirror into, which is a
    // normal state (he can delete and re-add it), not an error.
    const { data: houses, error: clErr } = await supabase
      .from("clients").select("id, data").eq("data->>internal", "true").limit(1);
    if (clErr) return json({ ok: true, error: `clients read failed: ${clErr.message}`, added: 0 });
    const house = (houses || [])[0];
    if (!house) return json({ ok: true, house: false, added: 0 });

    const { data: rows, error: wlErr } = await supabase
      .from("website_leads").select("id, created_at, form, name, business, email, message, status, payload")
      .order("created_at", { ascending: false }).limit(PRUNE_LIMIT);
    if (wlErr) return json({ ok: true, error: `website_leads read failed: ${wlErr.message}`, added: 0 });

    const leads = rows || [];
    const cl = house.data || {};
    const { kept, added, updated, pruned, changed } = mergeHouseLeads(cl.leadsLog, leads, { limit: PRUNE_LIMIT });

    if (!changed) return json({ ok: true, house: true, scanned: leads.length, added: 0, updated: 0, pruned: 0, total: kept.length });

    const { error: upErr } = await supabase.from("clients")
      .update({ data: { ...cl, leadsLog: kept, leads: kept.length }, updated_at: new Date().toISOString() })
      .eq("id", house.id);
    if (upErr) return json({ ok: true, error: `client update failed: ${upErr.message}`, added: 0 });

    console.log(`house-leads: ${leads.length} website lead(s) scanned \u2014 ${added} added, ${updated} status-synced, ${pruned} pruned.`);
    return json({ ok: true, house: true, scanned: leads.length, added, updated, pruned, total: kept.length });
  } catch (e) {
    console.error("house-leads failed:", e && e.message);
    return json({ ok: true, error: String((e && e.message) || e), added: 0 });
  }
};
