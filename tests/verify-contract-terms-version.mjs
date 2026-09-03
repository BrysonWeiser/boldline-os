// A signed agreement never gains a clause it was not signed with.
//
// Bryson, 2026-09-02: *"make sure in the contract from now on say something like if a client
// fails to respond, complete intake form, etc. the contract is voided and there is a fee
// charged as well (this will be for future clients not Sebastian until he renews his
// contract)"*.
//
// 🔴 THE SECOND HALF OF THAT SENTENCE IS THE HARD PART, AND IT IS NOT A PREFERENCE.
// This contract renders FRESH every time anyone opens it, in the OS and in the client
// portal. Adding a section unconditionally would put a new obligation, with money attached,
// into an agreement a client has already signed. Retroactively. Silently. The client would
// open their portal one day and find a clause they never agreed to, and the only reason
// anyone would notice is if it were ever enforced.
//
// So the terms are VERSIONED, and this suite exists to keep that true for every clause added
// from here on, not only this one.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { makeContractHTML: server } = require("../netlify/lib/contract-shared.cjs");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const decl = (start, end) => {
  const i = S.indexOf(`const ${start}`);
  assert.ok(i > 0, `could not find ${start} in index.html`);
  return S.slice(i, S.indexOf(end, i) + end.length);
};
const browser = new Function([
  'var LOGO="";',
  decl("ALL_FEATURES = [", "\n];"),
  decl("PKG_FEATURES = {", "\n};"),
  decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn makeContractHTML;")();

const PKG = { id: "g-growth", name: "Growth", price: 1200, setup: 500 };
const HANDOFF = { id: "h-handoff", name: "Launch & Hand Off", price: 0, setup: 2500, pricingModel: "one_time" };
const both = (cl, pkg = PKG) => [server(cl, pkg, ""), browser(cl, pkg, "")];
const HAS = /Client Delay and Abandonment/;

// 🔴 The real client, with his real signature date. If this ever starts passing the clause,
// somebody has changed a contract that is already signed.
const SEBASTIAN = { id: "c1", name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-growth",
  contractSigned: true, contractSignedAt: "2026-08-30T12:00:00Z", billingMonthly: 1200, contractTermMonths: 3 };

t("🔴 the client who signed before this clause existed does not have it", () => {
  for (const html of both(SEBASTIAN)) {
    assert.ok(!HAS.test(html), "a new obligation was added to an agreement that is already signed");
  }
});

t("a new, unsigned client does have it", () => {
  for (const html of both({ id: "c2", name: "New Client", packageId: "g-growth" })) {
    assert.match(html, HAS, "new agreements are going out without the clause Bryson asked for");
  }
});

t("someone who signs from now on has it", () => {
  const later = { ...SEBASTIAN, contractSignedAt: "2026-09-10T12:00:00Z" };
  for (const html of both(later)) assert.match(html, HAS);
});

t("🔴 renewing moves an old client onto the current terms", () => {
  // "not Sebastian UNTIL HE RENEWS". Renewal stamps contractTermsVersion, and it has to,
  // because renewing sets contractSigned again but leaves contractSignedAt on the ORIGINAL
  // date, so the inference alone would keep him on v1 for ever.
  for (const html of both({ ...SEBASTIAN, contractTermsVersion: 2 })) assert.match(html, HAS);
});

t("and the renewal path actually writes that stamp", () => {
  assert.match(S, /const CONTRACT_TERMS_VERSION = 2;/, "there is no current-terms constant to stamp");
  assert.match(S, /contractTermsVersion:CONTRACT_TERMS_VERSION/,
    "renewing does not move the client onto the current terms, so an old client stays on the old terms for ever");
});

t("an explicit version on the record beats the date guess, both ways", () => {
  // Belt and braces for a client whose signature date is missing or wrong.
  assert.ok(!HAS.test(server({ id: "x", name: "X", packageId: "g-growth", contractTermsVersion: 1 }, PKG, "")),
    "an explicit v1 was overridden by the guess");
  assert.match(server({ ...SEBASTIAN, contractTermsVersion: 2 }, PKG, ""), HAS);
});

t("a signed contract with no date at all gets the current terms", () => {
  // 🔴 Deliberate. An unknown signature date is far more likely to be a record created after
  // this change than a lost v1 client, and there is exactly one v1 client, whose date is
  // known. Guessing v1 would silently drop the clause from every new agreement whose date
  // failed to save.
  assert.match(server({ id: "x", name: "X", packageId: "g-growth", contractSigned: true }, PKG, ""), HAS);
});

// ── The clause itself ─────────────────────────────────────────────────────────
t("it says what happens and what it costs", () => {
  const html = server({ id: "c2", name: "New", packageId: "g-growth" }, PKG, "");
  const sec = html.slice(html.indexOf("Client Delay and Abandonment"), html.indexOf("No Guarantee of Results"));
  assert.match(sec, /fourteen \(14\) days/, "no deadline for the intake");
  assert.match(sec, /written reminder/, "it can be ended without warning them first");
  assert.match(sec, /ten \(10\) days/, "no grace period after the reminder");
  assert.match(sec, /end this Agreement immediately/, "it never actually says the agreement can be ended");
  assert.match(sec, /setup fee is earned in full and is not refundable/, "no money is owed, which was half the request");
  assert.match(sec, /Monthly Minimum remains payable/, "the months already run are not payable");
});

t("🔴 the money is framed as amounts earned, not as a punishment", () => {
  // This wording is the difference between a clause that holds and one a court strikes out.
  // A flat penalty for walking away is unenforceable in most US states unless it is a
  // genuine estimate of loss. The setup fee pays for work already done; the monthly minimum
  // reflects a slot held open while other work was turned away. Both are real losses.
  const html = server({ id: "c2", name: "New", packageId: "g-growth" }, PKG, "");
  assert.match(html, /reserved capacity and turned away other work/, "the clause does not justify the amounts");
  assert.match(html, /not a penalty/, "it does not say the amounts are not a penalty, which is the phrase that matters");
});

t("it does not fire when the delay is our fault", () => {
  const html = server({ id: "c2", name: "New", packageId: "g-growth" }, PKG, "");
  assert.match(html, /where the delay is caused by Agency/,
    "a client could be charged for a delay BoldLine caused, which is indefensible and would not survive being read aloud");
});

t("ending the agreement is optional, not automatic", () => {
  const html = server({ id: "c2", name: "New", packageId: "g-growth" }, PKG, "");
  assert.match(html, /Nothing in this section obliges Agency to end this Agreement/,
    "a slow client automatically loses their contract, with no room to just wait for them");
});

t("the one-time product gets its own version of the money clause", () => {
  // A hand-off has no Monthly Minimum, so the standard wording would refer to a number that
  // is not in the document.
  const html = server({ id: "c3", name: "H", packageId: "h-handoff" }, HANDOFF, "");
  assert.match(html, HAS);
  assert.match(html, /build fee is earned in full/, "a hand-off gets the monthly wording");
  const sec = html.slice(html.indexOf("Client Delay and Abandonment"), html.indexOf("No Guarantee of Results"));
  assert.ok(!/Monthly Minimum/.test(sec), "the hand-off clause refers to a monthly minimum it does not have");
});

// ── Numbering and structure ───────────────────────────────────────────────────
t("🔴 the sections stay numbered 1..N with no gap and no repeat", () => {
  // The clause slots in mid-document, so every section after it shifts. A duplicated or
  // skipped number in a contract is the kind of thing a dispute turns on.
  for (const cl of [{ id: "a", name: "A", packageId: "g-growth" }, SEBASTIAN,
                    { id: "b", name: "B", packageId: "h-handoff" }]) {
    for (const html of both(cl, cl.packageId === "h-handoff" ? HANDOFF : PKG)) {
      const nums = [...html.matchAll(/<h2>(\d+)\. /g)].map((m) => Number(m[1]));
      assert.deepEqual(nums, nums.map((_, i) => i + 1),
        `sections are numbered ${nums.join(",")} for ${cl.name}`);
    }
  }
});

t("the two copies of the contract agree, on both versions", () => {
  for (const cl of [SEBASTIAN, { id: "c2", name: "New", packageId: "g-growth" }]) {
    const [a, b] = both(cl);
    assert.equal(a, b, `the client's copy and Bryson's copy differ for ${cl.name}`);
  }
});

t("no dashes crept into the new clause", () => {
  const html = server({ id: "c2", name: "New", packageId: "g-growth" }, PKG, "");
  const sec = html.slice(html.indexOf("Client Delay and Abandonment"), html.indexOf("No Guarantee of Results"));
  assert.ok(!/[—–]/.test(sec), "an em or en dash is in the contract");
  assert.ok(!/\s-\s/.test(sec), "a spaced hyphen is in the contract");
});

console.log(`✓ verify-contract-terms-version: ${n} checks passed`);
