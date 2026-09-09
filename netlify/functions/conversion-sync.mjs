// Nightly: tell Google which leads turned out to be real, for every client.
//
// Bryson, 2026-09-09, after asking what the two buttons on the Conversion Tracking card
// do and being told nothing sends them on a schedule: *"Yes can you make it automatic"*.
//
// 🔴 WHY IT MATTERED MORE THAN IT LOOKED. Google can see a form was filled in and nothing
// else. It cannot tell a real buyer from someone curious, and it cannot see who paid. Left
// alone it goes and finds more of EVERYONE WHO FILLS IN FORMS, because that is the only
// thing it was ever told was good. The upload existed and worked, behind two buttons
// somebody had to remember to press. A signal nobody remembers to send is a signal the
// bidding never gets, and the failure is completely silent: the ads just quietly stay
// average and nothing anywhere says why.
//
// What it does each run, for every client with a linked Google account and conversion
// tracking actually set up:
//   1. sends every newly QUALIFIED lead that carries an ad click,
//   2. sends every newly CLOSED customer, with the order value where there is one,
//   3. marks only what Google actually accepted, so a rejected row is retried tomorrow
//      rather than hidden forever.
//
// It runs the SAME `sendConversions` the buttons run. Two copies of "what has already been
// sent" is how a button and a job start disagreeing about what Google has been told.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { getAccessToken as gadsToken, sendConversions } from "./google-ads.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";

// Tracking has to be genuinely finished, both actions, not just started. A half-finished
// setup uploads into an action that does not exist and Google refuses the whole batch.
export const readyForConversions = (cl) => {
  const ca = (cl && cl.conversionActions) || {};
  return !!(cl && cl.googleAdsCustomerId && cl.conversionId
    && ca.qualified && ca.qualified.resourceName);
};

// 🔴 A DEMO CLIENT IS NEVER UPLOADED. Its leads are invented, and the whole point of this
// job is teaching a real ad account what a real buyer looks like. Same rule the weekly
// report and the lead follow-up already run on.
export const uploadable = (cl) => !!cl && !cl.demo && readyForConversions(cl);

export default withFailureAlert("conversion-sync", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("conversion-sync aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) {
    console.error("conversion-sync: clients load failed:", error.message);
    return new Response("db error", { status: 200 });
  }

  const targets = (rows || []).filter((r) => uploadable(r.data));
  if (!targets.length) {
    console.log("conversion-sync: no client has conversion tracking finished yet.");
    return new Response(JSON.stringify({ ok: true, clients: 0, uploaded: 0 }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }

  // One OAuth exchange for the whole run, not one per client.
  let accessToken;
  try { accessToken = await gadsToken(); }
  catch (e) {
    console.error("conversion-sync: Google auth failed:", (e && e.message) || e);
    return new Response("auth failed", { status: 200 });
  }

  let uploaded = 0, rejected = 0, failed = 0;
  for (const row of targets) {
    const cl = row.data;
    for (const stage of ["qualified", "won"]) {
      try {
        const r = await sendConversions(supabase, accessToken, {
          clientId: row.id, customerId: cl.googleAdsCustomerId, stage,
        });
        if (!r.ok) { failed++; console.error(`conversion-sync: ${cl.name} ${stage}: ${r.error}`); continue; }
        uploaded += r.uploaded || 0;
        rejected += r.rejected || 0;
        if (r.uploaded) console.log(`conversion-sync: sent ${r.uploaded} ${stage} for ${cl.name}`);
      } catch (e) {
        // 🔴 ONE CLIENT'S FAILURE NEVER ENDS THE RUN. The next client's signals are not
        // this client's problem, and a run that stops on the first error silently starves
        // every account after it in the list.
        failed++;
        console.error(`conversion-sync: ${cl.name} ${stage} threw:`, (e && e.message) || e);
      }
    }
  }

  // 🔴 SILENCE IS THE FAILURE MODE THIS JOB EXISTS TO FIX, so it does not fail silently
  // either. Google refusing rows is worth knowing about: it usually means the conversion
  // action was deleted in the ad account, and every upload after it will fail the same way.
  if (failed || rejected) {
    try {
      await dispatchAlert({
        title: `Conversion upload had ${failed ? `${failed} failure${failed === 1 ? "" : "s"}` : `${rejected} rejected row${rejected === 1 ? "" : "s"}`}`,
        body: `The nightly job sent ${uploaded} conversion${uploaded === 1 ? "" : "s"} to Google across ${targets.length} account${targets.length === 1 ? "" : "s"}. ${failed ? `${failed} client/stage pair${failed === 1 ? "" : "s"} failed outright. ` : ""}${rejected ? `Google refused ${rejected} row${rejected === 1 ? "" : "s"}, which usually means the conversion action was deleted in the ad account. ` : ""}Open the client's Campaign tab and press Re-check the setup.`,
        severity: failed ? "red" : "yellow",
      });
    } catch (e) { console.warn("conversion-sync alert failed:", e && e.message); }
  }

  console.log(`conversion-sync: ${targets.length} account(s), ${uploaded} sent, ${rejected} refused, ${failed} failed.`);
  return new Response(JSON.stringify({ ok: true, clients: targets.length, uploaded, rejected, failed }), {
    status: 200, headers: { "content-type": "application/json" },
  });
});
