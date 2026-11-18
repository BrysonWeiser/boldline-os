// Complete, first year paid up front (Bryson, 2026-11-18: "make it all live", KB complete-plan). 10% off the plan fee
// for paying the 12 months at once: $5,400 instead of $6,000. Lead fees still monthly. Run: node tests/verify-complete-prepay.mjs
//
// What has to stay true:
//  1. One set of numbers: price list, agreement (both copies), website.
//  2. Only Complete with a website, only when ticked, frozen at send. Old agreements and monthly payers are untouched.
//  3. The agreement says what happens if either side leaves, and the exit fee is never charged on top of a paid year.
//  4. Billing: ONE payment that saves the card, never a subscription in year one; the webhook files it as a saved card,
//     never a hand-off; a paid invoice with no subscription never marks a client "active" (that stopped lead invoices).
//  5. Month 13: a week's heads-up, then $375/mo starts on the saved card, once, and never for someone who is leaving.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CS = require("../netlify/lib/contract-shared.cjs");
const PS = await import("../netlify/lib/pricing-shared.mjs");
const SD = await import("../netlify/lib/complete-stepdown.mjs");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const S = read("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");

const PKG = { id: "g-growth", name: "Growth System", platform: "Google Ads", price: 700, setup: 1500, pricingModel: "per_lead", adSpend: "$2,500 to $10,000/mo", tier: "growth" };
const base = { id: "np1", name: "Acme Pools", contactName: "Pat", email: "p@x.com", packageId: "g-growth", billingPerLead: 55, contractStart: "2026-01-15", plan: "complete", contractTermsVersion: 9 };
const ticked = { ...base, planPrepay: true };

// 1. One set of numbers
const pp = CS.planPrepayOf(ticked);
ok("$5,400 for the year, saves $600, $450 a month", pp && pp.total === 5400 && pp.saves === 600 && pp.full === 6000 && pp.perMonth === 450, JSON.stringify(pp));
ok("the price list says the same", PS.COMPLETE_PLAN.prepayYear === pp.total && PS.COMPLETE_PLAN.prepayDiscountPct === CS.COMPLETE_PLAN.prepayDiscountPct);
const fn = (src) => { const i = src.indexOf("function planPrepayOf(cl) {"); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i)); };
ok("🔴 the OS copy of the rule is the agreement's, word for word", fn(S) && fn(S) === fn(read("netlify/lib/contract-shared.cjs")));
ok("the OS price constants match", S.includes("careEdits: 2, prepayDiscountPct: 10 };"));

// 2. Only when it applies
ok("not ticked: nothing", CS.planPrepayOf(base) === null);
ok("ads only: nothing", CS.planPrepayOf({ ...ticked, plan: "ads" }) === null);
ok("a store (no website, no 12 months): nothing", CS.planPrepayOf({ ...ticked, packageId: "e-growth" }) === null);
ok("an older agreement: nothing", CS.planPrepayOf({ ...ticked, contractTermsVersion: 8 }) === null);
const sent = { ...base, contractSigned: true, contractPlan: "complete", contractPlanMonthly: 500, contractPlanMonthlyAfter: 375 };
ok("🔴 sent without it: unticking or ticking later changes nothing", CS.planPrepayOf({ ...sent, planPrepay: true }) === null);
ok("sent with it: the frozen total holds", (CS.planPrepayOf({ ...sent, contractPlanPrepay: 5400, planPrepay: false }) || {}).total === 5400);
ok("a custom plan fee is discounted the same way", (CS.planPrepayOf({ ...ticked, billingPlanMonthly: 450 }) || {}).total === 4860);
ok("frozen at send, cleared on reset", S.includes("contractPlanPrepay:(planPrepayOf(client)||{}).total||null,") && S.includes("contractPlanMonthlyAfter:null,contractPlanPrepay:null,"));

// 3. The agreement
const yes = text(CS.makeContractHTML(ticked, PKG, "")), no = text(CS.makeContractHTML(base, PKG, ""));
ok("it says $5,400, the $600 saved and what it covers", /Paid in advance\. Client has chosen to pay the Complete Plan Fee for the whole initial term up front: \$5,400 for the twelve \(12\) months, which is \$600 less/.test(yes));
ok("🔴 the client leaving early: not refunded, nothing more for the build", /If Client ends it early, the prepaid amount is not refunded/.test(yes) && /nothing further is owed for the website build, and the prepaid amount is not refunded/.test(yes));
ok("🔴 BoldLine ending it: $450 back for each month left", /Agency refunds \$450 for each whole month of the initial term remaining/.test(yes));
ok("lead fees are still monthly", /The Performance Fee is still billed monthly/.test(yes));
ok("the summary at the top says it", /Complete Plan Fee \$5,400 paid up front for the Initial Term, then \$375\/mo/.test(yes));
ok("billing mechanics say it", /paid in advance in one payment under Section \d+\(c\), and after the initial term it is billed monthly in advance/.test(yes));
ok("🔴 a monthly payer's agreement has none of it", !/Paid in advance|paid up front|prepaid amount/.test(no) && /\$125 for each month of the initial term remaining/.test(no));
ok("no dashes in the client's agreement wording", !/[—–]/.test(yes.slice(yes.indexOf("Paid in advance"), yes.indexOf("Paid in advance") + 900)));
ok("the OS copy carries the same clauses", ["Paid in advance.</strong> Client has chosen", "the prepaid amount is not refunded. Any Setup Fee", "paid in advance in one payment under Section "].every((k) => S.includes(k)));
ok("🔴 no exit fee on top of a paid year", CS.completeExitOwed(ticked, new Date("2026-04-20")) === 0 && CS.completeExitOwed(base, new Date("2026-04-20")) > 0);

// 4. Billing
const SB = read("netlify/functions/stripe-billing.mjs"), WH = read("netlify/functions/stripe-webhook.mjs");
const pre = SB.slice(SB.indexOf("if (prepay) {"), SB.indexOf("return json({ ok: true, url: session.url, customerId, prepay: true });"));
ok("🔴 one payment, not a subscription", /mode: "payment"/.test(pre) && !/recurring/.test(pre) && !/mode: "subscription"/.test(pre));
ok("🔴 the card is saved for the lead fees", /setup_future_usage: "off_session"/.test(pre));
ok("it is tagged, and gets a real invoice and receipt", /prepay: "1"/.test(pre) && /invoice_creation: \{ enabled: true/.test(pre));
ok("the amount is the year's", /first 12 months paid in advance` \},\s*unit_amount: dollars\(prepayAmount\),/.test(SB) && /prepay && !\(prepayAmount > 0\)/.test(SB));
ok("🔴 webhook: a paid year is a saved card, never a hand-off", /if \(obj\.metadata\?\.prepay === "1"\) \{[\s\S]{0,300}patch\.billingStatus = "card_on_file";[\s\S]{0,400}\} else if \(obj\.metadata\?\.oneTime === "1"/.test(WH));
ok("🔴 webhook: a paid invoice with no subscription keeps the client on card_on_file", /if \(event\.type === "invoice\.paid" && !invSub && !cl\.stripeSubscriptionId\) patch\.billingStatus = "card_on_file";/.test(WH));
ok("the record is the server's, never overwritten by a browser save", /const SERVER_OWNED_KEYS=\[[^\]]*"completePrepay"\]/.test(S));
ok("OS: the tick and the button", S.includes("Pay the first year up front: {wdMoney(pp.total)}") && S.includes("Collect the ${money(prepay.total)} for Year One →") && /prepay:!!prepay,prepayAmount:prepay\?prepay\.total:0,/.test(S));
ok("lead invoices still run for them in year one", (await import("../netlify/functions/lead-invoice-run.mjs")).dueForInvoice({ stripeCustomerId: "cus_1", billingStatus: "card_on_file" }));

// 5. Month 13
const live = { ...sent, contractPlanPrepay: 5400, contractStatus: "active", stripeCustomerId: "cus_1", completePrepay: { sessionId: "cs_1", paidAt: "2026-01-10T00:00:00Z" } };
const at = (d) => new Date(d);
ok("two weeks out: nothing", SD.prepayFollowOnDue(live, null, at("2027-01-01T12:00:00Z")) === null);
const n = SD.prepayFollowOnDue(live, null, at("2027-01-09T12:00:00Z"));
ok("a week out: Bryson gets a heads-up", n && n.kind === "notice" && n.monthly === 375 && n.termEnd === "2027-01-15", JSON.stringify(n));
ok("the heads-up goes once", SD.prepayFollowOnDue({ ...live, completePrepay: { ...live.completePrepay, noticeFor: "2027-01-15" } }, null, at("2027-01-10T12:00:00Z")) === null);
const st = SD.prepayFollowOnDue(live, null, at("2027-01-15T12:00:00Z"));
ok("🔴 the day year one ends: $375 starts", st && st.kind === "start" && st.monthly === 375);
ok("🔴 never for someone leaving", SD.prepayFollowOnDue({ ...live, etf: { total: 0 } }, null, at("2027-01-15T12:00:00Z")) === null && SD.prepayFollowOnDue({ ...live, contractStatus: "expired" }, null, at("2027-01-15T12:00:00Z")) === null);
ok("never twice", SD.prepayFollowOnDue({ ...live, completePrepay: { ...live.completePrepay, followOn: { subscriptionId: "sub_1" } } }, null, at("2027-02-01T12:00:00Z")) === null && SD.prepayFollowOnDue({ ...live, stripeSubscriptionId: "sub_1" }, null, at("2027-02-01T12:00:00Z")) === null && SD.prepayFollowOnDue(live, { id: "sub_1" }, at("2027-02-01T12:00:00Z")) === null);
ok("never for BoldLine's own, a monthly payer, or a year never paid for", SD.prepayFollowOnDue({ ...live, internal: true }, null, at("2027-01-15T12:00:00Z")) === null && SD.prepayFollowOnDue({ ...live, contractPlanPrepay: null }, null, at("2027-01-15T12:00:00Z")) === null && SD.prepayFollowOnDue({ ...live, completePrepay: null }, null, at("2027-01-15T12:00:00Z")) === null);
ok("a monthly payer's subscription still steps down the old way", !!SD.completeStepDownDue(sent, { id: "s", status: "active", current_period_end: Date.parse("2027-01-15T00:00:00Z") / 1000, items: { data: [{ id: "si", price: { unit_amount: 50000, product: "p" } }] } }));

const calls = [];
const api = (pm, paid = "paid") => ({
  resolvePaymentMethod: async () => pm,
  stripe: async (path, opts = {}) => { calls.push({ path, ...opts }); if (path.startsWith("checkout/sessions/")) return { payment_status: paid }; if (path === "products") return { id: "prod_1" }; return { id: "sub_9", status: "active" }; },
});
const fo = await SD.startPrepayFollowOn(api("pm_1"), live, 375);
const subCall = calls.find((c) => c.path === "subscriptions");
ok("🔴 $375 a month on the saved card", subCall && subCall.body.items[0].price_data.unit_amount === 37500 && subCall.body.items[0].price_data.recurring.interval === "month" && subCall.body.collection_method === "charge_automatically" && subCall.body.default_payment_method === "pm_1");
ok("it is the ads subscription (lead fees ride it from then on)", subCall && !subCall.body.metadata.kind && subCall.body.metadata.clientId === "np1" && fo.subscriptionId === "sub_9");
ok("🔴 one key per client and start date, so it can never open two", subCall && subCall.idempotencyKey === "complete-prepay-followon-np1-20260115-sub");
calls.length = 0;
const fo2 = await SD.startPrepayFollowOn(api(null), live, 375);
ok("no saved card: emailed invoices instead", calls.find((c) => c.path === "subscriptions").body.collection_method === "send_invoice" && fo2.collection === "invoice");
let threw = false;
try { await SD.startPrepayFollowOn(api("pm_1", "unpaid"), { ...live, completePrepay: { sessionId: "cs_1" } }, 375); } catch { threw = true; }
ok("🔴 a year that never cleared starts nothing", threw);
const BW = read("netlify/functions/billing-watch.mjs");
ok("billing-watch runs it daily", /const fo = prepayFollowOnDue\(cl, sub\);/.test(BW) && /startPrepayFollowOn\(\{ stripe: stripeApi, resolvePaymentMethod \}, cl, fo\.monthly\)/.test(BW) && /timeZone: "America\/Phoenix"/.test(BW));

// The website and the sales notes
const site = read("marketing-site/pricing/index.html");
ok("pricing page: $5,400, saves $600", /Rather pay the year up front\?<\/b> It's \$5,400 for the first 12 months instead of \$6,000, so you save \$600/.test(site));
ok("pricing page: no dashes in the new line", !/[—–]/.test((site.match(/Rather pay the year up front\?[^<]*<\/b>[^<]*/) || [""])[0]));
ok("FAQ and llms.txt", read("marketing-src/faq.html").includes("pay the first year up front for $5,400 and save $600") && read("marketing-site/llms.txt").includes("$5,400 for the first year paid up front"));
ok("Deal Prep knows the option", PS.completePromptBlock(55).includes("pay the first year up front: $5,400 once"));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-complete-prepay: ${pass} checks passed`);
