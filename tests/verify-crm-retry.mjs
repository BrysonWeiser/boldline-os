// A queue that re-sends a lead the client's system did not accept the first time.
//
// Bryson told Shaun Smith, 2026-09-03, declining his unsigned-browser-post request:
//   *"I make my relay retry harder and queue anything that doesn't get through, so a blip on
//   my side delays a lead rather than losing it."*
//
// 🔴 THE SHARPEST BUG THIS COULD HAVE IS NOT LOSING A LEAD, IT IS SENDING ONE THAT WAS NEVER
// MEANT TO GO. A lead with no `crm` record was never attempted, because no CRM was configured
// when it arrived. Sweep those and the day a client finally connects their CRM, every lead
// they have ever received lands in their pipeline at once, months of it, looking to them like
// our software went haywire. That gate is checked first and from both directions.
//
// 🔴 THE SECOND IS A DUPLICATE. A second copy in somebody's sales pipeline is worse than a
// late lead, which is the rule the original forward was built on.
//
// 🔴 THE THIRD IS SILENCE. Giving up is allowed. Giving up without telling anybody is not.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const {
  dueForRetry, nextCrmState, sweepClientLeads, retryDelayMs, needsAHuman,
  CRM_RETRY_MAX_TRIES, CRM_RETRY_DELAYS_MS,
} = await import("../netlify/lib/crm-retry.mjs");

const T0 = Date.parse("2026-09-04T12:00:00.000Z");
const ago = (ms) => new Date(T0 - ms).toISOString();
const HOUR = 3600000, MIN = 60000;

// A client with a real CRM target, so `crmTarget` does not veto the whole sweep.
const client = (leadsLog) => ({
  name: "Stencil & Thread",
  campaignSetup: { crmWebhook: "https://stencilandthread.com/api/ad-lead", crmWebhookSecret: "s3cret" },
  leadsLog,
});
const lead = (crm, extra = {}) => ({ leadId: "L1", receivedAt: "2026-09-04T11:00:00.000Z", name: "Dana", phone: "+15415550123", ...(crm ? { crm } : {}), ...extra });

// ── 1. 🔴 WHICH LEADS ARE EVEN ELIGIBLE ──────────────────────────────────────
{
  ok("🔴 a lead that was NEVER attempted is never swept",
    !dueForRetry(lead(null), T0),
    "the day a client connects a CRM, every lead they ever received would land at once");
  ok("🔴 and that holds no matter how old it is",
    !dueForRetry({ receivedAt: "2024-01-01T00:00:00.000Z", name: "Old" }, T0),
    "age is not the gate, having been attempted is");

  ok("🔴 a lead already delivered is never swept",
    !dueForRetry(lead({ ok: true, at: ago(10 * HOUR), tries: 0 }), T0),
    "a duplicate in somebody's sales pipeline is worse than a late lead");

  ok("a failed lead past its wait is due", dueForRetry(lead({ ok: false, at: ago(10 * MIN), tries: 0 }), T0));
  ok("🔴 but not before its wait is up",
    !dueForRetry(lead({ ok: false, at: ago(1 * MIN), tries: 0 }), T0),
    "hammering a CRM that is down is how a blip becomes a block");

  ok("🔴 a lead we gave up on stays given up",
    !dueForRetry(lead({ ok: false, at: ago(30 * HOUR), tries: CRM_RETRY_MAX_TRIES, gaveUp: true }), T0),
    "it was already reported once; reporting it every fifteen minutes forever is how alerts "
    + "get ignored");
  ok("and the cap holds even without the gaveUp flag",
    !dueForRetry(lead({ ok: false, at: ago(30 * HOUR), tries: CRM_RETRY_MAX_TRIES }), T0));

  // A record written by an older build, or corrupted, must not strand a real lead forever.
  ok("an unreadable timestamp retries rather than strands the lead",
    dueForRetry(lead({ ok: false, at: "not a date", tries: 0 }), T0));
}

// ── 2. The back-off actually backs off ───────────────────────────────────────
{
  ok("🔴 every delay is longer than the one before",
    CRM_RETRY_DELAYS_MS.every((d, i) => i === 0 || d > CRM_RETRY_DELAYS_MS[i - 1]),
    "a flat retry is just hammering on a timer");
  const total = CRM_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
  ok("🔴 the whole run covers a night and the morning after",
    total >= 24 * HOUR && total <= 48 * HOUR,
    `a CRM down overnight must still get its leads; total is ${Math.round(total / HOUR)}h`);
  eq("past the last attempt there is no next one", retryDelayMs(CRM_RETRY_MAX_TRIES), null);
  eq("the first wait is five minutes", retryDelayMs(0), 5 * MIN);
  // 🔴 THE CAP IS THE LENGTH OF THE LIST, and it has to stay that way. If the cap were its
  // own number, adding a delay without bumping it would strand the last attempt, and dropping
  // one would leave a try with no wait to obey. Pinned at the source so the single gate in
  // `dueForRetry` is provably the only one needed.
  eq("🔴 the cap and the delay list cannot drift apart", CRM_RETRY_MAX_TRIES, CRM_RETRY_DELAYS_MS.length);

  // The gap grows, so a lead five tries in is not due at the four-try interval.
  ok("a later try waits longer than an earlier one",
    !dueForRetry(lead({ ok: false, at: ago(30 * MIN), tries: 4 }), T0)
      && dueForRetry(lead({ ok: false, at: ago(30 * MIN), tries: 0 }), T0));
}

// ── 3. What gets written back onto the lead ──────────────────────────────────
{
  const after = nextCrmState({ ok: false, tries: 2, at: ago(HOUR) }, { ok: false, status: 500, error: "the CRM replied 500" }, new Date(T0));
  eq("a failed retry counts up", after.tries, 3);
  eq("and stays failed", after.ok, false);
  ok("it is marked as having been retried", after.retried === true);
  ok("🔴 it is NOT given up before the cap", !after.gaveUp);

  const capped = nextCrmState({ ok: false, tries: CRM_RETRY_MAX_TRIES - 1 }, { ok: false, status: 500 }, new Date(T0));
  ok("🔴 the last failure is marked given up", capped.gaveUp === true,
    "without this it is retried forever, and forever is how an alert becomes noise");

  const won = nextCrmState({ ok: false, tries: 3, error: "the CRM replied 500" }, { ok: true, status: 200 }, new Date(T0));
  eq("a successful retry is recorded as delivered", won.ok, true);
  eq("🔴 and keeps how many goes it took", won.tries, 4);
  ok("🔴 which means a flaky endpoint is visible even when it works",
    won.retried === true,
    "delivered after four tries is a different fact from delivered, and it is the one that "
    + "says an endpoint is unreliable while still working");
  ok("the old error does not survive the success", !won.error);
}

// ── 4. 🔴 A CONFIGURATION ERROR IS NOT AN OUTAGE ─────────────────────────────
{
  ok("🔴 a rejected password is flagged for a person", needsAHuman({ status: 401 }));
  ok("and so is a forbidden", needsAHuman({ status: 403 }));
  ok("🔴 but a server having a bad moment is not",
    !needsAHuman({ status: 500 }) && !needsAHuman({ status: 502 }) && !needsAHuman({}),
    "waking somebody for an outage that fixes itself is how they learn to ignore the alert "
    + "that matters");
}

// ── 5. The sweep, end to end, against a fake endpoint ────────────────────────
{
  // Only leads 1 and 3 qualify: 0 was never attempted, 2 already went, 4 is not due yet.
  const log = [
    lead(null, { leadId: "never-attempted" }),
    lead({ ok: false, at: ago(HOUR), tries: 0 }, { leadId: "due" }),
    lead({ ok: true, at: ago(HOUR), tries: 1 }, { leadId: "already-sent" }),
    lead({ ok: false, at: ago(HOUR), tries: 1 }, { leadId: "also-due" }),
    lead({ ok: false, at: ago(MIN), tries: 0 }, { leadId: "too-soon" }),
  ];
  const seen = [];
  const forward = async (_c, l) => { seen.push(l.leadId); return { ok: true, status: 200, at: new Date(T0).toISOString() }; };
  const res = await sweepClientLeads(client(log), { now: T0, forward });

  eq("🔴 exactly the eligible leads were sent", seen.sort().join(","), "also-due,due");
  eq("and the count matches", res.sent, 2);
  eq("nothing failed", res.failed, 0);
  ok("the log is marked changed", res.changed === true);
  ok("🔴 the untouched leads are returned untouched",
    !res.leadsLog[0].crm && res.leadsLog[2].crm.tries === 1 && res.leadsLog[4].crm.tries === 0,
    "a sweep that rewrites rows it did not send is a sweep that can corrupt them");
  ok("the sent ones now read as delivered",
    res.leadsLog[1].crm.ok === true && res.leadsLog[3].crm.ok === true);

  // 🔴 The whole point: run it again immediately and nothing goes twice.
  const again = [];
  const res2 = await sweepClientLeads({ ...client(res.leadsLog) }, { now: T0, forward: async (_c, l) => { again.push(l.leadId); return { ok: true, status: 200 }; } });
  eq("🔴 a second sweep sends nothing", again.length, 0,
    "this is the duplicate-in-the-pipeline failure, and it is the one that costs a client's trust");
  ok("and reports no change", res2.changed === false);
}

// ── 6. A client with no CRM is left entirely alone ───────────────────────────
{
  const seen = [];
  const noCrm = { name: "Nobody", campaignSetup: {}, leadsLog: [lead({ ok: false, at: ago(HOUR), tries: 0 })] };
  const res = await sweepClientLeads(noCrm, { now: T0, forward: async (_c, l) => { seen.push(l.leadId); return { ok: true }; } });
  eq("🔴 nothing is attempted with nowhere to send it", seen.length, 0);
  ok("and nothing is rewritten", res.changed === false);

  // http is not https. crmTarget already refuses it; the sweep must inherit that refusal
  // rather than quietly reimplementing its own idea of a valid target.
  const insecure = { name: "Plain", campaignSetup: { crmWebhook: "http://example.com/in" }, leadsLog: [lead({ ok: false, at: ago(HOUR), tries: 0 })] };
  const res3 = await sweepClientLeads(insecure, { now: T0, forward: async () => { seen.push("x"); return { ok: true }; } });
  ok("🔴 and an insecure endpoint is still refused on retry",
    seen.length === 0 && res3.changed === false,
    "a customer's name, email and phone must not cross the open internet on a retry either");
}

// ── 7. Failures, the cap, and what gets reported ─────────────────────────────
{
  // 🔴 Aged past the LAST delay, not the first. The back-off grows, so a lead seven tries in
  // is not due an hour later; using an hour here made this read as "the cap is broken" when
  // the cap was working and the fixture was wrong.
  const log = [lead({ ok: false, at: ago(30 * HOUR), tries: CRM_RETRY_MAX_TRIES - 1 }, { leadId: "last-chance" })];
  const res = await sweepClientLeads(client(log), { now: T0, forward: async () => ({ ok: false, status: 500, error: "the CRM replied 500" }) });
  eq("a final failure gives up", res.gaveUp, 1);
  ok("🔴 and says what went wrong in words", /500/.test(res.lastError),
    "an alert that says something failed without saying what is an alert nobody can act on");

  const authLog = [lead({ ok: false, at: ago(HOUR), tries: 0 }, { leadId: "bad-password" })];
  const authRes = await sweepClientLeads(client(authLog), { now: T0, forward: async () => ({ ok: false, status: 401, error: "unauthorised" }) });
  ok("🔴 a wrong password is reported on the FIRST sweep, not a day later",
    authRes.needsAHuman === true,
    "a day of silent retries on a password nobody is going to change on its own is a day of "
    + "lost customers");
  eq("and it is not given up on yet", authRes.gaveUp, 0);

  // 🔴 A thrown fetch is a failure, not a crashed sweep. One client's broken endpoint must
  // not stop every other client's backlog from moving.
  const boom = await sweepClientLeads(client([lead({ ok: false, at: ago(HOUR), tries: 0 })]), {
    now: T0, forward: async () => { throw new Error("socket hang up"); },
  });
  eq("a thrown error is recorded as a failed try", boom.failed, 1);
  ok("and the reason survives", /socket hang up/.test(boom.lastError));

  // `forwardLead` answers null when it decides there is nothing to do. That must not burn a try.
  const skipped = await sweepClientLeads(client([lead({ ok: false, at: ago(HOUR), tries: 1 })]), {
    now: T0, forward: async () => null,
  });
  ok("🔴 a deliberate skip does not burn an attempt",
    skipped.changed === false && skipped.failed === 0,
    "counting a skip as a failure walks a healthy lead to the give-up cap for no reason");
}

// ── 8. One client cannot starve the others ───────────────────────────────────
{
  const many = Array.from({ length: 60 }, (_, i) => lead({ ok: false, at: ago(HOUR), tries: 0 }, { leadId: `L${i}` }));
  const seen = [];
  const res = await sweepClientLeads(client(many), { now: T0, max: 25, forward: async (_c, l) => { seen.push(l.leadId); return { ok: false, status: 500 }; } });
  eq("🔴 the per-client cap holds", seen.length, 25,
    "one client with a large stuck backlog would otherwise eat the run and starve every "
    + "other client's single stuck lead");
  ok("the ones it did not reach are untouched", res.leadsLog[59].crm.tries === 0);
}

// ── 9. The job is actually wired up ──────────────────────────────────────────
// A queue nothing runs is a promise, not a feature, and this one was promised to a partner.
{
  const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
  ok("🔴 the sweep is on a schedule", /\[functions\."crm-retry"\]\s*\n\s*schedule = "\*\/15 \* \* \* \*"/.test(toml),
    "nothing else in the system ever calls this, so without the schedule it never runs at all");

  const fn = readFileSync(join(ROOT, "netlify/functions/crm-retry.mjs"), "utf8");
  const body = fn.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("it sweeps through the shared logic rather than its own copy", /sweepClientLeads\(/.test(body));
  ok("🔴 it skips clients with no CRM before doing any work", /if \(!crmTarget\(client\)\) continue;/.test(body));

  // 🔴 READ, MODIFY, WRITE ACROSS A NETWORK CALL IS HOW OTHER PEOPLE'S EDITS GET CLOBBERED.
  // The sweep holds a client record while several HTTP requests run. Writing that whole
  // record back would undo an approval, a campaign or a billing change made meanwhile.
  ok("🔴 it re-reads the client before writing", /select\("data"\)\.eq\("id", row\.id\)/.test(body),
    "writing back a record read before the network calls would clobber whatever changed "
    + "while they ran");
  ok("🔴 and writes back only the lead log", /leadsLog: res\.leadsLog/.test(body)
      && /\.\.\.\(fresh\.data \|\| \{\}\)/.test(body),
    "this job owns one key and must touch no others");

  ok("alerts are sent after the sweep, not inside it", body.indexOf("for (const a of alerts)") > body.indexOf("for (const row of rows"),
    "an alert that throws mid-loop turns one client's misconfiguration into everybody's outage");
  ok("a crash in the job itself is reported", /withFailureAlert\("crm-retry"/.test(body));

  // 🔴 The sweep must never re-run the things the intake does once. A retried lead is a lead
  // the customer was already texted about and Bryson was already told about.
  ok("🔴 it forwards only, it does not re-notify anybody",
    !/notifyLead|notifyOwnerOfLead|sendSMS|leadEmailHTML/.test(body),
    "re-texting a customer three hours later because their details were slow reaching a CRM "
    + "is the kind of thing that gets a number blocked");
}

console.log(fail === 0
  ? `✓ verify-crm-retry: ${pass} checks passed`
  : `✗ verify-crm-retry: ${pass} passed, ${fail} FAILED`);
if (fail) process.exit(1);
