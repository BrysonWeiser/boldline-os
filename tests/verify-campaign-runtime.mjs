// When a campaign started, and how long it has actually been running.
// Run: node tests/verify-campaign-runtime.mjs
//
// Bryson, 2026-09-21: *"in the os with the ads can we also add when they started and how long
// they have been running for not only for my ads but also clients ads"*.
//
// 🔴 THE WHOLE SUITE IS ABOUT ONE TEMPTATION: both platforms hand us a start date, and it is
// the wrong one. Google's `campaign.start_date` and Meta's `start_time` say when a campaign was
// ALLOWED to start. Every campaign the OS builds is created PAUSED and switched on later, so
// that date is routinely weeks earlier than the day it ran, always in the direction that makes
// a young campaign look old. He would read "three weeks" on a campaign that has had two days and
// judge the ads on it, and it would go into a client report.
//
// 🔴 AND THE SECOND TEMPTATION, WHICH IS WORSE. The day this shipped, every campaign already
// running had been running a while. Stamping "today" the first time the sync sees one spending
// would tell him a three-month-old campaign is one day old, confidently, on the screen he uses
// to decide whether the money is working. So an age is earned, not assumed: only a campaign the
// sync WATCHED cross from not-spending to spending gets a number of days.
//
// The rules are imported and executed, never re-implemented (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  foldFirstSpend, runtimeLabel, accountRuntime, runningDays, campKey, RUNTIME_CAP,
} from "../netlify/lib/campaign-runtime.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const T = (s) => new Date(s).toISOString();
const NOW = new Date("2026-09-21T12:00:00Z").getTime();

// ── 1. An age is earned by being watched, never assumed ──────────────────────
{
  // Seen idle first, then spending. This is the only path to an exact start.
  let m = foldFirstSpend({}, [{ platform: "google", id: "1", spend: 0, startDate: "2026-08-01" }], T("2026-09-01T10:00:00Z"));
  eq("a campaign seen with no spend is recorded but not dated", m["google:1"].since, null);
  ok("and is not marked exact yet", m["google:1"].exact === false);

  m = foldFirstSpend(m, [{ platform: "google", id: "1", spend: 42 }], T("2026-09-07T10:00:00Z"));
  eq("🔴 the crossover is what dates it", m["google:1"].since, "2026-09-07T10:00:00.000Z");
  ok("🔴 and only that earns exact", m["google:1"].exact === true);

  const lbl = runtimeLabel(m["google:1"], NOW);
  eq("🔴 the age counts from first SPEND, not the configured start",
    lbl.text, "Running 15 days, since Sep 7, 2026");
  ok("🔴 and the configured Aug 1 is nowhere in it",
    !/Aug 1/.test(lbl.text),
    "campaign.start_date said Aug 1 and the campaign was paused until Sep 7, so 51 days would be a lie");

  // Caught already spending. We do NOT know when it began.
  const mid = foldFirstSpend({}, [{ platform: "meta", id: "9", spend: 500, startDate: "2026-06-01" }], T("2026-09-07T10:00:00Z"));
  ok("a campaign caught mid-flight is recorded", !!mid["meta:9"].since);
  ok("🔴 but never marked exact", mid["meta:9"].exact === false);
  const midL = runtimeLabel(mid["meta:9"], NOW);
  ok("🔴 and is NEVER given a number of days", midL.days === null && !/\d+ days/.test(midL.text), midL.text);
  ok("it says when we first saw it instead", /first seen spending Sep 7, 2026/.test(midL.text), midL.text);
  ok("and pairs it with the configured date, which is also true",
    /set to start Jun 1, 2026/.test(midL.text), midL.text);
}

// ── 2. A stamp is permanent ──────────────────────────────────────────────────
// A campaign paused for a fortnight and switched back on has not started again, and a run where
// the platform reports zero spend for the window must not erase what it earned.
{
  let m = foldFirstSpend({}, [{ platform: "google", id: "1", spend: 0 }], T("2026-09-01T00:00:00Z"));
  m = foldFirstSpend(m, [{ platform: "google", id: "1", spend: 10 }], T("2026-09-02T00:00:00Z"));
  const stamped = m["google:1"].since;
  m = foldFirstSpend(m, [{ platform: "google", id: "1", spend: 0 }], T("2026-09-20T00:00:00Z"));
  eq("🔴 a later run with no spend does not move the start", m["google:1"].since, stamped);
  ok("and does not demote it", m["google:1"].exact === true);
  m = foldFirstSpend(m, [{ platform: "google", id: "1", spend: 99 }], T("2026-09-21T00:00:00Z"));
  eq("🔴 nor does spending again", m["google:1"].since, stamped);

  // A campaign missing from a run (paused and filtered, or past the list cap) keeps its stamp.
  const after = foldFirstSpend(m, [{ platform: "meta", id: "7", spend: 0 }], T("2026-09-21T01:00:00Z"));
  eq("a campaign absent from this run keeps its date", after["google:1"].since, stamped);

  ok("the fold never mutates what it was given",
    Object.keys(foldFirstSpend(Object.freeze({}), [{ platform: "meta", id: "3", spend: 1 }], T("2026-09-21T00:00:00Z"))).length === 1);
}

// ── 3. The account's own answer ──────────────────────────────────────────────
{
  const exact = { seenAt: T("2026-09-21T00:00:00Z"), since: T("2026-09-14T00:00:00Z"), exact: true };
  const older = { seenAt: T("2026-09-21T00:00:00Z"), since: T("2026-09-02T00:00:00Z"), exact: false };
  // 🔴 The inexact one LOOKS older. Taking it would print "20 days" from a date we only know we
  // noticed, which is the exact lie this whole design exists to refuse.
  const a = accountRuntime({ a: exact, b: older }, NOW);
  ok("🔴 an exact stamp wins over an older inexact one", a.exact === true && a.days === 8, JSON.stringify(a));
  ok("with the earliest exact date", /since Sep 14, 2026/.test(a.text), a.text);

  const only = accountRuntime({ b: older }, NOW);
  ok("with nothing exact it falls back honestly", only.exact === false && only.days === null, JSON.stringify(only));

  eq("an account with nothing spent says so",
    accountRuntime({ x: { seenAt: T("2026-09-01T00:00:00Z"), since: null, exact: false } }, NOW).text,
    "No campaign has spent yet");
  eq("and so does an empty one", accountRuntime({}, NOW).text, "No campaign has spent yet");
  eq("and rubbish does not crash it", accountRuntime(null, NOW).text, "No campaign has spent yet");
}

// ── 4. The states before anything has spent ──────────────────────────────────
{
  eq("a future configured start is named as scheduled",
    runtimeLabel({ since: null, scheduled: "2026-10-01" }, NOW).text, "Set to start Oct 1, 2026");
  ok("🔴 and is never described as running",
    !/Running/.test(runtimeLabel({ since: null, scheduled: "2026-10-01" }, NOW).text));
  eq("a past configured start with no spend says that plainly",
    runtimeLabel({ since: null, scheduled: "2026-08-01" }, NOW).text,
    "Has not spent yet, was set to start Aug 1, 2026");
  eq("and with nothing at all", runtimeLabel({}, NOW).text, "Has not spent yet");
  eq("and on nothing", runtimeLabel(null, NOW).text, "Has not spent yet");
}

// ── 5. Day counting ──────────────────────────────────────────────────────────
{
  // Inclusive of the first day: "0 days" reads as though it has not started.
  eq("the first day is day 1", runningDays(T("2026-09-21T00:00:00Z"), NOW), 1);
  eq("and a week later is 8", runningDays(T("2026-09-14T00:00:00Z"), NOW), 8);
  eq("one day reads singular", runtimeLabel({ since: T("2026-09-21T00:00:00Z"), exact: true }, NOW).text,
    "Running 1 day, since Sep 21, 2026");
  eq("a future date is not a negative age", runningDays(T("2027-01-01T00:00:00Z"), NOW), null);
  eq("and nonsense is null", runningDays("not a date", NOW), null);
}

// ── 6. The map cannot grow forever ───────────────────────────────────────────
// It lives on the client record and is read on every load.
{
  const many = {};
  for (let i = 0; i < RUNTIME_CAP + 40; i++) {
    many[campKey("google", i)] = { seenAt: T(new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString()), since: null, exact: false };
  }
  const out = foldFirstSpend(many, [{ platform: "meta", id: "new", spend: 1 }], T("2026-09-21T00:00:00Z"));
  ok("🔴 the map is capped", Object.keys(out).length <= RUNTIME_CAP, String(Object.keys(out).length));
  ok("and the newest survives the prune", !!out["meta:new"]);
  ok("and the oldest is what went", !out["google:0"]);
}

// ── 7. 🔴 BOTH COPIES OF THE RULES AGREE ─────────────────────────────────────
// The OS is one file served to a browser and cannot import the library, so it carries a mirror.
// Two copies of a rule is how a screen and a report end up quoting different numbers, so the
// OS copy is EVALUATED here and compared against the real one on the same inputs.
{
  const UI = readFileSync(join(ROOT, "index.html"), "utf8");
  const i = UI.indexOf("const RUN_DAY = 864e5;");
  const j = UI.indexOf("\nconst houseHealthFactors", i);
  ok("the OS copy was found", i > 0 && j > i);
  const os = new Function(UI.slice(i, j) + "\nreturn { runLabel, accountRun, runDays };")();

  const cases = [
    { since: T("2026-09-14T00:00:00Z"), exact: true },
    { since: T("2026-09-21T00:00:00Z"), exact: true },
    { since: T("2026-09-07T00:00:00Z"), exact: false, scheduled: "2026-06-01" },
    { since: T("2026-09-07T00:00:00Z"), exact: false },
    { since: null, scheduled: "2026-10-01" },
    { since: null, scheduled: "2026-08-01" },
    {},
  ];
  for (const c of cases) {
    eq(`🔴 both copies label ${JSON.stringify(c)} the same`,
      os.runLabel(c, NOW).text, runtimeLabel(c, NOW).text);
    eq("  and agree on whether it is exact", os.runLabel(c, NOW).exact, runtimeLabel(c, NOW).exact);
    eq("  and on the day count", os.runLabel(c, NOW).days, runtimeLabel(c, NOW).days);
  }
  const map = { a: cases[0], b: cases[2] };
  eq("🔴 and on the account's own answer", os.accountRun(map, NOW).text, accountRuntime(map, NOW).text);
  eq("including on an empty account", os.accountRun({}, NOW).text, accountRuntime({}, NOW).text);
}

// ── 7b. 🔴 THE KEY THE SCREEN LOOKS UP MUST BE THE KEY THE SYNC WROTE ────────
//
// Found in a browser, not by a test, and the tests were all green. The card carries TWO keys for
// the same campaign: a focus key, `platform-id`, which decides which row is selected, and the
// runtime key, `platform:id`, which the library writes the map with. The campaign rows reused
// the focus key to look up the map, matched nothing, and every row read "Has not spent yet",
// including campaigns that had been running for weeks.
//
// Nothing caught it because both halves were individually correct: the library was right, the
// mirror was right, and the join between them was wrong. So the join is what is pinned.
{
  const UI = readFileSync(join(ROOT, "index.html"), "utf8");
  const i = UI.indexOf("const RUN_DAY = 864e5;");
  const j = UI.indexOf("\nconst houseHealthFactors", i);
  const os = new Function(UI.slice(i, j) + "\nreturn { runKey };")();

  for (const [p, id] of [["google", "123"], ["meta", "act_9"], ["google", 7]]) {
    eq(`🔴 both sides build the same key for ${p}/${id}`, os.runKey(p, id), campKey(p, id));
  }

  // And the screen must actually USE it. A literal would pass the check above and still drift.
  ok("🔴 the campaign row looks the map up with the runtime key",
    /runLabel\(\(st\.runtime\|\|\{\}\)\[runKey\(c\.platform,c\.id\)\]\)/.test(UI),
    "reusing the row's focus key here matches nothing and reads as 'has not spent yet' for every "
    + "campaign, however long it has been running");
  ok("and so does the selected-campaign line",
    /runLabel\(\(st\.runtime\|\|\{\}\)\[runKey\(sel\.platform,sel\.id\)\]\)/.test(UI));
  // 🔴 The two key shapes must stay visibly different, or this bug becomes invisible again.
  ok("the focus key and the runtime key are still different shapes",
    /const key=`\$\{c\.platform\}-\$\{c\.id\}`/.test(UI) && os.runKey("a", "b") === "a:b",
    "if both became `a-b` the lookup would work by accident and break the day either changes");
}

// ── 8. The platform reads actually ask for the date ──────────────────────────
// The rules can be perfect and print nothing if the fetchers never requested the field.
{
  const G = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
  const M = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
  const S = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
  ok("Google asks for the configured start", /campaign\.start_date/.test(G) && /startDate: \(r\.campaign && r\.campaign\.startDate\)/.test(G));
  ok("Meta asks for it too", /start_time/.test(M) && /startDate: c\.start_time/.test(M));
  ok("🔴 the sync carries it through the trim, or it is dropped before anyone sees it",
    /\.\.\.\(c\.startDate \? \{ startDate: c\.startDate \} : \{\}\)/.test(S));
  ok("🔴 and the sync folds this run onto what it already knew",
    /foldFirstSpend\(\s*\(cl\.adPerf \|\| \{\}\)\.runtime,/.test(S),
    "starting from an empty map every run would re-stamp every campaign as new on every pass");
  ok("and stores it where the OS reads it", /google, meta, runtime,/.test(S));
  ok("the OS reads it off the record", /runtime: perf\.runtime \|\| \{\}/.test(readFileSync(join(ROOT, "index.html"), "utf8")));
}

console.log(`verify-campaign-runtime: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
