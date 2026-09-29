// A client Claude prepares and Bryson saves: the #addclient= link.
// Run: node tests/verify-client-prefill.mjs
//
// Bryson, 2026-09-28: *"Can you add him into the os yourself with all the details we have that way I
// don't have to manually do it right now"*. Claude has no database key, deliberately, so the answer is
// a link that opens Add Client already filled in. What must never happen:
//  1. The link SAVES anything. It is a draft until he presses Add Client.
//  2. The link sets something the form would never let him set by hand: a signed contract, a portal
//     token, a billing status, an id. Only a fixed list of fields gets through.
//  3. A reload reopens it and he adds the same client twice.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const a = UI.indexOf("const PREFILL_TEXT=");
const b = UI.indexOf("function AddClientSheet(", a);
assert.ok(a > 0 && b > a, "the prefill parser is gone");
const parse = new Function("findPkg", "atob", "escape", UI.slice(a, b) + "return parseClientPrefill;")(
  (id) => (["g-launch", "g-growth"].includes(id) ? { id } : null),
  (x) => Buffer.from(x, "base64").toString("binary"),
  globalThis.escape,
);
const link = (obj) => "#addclient=" + Buffer.from(JSON.stringify(obj), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

t("a prepared client comes through field for field", () => {
  const p = parse(link({ name: "Springbok Chiropractic, LLC", email: "a@b.com", packageId: "g-launch",
    billingMonthly: 0, billingSetup: 0, billingPerLead: 25, contractStart: "2026-10-19", startDateFirm: false, platforms: ["google"] }));
  assert.equal(p.name, "Springbok Chiropractic, LLC");
  assert.equal(p.billingMonthly, 0, "a $0 minimum is a real value, not a missing one");
  assert.equal(p.billingSetup, 0);
  assert.equal(p.billingPerLead, 25);
  assert.equal(p.startDateFirm, false);
  assert.deepEqual(p.platforms, ["google"]);
});
t("🔴 nothing outside the list gets through: no signed contract, no tokens, no ids, no billing status", () => {
  const p = parse(link({ name: "X", contractSigned: true, contractStatus: "active", portalToken: "t", id: "abc",
    billingStatus: "active", stripeCustomerId: "cus_1", internal: true, contractTermsVersion: 1 }));
  assert.deepEqual(Object.keys(p), ["name"]);
});
t("unknown packages, negative money and bad dates are dropped", () => {
  const p = parse(link({ name: "X", packageId: "nope", billingPerLead: -5, contractStart: "not a date", platforms: ["google", "tiktok"] }));
  assert.equal(p.packageId, undefined);
  assert.equal(p.billingPerLead, undefined);
  assert.equal(p.contractStart, undefined);
  assert.deepEqual(p.platforms, ["google"]);
});
t("a broken or empty link is ignored, never half-applied", () => {
  assert.equal(parse("#addclient=%%%"), null);
  assert.equal(parse("#addclient=" + Buffer.from("[1,2]").toString("base64")), null);
  assert.equal(parse(""), null);
  assert.equal(parse("#something-else"), null);
});
t("names with apostrophes and accents survive the trip", () => {
  assert.equal(parse(link({ name: "O'Brien Café & Co" })).name, "O'Brien Café & Co");
});
t("🔴 the link only OPENS the sheet; saving is still his button", () => {
  const eff = UI.slice(UI.indexOf("const [addPrefill,setAddPrefill]"), UI.indexOf("},[]);", UI.indexOf("const [addPrefill,setAddPrefill]")));
  assert.match(eff, /setAddPrefill\(p\); setShowAdd\(true\);/);
  assert.doesNotMatch(eff, /addClient\(|onSave|insert\(/, "the link must never save by itself");
});
t("🔴 the hash is cleared once read, so a reload cannot add the client twice", () => {
  assert.match(UI, /if\(\/addclient=\/\.test\(window\.location\.hash\)\) history\.replaceState\(null,"",window\.location\.pathname\+window\.location\.search\);/);
});
t("the end date is always worked out from the start and term, never trusted from the link", () => {
  assert.match(UI, /\.\.\.\(pre\|\|\{\}\),contractStart:fmt\(preStart\),contractEnd:fmt\(addMonths\(preStart,preTerm\)\),contractTermMonths:preTerm\}/);
});
t("the sheet tells him it was filled in and shows the fields it has no box for", () => {
  assert.match(UI, /Filled in for you\. Check it, then press Add Client\./);
  assert.match(UI, /Price per qualified lead:/);
});

console.log(`✓ verify-client-prefill: ${n} checks passed`);
