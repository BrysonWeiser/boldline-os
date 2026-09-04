// The monthly OS health report must report THE MONTH, and must not count BoldLine as a client.
//
// Bryson, 2026-09-04, after reading one:
//   *"make sure it takes information from the whole month and uses it not just what it sees
//    when it writes the report."*
//   *"it is also saying i have two clients but i only have 1 and then my own ads running"*
//
// 🔴 THE CLIENT COUNT. BoldLine's own advertising account is a row in `clients` with
// `internal: true`, because that is how the OS gives its own ads the same machinery every
// client gets. Counting it made a one-client agency look like a two-client agency, and every
// average was computed over a "client" that pays nothing, signs nothing and renews nothing.
//
// 🔴 THE PERIOD. It read `liveStats().leads`, the LIFETIME length of the lead log. On the
// first monthly report that is indistinguishable from the month; by month three it is a
// number that only ever goes up and says nothing about the month on the subject line.
//
// 🔴 AND THE HALF THAT CANNOT BE FIXED BY ARITHMETIC, which is the one worth remembering.
// Leads carry `receivedAt`, so a calendar month is exact. SPEND does not: all that is stored
// is a TRAILING 30-DAY reading from whenever the hourly sync last ran. No amount of dividing
// turns that into the month. So it is labelled as what it is and the prompt is told not to
// call it monthly. A number presented as something it is not is worse than no number.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "netlify/lib/report-shared.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const { buildOSDataBlock } = await import("../netlify/lib/report-shared.mjs");

// The report fires on the 1st, so it is about the month that just ended.
const RUN_AT = new Date("2026-09-01T16:00:00Z");
const lead = (iso) => ({ receivedAt: iso });
const rows = () => [
  { data: { name: "BoldLine Media", internal: true, contractStatus: "active",
      leadsLog: [lead("2026-08-05T10:00:00Z"), lead("2026-08-19T10:00:00Z"), lead("2026-09-02T10:00:00Z")] } },
  { data: { name: "Stencil & Thread", contractStatus: "active", contractStart: "2026-08-30",
      packageId: "g-launch", intakeComplete: true, email: "s@x.com", stage: "onboarding",
      adPerf: { syncedAt: "2026-09-01T05:00:00Z", totals: { spend30d: 812 } },
      leadsLog: [lead("2026-08-31T10:00:00Z"), lead("2026-08-02T10:00:00Z"),
                 lead("2026-07-15T10:00:00Z"), lead("2026-09-03T10:00:00Z")] } },
];
const out = buildOSDataBlock(rows(), RUN_AT);

// ── 1. 🔴 BoldLine is not a client ───────────────────────────────────────────
t("🔴 the house account is not counted as a client", () => {
  assert.match(out, /^Clients: 1\b/m,
    "BoldLine's own ad account is a client row with internal:true, and counting it turns a "
    + "one-client agency into a two-client agency");
  assert.match(out, /^Active Clients: 1$/m);
});

t("but it is still reported, as itself", () => {
  // Dropping it would lose the one account that always has data. It is named separately so
  // it can never be averaged in with paying clients again.
  assert.match(out, /BoldLine's Own Ads, Leads in August 2026: 2/,
    "the house account's own results vanished instead of being reported separately");
});

t("🔴 and the block SAYS the count excludes it", () => {
  // The model writes the prose. Left to infer, it will happily say "your two accounts".
  assert.match(out, /is NOT counted as a client/,
    "nothing tells the writer which rows are clients, so it can reintroduce the same error");
});

// ── 2. 🔴 The period is the month, not a snapshot ────────────────────────────
t("🔴 the report names the month it covers", () => {
  assert.match(out, /This report covers August 2026/,
    "running on 1 September, it must be about August, not the few hours of September so far");
});

t("🔴 leads are counted for that month, from the dates on the records", () => {
  // Two of the client's four leads fall in August. One is July, one is September.
  assert.match(out, /Client Leads in August 2026: 2/,
    "a lifetime total only ever goes up and says nothing about the month on the subject line");
});

t("and the month before is there to compare against", () => {
  assert.match(out, /Client Leads the Month Before: 1/,
    "a number with nothing to compare it to cannot show a trend, which is the point of monthly");
});

t("🔴 a September lead does NOT land in the August figure", () => {
  // The bug this replaces would have counted it, because it counted everything.
  const sept = buildOSDataBlock([{ data: { name: "X", contractStatus: "active",
    leadsLog: [lead("2026-09-15T10:00:00Z"), lead("2026-09-16T10:00:00Z")] } }], RUN_AT);
  assert.match(sept, /Client Leads in August 2026: 0/,
    "leads from after the reporting month are being counted in it");
});

t("the lifetime total is kept, and labelled as not being the month", () => {
  assert.match(out, /Total Client Leads All Time \(for context, NOT this month\): 4/,
    "either it is gone, or it is unlabelled and will be quoted as the month's result");
});

t("per-client figures are for the month too", () => {
  assert.match(out, /Leads per Client in August 2026: Stencil & Thread: 2/);
});

t("a client signed during the month is named", () => {
  assert.match(out, /New Clients Signed in August 2026: Stencil & Thread/);
});

// ── 3. 🔴 SPEND IS LABELLED, NOT GUESSED ─────────────────────────────────────
t("🔴 the spend reading says it is trailing 30 days, not the month", () => {
  assert.match(out, /TRAILING 30-DAY FIGURE/,
    "a rolling 30-day reading presented as the month's spend is a number that is simply wrong");
  assert.match(out, /NOT August 2026's spend/);
});

t("and it says WHEN it was read", () => {
  assert.match(out, /read at 2026-09-01T05:00:00Z/,
    "without the time, a stale sync is indistinguishable from a fresh one");
});

t("🔴 and the writer is told not to derive a monthly cost per lead from it", () => {
  assert.match(out, /do not compute a monthly cost per lead from it/,
    "spend over the wrong period divided by leads over the right one is a plausible-looking "
    + "number that is wrong in both directions");
});

// ── 4. The prompt carries the same two rules ────────────────────────────────
t("🔴 the prompt states both rules that were broken", () => {
  assert.match(SRC, /Report the month the data names/,
    "the data can be right and the prose still wrong: the model writes the report");
  assert.match(SRC, /BoldLine's own advertising account is not a client\. Never add it to the client count/);
});

t("the report is no longer asked for a snapshot of today", () => {
  assert.ok(!/state of the business portfolio right now/.test(SRC),
    "the format still asks for how things are RIGHT NOW, which is what produced a snapshot");
  assert.match(SRC, /over the month this report covers, not a snapshot of today/);
});

// ── 5. Degenerate inputs ────────────────────────────────────────────────────
t("no clients at all does not throw or invent a month", () => {
  const empty = buildOSDataBlock([], RUN_AT);
  assert.match(empty, /Clients: 0/);
  assert.match(empty, /This report covers August 2026/);
  assert.match(empty, /BoldLine's Own Ads, Leads in August 2026: no internal account/);
});

t("a lead with a missing or unreadable date is skipped, not counted", () => {
  const junk = buildOSDataBlock([{ data: { name: "X", contractStatus: "active",
    leadsLog: [lead(null), lead("nonsense"), {}, lead("2026-08-08T10:00:00Z")] } }], RUN_AT);
  assert.match(junk, /Client Leads in August 2026: 1/,
    "a bad timestamp must not become a phantom lead in the month");
});

t("🔴 January rolls back to December of the previous year", () => {
  // The off-by-one-year bug that every month-boundary calculation gets exactly once.
  const jan = buildOSDataBlock([{ data: { name: "X", contractStatus: "active",
    leadsLog: [lead("2025-12-14T10:00:00Z"), lead("2025-11-14T10:00:00Z")] } }],
    new Date("2026-01-01T16:00:00Z"));
  assert.match(jan, /This report covers December 2025/);
  assert.match(jan, /Client Leads in December 2025: 1/);
  assert.match(jan, /Client Leads the Month Before: 1/, "November 2025 is the month before December 2025");
});

console.log(`✓ verify-os-report-period: ${n} checks passed`);
