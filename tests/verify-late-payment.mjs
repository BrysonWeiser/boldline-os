// Late payments: three days, a flat fee, a pause that deletes nothing, and an ending that is a choice.
// Run: node tests/verify-late-payment.mjs
//
// Bryson, 2026-09-27: *"when a payment is late let's cut the time down from 10 days to 3 days
// without interest accumulating and then from there have one week of accumulated interest before
// the contract is automatically voided and all ads landing pages etc are stopped and deleted."*
// After pushback he agreed (*"Do that"*) to: day 3, a $50 fee (raised to $150 the same morning) and a PAUSE; day 10, he MAY end it.
//
// What this suite exists to stop, in order of how badly each would hurt:
//  1. A client who signed the OLD terms getting the new rules applied to them. Their ads paused on
//     day three when their contract says ten days and interest. That is the business breaching.
//  2. Anything ever being DELETED. The ad accounts are the client's property.
//  3. A resume switching on a campaign Bryson had deliberately left off.
//  4. The contract being ended by a machine.
//  5. The version bump silently rewriting a contract already out for signature (Air Suds, that day).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { makeContractHTML: server, termsVersionOf: serverVersion, TERMS_CURRENT } = require("../netlify/lib/contract-shared.cjs");
const LP = await import("../netlify/lib/late-payment.mjs");
const { pauseClientAds, resumeClientAds } = await import("../netlify/lib/billing-pause.mjs");
const { renderClientEmail } = await import("../netlify/lib/client-emails-shared.mjs");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const WATCH = read("netlify/functions/billing-watch.mjs");
const HOOK = read("netlify/functions/stripe-webhook.mjs");
const LANDING = read("netlify/functions/landing.mjs");
const PAUSE_SRC = read("netlify/lib/billing-pause.mjs");

let n = 0;
const t = async (name, fn) => { await fn(); n++; };

const decl = (start, end) => {
  const i = S.indexOf(`const ${start}`);
  assert.ok(i > 0, `could not find ${start} in index.html`);
  return S.slice(i, S.indexOf(end, i) + end.length);
};
const lifted = new Function([
  'var LOGO="";',
  decl("ALL_FEATURES = [", "\n];"),
  decl("PKG_FEATURES = {", "\n};"),
  decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"),
  decl("resultWords = (cl)", "\n};"),
  decl("TERMS_V2_FROM", "return TERMS_CURRENT;\n}"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn { makeContractHTML, termsVersionOf };")();
const browser = lifted.makeContractHTML, browserVersion = lifted.termsVersionOf;

const PKG = { id: "g-growth", name: "Growth", price: 1200, setup: 500 };
const base = { id: "c1", name: "Test Co", contactName: "Pat", packageId: "g-growth", billingMonthly: 1200, billingSetup: 500, contractTermMonths: 3 };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");
const late = (h) => { const x = text(h); const i = x.indexOf("3.4 Late and Failed Payments"); return x.slice(i, x.indexOf("3.5 ", i)); };

// The records that matter, each one a real shape.
const NEW = { ...base };                                                                   // never sent
const AIR_SUDS = { ...base, docusignSentAt: "2026-09-24T20:00:00Z", contractStatus: "pending" }; // out for signature before v6
const SIGNED_V5 = { ...base, contractSigned: true, contractSignedAt: "2026-09-20T18:00:00Z" };
const SEBASTIAN = { ...base, contractSigned: true, contractSignedAt: "2026-08-20T18:00:00Z" };  // v1
const SENT_TODAY = { ...base, docusignSentAt: "2026-09-28T17:00:00Z", contractTermsVersion: 6 };
const SIGNED_LATER = { ...base, docusignSentAt: "2026-09-24T20:00:00Z", contractSigned: true, contractSignedAt: "2026-10-02T18:00:00Z" };

// ── 1. Who gets which terms ──────────────────────────────────────────────────────────────
await t("a brand-new contract is on the newest terms, and that is v6 or later", () => {
  assert.ok(TERMS_CURRENT >= 6);
  assert.equal(serverVersion(NEW), TERMS_CURRENT);
});
await t("🔴 a contract already OUT FOR SIGNATURE before v6 stays on the terms it was sent with", () => {
  // DocuSign froze the document the day it went out. Rendering it with v6 would make the OS
  // claim they signed a clause they never saw.
  assert.equal(serverVersion(AIR_SUDS), 5);
  assert.ok(!/Pause after three days/.test(text(server(AIR_SUDS, PKG, ""))));
});
await t("🔴 and signing it later does not move it: the SEND date decides, not the signature", () => {
  assert.equal(serverVersion(SIGNED_LATER), 5);
});
await t("signed on v5 stays v5, and the v1 client stays v1", () => {
  assert.equal(serverVersion(SIGNED_V5), 5);
  assert.equal(serverVersion(SEBASTIAN), 1);
});
await t("an explicit stamp beats every inference, both directions", () => {
  assert.equal(serverVersion({ ...AIR_SUDS, contractTermsVersion: 6 }), 6);
  assert.equal(serverVersion({ ...NEW, contractTermsVersion: 3 }), 3);
});
await t("a blank or null stamp is ignored rather than read as version 0", () => {
  assert.equal(serverVersion({ ...NEW, contractTermsVersion: null }), TERMS_CURRENT);
  assert.equal(serverVersion({ ...NEW, contractTermsVersion: "" }), TERMS_CURRENT);
});
await t("🔴 a VOIDED or declined envelope does not pin the old terms (Springbok, sent 14 Sep, voided)", () => {
  for (const st of ["voided", "declined"]) {
    const cl = { ...base, docusignSentAt: "2026-09-14T20:00:00Z", docusignStatus: st, contractStatus: "pending" };
    assert.equal(serverVersion(cl), TERMS_CURRENT, st);
    assert.equal(browserVersion(cl), TERMS_CURRENT, st);
  }
  // A live envelope still pins, and a signed record is never "dead".
  assert.equal(serverVersion({ ...AIR_SUDS, docusignStatus: "sent" }), 5);
  assert.equal(serverVersion({ ...SIGNED_V5, docusignStatus: "voided", docusignSentAt: "2026-09-19T00:00:00Z" }), 5);
});
await t("🔴 the OS copy of the resolver answers identically on every shape", () => {
  for (const cl of [NEW, AIR_SUDS, SIGNED_V5, SEBASTIAN, SENT_TODAY, SIGNED_LATER, {}, { contractTermsVersion: 2 },
    { ...AIR_SUDS, docusignStatus: "voided" }, { ...SIGNED_V5, docusignStatus: "declined" }])
    assert.equal(browserVersion(cl), serverVersion(cl), JSON.stringify(cl));
});
await t("🔴 sending for signature STAMPS the version that was sent", () => {
  assert.match(S, /docusignSentAt:new Date\(\)\.toISOString\(\),contractTermsVersion:termsVersionOf\(client\)\}\)/,
    "without the stamp, the next terms change silently rewrites what the OS says they signed");
});

// ── 2. What the contract says ────────────────────────────────────────────────────────────
await t("the v6 clause says three days, a $150 fee once, a pause, and ten days", () => {
  const s = late(server(NEW, PKG, ""));
  assert.match(s, /unpaid three \(3\) days after its due date, Agency may pause the Services/);
  assert.match(s, /late fee of one hundred fifty dollars \(\$150\), or the maximum permitted by law if less, applies once/);
  assert.match(s, /unpaid ten \(10\) days after its due date, Agency may terminate this Agreement for cause/);
});
await t("🔴 it promises in words that nothing is deleted", () => {
  const s = late(server(NEW, PKG, ""));
  assert.match(s, /deletes nothing/);
  assert.match(s, /will not delete Client's ad accounts, campaigns, ads, or landing pages/);
});
await t("🔴 it TERMINATES, never voids, and says ending is never automatic", () => {
  const s = late(server(NEW, PKG, ""));
  assert.doesNotMatch(s, /\bvoid/i, "a voided contract never existed, which releases them from what they owe");
  assert.match(s, /all amounts owed under that Section become immediately due/);
  assert.match(s, /never automatic/);
});
await t("no interest under v6, and the old clause still carries it for everyone signed before", () => {
  assert.match(late(server(NEW, PKG, "")), /No interest accrues/);
  assert.doesNotMatch(late(server(NEW, PKG, "")), /1\.5% per month/);
  for (const cl of [AIR_SUDS, SIGNED_V5, SEBASTIAN]) {
    const s = late(server(cl, PKG, ""));
    assert.match(s, /1\.5% per month/);
    assert.match(s, /within ten \(10\) days of notice/);
    assert.doesNotMatch(s, /Pause after three days/);
  }
});
await t("the clause points at the real Termination section number", () => {
  const h = text(server(NEW, PKG, ""));
  const m = /(\d+)\. Termination/.exec(h);
  assert.ok(m);
  assert.match(late(server(NEW, PKG, "")), new RegExp(`under Section ${m[1]} without`));
});
await t("no em or en dash in the new clause (client-facing copy)", () => {
  assert.doesNotMatch(late(server(NEW, PKG, "")), /[—–]|&mdash;|&ndash;/);
});
await t("🔴 the OS and the portal print the same contract, old terms and new", () => {
  for (const cl of [NEW, AIR_SUDS, SIGNED_V5, SEBASTIAN, SENT_TODAY])
    assert.equal(browser(cl, PKG, ""), server(cl, PKG, ""), JSON.stringify(cl));
});

// ── 3. The rules ─────────────────────────────────────────────────────────────────────────
await t("v6: day 2 nothing, day 3 fee and pause, day 10 Bryson may end it", () => {
  const p = LP.latePolicyFor(NEW);
  assert.deepEqual(LP.lateStage(p, 2), { fee: false, pause: false, canEnd: false });
  assert.deepEqual(LP.lateStage(p, 3), { fee: true, pause: true, canEnd: false });
  assert.deepEqual(LP.lateStage(p, 9), { fee: true, pause: true, canEnd: false });
  assert.deepEqual(LP.lateStage(p, 10), { fee: true, pause: true, canEnd: true });
  assert.equal(p.lateFee, 150);
  // The contract, the rule and the Stripe charge must name the same figure.
  assert.match(late(server(NEW, PKG, "")), new RegExp(`\\(\\$${p.lateFee}\\)`));
});
await t("🔴 old terms NEVER pause and never charge the fee, however late", () => {
  for (const cl of [AIR_SUDS, SIGNED_V5, SEBASTIAN]) {
    const p = LP.latePolicyFor(cl);
    assert.equal(p.kind, "interest");
    assert.deepEqual(LP.lateStage(p, 60), { fee: false, pause: false, canEnd: false });
  }
});
await t("interest: zero under v6, 1.5%/mo after the grace under the old terms", () => {
  assert.equal(LP.interestFor(LP.latePolicyFor(NEW), 1000, 40), 0);
  // Even with a grace figure present: v6 is interest-free because the POLICY says so, not
  // because a field happens to be missing.
  assert.equal(LP.interestFor({ ...LP.latePolicyFor(NEW), graceDays: 0 }, 1000, 40), 0);
  const old = LP.latePolicyFor(SIGNED_V5);
  assert.equal(LP.interestFor(old, 1000, 10), 0);
  assert.equal(LP.interestFor(old, 1000, 40), 15);
  assert.equal(LP.interestFor(LP.latePolicyFor(SIGNED_V5, { legacyGrace: 0 }), 1000, 30), 15);
});
await t("a pause is lifted by resumedAt, and absent means not paused", () => {
  assert.equal(LP.isBillingPaused({}), false);
  assert.equal(LP.isBillingPaused({ billingPause: { at: "x" } }), true);
  assert.equal(LP.isBillingPaused({ billingPause: { at: "x", resumedAt: "y" } }), false);
});

// ── 4. Pausing and resuming, against fakes ──────────────────────────────────────────────
const fakes = () => {
  const calls = [];
  return {
    calls,
    deps: {
      googleConfigured: () => true, metaConfigured: () => true,
      gadsToken: async () => "tok",
      gadsCampaigns: async () => [
        { id: "1", name: "Live", status: "ENABLED", campaignResourceName: "c/1" },
        { id: "2", name: "Left off on purpose", status: "PAUSED", campaignResourceName: "c/2" },
      ],
      gadsSetStatus: async (_t, _g, rn, s) => { calls.push(["g", rn, s]); if (rn === "c/9") throw new Error("boom"); },
      metaCampaigns: async () => [{ id: "m1", name: "Meta live", status: "ACTIVE" }, { id: "m2", name: "Meta off", status: "PAUSED" }],
      metaSetStatus: async (id, s) => { calls.push(["m", id, s]); },
    },
  };
};
const ACCT = { ...NEW, googleAdsCustomerId: "123", metaAdAccountId: "act_1" };
await t("🔴 a pause switches off only what was ON, and records exactly that", async () => {
  const f = fakes();
  const r = await pauseClientAds(ACCT, f.deps);
  assert.deepEqual(f.calls, [["g", "c/1", "PAUSED"], ["m", "m1", "PAUSED"]]);
  assert.deepEqual(r.paused.map((c) => c.id), ["1", "m1"]);
  assert.equal(r.failed.length, 0);
});
await t("🔴 a resume switches back on the recorded list and NOTHING else", async () => {
  const f = fakes();
  const r = await resumeClientAds(ACCT, { paused: [{ p: "google", id: "1", rn: "c/1" }, { p: "meta", id: "m1" }] }, f.deps);
  assert.deepEqual(f.calls, [["g", "c/1", "ENABLED"], ["m", "m1", "ACTIVE"]]);
  assert.equal(r.resumed.length, 2);
  assert.ok(!f.calls.some((c) => c[1] === "c/2" || c[1] === "m2"), "switched on a campaign Bryson had left off");
});
await t("a failure is reported, never swallowed", async () => {
  const f = fakes();
  const r = await resumeClientAds(ACCT, { paused: [{ p: "google", id: "9", rn: "c/9", name: "Broken" }] }, f.deps);
  assert.equal(r.failed.length, 1);
  assert.equal(r.failed[0].name, "Broken");
  const off = await pauseClientAds(ACCT, { ...f.deps, googleConfigured: () => false });
  assert.ok(off.failed.some((x) => x.p === "google"), "an unconnected platform must say so, not report a clean pause");
});
await t("🔴 nothing in the pause code can REMOVE anything", () => {
  assert.doesNotMatch(PAUSE_SRC.replace(/\/\/.*$/gm, ""), /REMOVED|removeCampaign|DELETE|delete/);
});

// ── 5. The daily watch ───────────────────────────────────────────────────────────────────
await t("the watch reads the client's own terms, not a global rule", () => {
  assert.match(WATCH, /const policy = latePolicyFor\(cl, \{ legacyGrace: GRACE_DAYS \}\);/);
  assert.match(WATCH, /const interest = interestFor\(policy, overdue, daysLate\);/);
  assert.doesNotMatch(WATCH, /daysLate > GRACE_DAYS \?/, "the old hard-coded interest rule is back, charging v6 clients interest");
});
await t("🔴 the late fee is added ONCE per overdue invoice", () => {
  assert.match(WATCH, /if \(stage\.fee && !next\.lateFeeItemId\)/);
  assert.match(WATCH, /lateFeeItemId: sameInv \? \(prev\.lateFeeItemId \|\| null\) : null/);
});
await t("a pause happens once, and never on BoldLine's own account", () => {
  assert.match(WATCH, /if \(stage\.pause && !isBillingPaused\(cl\) && !cl\.internal\)/);
});
await t("day ten tells him once, on the transition, and ends nothing", () => {
  assert.match(WATCH, /if \(stage\.canEnd && !prev\.canEnd\)/);
  assert.doesNotMatch(WATCH, /charge-etf|cancel_at_period_end|subscriptions\/[^`]*\/cancel|contractStatus:\s*"(ended|terminated|canceled)"/,
    "something in the daily watch ends a contract on its own");
});
await t("paying lifts the pause, from the watch and from the webhook", () => {
  assert.match(WATCH, /if \(isBillingPaused\(cl\)\) \{\s*const r = await resumeClientAds\(cl, cl\.billingPause\);/);
  assert.match(HOOK, /event\.type === "invoice\.paid" && isBillingPaused\(cl\) && cl\.billingPause\.invoiceId === obj\.id/,
    "only the invoice that caused the pause may lift it from the webhook");
});

// ── 6. The landing page ──────────────────────────────────────────────────────────────────
await t("🔴 a paused account serves a temporary page, checked BEFORE the preview key", () => {
  const pauseAt = LANDING.indexOf("if (isBillingPaused(data.data)) return unavailablePage(cl.name);");
  const keyAt = LANDING.indexOf('const key = String(url.searchParams.get("preview")');
  assert.ok(pauseAt > 0 && keyAt > 0 && pauseAt < keyAt);
});
await t("that page says nothing about money and tells search engines it is temporary", () => {
  const i = LANDING.indexOf("const unavailablePage");
  const src = LANDING.slice(i, LANDING.indexOf(");\n", i));
  assert.match(src, /status: 503/);
  assert.match(src, /temporarily unavailable/);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /pay|bill|overdue|late fee/i, "the visitor is the client's customer");
});

// ── 7. What the client is told ───────────────────────────────────────────────────────────
await t("🔴 the failed-payment email warns a v6 client BEFORE anything pauses", () => {
  const { html } = renderClientEmail("past_due", { contactName: "Pat", amount: 700, pauseAfter: 3, lateFee: 150 });
  const x = text(html);
  assert.match(x, /still unpaid 3 days after it was due, your ads and landing page pause/);
  assert.match(x, /\$150 late fee/);
  assert.match(x, /Nothing gets deleted/);
  assert.doesNotMatch(x, /keep running for now/);
});
await t("and an older client keeps the old wording, which is still true for them", () => {
  const x = text(renderClientEmail("past_due", { contactName: "Pat", amount: 700 }).html);
  assert.match(x, /keep running for now/);
  assert.doesNotMatch(x, /late fee/);
});
await t("the webhook only passes the warning for pause-terms clients", () => {
  assert.match(HOOK, /\.\.\.\(pol\.kind === "pause" \? \{ pauseAfter: pol\.pauseAfter, lateFee: pol\.lateFee \} : \{\}\)/);
});

console.log(`✓ verify-late-payment: ${n} checks passed`);
