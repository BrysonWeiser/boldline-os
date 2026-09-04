// A promise made to a prospect cannot be dropped in silence.
//
// Bryson, 2026-09-04: *"can we fix it so the lead thing automatically sends like it's
// supposed to"*, after a real prospect (a Scottsdale roofing company) asked for the free
// Lead-Leak Check at 1:20pm and, an hour later, had received nothing.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 WHAT FAILED, AND WHY NOTHING NOTICED.
//
// The bot's ONLY trigger was a POST from the MARKETING site to the OS site, gated on
// `AUDIT_TRIGGER_SECRET` being set identically on two separate Netlify sites. It was not
// set. So the gate on the marketing site was false, no request was made, and NOTHING was
// written anywhere: no error, no failed status, no log line. The lead record carried no
// audit stamp at all, which is the only reason it was possible to work out afterwards what
// had happened.
//
// 🔴 A FEATURE WHOSE ONLY TRIGGER IS A CROSS-SITE CALL GATED ON A HAND-COPIED SECRET IS A
// FEATURE THAT IS OFF BY DEFAULT, and it cannot report its own absence, because the code
// that would do the reporting is the code that never runs. Setting the env var fixes today
// and leaves the trap in place. So the trigger no longer has to work at all.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const BG = readFileSync(join(ROOT, "netlify/functions/lead-leak-audit-background.mjs"), "utf8");
const SWEEP = readFileSync(join(ROOT, "netlify/functions/lead-leak-sweep.mjs"), "utf8");
const TOML = readFileSync(join(ROOT, "netlify.toml"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const { needsAudit, MAX_AUDIT_TRIES, SWEEP_WINDOW_MS } = await import("../netlify/functions/lead-leak-sweep.mjs");

const NOW = Date.parse("2026-09-04T21:00:00Z");
const row = (o = {}) => ({
  id: "1", form: "lead_leak", email: "them@x.com",
  created_at: new Date(NOW - 20 * 60e3).toISOString(),
  payload: {}, ...o,
});

// ── 1. 🔴 THE LEAD THAT GOT NOTHING ──────────────────────────────────────────
t("🔴 THE CASE ITSELF: a request the trigger never delivered gets picked up", () => {
  // No audit stamp of any kind is exactly what a missing shared secret leaves behind.
  assert.equal(needsAudit(row(), NOW), true,
    "a prospect who asked for the free report and received nothing is still ignored");
});

t("🔴 the sweep needs no shared secret, because that is the thing that was missing", () => {
  // 🔴 Comments stripped first. This file EXPLAINS the missing secret at length, and a check
  // that read its own explanation as a dependency would fail for entirely the wrong reason.
  assert.ok(!/AUDIT_TRIGGER_SECRET/.test(code(SWEEP)),
    "the safety net depends on the same env var whose absence caused the outage");
  assert.match(SWEEP, /SUPABASE_SERVICE_ROLE_KEY/, "it has no way to reach the leads at all");
});

t("🔴 and it runs on a schedule, or it is just another thing nobody calls", () => {
  assert.match(TOML, /\[functions\."lead-leak-sweep"\]\s*\n\s*schedule = "\*\/10 \* \* \* \*"/,
    "the sweep exists and is never run");
});

t("🔴 ONE implementation, not a second copy of the audit", () => {
  assert.match(SWEEP, /import \{ auditLead \} from "\.\/lead-leak-audit-background\.mjs";/,
    "the sweep has its own copy of the audit, which will drift from the one the POST path uses");
  assert.match(BG, /export async function auditLead\(supabase, \{ leadId, website, email, name \}\)/,
    "the audit body is not reachable by a second caller");
  assert.match(BG, /const r = await auditLead\(supabase, \{ leadId, website, email, name: body\.name \}\);/,
    "the POST path no longer goes through the shared function");
});

// ── 2. 🔴 IT MUST NOT EMAIL THE SAME STRANGER TWICE ──────────────────────────
t("🔴 a report already sent is never sent again", () => {
  // 🔴 The claim stamp is deliberately OLD here. With a fresh one the in-progress guard
  // below would catch these too, and this check would pass without the status ever being
  // read: a guard that holds for the wrong reason is one edit from holding for none.
  const old = new Date(NOW - 3 * 3600e3).toISOString();
  for (const st of ["sent", "review_sent"]) {
    assert.equal(needsAudit(row({ payload: { auditStatus: st, auditedAt: old } }), NOW), false,
      `a lead marked ${st} would be emailed a second time`);
  }
});

t("🔴 a claim in progress is left alone", () => {
  // `auditedAt` with status running is the other path saying "I am working on this". Taking
  // it would put two reports in one stranger's inbox.
  assert.equal(needsAudit(row({ payload: { auditStatus: "running", auditedAt: new Date(NOW - 60e3).toISOString() } }), NOW), false,
    "a lead being audited right now is picked up again in parallel");
});

t("...but a claim that never finished is not left forever", () => {
  // A background function cannot live longer than 15 minutes, so a claim older than 20 is a
  // crash. Without this the lead would be stuck "running" and never send.
  assert.equal(needsAudit(row({ payload: { auditStatus: "running", auditedAt: new Date(NOW - 30 * 60e3).toISOString() } }), NOW), true,
    "a crashed attempt strands the lead forever, which is the original bug wearing a hat");
});

t("a failed attempt is retried, up to a limit", () => {
  assert.equal(needsAudit(row({ payload: { auditStatus: "error", auditTries: 1 } }), NOW), true, "one failure gives up");
  assert.equal(needsAudit(row({ payload: { auditStatus: "error", auditTries: MAX_AUDIT_TRIES } }), NOW), false,
    "🔴 a permanently broken step is retried every ten minutes forever, burying the real failure in noise");
});

t("🔴 the try count survives a failure, or the limit can never be reached", () => {
  assert.match(BG, /auditedAt: null, auditStatus: "error", auditTries: tries, auditError: msg/,
    "the count is reset on the error path, so it retries forever and no alert ever fires");
  assert.match(BG, /const tries = Number\(payload\.auditTries \|\| 0\) \+ 1;/, "attempts are not counted at all");
});

t("only recent requests, because emailing a stranger about a fortnight-old ask is worse than silence", () => {
  assert.equal(needsAudit(row({ created_at: new Date(NOW - 2 * SWEEP_WINDOW_MS).toISOString() }), NOW), false,
    "an ancient request is emailed out of nowhere");
  assert.equal(needsAudit(row({ created_at: new Date(NOW + 60e3).toISOString() }), NOW), false,
    "a row dated in the future is treated as due");
});

t("🔴 a lead he has already worked is left alone", () => {
  // The first thing this sweep would have done on the day it shipped is email an automated
  // report to a prospect Bryson had written to by hand an hour earlier. Moving the lead off
  // "new" is him saying he has it, and it is one tap on the card.
  assert.equal(needsAudit(row({ status: "contacted" }), NOW), false,
    "a prospect he has already replied to is sent a canned report on top of his own email");
  assert.equal(needsAudit(row({ status: "new" }), NOW), true, "an untouched lead is skipped");
  assert.equal(needsAudit(row({ status: null }), NOW), true, "a row with no status set is skipped");
  assert.match(readFileSync(join(ROOT, "netlify/functions/lead-leak-sweep.mjs"), "utf8"),
    /\.select\("id, created_at, form, name, email, status, payload"\)/,
    "the sweep never reads the status it claims to check, so the guard can never fire");
});

t("other kinds of lead are not touched", () => {
  assert.equal(needsAudit(row({ form: "contact" }), NOW), false, "a normal contact form is sent a website audit");
  assert.equal(needsAudit(row({ form: "newsletter" }), NOW), false);
});

t("rubbish rows do not throw", () => {
  for (const r of [null, undefined, {}, { form: "lead_leak" }, { form: "lead_leak", payload: null }]) {
    assert.doesNotThrow(() => needsAudit(r, NOW), `threw on ${JSON.stringify(r)}`);
  }
});

// ── 3. 🔴 WHEN IT GENUINELY CANNOT SEND, IT SAYS SO ──────────────────────────
t("🔴 running out of attempts raises an alarm naming the prospect", () => {
  // The failure mode being replaced is silence. An alert that does not say who, or that
  // does not say they got nothing, would leave him unable to act on it.
  assert.match(SWEEP, /title: "A free website check could not be sent"/, "a stuck lead is still silent");
  assert.match(SWEEP, /\$\{s\.email\} asked for the free Lead-Leak Check/, "the alert does not say who");
  assert.match(SWEEP, /they have received nothing/, "the alert does not say the prospect is still waiting");
  assert.match(SWEEP, /Reason: \$\{s\.reason\}/, "the alert does not say what went wrong");
  assert.match(SWEEP, /severity: "red"/, "a prospect getting nothing is filed as a minor note");
});

t("only a genuinely exhausted lead alerts, not every retry", () => {
  assert.match(SWEEP, /if \(Number\(r && r\.tries\) >= MAX_AUDIT_TRIES\) \{/,
    "every transient failure alerts him, which trains him to ignore the alert");
});

t("the sweep's own failure is reported too", () => {
  assert.match(SWEEP, /withFailureAlert\("lead-leak-sweep"/,
    "the safety net can itself die quietly, which is the whole bug again one level up");
});

// ── 4. 🔴 AND HE CAN SEE IT ON THE LEAD ──────────────────────────────────────
t("🔴 the card says whether they actually got their report", () => {
  // Working this out required reading the raw record and knowing which stamp to look for.
  assert.match(UI, /if\(String\(lead&&lead\.form\|\|""\)!=="lead_leak"\) return null;/,
    "the report status is shown on leads that never asked for a report");
  assert.match(S, /Their free report was sent automatically\./, "a sent report is not confirmed");
  assert.match(S, /They are still waiting\./, "a failed report does not say the prospect is still waiting");
  assert.match(S, /it has not gone out yet/, "a pending report looks identical to a sent one");
});

t("a waiting report is amber and a failed one is red, because they are different problems", () => {
  const i = S.indexOf('if(st==="error")');
  assert.ok(i > 0, "the failed state is gone");
  assert.match(S.slice(i, i + 200), /color:C\.red/, "a prospect who got nothing is not flagged");
  const j = S.indexOf("They asked for the free report and it has not gone out yet");
  assert.match(S.slice(j - 120, j), /color:C\.amber/, "a report still on its way looks like a failure");
});

console.log(`✓ verify-lead-leak-delivery: ${n} checks passed`);
