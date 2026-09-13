// The 11pm alert that should never have been sent, and the alert that should have been.
// Run: node tests/verify-lead-check-alerts.mjs
//
// 2026-09-12, 11:00pm Phoenix. Bryson's phone: "🔴 BoldLine Alert — Lead check is not
// running ... failed at 'reading the client list': Gateway Timeout." Supabase answered
// normally on the next attempt. Nothing was broken. Nothing needed doing.
//
// 🔴 TWO DEFECTS, AND THE SECOND IS THE DANGEROUS ONE.
//   1. No retry. One momentary gateway error ended the run. The retry for exactly this had
//      been written months earlier next to the clock-skew incident and was welded to one
//      query, so the job that needed it most could not use it.
//   2. The job alerted on its own first bad run. It runs 96 times a day. An hour of blips is
//      four identical red alerts, a day of them is ninety-six, and the end of that road is a
//      muted channel that swallows the alert it exists to deliver. That exact sentence was
//      already written down in this codebase. It was written about a different job.
//
// A job cannot judge its own health from inside one run: it cannot tell a blip from an
// outage, and the failures it never survives are the ones it cannot report. So the health
// call moved OUT, to a watcher with its own connection and its own schedule.

import { readFileSync } from "node:fs";
import { leadMirrorState, STALE_HOURS, hoursSince } from "../netlify/lib/heartbeats.mjs";
import { retryQuery } from "../netlify/lib/report-shared.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const RUN = readFileSync(new URL("../netlify/lib/house-leads-run.mjs", import.meta.url), "utf8");
const FN = readFileSync(new URL("../netlify/functions/house-leads.mjs", import.meta.url), "utf8");
const WATCH = readFileSync(new URL("../netlify/functions/alerts-watch.mjs", import.meta.url), "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE BLIP SURVIVES NOW
// ══════════════════════════════════════════════════════════════════════════════
const gateway = { message: "Gateway Timeout" };

{
  // Exactly what happened: it failed once, then worked.
  let calls = 0;
  const r = await retryQuery(async () => (++calls === 1 ? { error: gateway } : { data: [{ id: "house" }] }),
    { job: "t", step: "reading the client list", gapMs: 0 });
  eq("🔴 one Gateway Timeout no longer ends the run", r.error, null);
  eq("and it tried again", calls, 2);
  eq("and the caller gets the real data", r.data, [{ id: "house" }]);
  eq("and it says how many goes it took", r.attempts, 2);
}
{
  let calls = 0;
  const r = await retryQuery(async () => { calls++; return { error: gateway }; }, { job: "t", gapMs: 0 });
  eq("a fault that survives every attempt is reported", r.error, gateway,
    "three failures a second apart is not a blip, and hiding it would be worse than the noise");
  eq("and it stops at three, it does not hammer the database", calls, 3);
  eq("and it hands back no data rather than stale data", r.data, null);
}
{
  let calls = 0;
  await retryQuery(async () => { calls++; return { data: [] }; }, { job: "t", gapMs: 0 });
  eq("a first-time success does not retry", calls, 1, "96 runs a day tripling their queries for nothing");
}
{
  // An empty result is a legitimate answer, not a failure to retry past.
  const r = await retryQuery(async () => ({ data: [] }), { job: "t", gapMs: 0 });
  eq("no rows found is an answer, not an error", r.data, []);
}
eq("it survives a call that returns nothing at all", (await retryQuery(async () => undefined, { job: "t", gapMs: 0 })).error, null);
{
  // 🔴 `if (error)` must mean the same thing on every path out. A success that leaves error
  // undefined and a success that sets it null read the same to `if (error)` today, and stop
  // reading the same the moment a caller compares it to null.
  const good = await retryQuery(async () => ({ data: 1 }), { job: "t", gapMs: 0 });
  ok("a success always reports error as null, never missing", good.error === null, String(good.error));
}

// 🔴 Every database call in the mirror is covered, not just the one that happened to fail.
{
  const guarded = [...RUN.matchAll(/retryQuery\(/g)].length;
  const raw = [...RUN.matchAll(/await\s+supabase\s*\n?\s*\.?from\(|await supabase\.from\(/g)].length;
  eq("🔴 every database call in the mirror retries", raw, 0,
    "fixing only the call that failed tonight leaves the other two to fail the same way");
  ok("all three of them", guarded === 3, `found ${guarded}`);
  ok("the client read is one of them", /step: "reading the client list"/.test(RUN));
  ok("the leads read is another", /step: "reading website_leads"/.test(RUN));
  ok("and so is the save", /step: "saving the mirrored leads"/.test(RUN));
}
ok("🔴 the retried write is safe to repeat, and it says why",
  /REPLACES the whole row/.test(RUN) && /not an append/.test(RUN),
  "retrying an APPEND would double a lead every time the network hiccuped");

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 THE JOB NO LONGER PAGES HIM ON ITS OWN BAD RUN
// ══════════════════════════════════════════════════════════════════════════════
ok("🔴 the lead mirror sends no alerts at all", !/dispatchAlert/.test(FN),
  "96 runs a day means a fault lasting one hour sends four identical red alerts and a fault lasting a day sends ninety-six");
ok("it still says loudly what failed, in the log", /console\.error\(`house-leads: \$\{step\}/.test(FN),
  "quiet in the inbox must not mean invisible when somebody goes looking");
ok("a crash is still recorded", /withFailureAlert\("house-leads"/.test(FN));

// 🔴 A failed run must now REPORT itself failed. This is what the heartbeat check reads, and
// the old code returned ok:true on every error path, so Netlify saw 96 clean runs a day.
{
  const oks = [...RUN.matchAll(/return \{ ok: (true|false), error:/g)].map((m) => m[1]);
  eq("every failure path now reports failure", oks, ["false", "false", "false"],
    "an error path that returns ok:true is how this went unnoticed for a week the first time");
  ok("and so does the wrapper", /return json\(\{ ok: false, error:/.test(FN));
}
// The success paths are untouched: a quiet run is still a good run.
ok("nothing-to-do still reports success", /ok: true, house: true, scanned: leads\.length, added: 0/.test(RUN));
ok("and no house account is still a normal state, not an error", /return \{ ok: true, house: false, added: 0 \}/.test(RUN),
  "he can delete and re-add the house account; that is not a fault");

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 A REAL STALL STILL REACHES HIM, JUDGED FROM OUTSIDE THE JOB
// ══════════════════════════════════════════════════════════════════════════════
const NOW = Date.parse("2026-09-12T23:00:00-07:00");
const house = (mins, extra = {}) => ({ data: { internal: true, leadSync: { at: new Date(NOW - mins * 60e3).toISOString() }, ...extra } });

eq("the threshold is two hours", STALE_HOURS.leads, 2);
{
  const st = leadMirrorState(house(15), { now: NOW });
  eq("🔴 tonight's blip says nothing", st.alert, false,
    "this is the whole point: a 15-minute job that missed one run is not news");
  eq("and there is nothing to clear either", st.clear, false);
}
eq("an hour behind is still not news", leadMirrorState(house(60), { now: NOW }).alert, false,
  "four missed runs could still be one bad ten minutes at the database");
{
  const st = leadMirrorState(house(150), { now: NOW });
  eq("🔴 two and a half hours IS news", st.alert, true);
  ok("and it says how long", /2\.5h/.test(st.why), st.why);
}
eq("so is a whole day", leadMirrorState(house(1440), { now: NOW }).alert, true);
{
  // 🔴 ONCE PER STALL. The flag is what stops fifteen-minute repeats of the same fact.
  const st = leadMirrorState(house(150, { leadMirrorAlertedAt: "2026-09-12T20:00:00Z" }), { now: NOW });
  eq("🔴 a stall already reported is not reported again", st.alert, false,
    "otherwise this becomes the every-15-minutes alert it was built to replace");
  eq("and it is not cleared while it is still stalled", st.clear, false);
}
{
  // 🔴 AND IT RE-ARMS. Without this it fires once ever and is silent through every future outage.
  const st = leadMirrorState(house(10, { leadMirrorAlertedAt: "2026-09-12T20:00:00Z" }), { now: NOW });
  eq("🔴 recovery clears the flag", st.clear, true,
    "a one-time-only alarm is worse than no alarm, because it reads as silence meaning fine");
  eq("and recovery is not itself an alert", st.alert, false);
}
eq("a healthy mirror that never alerted has nothing to do", leadMirrorState(house(5), { now: NOW }), 
  { alert: false, clear: false, hours: leadMirrorState(house(5), { now: NOW }).hours, why: leadMirrorState(house(5), { now: NOW }).why });

// ── What it must NOT trip on ─────────────────────────────────────────────────
{
  // Never started and stopped working are different faults with different fixes, and this
  // would alarm forever on a fresh install. The two silent cases must also be tellable
  // apart by whoever reads the log, or the next person debugging this learns nothing.
  const never = leadMirrorState({ data: { internal: true } }, { now: NOW });
  eq("a mirror that has never run says nothing", never.alert, false);
  ok("and says it has no heartbeat yet", /no heartbeat yet/.test(never.why), never.why);
  const broken = leadMirrorState({ data: { leadSync: { at: "soon" } } }, { now: NOW });
  ok("which is a different reason from a heartbeat it cannot read",
    /not a readable time/.test(broken.why) && broken.why !== never.why, broken.why);
}
eq("no house account at all says nothing", leadMirrorState(null, { now: NOW }).alert, false);
eq("an unreadable timestamp says nothing", leadMirrorState({ data: { leadSync: { at: "soon" } } }, { now: NOW }).alert, false,
  "guessing at a broken date would alert every fifteen minutes forever");
eq("junk in does not throw", leadMirrorState(undefined).alert, false);
eq("hoursSince handles a missing time", hoursSince(null), null);

// ── It is actually wired in ──────────────────────────────────────────────────
ok("🔴 the watcher that has its own connection is the one doing the judging",
  /leadMirrorState\(houseRow\)/.test(WATCH),
  "a job reporting its own health can only report the failures it survives");
ok("and it alerts when told to", /if \(st\.alert\)/.test(WATCH) && /title: "Lead check has stopped"/.test(WATCH));
ok("and writes the flag so it says it once", /leadMirrorAlertedAt: new Date\(\)\.toISOString\(\)/.test(WATCH));
ok("🔴 and actually removes the flag on recovery, rather than just noting it",
  /const \{ leadMirrorAlertedAt, \.\.\.recovered \} = houseRow\.data/.test(WATCH) && /data: recovered/.test(WATCH),
  "leaving the flag set means the next real outage is silent");
{
  const i = WATCH.indexOf("leadMirrorState(houseRow)");
  const body = WATCH.slice(i, i + 2200);
  ok("🔴 the alert tells him his leads are NOT lost", /leads are NOT lost/.test(body),
    "the old alert said the count was frozen and left him to work out whether a lead had gone missing at 11pm");
  ok("and that it fixes itself once the job runs again", /catch up by itself/.test(body));
  ok("and where to look if it does not", /Netlify, Logs, Functions, house-leads/.test(body));
}
{
  // The stall check must not be buried inside the per-client loop, where it would fire once
  // per client and depend on there being any clients at all.
  const stall = WATCH.indexOf("leadMirrorState(houseRow)");
  const loop = WATCH.indexOf("for (const row of rows || []) {");
  ok("the stall check runs once, not once per client", stall > 0 && loop > 0 && stall < loop,
    "inside the loop it would send one alert per client, which is the noise problem again");
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ONE DEFINITION OF STALE, NOT TWO
// ══════════════════════════════════════════════════════════════════════════════
{
  const dc = readFileSync(new URL("../netlify/functions/daily-check.mjs", import.meta.url), "utf8");
  ok("the daily check reads the same thresholds", /from "\.\.\/lib\/heartbeats\.mjs"/.test(dc),
    "two copies of the same threshold drift, and the day they disagree one watcher is calm while the other alarms");
  ok("and does not keep its own copy", !/export const STALE_HOURS = \{/.test(dc));
}

console.log(`verify-lead-check-alerts: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
