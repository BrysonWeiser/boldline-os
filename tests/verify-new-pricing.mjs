// The new pricing and the Complete plan, inside the OS (Bryson, Sat 2026-11-07, KB `complete-plan`).
// Run: node tests/verify-new-pricing.mjs
//
// Decided: no monthly minimum for anyone (ads per qualified lead, stores a share of ad spend); every agreement
// starts with 3 months, Complete with 12; after that it runs month to month with nothing to renew, and either side
// ends it with 30 days' notice; the first five clients get their first month of LEAD FEES free; Complete is $500 a
// month plus the lead fee, with the website built free (leaving early pays $125 for each month left of the first
// year), hosting and care, Google profile care, a blog, past-customer emails and booking, all on ONE agreement and
// ONE bill.
//
// 🔴 What would cost real money if it broke, and is therefore pinned here:
//   1. An agreement signed BEFORE the new pricing must read exactly as it did (terms are versioned: v9 is new).
//   2. The OS and the client portal must render the SAME agreement (two copies of the renderer).
//   3. A Complete client must never be billed twice: no website agreement, no website care plan, no Google
//      profile add-on, and lead fees added ON TOP of the $500, never measured against it.
//   4. What is sent is frozen: ticking boxes after sending can't rewrite a signed agreement.
//   5. The founding month is decided by when a lead ARRIVED, not when it was approved.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const CS = require("../netlify/lib/contract-shared.cjs");
const PS = await import("../netlify/lib/pricing-shared.mjs");
const WD = await import("../netlify/lib/website-deal.mjs");
const SB = await import("../netlify/lib/site-blog.mjs");
const DR = await import("../netlify/functions/deal-research-background.mjs");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const CODE = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const text = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// The OS copy of the renderer, lifted for real (the same harness every contract suite uses).
const decl = (start, end) => { const i = S.indexOf(`const ${start}`); if (i < 0) throw new Error(start); return S.slice(i, S.indexOf(end, i) + end.length); };
const OS = new Function([
  'var LOGO="";', decl("ALL_FEATURES = [", "\n];"), decl("PKG_FEATURES = {", "\n};"), decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"), decl("resultWords = (cl)", "\n};"), decl("TERMS_V2_FROM", "&& off.indexOf(fid) < 0);\n}"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn { makeContractHTML, planOf, planFeeOf, minimumOf, foundingFreeMonthOf, rollingTerm, completeExitOwed, COMPLETE_PLAN, ADS_FIRST_TERM_MONTHS, NOTICE_DAYS, FOUNDING_FREE_DAYS, termsVersionOf, addOnsOf };")();

const PKG = { id: "g-growth", name: "Growth System", platform: "Google Ads", price: 700, setup: 1500, pricingModel: "per_lead", adSpend: "$2,500 to $10,000/mo", tier: "growth" };
const STORE = { id: "e-growth", name: "Store Growth", platform: "Meta Ads", price: 700, setup: 1400, pricingModel: "ad_spend_pct", adSpendPct: 15, adSpend: "$2,500 to $10,000/mo", tier: "growth" };
const base = { id: "np123456", name: "Acme Pools", contactName: "Pat", email: "pat@example.com", packageId: "g-growth", billingPerLead: 55, contractStart: "Nov 20, 2026", contractEnd: "Feb 20, 2027" };
const both = (cl, pkg = PKG) => [CS.makeContractHTML(cl, pkg, ""), OS.makeContractHTML(cl, pkg, "")];
const heads = (h) => [...h.matchAll(/<h2>(\d+)\. [^<]+<\/h2>/g)].map((m) => Number(m[1]));

// ── 0. One set of numbers ─────────────────────────────────────────────────────────────────────────────
eq("the agreement's Complete price is the price list's", CS.COMPLETE_PLAN.monthly, PS.COMPLETE_PLAN.monthly);
eq("and the early-exit amount", CS.COMPLETE_PLAN.exitPerMonth, PS.COMPLETE_PLAN.earlyExitPerMonthLeft);
eq("and the first terms", `${CS.ADS_FIRST_TERM_MONTHS}/${CS.COMPLETE_PLAN.termMonths}`, `${PS.TERMS.adsFirstTermMonths}/${PS.TERMS.completeFirstTermMonths}`);
eq("and the notice", CS.NOTICE_DAYS, PS.TERMS.noticeDays);
eq("the OS copy agrees with the agreement copy", JSON.stringify(OS.COMPLETE_PLAN), JSON.stringify(CS.COMPLETE_PLAN));
eq("the exit amount is the build spread over the year", CS.COMPLETE_PLAN.exitPerMonth * CS.COMPLETE_PLAN.termMonths, PS.WEBSITE_OFFER.build);
eq("the current terms are v9", CS.TERMS_CURRENT, 9);
ok("the OS renewal stamp is v9 too", /const CONTRACT_TERMS_VERSION = 9;/.test(S));

// ── 1. The two copies of the agreement are the same document ───────────────────────────────────────────
for (const [label, cl, pkg] of [
  ["ads", base, PKG], ["Complete", { ...base, plan: "complete" }, PKG], ["founding", { ...base, foundingFreeMonth: true }, PKG],
  ["Complete + founding + special terms", { ...base, plan: "complete", foundingFreeMonth: true, specialTerms: { clauses: [{ heading: "Note", text: "Agreed on the call." }] } }, PKG],
  ["store", { ...base, packageId: "e-growth", billingPerLead: null }, STORE], ["old v8", { ...base, contractTermsVersion: 8, billingMonthly: 700 }, PKG],
]) {
  const [a, b] = both(cl, pkg);
  eq(`🔴 OS and portal render the same agreement (${label})`, a === b, true);
  const ns = heads(a); ok(`sections numbered 1..N with no gap (${label})`, JSON.stringify(ns) === JSON.stringify(ns.map((_, i) => i + 1)), ns.join(","));
  ok(`no em or en dash (${label})`, !/[—–]/.test(text(a).replace(/Agency — BoldLine Media LLC|Client — [^<]*|Growth System — Google Ads|Store Growth — Meta Ads/g, "")));
}

// ── 2. A new ads agreement (v9) ─────────────────────────────────────────────────────────────────────────
{
  const t = text(both(base)[0]);
  ok("🔴 v9: no monthly minimum, in capitals", /THERE IS NO MONTHLY MINIMUM\./.test(t));
  ok("and the key terms say None", /Monthly Minimum None/.test(t));
  ok("and the package's old $700 minimum appears nowhere", !/\$700/.test(t));
  ok("a month with no leads costs nothing, for the whole agreement", /Client owes no Performance Fee for that month/.test(t) && /including after the initial term/.test(t));
  ok("🔴 no 'minimum from renewal' clause (that was the founding wording)", !/From any renewal term onward a Monthly Minimum/.test(t));
  ok("3 months, then month to month", /Initial Term 3 months, then month to month/.test(t) && /continues month to month on the same terms, with nothing further to sign/.test(t));
  ok("no renewal menu and no holdover", !/renew for a length/.test(t) && !/Holdover/.test(t));
  ok("either side ends it with 30 days' notice", /by thirty \(30\) days' written notice/.test(t));
  ok("🔴 no early-termination fee", /THERE IS NO EARLY-TERMINATION FEE UNDER THIS AGREEMENT/.test(t) && !/Monthly Minimum for each remaining month/.test(t));
  ok("nothing is billed in advance and no subscription is authorised", /THERE IS NO RECURRING SUBSCRIPTION/.test(t));
  ok("no Complete section on an ads agreement", !/The Complete Plan/.test(t));
  const st = text(both({ ...base, packageId: "e-growth", billingPerLead: null }, STORE)[0]);
  ok("a store: 15% of spend, no minimum, and its own words (no 'Qualified Leads')", /15% of monthly ad spend/.test(st) && /THERE IS NO MONTHLY MINIMUM\./.test(st) && !/Qualified Lead/.test(st));
  ok("a store: a month with no spend costs nothing", /A month with no advertising spend produces no charge/.test(st));
}

// ── 3. The Complete plan ────────────────────────────────────────────────────────────────────────────────
{
  const cl = { ...base, plan: "complete" }, t = text(both(cl)[0]);
  ok("Complete: the fee is in the key terms", /Complete Plan Fee \$500\/mo/.test(t));
  ok("Complete: the package names both", /Service Package Complete Plan, with Growth System advertising/.test(t));
  ok("Complete: 12 months, then month to month", /Initial Term 1 year, then month to month/.test(t) && /twelve \(12\) months/.test(t));
  ok("🔴 Complete: lead fees are ON TOP, never measured against the $500", /separate from and in addition to the Complete Plan Fee/.test(t) && /neither counts toward or against the other/.test(t));
  ok("Complete: the plan fee is billed in advance and authorised", /The Complete Plan Fee is charged monthly in advance by automatic payment/.test(t));
  for (const w of ["A website of up to 5 pages", "Hosting and care", "Google Business Profile care", "A blog", "Emails to Client's past customers", "Online booking"])
    ok(`Complete includes: ${w}`, t.includes(w));
  ok("🔴 the build fee is named, waived, and the exit is $125 per month left", /standard fee to build this website is \$1,500/.test(t) && /\$125 for each month of the initial term remaining/.test(t));
  ok("the exit is liquidated damages with a stated reason", /as liquidated damages and not as a penalty/.test(t) && /built the website at no charge in return for the twelve-month commitment/.test(t));
  ok("the domain and the content stay the client's", /domain stays registered to Client/.test(t) && /words, logo and photos on the website are Client's/.test(t));
  ok("Google profile care: reviews earned, never bought", /Reviews are earned, never bought/.test(t));
  ok("no dash in the Complete section either", !/[—–]/.test(t.slice(t.indexOf("The Complete Plan"), t.indexOf("Signatures"))));
  // 🔴 Never billed twice for Google profile care.
  const gbp = { ...cl, addOns: [{ id: "gbp_care", monthly: 130 }] };
  eq("🔴 Complete never carries the Google profile add-on too", CS.addOnsOf(gbp).length, 0);
  ok("and its agreement has no add-on section", !/Add-On Service: Google Business Profile Care/.test(both(gbp)[0]));
  ok("the Add-ons card hides itself for Complete", /if\(planOf\(client\)==="complete"\) return null;   \/\/ Complete already includes Google profile care/.test(S));
  eq("Complete at the client's own price", CS.planFeeOf({ ...cl, billingPlanMonthly: 450 }), 450);
  eq("an ads client has no plan fee", CS.planFeeOf(base), 0);
}

// ── 4. Old agreements are untouched ─────────────────────────────────────────────────────────────────────
{
  const signedV8 = { ...base, contractSigned: true, contractSignedAt: "2026-11-01T18:00:00Z", billingMonthly: 700, plan: "complete", foundingFreeMonth: true };
  eq("🔴 an agreement signed before the new pricing stays on v8", CS.termsVersionOf(signedV8), 8);
  const t = text(both(signedV8)[0]);
  ok("🔴 it keeps its minimum, its greater-of rule and its renewal menu", /\$700\/mo/.test(t) && /greater of/.test(t) && /renew for a length/.test(t));
  ok("🔴 ticking Complete or the founding month on an old record changes nothing", !/Complete Plan/.test(t) && !/Founding client: the first month is free/.test(t));
  eq("and it is not month to month", CS.rollingTerm(signedV8), false);
  eq("its minimum is still its own", CS.minimumOf(signedV8, PKG), 700);
  eq("a v9 client has no minimum even if one was typed", CS.minimumOf({ ...base, billingMonthly: 700 }, PKG), 0);
  eq("a hand-off has no minimum", CS.minimumOf(base, { pricingModel: "one_time", price: 0 }), 0);
}

// ── 5. What is sent is frozen ───────────────────────────────────────────────────────────────────────────
{
  const sent = { ...base, docusignSentAt: "2026-11-10T18:00:00Z", contractTermsVersion: 9, contractPlan: "ads", contractFoundingFreeMonth: false };
  const after = { ...sent, plan: "complete", foundingFreeMonth: true, billingPlanMonthly: 300 };
  eq("🔴 switching the plan box after sending doesn't turn it into Complete", CS.planOf(after), "ads");
  eq("nor tick the founding month on", CS.foundingFreeMonthOf(after), false);
  eq("and the agreement reads exactly as sent", both(after)[0], both(sent)[0]);
  const sentC = { ...base, docusignSentAt: "2026-11-10T18:00:00Z", contractTermsVersion: 9, contractPlan: "complete", contractPlanMonthly: 500 };
  eq("a sent Complete price can't be changed afterwards", CS.planFeeOf({ ...sentC, billingPlanMonthly: 300 }), 500);
  eq("🔴 a voided envelope froze nothing", CS.planOf({ ...sent, docusignStatus: "voided", plan: "complete" }), "complete");
  ok("🔴 the OS stamps the plan, its price and the founding month when it sends",
    /contractPlan:planOf\(client\),contractPlanMonthly:planFeeOf\(client\)\|\|null,contractPlanMonthlyAfter:planOf\(client\)==="complete"\?planFeeAfterTermOf\(client\):null,contractFoundingFreeMonth:foundingFreeMonthOf\(client\),contractWaivedSetup:waivedSetupOf\(client,pkg\),contractLateFee:/.test(S));
  ok("and replacing an agreement unfreezes them", /contractPlan:null,contractPlanMonthly:null,contractPlanMonthlyAfter:null,contractFoundingFreeMonth:null/.test(S));
}

// ── 🔴 The step-down after year one (Bryson, 2026-11-10, KB complete-plan): $500 for the first 12 months, then $375,
// so Complete is never dearer than buying the same pieces. Stores never step down. Agreements sent before keep their flat fee.
{
  const C = { name: "Summit", plan: "complete", packageId: "g-growth", contractTermsVersion: 9 };
  eq("year one is $500", CS.planFeeOf(C), 500);
  eq("🔴 after year one it is $375 (the $125 that paid back the build comes off)", CS.planFeeAfterTermOf(C), 500 - CS.COMPLETE_PLAN.exitPerMonth);
  eq("the price list says the same", PS.COMPLETE_PLAN.monthlyAfterTerm, 375);
  eq("a store never steps down (no website to pay back)", CS.planFeeAfterTermOf({ ...C, packageId: "e-growth" }), CS.planFeeOf({ ...C, packageId: "e-growth" }));
  eq("ads only: no plan fee either way", CS.planFeeAfterTermOf({ ...C, plan: "ads" }), 0);
  const oldSent = { ...C, contractSigned: true, contractPlan: "complete", contractPlanMonthly: 500 };
  eq("🔴 an agreement sent before the change keeps the flat fee it says", CS.planFeeAfterTermOf(oldSent), 500);
  const newSent = { ...oldSent, contractPlanMonthlyAfter: 375, contractStart: "2026-01-15" };
  eq("a new one is frozen at what it said", CS.planFeeAfterTermOf({ ...newSent, billingPlanMonthly: 450 }), 375);
  eq("month 12 is still $500", CS.planFeeNowOf(newSent, "2026-12-20"), 500);
  eq("🔴 month 13 is $375", CS.planFeeNowOf(newSent, "2027-01-15"), 375);
  eq("and stays $375", CS.planFeeNowOf(newSent, "2027-08-01"), 375);
  const html = CS.makeContractHTML(C, PS.PACKAGES.find((p) => p.id === "g-growth"));
  ok("🔴 the agreement says it drops to $375 after the initial term", /drops to \$375(\.00)? per month<\/strong> from the first month after the initial term/.test(html) && /\$500(\.00)?\/mo, then \$375(\.00)?\/mo after the Initial Term/.test(html));
  const oldHtml = CS.makeContractHTML(oldSent, PS.PACKAGES.find((p) => p.id === "g-growth"));
  ok("an old agreement still reads 'the same fee'", /continues month to month at the same fee/.test(oldHtml) && !/drops to/.test(oldHtml));
}

// ── 6. The founding month ───────────────────────────────────────────────────────────────────────────────
{
  const t = text(both({ ...base, foundingFreeMonth: true })[0]);
  ok("🔴 founding: the first 30 days after the Start Date carry no Performance Fee", /No Performance Fee is charged for Qualified Leads generated during the first thirty \(30\) days after the Start Date/.test(t));
  ok("and the client still pays its own ad spend", /Client still pays its advertising spend directly to the platforms/.test(t));
  ok("and it is in the key terms", /Founding Client No Performance Fee for the first thirty \(30\) days after the Start Date/.test(t));
  ok("not on an agreement without it", !/Founding/.test(text(both(base)[0])));
  // The billing card: decided by when the lead ARRIVED.
  ok("🔴 the Billing card counts a lead as free by when it arrived", /const leadAt = \(l\)=>new Date\(l\.receivedAt\|\|l\.createdAt\|\|l\.date\|\|0\)\.getTime\(\);/.test(S)
    && /t<freeUntil/.test(S) && /t\+FOUNDING_FREE_DAYS\*864e5/.test(S));
  ok("free leads are not charged", /const leadAmount = \(billableCount-freeCount\)\*perLeadRate;/.test(S));
  ok("but they are recorded as approved, marked free", /freeFounding:true,fee:0/.test(S));
}

// ── 7. Billing: one bill for Complete, never twice ──────────────────────────────────────────────────────
{
  ok("🔴 lead fees are measured against the MINIMUM only (zero on v9), never against the Complete fee", /const monthlyFloor = minimum;/.test(S));
  ok("the subscription charges the minimum plus the plan fee", /const minimum=minimumOf\(client,pkg\), planFee=planFeeOf\(client\), complete=planFee>0;/.test(S) && /const monthly=minimum\+planFee;/.test(S));
  ok("the checkout names the Complete fee for what it is", /productLabel:complete\?`Complete plan with \$\{pkg&&pkg\.name\} \(monthly\)`:""/.test(S)
    && /body\.productLabel \?/.test(src("netlify/functions/stripe-billing.mjs")));
  ok("a Complete lead line never says 'above monthly minimum'", /arrears:resultsOnly\|\|minimum===0/.test(S));
  const sbill = src("netlify/functions/website-deal.mjs");
  ok("🔴 putting a Complete site live never starts the $100 care plan", /const r = completeCovered\(cl\) \? null : await startCarePlan\(cl, api\);/.test(sbill));
  ok("🔴 and the website deal card shows no agreement or invoice for Complete", /if\(wdComplete\(client\)\) return \(/.test(S) && /Covered by Complete/.test(S));
}

// ── 8. The website for a Complete client ────────────────────────────────────────────────────────────────
{
  const unsigned = { ...base, plan: "complete" }, signed = { ...unsigned, contractSigned: true, contractSignedAt: "2026-11-12T18:00:00Z" };
  ok("unsigned Complete: the build waits for THE agreement, not a website one", /Complete client/.test(WD.buildLock(unsigned) || ""));
  eq("signed Complete: the build is unlocked with nothing paid", WD.buildLock(signed), null);
  eq("and it can go live with nothing paid", WD.publishLock(signed), null);
  ok("an ads-only client still needs the website agreement", /Send the website agreement first/.test(WD.buildLock({ ...base, contractSigned: true }) || ""));
  const live = { ...signed, websiteDeal: { launchedAt: "2026-12-01T18:00:00Z" } };
  eq("🔴 the blog runs for a live Complete site (it is included)", SB.blogActive(live), true);
  eq("but not before it is live", SB.blogActive(signed), false);
  // The OS mirror must say what the server says, with the real planOf in reach.
  const mirror = S.slice(S.indexOf("// ─── Website deal (mirror"), S.indexOf("// WD-MIRROR-END"));
  const M = new Function("planOf", `${mirror}; return { wdBuildLock, wdPublishLock };`)(CS.planOf);
  for (const [k, c] of [["unsigned", unsigned], ["signed", signed], ["ads", { ...base, contractSigned: true }]])
    ok(`OS and server agree on the website locks (${k})`, M.wdBuildLock(c) === WD.buildLock(c) && M.wdPublishLock(c) === WD.publishLock(c), `${M.wdBuildLock(c)} / ${WD.buildLock(c)}`);
}

// ── 9. Month to month: nothing nags about an end that isn't coming ──────────────────────────────────────
{
  eq("a v9 client rolls", CS.rollingTerm(base), true);
  ok("🔴 billing-watch never emails a v9 client to renew", /cl\.contractEnd && !rollingTerm\(cl\)\) \{/.test(src("netlify/functions/billing-watch.mjs")));
  ok("the calendar digest skips the end and the renewal window", /if \(c\.contractEnd && !rollingTerm\(c\)\) \{/.test(src("netlify/lib/calendar-digest-shared.mjs")));
  ok("the portal shows month to month, not an end date", /" · Month to month"/.test(src("netlify/functions/portal.mjs")));
  ok("the OS lists, alerts and scores ask daysToRenewal", (CODE.match(/daysToRenewal\(/g) || []).length >= 15 && !/daysUntil\((c|cl|a|b)\.contractEnd\)/.test(CODE));
  ok("the Contract tab never offers a v9 client a renewal", /\{!rolling&&showRenewBtn&&!showRenewal&&\(/.test(S));
  // "any part of a month counting as a whole month": only COMPLETED months are used up, exactly as the agreement says.
  eq("Complete exit: 3 whole months done, 9 left = $1,125", CS.completeExitOwed({ ...base, plan: "complete", contractStart: "2026-01-15" }, "2026-04-20"), 9 * 125);
  eq("Complete exit: a month under way is still owed in full", CS.completeExitOwed({ ...base, plan: "complete", contractStart: "2026-01-15" }, "2026-04-10"), 10 * 125);
  eq("Complete exit: before the Start Date the whole year is owed", CS.completeExitOwed({ ...base, plan: "complete", contractStart: "2026-01-15" }, "2026-01-01"), 12 * 125);
  eq("Complete exit: after the first year nothing is owed", CS.completeExitOwed({ ...base, plan: "complete", contractStart: "2025-01-15" }, "2026-04-10"), 0);
  eq("an ads client owes nothing to leave", CS.completeExitOwed(base, "2026-04-10"), 0);
}

// ── 9b. The cancellation fee: pay back the free setup (Bryson, 2026-11-07) ──────────────────────────────
{
  const waived = { ...base, billingSetup: 0, contractStart: "2026-11-20" };
  eq("the waived setup is the package's standard setup", CS.waivedSetupOf(waived, PKG), 1500);
  eq("🔴 leaving before the ads start pays it all back", CS.setupPaybackOwed(waived, PKG, "2026-11-10"), 1500);
  eq("leaving in the first month pays all three thirds (a month under way counts)", CS.setupPaybackOwed(waived, PKG, "2026-12-10"), 1500);
  eq("one whole month done: two thirds", CS.setupPaybackOwed(waived, PKG, "2026-12-25"), 1000);
  eq("two whole months done: one third", CS.setupPaybackOwed(waived, PKG, "2027-01-25"), 500);
  eq("after the first 3 months: nothing", CS.setupPaybackOwed(waived, PKG, "2027-02-25"), 0);
  eq("🔴 a client who PAID setup owes nothing extra", CS.setupPaybackOwed({ ...base, contractStart: "2026-11-20" }, PKG, "2026-12-10"), 0);
  eq("a part-discount pays back only what was waived", CS.waivedSetupOf({ ...base, billingSetup: 1000 }, PKG), 500);
  eq("the website Complete plan pays back the build instead, never the setup too", CS.setupPaybackOwed({ ...waived, plan: "complete" }, PKG, "2026-12-10"), 0);
  eq("a pre-v9 agreement never gains it", CS.setupPaybackOwed({ ...waived, contractTermsVersion: 8 }, PKG, "2026-12-10"), 0);
  const t = text(both(waived)[0]);
  ok("🔴 the agreement states it, with the amount, as liquidated damages", /one third of \$1,500 for each month of the initial term remaining/.test(t) && /as liquidated damages and not as a penalty/.test(t) && /without charging its standard Setup Fee in return for the three-month commitment/.test(t));
  ok("and the key terms flag it beside the waived setup", /Waived \(\$1,500 standard; paid back in part if Client leaves in the first 3 months\)/.test(t));
  ok("a client who paid setup still reads 'no early-termination fee'", /THERE IS NO EARLY-TERMINATION FEE/.test(text(both(base)[0])));
  const sent = { ...waived, docusignSentAt: "2026-11-10T18:00:00Z", contractTermsVersion: 9, contractWaivedSetup: 1500 };
  eq("🔴 frozen at send: a later price-list change can't move it", CS.waivedSetupOf(sent, { ...PKG, setup: 3000 }), 1500);
  ok("the OS stamps it when sending and clears it on replace", /contractWaivedSetup:waivedSetupOf\(client,pkg\),contractLateFee:/.test(S) && /contractWaivedSetup:null/.test(S));
  ok("the OS early-exit card adds it to what is owed", /const owed=completeExitOwed\(client\)\+setupPaybackOwed\(client,pkg\);/.test(S));
}

// ── 9c. Complete for online stores ($300 + share of spend, no website, 3 months) ─────────────────────────
{
  const st = { ...base, packageId: "e-growth", billingPerLead: null, plan: "complete", billingSetup: 0, contractStart: "2026-11-20" };
  eq("a store's Complete is $300", CS.planFeeOf(st), 300);
  eq("and the price list agrees", CS.COMPLETE_STORE.monthly, PS.COMPLETE_STORE.monthly);
  eq("3 months, not 12", CS.firstTermMonths(st), 3);
  eq("no website build to pay back", CS.completeExitOwed(st, "2026-12-10"), 0);
  eq("🔴 but the setup payback applies, like Ads", CS.setupPaybackOwed(st, STORE, "2026-12-10"), 1400);
  const [a, b] = both(st, STORE);
  eq("🔴 OS and portal render the same store Complete agreement", a === b, true);
  const t = text(a);
  ok("store Complete: named for what it is", /Complete Plan for Online Stores, with Store Growth advertising/.test(t) && /Complete Plan Fee \$300\/mo/.test(t));
  ok("store Complete: shop pages, past-buyer emails, Google profile if they have a location", /Shop pages for the ads/.test(t) && /Emails to Client's past buyers/.test(t) && /if Client has a location customers visit/.test(t));
  ok("🔴 store Complete: promises NO website", !/A website of up to/.test(t) && !/website build/.test(t) && /Agency does not build or run the store itself/.test(t));
  ok("store Complete: 3 months then month to month", /Initial Term 3 months, then month to month/.test(t));
  ok("store Complete: a month without spend adds nothing", /A month with no advertising spend adds nothing to the Complete Plan Fee/.test(t) && !/Qualified Lead/.test(t));
  const ns = heads(a); ok("store Complete: sections numbered with no gap", JSON.stringify(ns) === JSON.stringify(ns.map((_, i) => i + 1)), ns.join(","));
  eq("🔴 nothing website-side is 'covered' for a store (no free build unlocked)", WD.completeCovered({ ...st, contractSigned: true }), false);
  ok("and its website locks are the ordinary ones", /Send the website agreement first/.test(WD.buildLock({ ...st, contractSigned: true }) || ""));
  eq("never the Google profile add-on as well", CS.addOnsOf({ ...st, addOns: [{ id: "gbp_care" }] }).length, 0);
  ok("the sales prompt knows the store version", /\$300 a month plus their share of ad spend/.test(PS.completePromptBlock(55)));
  ok("the Plan card lets a store pick it", /Complete\{store\?" for stores":""\}/.test(S));
}

// ── 10. The OS: picking Complete and the ad tier ────────────────────────────────────────────────────────
{
  ok("the Plan card sits on the Contract tab, above Special Terms", /<PlanCard client=\{client\} pkg=\{pkg\} onUpdate=\{onUpdate\}\/>\n\s*<SpecialTermsCard/.test(S));
  ok("🔴 one tap per tier, with the tier their budget fits marked", /PLAN_TIERS\.map\(\(\[t,label,band\]\)=>/.test(S) && /FITS/.test(S) && /tierForBudget/.test(S));
  ok("and the platform is a tap (both only from $5,000)", /PLAN_PLATFORMS\.map/.test(S) && /budget<COMBO_MIN_BUDGET/.test(S));
  ok("switching to Complete sets the 12-month first term and end date (website plan)", /p==="complete"&&!store\?COMPLETE_PLAN\.termMonths/.test(S));
  ok("a store's Complete keeps a 3-month first term", /const months=p==="complete"&&!store\?COMPLETE_PLAN\.termMonths:ADS_FIRST_TERM_MONTHS;/.test(S));
  ok("Deal Prep can create a Complete client straight from the call", /withQuotedPlan\(clientFromMeeting\(/.test(S));
}

// ── 11. Deal Prep and the sales prompts ────────────────────────────────────────────────────────────────
{
  const blk = PS.completePromptBlock(55);
  ok("the model is told Complete is $500 PLUS the lead fee", /\$500 a month PLUS the same per-qualified-lead fee/.test(blk));
  ok("and when to recommend it", /WHEN TO RECOMMEND COMPLETE/.test(blk));
  ok("and never to invent a 'value' total", /Never quote a total "value" figure/.test(blk));
  ok("🔴 no package line tells the model about a minimum", !/MINIMUM|whichever is higher/i.test(PS.packagesPromptBlock(55).replace(/no minimum/g, "")));
  eq("the brief's plan line is read", DR.parsePlanLine("PLAN: complete\nRest").recommendPlan, "complete");
  eq("and removed from the brief", DR.parsePlanLine("PLAN: ads\nRest").brief, "Rest");
  ok("Deal Prep shows the three plans with this trade's lead fee", /★ Pitch this/.test(S) && /\["complete","Complete",`\$\$\{COMPLETE_PLAN\.monthly\}\/mo`/.test(S));
  ok("the cold-call card answers 'how much' with the new pricing", /There's no monthly fee for the ads\./.test(S));
  ok("🔴 the blog writer no longer tells the public about a minimum", !/minimum or the fee for qualified leads/.test(src("netlify/lib/blog-shared.mjs")));
  ok("nor the lead scout", !/\/mo minimum or/.test(src("netlify/lib/scout-shared.mjs")));
}

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-new-pricing: ${pass} checks passed`);
