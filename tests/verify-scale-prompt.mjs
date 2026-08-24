// Guards the "scale or keep as is" prompt (Bryson, 2026-08-24: "for my own ads when it
// thinks we should scale i want to get an alert prompting me to either scale or keep it
// as is"). KB `scale-prompt`.
//
// 🔴 THIS IS THE ONE DIRECTION THE AUTOPILOT IS FORBIDDEN TO MOVE ON ITS OWN. The founding
// invariant is that it may always spend LESS and may NEVER spend more without asking. So
// every assertion here is really about one question: does this ASK, and does it ask only
// when spending more would actually achieve something?
//
// The check is sliced out of the shipped function and executed rather than re-implemented
// (KB `repo-tests`), because a copy of the rule in the test would happily stay correct
// while the real one drifted, and the real one decides whether to suggest spending money.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const SRC_CODE = strip(SRC);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── Run the real check ────────────────────────────────────────────────────────
const slice = (startRe, endRe) => {
  const i = SRC.search(startRe);
  if (i < 0) throw new Error(`could not find ${startRe}`);
  const j = SRC.slice(i).search(endRe);
  if (j < 0) throw new Error(`could not find the end of ${startRe}`);
  return SRC.slice(i, i + j);
};
const src = [
  slice(/^const SCALE_MIN_LEADS = /m, /\n\n/),
  slice(/^function scaleCheck\(/m, /\n\}\n/) + "\n}\n",
].join("\n");
// `liveStats` and `PER_LEAD` are the real ones the function imports.
const { liveStats, PER_LEAD } = await import("../netlify/lib/report-shared.mjs");
const scaleCheck = new Function("liveStats", "PER_LEAD", `${src}\nreturn scaleCheck;`)(liveStats, PER_LEAD);

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const leads = (n) => Array.from({ length: n }, () => ({ receivedAt: ago(3) }));

// A house account that is genuinely doing well and running out of money: 5 leads at
// $30 each against a $75 target, spending 95% of budget.
const good = (over = {}) => ({
  cl: { internal: true, name: "BoldLine Media", niche: "Marketing Agency",
        leadsLog: leads(5), adPerf: { totals: { spend30d: 150 } }, ...(over.cl || {}) },
  perf: {
    totals: { liveCampaigns: 1, spend30d: 150 },
    budget: { monthly: 160, pacing: 152, pct: 95, state: "warn" },
    ...(over.perf || {}),
  },
  camps: over.camps !== undefined ? over.camps : [{ id: "c1", name: "Agency Search", dailyBudget: 5, platform: "meta" }],
});
const run = (o = {}) => { const g = good(o); return scaleCheck(g.cl, g.perf, g.camps); };

// ── 1. It fires when spending more would actually buy more ────────────────────
{
  const r = run();
  ok("a performing, budget-limited account is worth scaling", r.ready === true);
  eq("and it reports the real lead count", r.leads30, 5);
  eq("the real cost per lead", r.cpl, 30);
  eq("against the target the rest of the OS uses", r.target, PER_LEAD["Marketing Agency"] || 75);
}

// ── 2. 🔴 THE CONDITION MOST ADVICE GETS WRONG ────────────────────────────────
// Raising a budget that is not being spent changes NOTHING. If the money is not running
// out, the constraint is targeting, creative or bid, and a bigger number just sits there
// unused while looking like action was taken.
{
  eq("an account with budget to spare is NOT worth scaling",
    run({ perf: { totals: { liveCampaigns: 1, spend30d: 150 }, budget: { monthly: 400, pacing: 152, pct: 38, state: "ok" } } }).ready, false);
  // Already over budget is handled by the RED over-budget alert. Two alerts saying
  // opposite things about one account is worse than one.
  eq("an account already over budget is left to the over-budget alert",
    run({ perf: { totals: { liveCampaigns: 1, spend30d: 300 }, budget: { monthly: 160, pacing: 300, pct: 188, state: "over" } } }).ready, false);
  eq("and an account with no budget set is not prompted either",
    run({ perf: { totals: { liveCampaigns: 1, spend30d: 150 }, budget: { monthly: 0, pacing: 150, pct: null, state: "unset" } } }).ready, false);
}

// ── 3. Enough evidence to be evidence ─────────────────────────────────────────
{
  // One lucky lead is not a track record, and it makes cost per lead look spectacular.
  eq("two leads is not enough to call it working",
    run({ cl: { internal: true, niche: "Marketing Agency", leadsLog: leads(2), adPerf: { totals: { spend30d: 20 } } } }).ready, false);
  eq("three is the floor",
    run({ cl: { internal: true, niche: "Marketing Agency", leadsLog: leads(3), adPerf: { totals: { spend30d: 150 } } } }).ready, true);
  // Leads that arrived months ago say nothing about what the ads are doing now.
  eq("old leads do not count toward it",
    run({ cl: { internal: true, niche: "Marketing Agency",
                leadsLog: [{ receivedAt: ago(200) }, { receivedAt: ago(180) }, { receivedAt: ago(90) }, { receivedAt: ago(2) }],
                adPerf: { totals: { spend30d: 150 } } } }).ready, false);
  eq("nothing running is never worth scaling",
    run({ perf: { totals: { liveCampaigns: 0, spend30d: 150 }, budget: { monthly: 160, pacing: 152, pct: 95, state: "warn" } } }).ready, false);
}

// ── 4. Performing, not merely busy ────────────────────────────────────────────
{
  // Same volume, same budget pressure, but each lead costs more than it is worth.
  // Scaling that is buying more of a losing trade.
  eq("expensive leads are not scaled into",
    run({ cl: { internal: true, niche: "Marketing Agency", leadsLog: leads(4), adPerf: { totals: { spend30d: 600 } } } }).ready, false);
  // Exactly on target still counts as on target.
  const onTarget = run({ cl: { internal: true, niche: "Marketing Agency", leadsLog: leads(2).concat(leads(2)), adPerf: { totals: { spend30d: 300 } } } });
  eq("dead on the target is still worth scaling", onTarget.ready, true);
  eq("and the cost per lead is the real one", onTarget.cpl, 75);
}

// ── 5. The suggested step is a step, not a leap ───────────────────────────────
{
  const r = run();
  eq("it names the one live campaign", r.campaign.name, "Agency Search");
  eq("and raises it by a quarter", r.campaign.newDaily, 6);   // 5 -> 6.25 -> 6
  eq("keeping the current figure so the change is visible", r.campaign.curDaily, 5);
  // A tiny budget must still move by at least a dollar rather than rounding to nothing.
  const tiny = run({ camps: [{ id: "c1", name: "Tiny", dailyBudget: 1, platform: "meta" }] });
  eq("a $1 budget still moves", tiny.campaign.newDaily, 2);

  // 🔴 With several campaigns running, picking one would be a guess about his own
  // strategy. The alert still goes out; the one-click change does not.
  const many = run({ camps: [
    { id: "c1", name: "A", dailyBudget: 5, platform: "meta" },
    { id: "c2", name: "B", dailyBudget: 5, platform: "google" },
  ] });
  ok("several campaigns still says it is worth scaling", many.ready === true);
  eq("but offers no one-click change", many.campaign, null);
  eq("and neither does a campaign with no daily budget of its own",
    run({ camps: [{ id: "c1", name: "A", dailyBudget: 0, platform: "meta" }] }).campaign, null);
}

// ── 6. It asks. It never acts. ────────────────────────────────────────────────
// The founding invariant: always allowed to spend less, never allowed to spend more
// without asking.
{
  ok("the job still never writes a campaign itself",
    !/setBudget|setStatus|activateCampaign/.test(SRC_CODE));
  ok("the decision goes into the approval queue", /pendingActions: nextPending/.test(SRC_CODE));
  ok("as a budget change the queue already knows how to execute",
    /kind: "set_daily_budget"/.test(SRC_CODE));
  // That kind is executed by the OS's existing approval path, on both platforms.
  ok("and the OS really does execute that kind", /ex\.kind==="set_daily_budget"/.test(UI));
  ok("on Meta", /metaCall\(\{action:"setBudget",campaignId:camp\.id/.test(UI));
  ok("and on Google", /gadsCall\(\{action:"setBudget",customerId:cl\.googleAdsCustomerId/.test(UI));

  // Asked once, not every hour.
  ok("it is transition-only", /if \(cur\.scaleReady && !prev\.scaleReady\)/.test(SRC_CODE));
  ok("and never queues the same decision twice",
    /const already = \(cl\.pendingActions \|\| \[\]\)\.some\(\(a\) => a && a\.id === id\)/.test(SRC_CODE));
  ok("the queue item is only added, never replacing what is there",
    /\.\.\.\(cl\.pendingActions \|\| \[\]\)\]/.test(SRC_CODE));

  // Both choices offered in words, which is what he asked for.
  ok("the alert offers both choices", /Either is a fair call/.test(SRC));
  ok("and says nothing changes on its own", /Nothing changes until you choose/.test(SRC));
  ok("the queue item says what dismissing does", /Dismissing keeps everything exactly as it is/.test(SRC));
  ok("the alert explains why the step is only 25%", /restarts the platform's learning/.test(SRC));
  ok("it is informational, not an emergency", /severity: "blue"/.test(SRC_CODE));
}

console.log(`verify-scale-prompt: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
