// The late fee, per client: one box on the Billing card, frozen into each agreement when it is sent.
// Run: node tests/verify-late-fee-setting.mjs
//
// Bryson, 2026-10-19: "for the future for all clients i want an easy way to edit the late fee".
// What this suite stops, worst first:
//  1. A client charged MORE than the late fee their signed agreement names.
//  2. The agreement and the automatic charge disagreeing (the paper says $25, Stripe adds $150).
//  3. Agreements already out or signed silently changing their printed fee. KB `late-fee-setting`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CS = require("../netlify/lib/contract-shared.cjs");
const { latePolicyFor } = await import("../netlify/lib/late-payment.mjs");
const { renderClientEmail } = await import("../netlify/lib/client-emails-shared.mjs");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const WATCH = readFileSync(join(ROOT, "netlify/functions/billing-watch.mjs"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const decl = (start, end) => { const i = UI.indexOf(`const ${start}`); return UI.slice(i, UI.indexOf(end, i) + end.length); };
const OS = new Function([
  'var LOGO="";', decl("ALL_FEATURES = [", "\n];"), decl("PKG_FEATURES = {", "\n};"), decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"), decl("resultWords = (cl)", "\n};"), decl("TERMS_V2_FROM", "&& off.indexOf(fid) < 0);\n}"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn { makeContractHTML, lateFeeSetting, lateFeeFrozen, agreedLateFee, chargedLateFee, feeWords };")();

const PKG = { id: "g-growth", name: "Growth", price: 1200, setup: 500 };
const base = { id: "c1", name: "Test Co", contactName: "Pat", packageId: "g-growth", billingMonthly: 1200, billingSetup: 500, contractTermMonths: 3 };
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");
const late = (h) => { const x = text(h); const i = x.indexOf("3.4 Late and Failed Payments"); return x.slice(i, x.indexOf("3.5 ", i)); };

const NEW = { ...base };
const NEW_25 = { ...base, billingLateFee: 25 };
const NEW_0 = { ...base, billingLateFee: 0 };
const SENT_OLD = { ...base, docusignSentAt: "2026-10-19T17:00:00Z", contractTermsVersion: 7 };           // sent before this existed
const SIGNED_OLD_LOWERED = { ...SENT_OLD, contractSigned: true, contractSignedAt: "2026-10-20T17:00:00Z", billingLateFee: 25 };
const SIGNED_AT_40 = { ...SENT_OLD, contractLateFee: 40, contractSigned: true, contractSignedAt: "2026-10-20T17:00:00Z" };
const VOIDED = { ...base, docusignSentAt: "2026-10-19T17:00:00Z", docusignStatus: "voided", billingLateFee: 60 };

// ── 1. The rules ─────────────────────────────────────────────────────────────
for (const [name, impl] of [["server", CS], ["OS", OS]]) {
  eq(`${name}: blank is the standard $150`, impl.lateFeeSetting(NEW), 150);
  eq(`${name}: the box is used before sending`, impl.agreedLateFee(NEW_25), 25);
  eq(`${name}: 0 means no late fee`, impl.chargedLateFee(NEW_0), 0);
  eq(`${name}: whole dollars, capped`, [impl.lateFeeSetting({ billingLateFee: 24.6 }), impl.lateFeeSetting({ billingLateFee: 99999 }), impl.lateFeeSetting({ billingLateFee: -5 })], [25, 1000, 150]);
  eq(`${name}: 🔴 anything sent before this existed signed $150`, impl.agreedLateFee({ ...SENT_OLD, billingLateFee: 25 }), 150);
  eq(`${name}: 🔴 lowering after signing lowers the charge`, impl.chargedLateFee(SIGNED_OLD_LOWERED), 25);
  eq(`${name}: 🔴 raising after signing never charges more than signed`, impl.chargedLateFee({ ...SIGNED_AT_40, billingLateFee: 300 }), 40);
  eq(`${name}: a voided envelope froze nothing`, [impl.lateFeeFrozen(VOIDED), impl.agreedLateFee(VOIDED)], [false, 60]);
}
eq("number words", ["one", "twenty-five", "one hundred fifty", "one thousand"].map((w, i) => CS.feeWords([1, 25, 150, 1000][i]) === w), [true, true, true, true]);

// ── 2. The agreement prints it ───────────────────────────────────────────────
{
  const std = late(CS.makeContractHTML(NEW, PKG, ""));
  ok("🔴 the standard wording is byte-for-byte what was signed before", /late fee of one hundred fifty dollars \(\$150\), or the maximum permitted by law if less, applies once/.test(std));
  ok("a custom fee is printed in words and numbers", /late fee of twenty-five dollars \(\$25\)/.test(late(CS.makeContractHTML(NEW_25, PKG, ""))));
  const zero = late(CS.makeContractHTML(NEW_0, PKG, ""));
  ok("$0 says there is no late fee, and never prints $0", /No late fee applies/.test(zero) && !/\$0\)/.test(zero));
  ok("🔴 a signed agreement keeps printing what was signed after the box is lowered", /\(\$150\)/.test(late(CS.makeContractHTML(SIGNED_OLD_LOWERED, PKG, ""))));
  ok("a stamped agreement prints its stamp", /forty dollars \(\$40\)/.test(late(CS.makeContractHTML({ ...SIGNED_AT_40, billingLateFee: 10 }, PKG, ""))));
  const probes = [NEW, NEW_25, NEW_0, SENT_OLD, SIGNED_OLD_LOWERED, SIGNED_AT_40, VOIDED];
  ok("🔴 the OS's copy of the agreement says exactly the same", probes.every((p) => late(OS.makeContractHTML(p, PKG)) === late(CS.makeContractHTML(p, PKG, ""))));
}

// ── 3. The charge follows it ─────────────────────────────────────────────────
{
  eq("the automatic charge uses the client's fee", latePolicyFor(NEW_25).lateFee, 25);
  eq("and the lower of signed and today's box", latePolicyFor(SIGNED_OLD_LOWERED).lateFee, 25);
  ok("🔴 a $0 fee never creates a Stripe charge", /if \(stage\.fee && policy\.lateFee > 0 && !next\.lateFeeItemId\)/.test(WATCH));
  const x = text(renderClientEmail("past_due", { contactName: "Pat", amount: 700, pauseAfter: 3, lateFee: 0 }).html);
  ok("the late-payment email mentions no fee when there is none", !/late fee/.test(x) && /pause until it's sorted\./.test(x));
  ok("and names theirs when there is one", /\$25 late fee/.test(text(renderClientEmail("past_due", { contactName: "Pat", amount: 700, pauseAfter: 3, lateFee: 25 }).html)));
}

// ── 4. The OS ────────────────────────────────────────────────────────────────
{
  ok("the box sits on the Billing card for clients on the late-fee terms", /\{!oneTime&&!client\.internal&&termsVersionOf\(client\)>=6&&<LateFeeRow client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
  ok("🔴 sending stamps the fee that was sent", /contractLateFee:agreedLateFee\(client\)[,}]/.test(UI));
  ok("replacing an agreement archives the old fee and unlocks the box", /lateFee:agreedLateFee\(client\),(addOns:client\.contractAddOns\|\|null,)?replacedAt:/.test(UI) && /contractTermsVersion:null,contractLateFee:null,contractOmits:null/.test(UI));
  ok("a renewal never raises it", /contractLateFee:chargedLateFee\(client\)/.test(UI));
  ok("the alerts use the client's own fee", /\$\$\{chargedLateFee\(cl\)\} late fee is added/.test(UI));
}

console.log(`verify-late-fee-setting: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
