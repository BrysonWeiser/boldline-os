// Ask for the house-lead mirror right now, from the OS.
//
// Bryson, 2026-09-02, after reading a Netlify log that showed the scheduled job skipped for
// two and a half hours: *"lets have the numbers update live"*.
//
// 🔴 WHAT THIS DOES AND DOES NOT FIX, because the first diagnosis was wrong and the
// difference decides whether this file is worth having. Website leads already reach the OS
// instantly: the Leads screen reads `website_leads` straight from Supabase on a realtime
// subscription. Nothing was ever delayed there, and an earlier reply to Bryson that said
// otherwise was mistaken. What lags is the HOUSE ACCOUNT'S copy in `leadsLog`, which feeds
// the My Ads lead tile, cost per lead, the ad health score and the pipeline stage. So this
// makes a dashboard current. It does not make leads arrive sooner, because they already do.
//
// 🔴 WHY AN OWNER-AUTHED ENDPOINT AND NOT A PUSH FROM THE MARKETING SITE. The obvious build
// was: the form handler POSTs to the OS the moment a lead lands. That crosses two separate
// Netlify sites, needs a shared secret in an env var (a job Bryson can only do at a
// computer), and leaves an endpoint anyone can hammer. This needs none of that: the OS is
// already logged in, already subscribed to `website_leads`, and can simply ask. Same
// freshness, no new secret, nothing new to deploy or configure.
//
// It runs the SAME `syncHouseLeads` the scheduled job runs. There is no second copy of the
// merge, so the two paths cannot disagree about a lead count.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { syncHouseLeads } from "../lib/house-leads-run.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  try {
    // 🔴 No `warn` passed. The scheduled job alerts on failure because nobody is watching
    // it; this one runs because Bryson is looking at the screen right now, so a red alert
    // for something he can see and retry by refreshing would be noise. The scheduled job
    // still covers the silent case fifteen minutes later.
    return json(await syncHouseLeads(supabase));
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error("house-leads-sync failed:", m);
    return json({ ok: false, error: m }, 500);
  }
};
