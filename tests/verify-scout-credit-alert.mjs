// Lead Scout's "out of credits" box: short, step by step, and only for that error.
// Run: node tests/verify-scout-credit-alert.mjs
//
// Bryson, 2026-09-27, after a search died part way with two raw JSON billing errors in a red box:
// *"can you add step by step instructions in the red alert and make it smaller saying something like
// out of credits go to this do this this and this"*.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const m = /const scoutCreditError = (\(e\)=>[^\n]+);/.exec(UI);
assert.ok(m, "scoutCreditError is gone");
const isCredit = new Function(`return ${m[1]}`)();

// The exact text his screen showed.
const REAL = 'opus-5 + effort + strict: {"type":"error","error":{"details":null,"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011CfUVHnAnQRzYgYNaB1frZ"}';

t("🔴 recognises the real error he saw", () => assert.ok(isCredit(REAL)));
t("and the bare message", () => assert.ok(isCredit("Your credit balance is too low to access the Anthropic API.")));
t("🔴 but NOT other failures, which must keep their raw text", () => {
  for (const e of ["overloaded_error", "429 rate_limit_error", "tool not called", "", null, "credit card declined by Apollo"])
    assert.ok(!isCredit(e), String(e));
});
t("the box gives the steps in order", () => {
  const box = UI.slice(UI.indexOf("Out of AI credits."), UI.indexOf("</ol>", UI.indexOf("Out of AI credits.")));
  const order = ["console.anthropic.com", "Billing", "Buy credits", "$10 to $20", "Run this search again"].map((w) => box.indexOf(w));
  assert.ok(order.every((i) => i > 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});
t("the link opens safely in a new tab", () => {
  assert.match(UI, /href="https:\/\/console\.anthropic\.com" target="_blank" rel="noopener noreferrer"/);
});
t("🔴 no login email in the page: this file is served to anyone who asks for it", () => {
  const box = UI.slice(UI.indexOf("Out of AI credits."), UI.indexOf("</ol>", UI.indexOf("Out of AI credits.")));
  assert.doesNotMatch(box, /@gmail\.com/);
});
t("🔴 a credit error no longer prints raw, other errors still do", () => {
  assert.match(UI, /other=errs\.filter\(e=>!scoutCreditError\(e\)\)/);
  assert.match(UI, /\{other\.map\(\(e,i\)=>/);
  assert.doesNotMatch(UI, /\{runResult\.errors\.map\(\(e,i\)=>/, "the old box printing every error raw is back");
});

console.log(`✓ verify-scout-credit-alert: ${n} checks passed`);
