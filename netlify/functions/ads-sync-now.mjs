// Pull the ad numbers RIGHT NOW, because "wait an hour and see" is not an answer.
//
// Bryson, 2026-09-04 evening: *"Make sure that the analytics for my ads are updating. They
// haven't updated in a few hours now"*.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 HE HAD NO WAY TO ANSWER HIS OWN QUESTION, AND NEITHER DID I.
//
// The numbers come from a job Netlify runs on the hour. When they stop moving there are three
// possible reasons and the screen showed the same thing for all of them: the job ran and
// nothing had changed, the job ran and the ad platform refused, or the job never ran at all.
// Netlify's schedules are best effort and a two-and-a-half hour gap with no errors has been
// seen on this account before, so the third is not hypothetical.
//
// A button that forces the job separates all three in about ten seconds. If the numbers move,
// the schedule slipped. If it comes back with an error, that error is the answer. If it comes
// back saying nothing changed, nothing had changed.
//
// 🔴 IT RUNS THE SCHEDULED JOB ITSELF, NOT A COPY OF IT. Reimplementing the sync here would
// mean two versions of the arithmetic that decides what he is looking at, and the copy nobody
// runs on a schedule would be the one that drifts. Same reasoning as house-leads-sync, which
// is the other on-demand twin in this codebase.
//
// Owner only. This spends nothing and writes only our own snapshot, but it does hit both ad
// platforms' APIs on demand, and an unauthenticated endpoint that does that is a way for a
// stranger to burn our rate limit.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import runAdsSync from "./ads-sync.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Server not configured" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  // 🔴 THE JOB'S OWN FAILURE HANDLING IS LEFT INTACT. `ads-sync` is wrapped in the alert
  // wrapper, so a failure here raises the same alarm a scheduled failure would, which is
  // exactly right: a press that fails is as much a problem as an hour that fails.
  try {
    const res = await runAdsSync(req);
    // The job answers with a Response. Read it if we can, and never let a shape we did not
    // expect turn a successful refresh into an error on his screen.
    let detail = null;
    try { detail = await res.clone().json(); } catch (e) { detail = null; }
    return json({ ok: true, ranAt: new Date().toISOString(), detail });
  } catch (e) {
    return json({ ok: false, error: String((e && e.message) || e).slice(0, 300) }, 200);
  }
};
