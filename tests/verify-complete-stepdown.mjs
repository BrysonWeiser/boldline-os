// Complete steps down after year one (Bryson, 2026-11-10: "Let's change it to what you said", KB complete-plan):
// $500 a month for the 12-month initial term (that pays back the free website build), then $375. Run:
// node tests/verify-complete-stepdown.mjs
//
// What has to stay true:
//  1. Billing lowers the Stripe price in time for the FIRST invoice after the initial term: not a month early (that
//     undercharges what was agreed), not a month late (that overcharges). Month already paid: untouched.
//  2. It only ever lowers, only to what the agreement says, and never for a store (no website) or an agreement sent
//     before this change (it says "the same fee").
//  3. Every screen that shows what a Complete client pays NOW reads the stepped-down fee, and the portal says it too.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CS = require("../netlify/lib/contract-shared.cjs");
const S = await import("../netlify/lib/complete-stepdown.mjs");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const cl = { name: "Summit", plan: "complete", packageId: "g-growth", contractTermsVersion: 9, contractSigned: true, contractPlan: "complete",
  contractPlanMonthly: 500, contractPlanMonthlyAfter: 375, contractStart: "2026-01-15" };
const sub = (nextInvoice, cents = 50000, status = "active") => ({ id: "sub_1", status, current_period_end: Date.parse(nextInvoice) / 1000,
  items: { data: [{ id: "si_1", price: { unit_amount: cents, product: "prod_1" } }] } });

// 1. Timing
ok("month 11 (next invoice is month 12): not yet", S.completeStepDownDue(cl, sub("2026-12-15T00:00:00Z")) === null);
const due = S.completeStepDownDue(cl, sub("2027-01-15T00:00:00Z"));
ok("🔴 month 12 (next invoice is month 13): due, $500 to $375", due && due.from === 500 && due.to === 375 && due.termEnd === "2027-01-15", JSON.stringify(due));
ok("a missed day still catches it later", !!S.completeStepDownDue(cl, sub("2027-03-15T00:00:00Z")));
ok("a month-end start date still lands on the right month", !!S.completeStepDownDue({ ...cl, contractStart: "2026-01-31" }, sub("2027-01-31T00:00:00Z")) && !S.completeStepDownDue({ ...cl, contractStart: "2026-01-31" }, sub("2026-12-31T00:00:00Z")));
// 2. Only ever lowers, only what the agreement says
ok("already $375: nothing to do", S.completeStepDownDue(cl, sub("2027-02-15T00:00:00Z", 37500)) === null);
ok("🔴 never raises a lower price", S.completeStepDownDue(cl, sub("2027-02-15T00:00:00Z", 30000)) === null);
ok("🔴 an agreement sent before the change keeps its flat fee", S.completeStepDownDue({ ...cl, contractPlanMonthlyAfter: undefined }, sub("2027-01-15T00:00:00Z")) === null);
ok("a store never steps down", S.completeStepDownDue({ ...cl, packageId: "e-growth" }, sub("2027-01-15T00:00:00Z")) === null);
ok("ads only: nothing", S.completeStepDownDue({ ...cl, plan: "ads", contractPlan: "ads" }, sub("2027-01-15T00:00:00Z")) === null);
ok("a cancelled subscription is left alone", S.completeStepDownDue(cl, sub("2027-01-15T00:00:00Z", 50000, "canceled")) === null);
ok("no Start Date: nothing", S.completeStepDownDue({ ...cl, contractStart: "" }, sub("2027-01-15T00:00:00Z")) === null);
ok("a custom $450 Complete steps down by the same $125", S.completeStepDownDue({ ...cl, contractPlanMonthly: 450, contractPlanMonthlyAfter: 325 }, sub("2027-01-15T00:00:00Z", 45000)).to === 325);
{
  const calls = [];
  await S.applyStepDown(async (p, o) => { calls.push({ p, o }); return { active: true }; }, sub("2027-01-15T00:00:00Z"), 375, "Summit");
  const up = calls.find((c) => c.p === "subscriptions/sub_1");
  ok("🔴 changes the same line, from the next invoice only (no proration)", up && up.o.body.proration_behavior === "none" && up.o.body.items[0].id === "si_1" && up.o.body.items[0].price_data.unit_amount === 37500 && up.o.body.items[0].price_data.product === "prod_1");
  ok("and cannot be applied twice by a retry", /complete-stepdown-sub_1-37500/.test(up && up.o.idempotencyKey));
}
const BW = read("netlify/functions/billing-watch.mjs");
ok("the daily billing check runs it on the ads subscription", /const step = completeStepDownDue\(cl, sub\);/.test(BW) && BW.indexOf("completeStepDownDue(cl, sub)") > BW.indexOf("const sub = adsSubscriptionOf(subs.data);"));
ok("it tells Bryson, and tells him if Stripe refused", /Complete fee drops to/.test(BW) && /Complete step-down FAILED/.test(BW));

// 3. What screens show
const UI = read("index.html");
ok("billing terms use this month's fee", /const planMonthly = planFeeNowOf\(c\);/.test(UI));
ok("the invoice email uses this month's fee", /planMonthly: planFeeNowOf\(client\),/.test(UI));
ok("the Package tab shows the year-two price under the fee", /\/mo after year one<\/div>/.test(UI));
ok("the Plan card says it drops after 12 months", /After the 12 months it drops to \$\{wdMoney\(planFeeAfterTermOf\(client\)\)\} a month by itself/.test(UI));
ok("Deal Prep and the cold-call card quote it", /then month to month at \$\$\{COMPLETE_PLAN\.monthlyAfterTerm\}\/mo/.test(UI) && /and \$\$\{COMPLETE_PLAN\.monthlyAfterTerm\} after the first year/.test(UI));
ok("the OS copy of the price list has it", /const COMPLETE_PLAN = \{ monthly: 500, monthlyAfterTerm: 375,/.test(UI) && /const COMPLETE_PLAN = \{ monthly: 500, monthlyAfterTerm: 375,/.test(read("netlify/lib/contract-shared.cjs")));
ok("the client portal tells the client", /\/mo after your first year\)/.test(read("netlify/functions/portal.mjs")));
ok("the sales and scout prompts know it", /then month to month at a LOWER \$\$\{COMPLETE_PLAN\.monthlyAfterTerm\} a month/.test(read("netlify/lib/pricing-shared.mjs")) && /drops to \$\$\{COMPLETE_PLAN\.monthlyAfterTerm\} after the first year/.test(read("netlify/lib/scout-shared.mjs")));

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-complete-stepdown: ${pass} checks passed`);
