// Guards the answer to "is this all live accurate data, not stand ins" (Bryson,
// 2026-08-22). KB `live-stats`.
//
// 🔴 `client.cpl` WAS NEVER COMPUTED BY ANYTHING. It is set to 0 when a client is created
// and hardcoded on the demo records, and no code path has ever written a real value to
// it. Five things read it as though it were live:
//   • the server health score (its cost-per-lead points were unreachable),
//   • the client report prompt (every report ever sent said "Not yet tracked"),
//   • the owner rollup's over-target list (could never list anyone),
//   • the Reports tab in the OS, and
//   • alerts-watch's CPL-blowout alarm, which therefore COULD NEVER FIRE. That one is
//     not cosmetic. It is a warning he believes is watching his money.
//
// `liveStats` is importable and pure, so this runs the real thing (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { liveStats } from "../netlify/lib/report-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI     = readFileSync(join(ROOT, "index.html"), "utf8");
const SHARED = readFileSync(join(ROOT, "netlify/lib/report-shared.mjs"), "utf8");
const ALERTS = readFileSync(join(ROOT, "netlify/functions/alerts-watch.mjs"), "utf8");
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const SHARED_CODE = strip(SHARED), ALERTS_CODE = strip(ALERTS), UI_CODE = strip(UI);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();

// ── 1. Cost per lead is computed, from real spend and real leads ──────────────
{
  const s = liveStats({ leadsLog: [{ receivedAt: ago(1) }, { receivedAt: ago(2) }], adPerf: { totals: { spend30d: 5 } } });
  eq("two leads and five dollars is $2.50 a lead", s.cpl, 2.5);
  eq("leads count the log", s.leads, 2);

  // 🔴 null, never 0. A zero reads as "leads are free", which is worse than "unknown",
  // and it is what a stored-but-never-written field looks like.
  eq("no spend means unknown, not free", liveStats({ leadsLog: [{ receivedAt: ago(1) }] }).cpl, null);
  eq("no leads means unknown too", liveStats({ adPerf: { totals: { spend30d: 40 } } }).cpl, null);
  eq("an empty account is unknown", liveStats({}).cpl, null);
  eq("and does not crash on nothing at all", liveStats(null).leads, 0);

  // 🔴 The window has to match. Spend is a trailing 30-day figure, so dividing it by
  // ALL-TIME leads would understate cost per lead by however long the account has
  // existed, and the number would get quietly better every month for no reason.
  const old = liveStats({
    leadsLog: [{ receivedAt: ago(1) }, { receivedAt: ago(200) }, { receivedAt: ago(400) }],
    adPerf: { totals: { spend30d: 60 } },
  });
  eq("all-time leads are still counted for the lead total", old.leads, 3);
  eq("but only recent ones divide recent spend", old.leads30, 1);
  eq("so cost per lead is 60, not 20", old.cpl, 60);

  // The stored counter is a fallback, not the truth, and the log wins when they differ.
  eq("the log outranks the stale counter", liveStats({ leads: 99, leadsLog: [{ receivedAt: ago(1) }] }).leads, 1);
  eq("the counter is used only when there is no log", liveStats({ leads: 7 }).leads, 7);
}

// ── 2. The dead field is gone from every reader ───────────────────────────────
{
  ok("the server health score uses the live figures", /const live = liveStats\(cl\);/.test(SHARED_CODE));
  ok("and no longer reads the stored cpl", !/cl\.cpl/.test(SHARED_CODE));
  ok("the client report prompt computes it", /Average CPL: \$\{live\.cpl > 0/.test(SHARED));
  ok("and no longer reads the stored one", !/client\.cpl/.test(SHARED_CODE));
  ok("the owner rollup counts live leads", /liveStats\(c\)\.leads/.test(SHARED_CODE));
  ok("and compares live cost per lead", /lv\.leads > 0 && lv\.cpl > target/.test(SHARED_CODE));

  // The one that matters most.
  ok("the CPL alarm reads a number that can actually exist",
    /lv\.cpl > 0 && lv\.cpl >= 2 \* target/.test(ALERTS_CODE));
  ok("and the alarm's message quotes the same live figure",
    /liveStats\(cl\)\.cpl/.test(ALERTS));
  ok("alerts-watch no longer reads the dead field", !/cl\.cpl/.test(ALERTS_CODE));

  ok("the OS Reports tab no longer reads it", !/client\.cpl/.test(UI_CODE));
}

// ── 3. Both definitions of cost per lead must stay identical ──────────────────
// The OS computes this in the browser (`adPerfStats`) and the server computes it in
// `liveStats`. Two copies of one rule is exactly how a report ends up quoting a
// different number from the screen it is describing, so both are pinned by name.
{
  ok("the browser divides 30-day spend by 30-day leads",
    /cpl: \(leads30>0 && spend30>0\) \? spend30\/leads30 : null/.test(UI_CODE));
  ok("the server does the same",
    /cpl: \(leads30 > 0 && spend30 > 0\) \? Math\.round\(\(spend30 \/ leads30\) \* 100\) \/ 100 : null/.test(SHARED_CODE));
  // Same window on both sides, expressed the same way.
  const WINDOW = /30 \* 864e5|30\*864e5/;
  ok("the browser uses a 30 day window", WINDOW.test(UI_CODE));
  ok("the server uses a 30 day window", WINDOW.test(SHARED_CODE));
  // And they agree on a worked example, computed by the real server function.
  const s = liveStats({ leadsLog: [{ receivedAt: ago(3) }, { receivedAt: ago(40) }], adPerf: { totals: { spend30d: 12 } } });
  eq("one recent lead against twelve dollars is $12", s.cpl, 12);
}

// ── 4. Nothing seeds a fake number onto a real account ────────────────────────
{
  // The demo records carry invented leads and CPL on purpose, and are flagged `demo`.
  // A REAL account must never be created carrying numbers nobody earned.
  const houseSeed = UI.match(/function makeInternalClient\(\)[\s\S]*?\n\}/);
  ok("the house account is created with no leads", !!houseSeed && /leads: 0, cpl: 0/.test(houseSeed[0]));
  const addSeed = UI.match(/onSave\(\{\.\.\.form,id:uid\(\)[\s\S]{0,400}/);
  ok("a new client is created with no leads", !!addSeed && /leads:0,cpl:0/.test(addSeed[0]));
  // Every hardcoded non-zero figure in a seed must belong to a demo record.
  const seeds = [...UI.matchAll(/leads: ?(\d+), ?cpl: ?(\d+)/g)].map((m) => ({ at: m.index, leads: +m[1], cpl: +m[2] }));
  ok("there are seed records to check", seeds.length > 0);
  for (const s of seeds) {
    if (s.leads === 0 && s.cpl === 0) continue;
    const near = UI.slice(Math.max(0, s.at - 1200), s.at);
    ok(`a seed with ${s.leads} leads is a demo record`, /demo\s*:\s*true/.test(near),
      "a non-zero seed outside a demo record puts invented numbers on a real account");
  }
}

console.log(`verify-live-stats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
