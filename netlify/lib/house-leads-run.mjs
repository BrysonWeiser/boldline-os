// One mirror, two ways to ask for it.
//
// This is the body that used to live inside the scheduled `house-leads` function. It was
// lifted out on 2026-09-02 so the OS can ask for the same mirror ON DEMAND, without a
// second implementation of it existing anywhere.
//
// Bryson, that night, after reading the Netlify log: *"lets have the numbers update live"*.
//
// 🔴 WHAT WAS AND WAS NOT ACTUALLY SLOW, because the first diagnosis was wrong and the
// distinction decides what this file is for. Website leads reach the OS's Leads screen
// IMMEDIATELY: that screen reads `website_leads` straight from Supabase and refreshes on a
// realtime subscription. Nothing was ever delayed there. What lags is the HOUSE ACCOUNT'S
// COPY in `leadsLog`, which the fifteen-minute job writes, and which feeds the My Ads lead
// tile, cost per lead, the ad health score and the pipeline stage. So this is about a
// dashboard being current, not about leads arriving.
//
// 🔴 AND IT IS THE SAME CODE, NOT A BROWSER-SIDE RECALCULATION. Deriving the house lead
// count in the UI would have been far less work and is exactly the trap `house-leads.mjs`
// warns about at the top of the file: five other readers, two of them server-side with no
// browser to derive anything in, would have kept the old number. One write still fixes all
// of them; it just happens sooner now.

import { mergeHouseLeads, PRUNE_LIMIT } from "./house-leads-merge.mjs";

/**
 * Mirror `website_leads` onto the internal (house) client record.
 * @param {object} supabase  a service-role client
 * @param {object} opts      { warn } — called as warn(step, detail) on a swallowed failure
 * @returns {object} the same shape both callers report
 */
export async function syncHouseLeads(supabase, { warn = async () => {} } = {}) {
  // The house account. No internal client means nothing to mirror into, which is a normal
  // state (he can delete and re-add it), not an error.
  const { data: houses, error: clErr } = await supabase
    .from("clients").select("id, data").eq("data->>internal", "true").limit(1);
  if (clErr) { await warn("reading the client list", clErr.message); return { ok: true, error: `clients read failed: ${clErr.message}`, added: 0 }; }
  const house = (houses || [])[0];
  if (!house) return { ok: true, house: false, added: 0 };

  const { data: rows, error: wlErr } = await supabase
    .from("website_leads").select("id, created_at, form, name, business, email, message, status, payload")
    .order("created_at", { ascending: false }).limit(PRUNE_LIMIT);
  if (wlErr) { await warn("reading website_leads", wlErr.message); return { ok: true, error: `website_leads read failed: ${wlErr.message}`, added: 0 }; }

  const leads = rows || [];
  const cl = house.data || {};
  const { kept, added, addedLeads, updated, pruned, changed } = mergeHouseLeads(cl.leadsLog, leads, { limit: PRUNE_LIMIT });

  // 🔴 A HEARTBEAT, SO "NO LEADS YET" AND "THIS STOPPED WORKING" LOOK DIFFERENT.
  // Bryson, 2026-08-24: "I also want to make sure the actual lead count works (i havent
  // gotten any yet but i still want to test that itll work)". He cannot test it with no
  // leads, and that is exactly the state where a broken mirror is invisible: the screen
  // reads 0, which is also the correct answer, so nothing looks wrong.
  const prevSync = cl.leadSync || {};
  const staleBeat = !prevSync.at || (Date.now() - new Date(prevSync.at).getTime()) > 55 * 60e3;
  const leadSync = { at: new Date().toISOString(), scanned: leads.length, total: kept.length };

  // 🔴 NOTHING CHANGED AND THE HEARTBEAT IS FRESH: NO WRITE AT ALL. This mattered when only
  // a scheduled job called it (96 pointless row writes a day) and it matters MORE now that
  // the OS calls it too: the My Ads screen asks on every realtime nudge and every poll, so
  // without this a screen left open would rewrite the client record all day.
  if (!changed && !staleBeat) {
    return { ok: true, house: true, scanned: leads.length, added: 0, updated: 0, pruned: 0, total: kept.length, beat: false };
  }

  const { error: upErr } = await supabase.from("clients")
    .update({ data: { ...cl, leadsLog: kept, leads: kept.length, leadSync }, updated_at: new Date().toISOString() })
    .eq("id", house.id);
  if (upErr) { await warn("saving the mirrored leads", upErr.message); return { ok: true, error: `client update failed: ${upErr.message}`, added: 0 }; }

  // ─── 🔴 A LEAD HE DOES NOT KNOW ABOUT IS A LEAD HE LOSES ────────────────────
  // Bryson, 2026-09-04, on his first one: *"make sure I get an alert on my phone as well
  // when a new lead lands"*. He is on his phone most of the day and the whole product is
  // speed to lead: minutes decide whether a prospect is still thinking about you.
  //
  // 🔴 SENT AFTER THE WRITE, NEVER BEFORE. If the push went first and the save then failed,
  // the next run would see the same lead as new and buzz him again for it, every fifteen
  // minutes, forever. Once the row is written the lead is no longer new to anything, so this
  // can only fire once per lead no matter which caller got here first.
  //
  // Push only, not the full alert channel: the website already emails him on every
  // submission, so routing this through `dispatchAlert` would mean two emails and a text
  // message for one lead, and an alert he learns to ignore is worse than no alert.
  if (addedLeads.length) {
    try {
      const { sendPushToAll } = await import("./push-shared.mjs");
      const { leadOrigin } = await import("./lead-origin.mjs");
      for (const lead of addedLeads.slice(0, 5)) {
        const who = lead.name || lead.business || lead.email || "Someone";
        const o = leadOrigin(lead);
        const bits = [o.known ? `From ${o.label}.` : null, lead.business || null, lead.email || null];
        await sendPushToAll({
          title: `New lead: ${who}`,
          body: bits.filter(Boolean).join(" · ") || "Open the OS to see the details.",
          severity: "green", url: "/",
        });
      }
    } catch (e) {
      // A missed buzz must never cost the mirror. The lead is already saved.
      console.error("house-leads: new-lead push failed:", e && e.message);
      await warn("sending the new-lead alert", e && e.message);
    }
  }

  console.log(`house-leads: ${leads.length} website lead(s) scanned — ${added} added, ${updated} status-synced, ${pruned} pruned.`);
  return { ok: true, house: true, scanned: leads.length, added, updated, pruned, total: kept.length };
}
