// Is every scheduled job actually WIRED IN, or does it just look like it is?
// Run: node tests/verify-scheduled-wiring.mjs
//
// 🔴 2026-09-13. Bryson: *"Which email did the backup email go to because I didn't get it"*.
// The answer was that no email was ever sent, because the backup had never run. Not once.
// Neither had the daily health check. Both had been merged, deployed, tested and logged.
//
// THE DEFECT IS ONE PAIR OF ARROW BRACKETS.
//
//   export default withFailureAlert("job", async () => { ... });            works
//   export default async () => withFailureAlert("job", async () => { ... }); never runs
//
// `withFailureAlert` RETURNS a function. In the second form the export hands that function
// back to Netlify instead of running it. The body never executes. Nothing throws. No alert
// can fire, because the alerting lives inside the wrapper that was never invoked. A job in
// this state is indistinguishable from a job with nothing to report, which is precisely the
// failure mode every heartbeat in this codebase exists to prevent, arriving through the door
// nobody was watching: the wiring itself.
//
// 🔴 AND THE SUITE THAT SHOULD HAVE CAUGHT IT ASSERTED THE WRONG THING. `verify-backup`
// checked that the text `withFailureAlert("backup-run"` appears in the file. It does. It
// appears in the broken version too. A grep for a call is not evidence the call is reachable,
// and this is the third time in a week that reading source has passed while the running thing
// was dead (KB `portal-script-parse`). So this suite executes nothing and greps nothing: it
// IMPORTS each job and asks the wrapper itself whether it is on the outside.

import { readFileSync } from "node:fs";
import { withFailureAlert } from "../netlify/lib/alerts-shared.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE TAG TELLS THE TWO SHAPES APART
// ══════════════════════════════════════════════════════════════════════════════
{
  const body = async () => new Response("ran");
  const right = withFailureAlert("demo", body);
  eq("a correctly wired job carries its name", right.wrappedJob, "demo");
  eq("and running it runs the body", (await right()).status, 200);

  // The exact broken shape that shipped twice.
  const wrong = async () => withFailureAlert("demo", body);
  eq("🔴 the broken shape carries no name", wrong.wrappedJob, undefined,
    "this is the only difference visible from outside, and it is the whole test");
  ok("and calling it returns a function instead of a reply", typeof (await wrong()) === "function",
    "Netlify gets a function where a Response should be, and the job silently does nothing");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 EVERY SCHEDULED JOB IN netlify.toml, CHECKED AGAINST ITS OWN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
// Read from the schedule list, not a hand-written list here: a job added next month is
// covered the moment it is scheduled, with nobody having to remember this file exists.
const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const scheduled = [...toml.matchAll(/\[functions\."([a-z0-9-]+)"\]\s*\n\s*schedule\s*=\s*"([^"]+)"/g)]
  .map((m) => ({ name: m[1], cron: m[2] }));

ok("there are scheduled jobs to check", scheduled.length >= 15, `found ${scheduled.length}`);

const unwired = [];
for (const job of scheduled) {
  let mod;
  try { mod = await import(new URL(`../netlify/functions/${job.name}.mjs`, import.meta.url)); }
  catch (e) { unwired.push(`${job.name}: will not even import (${String(e.message).slice(0, 70)})`); continue; }

  if (typeof mod.default !== "function") { unwired.push(`${job.name}: has no default export to run`); continue; }

  // Not every job is wrapped — that is a choice, not a fault. But a job that MENTIONS the
  // wrapper and does not carry the tag has the wrapper on the inside, which is the bug.
  const src = readFileSync(new URL(`../netlify/functions/${job.name}.mjs`, import.meta.url), "utf8");
  if (!src.includes("withFailureAlert")) continue;
  if (mod.default.wrappedJob !== job.name) {
    unwired.push(`${job.name}: wrapped but the export does not carry it (got ${JSON.stringify(mod.default.wrappedJob)}) — the body never runs`);
  }
}
eq("🔴 every scheduled job is actually wired in", unwired, [],
  "a job in this state looks exactly like a job with nothing to report");

// The two that shipped broken, named so a regression is unmistakable.
for (const name of ["backup-run", "daily-check"]) {
  const mod = await import(new URL(`../netlify/functions/${name}.mjs`, import.meta.url));
  eq(`🔴 ${name} runs when Netlify calls it`, mod.default.wrappedJob, name,
    "this one shipped broken on 2026-09-11 and never ran once");
  ok(`and ${name} is not wrapped in a second arrow`, 
    !new RegExp(`export default async \\([^)]*\\) =>\\s*withFailureAlert`).test(
      readFileSync(new URL(`../netlify/functions/${name}.mjs`, import.meta.url), "utf8")),
    "the exact shape that broke it");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE WRAPPER STILL DOES ITS ACTUAL JOB
// ══════════════════════════════════════════════════════════════════════════════
// Tagging it must not have broken what it was for.
{
  const boom = withFailureAlert("demo", async () => { throw new Error("kaboom"); });
  const res = await boom();
  eq("a crashing job still answers rather than hanging", res.status, 500);
  eq("and it is still one name, not a stale one", boom.wrappedJob, "demo");
}
{
  const passes = withFailureAlert("demo", async (req) => new Response(req.url));
  eq("arguments still reach the body", await (await passes(new Request("https://x.test/y"))).text(), "https://x.test/y",
    "Netlify hands the request in, and a job that reads it would get nothing");
}
{
  const a = withFailureAlert("one", async () => new Response("x"));
  const b = withFailureAlert("two", async () => new Response("x"));
  ok("two wrapped jobs do not share a tag", a.wrappedJob === "one" && b.wrappedJob === "two",
    "a tag written onto a shared object would make every job answer to the last name used");
}

console.log(`verify-scheduled-wiring: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
