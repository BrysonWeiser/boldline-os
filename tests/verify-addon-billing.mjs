// Google profile care as an add-on: in the agreement when ticked, billed on its own, never anywhere it wasn't agreed.
//
// Bryson, 2026-10-27: "yes" to making the $130 Google profile care "a proper checkbox in the agreement that adds $130
// to their monthly bill automatically". KB `addon-billing`.
//
// What this pins, because each one is a way to bill somebody for something they never signed:
//   - the clause appears only when ticked, only on v8+ terms, never on a hand-off, and FREEZES when sent;
//   - both copies of the ads agreement say the same thing, and every heading is numbered 1..N with no repeat;
//   - the website agreement carries it as 7a/7b and its monthly total and build total don't move;
//   - billing starts only for a SIGNED agreement whose profile is linked, never for BoldLine's own businesses,
//     never twice, and the add-on's own subscription is kept apart from the ads billing everywhere.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CS = require("../netlify/lib/contract-shared.cjs");
const { GOOGLE_PROFILE } = await import("../netlify/lib/pricing-shared.mjs");
const WD = await import("../netlify/lib/website-deal.mjs");
const AB = await import("../netlify/lib/addon-billing.mjs");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${name}`); throw e; } };
const ta = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error(`✗ ${name}`); throw e; } };

// The browser copy of the generator, lifted for real (same harness as verify-contract-terms-version).
const decl = (start, end) => {
  const i = S.indexOf(`const ${start}`);
  assert.ok(i > 0, `could not find ${start} in index.html`);
  return S.slice(i, S.indexOf(end, i) + end.length);
};
const B = new Function([
  'var LOGO="";',
  decl("ALL_FEATURES = [", "\n];"), decl("PKG_FEATURES = {", "\n};"), decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"), decl("resultWords = (cl)", "\n};"),
  decl("TERMS_V2_FROM", "&& off.indexOf(fid) < 0);\n}"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn { makeContractHTML, addOnsOf, ADD_ONS, termsVersionOf };")();

const PKG = { id: "g-growth", name: "Growth", price: 1200, setup: 500, platform: "Google Ads", pricingModel: "per_lead" };
const PCT = { id: "e-growth", name: "Store Growth", price: 700, setup: 500, platform: "Meta Ads", pricingModel: "ad_spend_pct", adSpendPct: 15 };
const HANDOFF = { id: "h-handoff", name: "Launch & Hand Off", price: 0, setup: 1500, pricingModel: "one_time", platform: "Google Ads" };
const base = { id: "c-addon-1", name: "Summit Handyman Co.", contactName: "Dana", email: "dana@example.com", packageId: "g-growth", niche: "Roofing" };
const GBP = [{ id: "gbp_care" }];
const both = (cl, pkg = PKG) => [CS.makeContractHTML(cl, pkg, ""), B.makeContractHTML(cl, pkg, "")];
const HAS = /Add-On Service: Google Business Profile Care/;
const heads = (h) => [...h.matchAll(/<h2>(\d+)\. ([^<]+)<\/h2>/g)].map((m) => Number(m[1]));
const section = (h) => { const i = h.search(HAS); return i < 0 ? "" : h.slice(i, h.indexOf("<h2>", i + 10) > 0 ? h.indexOf("<h2>", i + 10) : h.length); };

// ── The ads agreement ──────────────────────────────────────────────────────────────
t("ticked on an unsent agreement: both copies carry the section, the price and the key-terms row", () => {
  for (const h of both({ ...base, addOns: GBP })) {
    assert.match(h, HAS); assert.match(h, /\$130 per month/); assert.match(h, /Add-On Service<\/div><div class="meta-value">Google Business Profile Care, \$130\/mo/);
  }
  const [a, b] = both({ ...base, addOns: GBP }); assert.equal(a, b, "the OS and the portal must render the same agreement");
});
t("not ticked: no section, no row", () => { for (const h of both(base)) { assert.doesNotMatch(h, HAS); assert.doesNotMatch(h, /Add-On Service/); } });
t("the price is the client's own", () => { for (const h of both({ ...base, addOns: [{ id: "gbp_care", monthly: 110 }] })) assert.match(h, /\$110 per month/); });
t("default price equals the website's $130 (pricing-shared GOOGLE_PROFILE), in both copies", () => {
  assert.equal(CS.ADD_ONS.gbp_care.monthly, GOOGLE_PROFILE.monthly); assert.equal(B.ADD_ONS.gbp_care.monthly, GOOGLE_PROFILE.monthly);
});
t("every heading is numbered 1..N with no gap or repeat (plain, add-on, special terms, both, results-only, store %)", () => {
  const spec = { specialTerms: { clauses: [{ heading: "First month", text: "Half price." }] } };
  const cases = [[base, PKG], [{ ...base, addOns: GBP }, PKG], [{ ...base, ...spec }, PKG], [{ ...base, ...spec, addOns: GBP }, PKG],
    [{ ...base, addOns: GBP, billingMonthly: 0, billingPerLead: 60 }, PKG], [{ ...base, packageId: "e-growth", addOns: GBP }, PCT]];
  for (const [cl, pkg] of cases) for (const h of both(cl, pkg)) { const ns = heads(h); assert.deepEqual(ns, ns.map((_, i) => i + 1), `numbering: ${ns.join(",")}`); }
});
t("the fee never counts toward the Minimum or the Performance Fee, in this agreement's own words", () => {
  assert.match(section(both({ ...base, addOns: GBP })[0]), /does not count toward the Monthly Minimum or the Performance Fee/);
  assert.match(section(both({ ...base, addOns: GBP, billingMonthly: 0, billingPerLead: 60 })[0]), /is not part of the Performance Fee/);
  assert.match(section(both({ ...base, addOns: GBP })[0]), /not part of the Committed Term/);
});
t("🔴 a v7 agreement signed before add-ons existed never gains it, even with the box ticked", () => {
  const cl = { ...base, contractSigned: true, contractSignedAt: "2026-10-10T18:00:00Z", addOns: GBP };
  assert.equal(CS.termsVersionOf(cl), 7);
  for (const h of both(cl)) assert.doesNotMatch(h, HAS);
});
t("🔴 a v7 agreement with special terms keeps the numbering it was signed with", () => {
  const cl = { ...base, contractSigned: true, contractSignedAt: "2026-10-10T18:00:00Z", specialTerms: { clauses: [{ heading: "X", text: "Y" }] } };
  for (const h of both(cl)) { const ns = heads(h); assert.equal(ns[ns.length - 1], ns[ns.length - 2], "old documents must not be renumbered"); }
});
t("🔴 sent without it: ticking the box afterwards changes nothing (frozen as empty)", () => {
  const cl = { ...base, docusignSentAt: "2026-10-29T17:00:00Z", contractTermsVersion: 8, addOns: GBP };
  assert.deepEqual(CS.addOnsOf(cl), []); for (const h of both(cl)) assert.doesNotMatch(h, HAS);
});
t("sent with it: the frozen list rules, whatever the box says now", () => {
  const cl = { ...base, docusignSentAt: "2026-10-29T17:00:00Z", contractTermsVersion: 8, addOns: [], contractAddOns: [{ id: "gbp_care", monthly: 120 }] };
  for (const h of both(cl)) assert.match(h, /\$120 per month/);
  const signed = { ...cl, contractSigned: true, contractSignedAt: "2026-10-30T17:00:00Z" };
  assert.deepEqual(CS.addOnsOf(signed), [{ id: "gbp_care", monthly: 120 }]);
});
t("🔴 the version gate on its own: a v7-stamped agreement can't carry it, even with nothing frozen", () => {
  const cl = { ...base, contractTermsVersion: 7, docusignSentAt: "2026-10-20T17:00:00Z", docusignStatus: "voided", addOns: GBP };
  assert.deepEqual(CS.addOnsOf(cl), []); assert.deepEqual(B.addOnsOf(cl), []);
  for (const h of both(cl)) assert.doesNotMatch(h, HAS);
});
t("a voided envelope froze nothing: the live box rules again", () => {
  const cl = { ...base, docusignSentAt: "2026-10-29T17:00:00Z", docusignStatus: "voided", contractAddOns: [], addOns: GBP };
  assert.equal(CS.addOnsOf(cl).length, 1);
});
t("🔴 a hand-off never carries a recurring charge", () => {
  const cl = { ...base, packageId: "h-handoff", addOns: GBP };
  assert.deepEqual(CS.addOnsOf(cl), []);
  for (const h of both(cl, HANDOFF)) { assert.doesNotMatch(h, HAS); assert.match(h, /NO RECURRING CHARGE OF ANY KIND/); }
});
t("unknown ids, zero prices and duplicates are dropped", () => {
  assert.deepEqual(CS.addOnsOf({ ...base, addOns: [{ id: "seo" }, { id: "gbp_care", monthly: 0 }] }), []);
  assert.equal(CS.addOnsOf({ ...base, addOns: [{ id: "gbp_care" }, { id: "gbp_care", monthly: 99 }] }).length, 1);
});
t("the clause has no dashes, no emoji, and never implies Google backs us", () => {
  const sec = section(both({ ...base, addOns: GBP })[0]);
  assert.doesNotMatch(sec, /[—–]|&mdash;|&ndash;/); assert.doesNotMatch(sec, /\p{Extended_Pictographic}/u);
  assert.match(sec, /does not sponsor or endorse/); assert.match(sec, /never write, buy or post a review/); assert.match(sec, /manager access/);
});

// ── The OS freezes it at send and never writes the billing state ─────────────────────────
t("sending stamps contractAddOns; replacing an agreement clears it and keeps the old one in history", () => {
  assert.match(S, /contractLateFee:agreedLateFee\(client\),contractAddOns:addOnsOf\(client\)\}\)/);
  assert.match(S, /addOns:client\.contractAddOns\|\|null,replacedAt/);
  assert.match(S, /contractOmits:null,contractAddOns:null\}\)/);
});
t("addOnBilling is server-owned in the OS", () => { assert.match(S, /SERVER_OWNED_KEYS=\[[^\]]*"addOnBilling"/); });
t("the box is offered once per business and never on a hand-off", () => {
  const card = S.slice(S.indexOf("function AddOnsCard"), S.indexOf("function ContractTabContent"));
  assert.match(card, /isOneTime\(pkg\)\) return null/); assert.match(card, /inWebsite/);
});

// ── The website agreement ─────────────────────────────────────────────────────────────
t("website agreement: 7a when ticked, 7b after the blog, none otherwise", () => {
  const cl = { id: "w1", name: "Acme", email: "a@b.c" };
  assert.match(WD.websiteAgreementHTML(cl, { gbpCare: true }), /<h2>7a\. Google Business Profile care<\/h2>/);
  assert.match(WD.websiteAgreementHTML(cl, { gbpCare: true, blog: true }), /<h2>7b\. Google Business Profile care<\/h2>/);
  assert.doesNotMatch(WD.websiteAgreementHTML(cl, {}), /Google Business Profile care/);
  assert.match(WD.websiteAgreementHTML(cl, { gbpCare: true, gbpMonthly: 150 }), /\$150 per month/);
  assert.match(WD.websiteAgreementHTML(cl, { gbpCare: true, mgmt: "own" }), /7a\. Google Business Profile care/);
});
t("website agreement: the build and care totals do not move (it is billed on its own)", () => {
  assert.equal(WD.monthlyTotal({ gbpCare: true }), WD.monthlyTotal({})); assert.equal(WD.buildTotal({ gbpCare: true }), WD.buildTotal({}));
  assert.equal(WD.normTerms({ gbpCare: true }).gbpMonthly, GOOGLE_PROFILE.monthly);
  assert.equal(WD.AGREEMENT_VERSION, "WA-9");
});
t("the browser mirror and the server refuse a second copy across the two agreements", () => {
  assert.match(S, /gbpCare:t\.gbpCare===true,gbpMonthly:wdNum\(t\.gbpMonthly,WD_GBP_MONTHLY\)/);
  assert.equal(Number((S.match(/const WD_GBP_MONTHLY=(\d+);/) || [])[1]), GOOGLE_PROFILE.monthly);
  assert.match(src("netlify/functions/website-deal.mjs"), /gbpCare && addOnsOf\(cl\)\.some\(\(a\) => a\.id === "gbp_care"\)\) return json\(\{ ok: false/);
});

// ── Billing ───────────────────────────────────────────────────────────────────────────
const SIGNED = { ...base, contractSigned: true, contractSignedAt: "2026-10-30T17:00:00Z", contractTermsVersion: 8, contractAddOns: [{ id: "gbp_care", monthly: 130 }] };
const LINKED = { ...SIGNED, gbp: { location: "locations/1", account: "accounts/1", title: "Summit" } };
const WEB = { id: "w2", name: "Web Only Co", email: "w@b.c", websiteDeal: { agreement: { status: "completed", terms: { gbpCare: true, gbpMonthly: 140 } } } };

t("agreed only from a SIGNED agreement, ads first, never twice", () => {
  assert.deepEqual(AB.agreedAddOns({ ...base, addOns: GBP }), []);
  assert.deepEqual(AB.agreedAddOns(SIGNED), [{ id: "gbp_care", monthly: 130, source: "ads" }]);
  assert.deepEqual(AB.agreedAddOns(WEB), [{ id: "gbp_care", monthly: 140, source: "website" }]);
  assert.equal(AB.agreedAddOns({ ...SIGNED, websiteDeal: WEB.websiteDeal }).length, 1);
  assert.deepEqual(AB.agreedAddOns({ ...WEB, websiteDeal: { agreement: { status: "sent", terms: { gbpCare: true } } } }), []);
});
t("plan: exempt, none, waiting for the profile, ready, billing, stopped", () => {
  assert.equal(AB.addOnPlan({ ...LINKED, internal: true }).state, "exempt");
  assert.equal(AB.addOnPlan(base).state, "none");
  assert.equal(AB.addOnPlan(SIGNED).state, "waiting_profile");
  assert.equal(AB.addOnPlan(LINKED).state, "ready");
  assert.equal(AB.addOnPlan({ ...LINKED, addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "active" } } }).state, "billing");
  assert.equal(AB.addOnPlan({ ...LINKED, addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "canceled" } } }).state, "stopped");
});
t("the OS mirror reads the same states", () => {
  assert.match(S, /const osAddOnPlan=/);
  for (const st of ["exempt", "billing", "stopped", "waiting_profile", "ready"]) assert.ok(S.includes(`state:"${st}"`), st);
});

const stubApi = ({ pm = "pm_1" } = {}) => {
  const calls = [];
  return { calls,
    ensureCustomer: async (id) => { calls.push(["customer", id]); return id || "cus_new"; },
    resolvePaymentMethod: async () => pm,
    stripe: async (path, opts = {}) => { calls.push([path, opts]);
      if (path === "products") return { id: "prod_1" };
      if (path === "subscriptions") return { id: "sub_9", status: pm ? "active" : "incomplete" };
      if (path.startsWith("subscriptions/")) return { id: "sub_9", current_period_end: Date.UTC(2026, 10, 28) / 1000 };
      return {}; } };
};
await ta("start: its own tagged subscription at the agreed price, on the card on file, with an idempotency key", async () => {
  const api = stubApi();
  const r = await AB.startAddOn({ ...LINKED, stripeCustomerId: "cus_ads" }, "gbp_care", api, { now: new Date("2026-11-01T16:00:00Z") });
  const sub = api.calls.find((c) => c[0] === "subscriptions")[1];
  assert.equal(sub.body.customer, "cus_ads");
  assert.deepEqual(sub.body.metadata, { clientId: base.id, kind: "addon", addOn: "gbp_care" });
  assert.equal(sub.body.items[0].price_data.unit_amount, 13000); assert.deepEqual(sub.body.items[0].price_data.recurring, { interval: "month" });
  assert.equal(sub.body.collection_method, "charge_automatically"); assert.equal(sub.body.default_payment_method, "pm_1");
  assert.ok(sub.idempotencyKey && api.calls.find((c) => c[0] === "products")[1].idempotencyKey);
  assert.equal(r.billing.status, "active"); assert.equal(r.billing.collection, "card"); assert.equal(r.billing.source, "ads");
});
await ta("start with no card: Stripe emails a monthly invoice instead", async () => {
  const api = stubApi({ pm: null });
  const r = await AB.startAddOn(LINKED, "gbp_care", api);
  const sub = api.calls.find((c) => c[0] === "subscriptions")[1];
  assert.equal(sub.body.collection_method, "send_invoice"); assert.equal(sub.body.days_until_due, 7); assert.equal(r.billing.collection, "invoice");
});
await ta("🔴 start refuses: not agreed, BoldLine's own, profile not linked (unless Bryson presses the button), stopped", async () => {
  await assert.rejects(AB.startAddOn({ ...base, addOns: GBP, gbp: LINKED.gbp }, "gbp_care", stubApi()), /signed agreement/);
  await assert.rejects(AB.startAddOn({ ...LINKED, internal: true }, "gbp_care", stubApi()), /never billed/);
  await assert.rejects(AB.startAddOn(SIGNED, "gbp_care", stubApi()), /isn't linked/);
  const stopped = { ...LINKED, addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "canceled", endedAt: "2026-12-01T00:00:00Z" } } };
  await assert.rejects(AB.startAddOn(stopped, "gbp_care", stubApi()), /stopped/);
  assert.equal((await AB.startAddOn(SIGNED, "gbp_care", stubApi(), { manual: true })).billing.status, "active");
  assert.equal((await AB.startAddOn(stopped, "gbp_care", stubApi(), { manual: true })).billing.subscriptionId, "sub_9");
});
await ta("already billing: nothing new is created", async () => {
  const api = stubApi();
  const r = await AB.startAddOn({ ...LINKED, addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "active" } } }, "gbp_care", api);
  assert.ok(r.already); assert.equal(api.calls.length, 0);
});
await ta("stop: at the end of the month already paid for", async () => {
  const api = stubApi();
  const r = await AB.stopAddOn({ addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "active" } } }, "gbp_care", api);
  assert.deepEqual(api.calls[0], ["subscriptions/sub_1", { body: { cancel_at_period_end: true } }]);
  assert.equal(r.billing.stopAt, "2026-11-28T00:00:00.000Z");
});

t("telling subscriptions apart: the ads one is the untagged one, whatever order Stripe lists them in", () => {
  const list = [{ id: "a", metadata: { kind: "addon" } }, { id: "w", metadata: { kind: "website" } }, { id: "ads", metadata: { clientId: "x" } }];
  assert.equal(AB.adsSubscriptionOf(list).id, "ads"); assert.equal(AB.adsSubscriptionOf(list.slice(0, 2)), null);
  assert.deepEqual(AB.addOnKind({ object: "subscription", metadata: { kind: "addon", addOn: "gbp_care" } }), { id: "gbp_care" });
  assert.deepEqual(AB.addOnKind({ object: "invoice", metadata: {}, parent: { subscription_details: { metadata: { kind: "addon", addOn: "gbp_care" } } } }), { id: "gbp_care" });
  assert.deepEqual(AB.addOnKind({ subscription_details: { metadata: { kind: "addon" } } }), { id: "gbp_care" });
  assert.equal(AB.addOnKind({ metadata: { kind: "website" } }), null);
});
t("🔴 only ads invoices can trigger the ads late-payment policy", () => {
  assert.equal(AB.isAdsInvoice({ id: "i1", metadata: {} }), true);
  assert.equal(AB.isAdsInvoice({ id: "i2", subscription_details: { metadata: { kind: "addon" } } }), false);
  assert.equal(AB.isAdsInvoice({ id: "i3", metadata: { kind: "website", stage: "deposit" } }), false);
});
t("events: paid, failed (with a calm alert), stopping at period end, ended", () => {
  const cl = { name: "Summit", addOnBilling: { gbp_care: { subscriptionId: "sub_1", status: "active" } } };
  const inv = { metadata: {}, subscription_details: { metadata: { kind: "addon", addOn: "gbp_care", clientId: "c" } }, amount_due: 13000 };
  const now = new Date("2026-12-01T16:00:00Z");
  assert.equal(AB.applyAddOnEvent(cl, { type: "invoice.paid", data: { object: inv } }, now).billing.lastPaidAt, now.toISOString());
  const f = AB.applyAddOnEvent(cl, { type: "invoice.payment_failed", data: { object: inv } }, now);
  assert.equal(f.billing.status, "past_due"); assert.equal(f.alert.severity, "yellow"); assert.match(f.alert.body, /\$130/); assert.match(f.alert.body, /ads are not affected/);
  const subObj = { id: "sub_1", object: "subscription", status: "active", cancel_at_period_end: true, current_period_end: Date.UTC(2026, 11, 28) / 1000, metadata: { kind: "addon", addOn: "gbp_care" } };
  assert.equal(AB.applyAddOnEvent(cl, { type: "customer.subscription.updated", data: { object: subObj } }, now).billing.stopAt, "2026-12-28T00:00:00.000Z");
  const del = AB.applyAddOnEvent(cl, { type: "customer.subscription.deleted", data: { object: { ...subObj, status: "canceled" } } }, now);
  assert.equal(del.billing.status, "canceled"); assert.equal(del.billing.endedAt, now.toISOString());
  assert.equal(AB.applyAddOnEvent(cl, { type: "invoice.paid", data: { object: { metadata: {} } } }), null);
});

await ta("daily: starts only what is agreed, linked and not already running; writes onto a fresh read; one alert", async () => {
  const rows = [
    { id: "r1", data: { ...LINKED, id: "r1" } },
    { id: "r2", data: { ...SIGNED, id: "r2" } },                                   // profile not linked yet
    { id: "r3", data: { ...LINKED, id: "r3", internal: true } },                   // BoldLine's own
    { id: "r4", data: { ...LINKED, id: "r4", addOnBilling: { gbp_care: { subscriptionId: "s", status: "active" } } } },
    { id: "r5", data: { ...LINKED, id: "r5", addOnBilling: { gbp_care: { subscriptionId: "s", status: "canceled" } } } },
    { id: "r6", data: { ...base, id: "r6", addOns: GBP, gbp: LINKED.gbp } },       // ticked but never signed
  ];
  const writes = []; const alerts = [];
  const db = { from: () => ({
    select: () => ({ eq: (_k, id) => ({ maybeSingle: async () => ({ data: { data: { ...rows.find((r) => r.id === id).data, notes: "fresh" } } }) }) }),
    update: (v) => ({ eq: async (_k, id) => { writes.push([id, v.data]); return { error: null }; } }) }) };
  const res = await AB.runAddOnStarts(db, rows, stubApi(), { alert: async (a) => alerts.push(a) });
  assert.deepEqual(writes.map((w) => w[0]), ["r1"]);
  assert.equal(writes[0][1].notes, "fresh"); assert.equal(writes[0][1].addOnBilling.gbp_care.subscriptionId, "sub_9");
  assert.equal(res.started.length, 1); assert.equal(alerts.length, 1); assert.equal(alerts[0].severity, "green");
});

// ── Wiring ────────────────────────────────────────────────────────────────────────────
t("the webhook routes add-on money away from the ads status, before anything else touches it", () => {
  const WH = src("netlify/functions/stripe-webhook.mjs");
  const a = WH.indexOf("if (addOnKind(obj))"), w = WH.indexOf("if (websiteKind(obj))"), p = WH.indexOf("switch (event.type)");
  assert.ok(a > 0 && a < w && a < p, "the add-on branch must come first");
  assert.match(WH.slice(a, w), /addOnBilling/); assert.doesNotMatch(WH.slice(a, w), /billingStatus/);
});
t("ads lookups skip tagged subscriptions; the watcher filters invoices and starts add-ons", () => {
  const SB = src("netlify/functions/stripe-billing.mjs"), BW = src("netlify/functions/billing-watch.mjs");
  assert.equal((SB.match(/adsSubscriptionOf\(subs\.data\)/g) || []).length, 2); assert.doesNotMatch(SB, /limit=1&status=all/);
  assert.match(BW, /\.filter\(isAdsInvoice\)/); assert.match(BW, /adsSubscriptionOf\(subs\.data\)/); assert.match(BW, /runAddOnStarts\(supabase, rows/);
  assert.match(src("netlify/functions/gbp.mjs"), /addOnPlan\(\{ \.\.\.linked, id: row\.id \}, "gbp_care"\)\.state === "ready"/);
});

console.log(`✓ verify-addon-billing: ${n} checks passed`);
