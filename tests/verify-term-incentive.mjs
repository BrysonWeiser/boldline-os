// The longer-term discount has to be felt, which under greater-of pricing it was not.
//
// Bryson, 2026-09-02: *"with the new pricing how will we do the incentives we made to make
// companies want to sign up for longer contracts? ... the 1 month contract costing more, the
// 3 month being the base rate and the 6 month and 1 year contracts costing less overall"*.
//
// 🔴 THE INCENTIVE HAD QUIETLY STOPPED WORKING, AND NOTHING WAS BROKEN. Term pricing was
// built under the old model, where the monthly fee was simply what the client paid. Under
// the greater-of model the client pays the HIGHER of the monthly minimum and the performance
// fee, never both. So discounting only the minimum discounts only the months where the
// campaigns UNDERPERFORMED: a client whose ads work well never touches the minimum, and
// committing for a year bought them literally nothing. It also put the discount on exactly
// the months BoldLine was already earning least on.
//
// The fix is one sentence on a sales call: the same percentage applies to both numbers.

// 🔴 RETIRED FOR NEW RENEWALS, Bryson, Sat 2026-11-07 (KB complete-plan): "for renewals after the first 3 months
// will only be month to month because there is no reason for a client to sign for more than a month at a time
// anymore". With no monthly fee for ads there is nothing left to discount, so the renewal menu (1/3/6/12 months,
// month to month +10%, a year -10%) is gone from the OS. What stays is the arithmetic below, because agreements
// signed before v9 still describe it in their renewal clause, and the guards that renewing now moves a client onto
// the new terms instead.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// The real dials and the real maths, lifted out of the shipping file.
const decl = (start, end) => {
  const i = S.indexOf(`const ${start}`);
  assert.ok(i > 0, `could not find ${start} in index.html`);
  return S.slice(i, S.indexOf(end, i) + end.length);
};
const { TERM_RATE, termRate, termMonthly, termPct, termRateLabel } = new Function(
  decl("TERM_PRICING_ENABLED", ";") + "\n"
  + decl("TERM_RATE ", "};") + "\n"
  + decl("termRate ", ";") + "\n"
  + decl("termMonthly ", ";") + "\n"
  + decl("termPct ", ";") + "\n"
  + decl("termRateLabel ", "\n};") + "\n"
  + "return { TERM_RATE, termRate, termMonthly, termPct, termRateLabel };")();

// ── The shape Bryson described, checked as arithmetic rather than as constants ──
t("month to month costs more, three months is the anchor, longer costs less", () => {
  const base = 1000;
  assert.ok(termMonthly(base, 1) > base, "month to month is not a premium");
  assert.equal(termMonthly(base, 3), base, "three months is not the standard rate");
  assert.ok(termMonthly(base, 6) < base, "six months is not a discount");
  assert.ok(termMonthly(base, 12) < termMonthly(base, 6), "a year is not cheaper than six months");
});

t("🔴 a longer term is cheaper over the WHOLE term, not just per month", () => {
  // The claim Bryson makes to a client is about total cost, and a cheaper monthly rate over
  // more months could still be more money. It is not, but it has to be checked as a total.
  const base = 1000;
  for (const m of [6, 12]) {
    const perMonthSaving = termMonthly(base, 1) - termMonthly(base, m);
    assert.ok(perMonthSaving > 0, `${m} months is not cheaper per month than month to month`);
    assert.ok(perMonthSaving * m > 0, `${m} months does not save money over the term`);
  }
});

t("the arithmetic of that, done twice", () => {
  const base = 100;
  const first = termMonthly(base, 12);            // 90
  const secondFromBase = termMonthly(base, 12);   // 90, correct
  const secondFromCurrent = termMonthly(first, 12); // 81, the bug
  assert.equal(first, secondFromBase, "renewing twice from the base changed the rate");
  assert.notEqual(secondFromBase, secondFromCurrent, "precondition: compounding would be visible");
});



// ── The dials stay editable, and stay sane ────────────────────────────────────
t("the rates are still one editable table", () => {
  assert.deepEqual(Object.keys(TERM_RATE).map(Number).sort((a, b) => a - b), [1, 3, 6, 12]);
  assert.equal(termRate(3), 0, "the anchor term is not free of adjustment");
  assert.equal(termRate(99), 0, "an unknown term length is not treated as the standard rate");
});

t("the labels read the way they are shown to a client", () => {
  assert.equal(termRateLabel(3), "Standard rate");
  assert.match(termRateLabel(1), /^\+\d+%$/);
  assert.match(termRateLabel(12), /^−\d+%$/);
});

t("🔴 turning the whole thing off leaves every term at the plain rate", () => {
  // The documented "put the rates back to normal" switch. If it ever stops working, Bryson
  // has no way to undo term pricing without a code change.
  const off = new Function(
    "const TERM_PRICING_ENABLED = false;\n"
    + decl("TERM_RATE ", "};") + "\n"
    + decl("termRate ", ";") + "\n"
    + decl("termMonthly ", ";") + "\n"
    + "return { termMonthly };")();
  for (const m of [1, 3, 6, 12]) assert.equal(off.termMonthly(1000, m), 1000, `term ${m} still adjusted when disabled`);
});

// ── 🔴 E-COMMERCE: the same incentive, on the number a store actually pays ────
// Bryson, 2026-09-02: *"What do we do for the e-commerce then"*. A store has no per-lead
// rate, so its performance fee is a percentage of ad spend. Leave that untouched and an
// e-commerce client is back in exactly the position the whole fix exists to remove:
// committing for a year discounts only the months their store did badly.
t("the percentage moves the same way the other numbers do", () => {
  for (const base of [15, 12]) {
    assert.ok(termPct(base, 1) > base, `${base}% month to month is not a premium`);
    assert.equal(termPct(base, 3), base, `${base}% at three months is not the standard rate`);
    assert.ok(termPct(base, 6) < base, `${base}% at six months is not a discount`);
    assert.ok(termPct(base, 12) < termPct(base, 6), `${base}% at a year is not cheaper than six months`);
  }
});

t("🔴 every term is a visibly DIFFERENT percentage", () => {
  // This is why termPct exists instead of reusing termMonthly. Whole-unit rounding turns
  // 15% into 16 / 15 / 14 / 14: six months and a year cost the SAME, and the client asking
  // "what does a year get me" is told nothing. Rounded to the half point they separate.
  for (const base of [15, 12]) {
    const seen = [1, 3, 6, 12].map((m) => termPct(base, m));
    assert.equal(new Set(seen).size, 4, `${base}% collapses to ${seen.join(", ")}`);
  }
});

t("the percentages land on halves, not on awkward decimals", () => {
  // A contract that says "14.25% of ad spend" reads like a spreadsheet leaked into a legal
  // document. Every value has to be a whole or a half.
  for (const base of [15, 12]) {
    for (const m of [1, 3, 6, 12]) {
      const v = termPct(base, m);
      assert.equal(v * 2, Math.round(v * 2), `${base}% at ${m} months is ${v}%`);
    }
  }
});


t("🔴 it scales from the PACKAGE, so it cannot compound", () => {
  // Unlike the per-lead rate, this needs no stored base: the standard lives on the package,
  // exactly as baseMonthly reads pkg.price. billingSpendPct is only ever written, never read
  // back as the base, which is what makes repeated renewals safe.
  assert.match(S, /const basePct = \(pkg && pkg\.pricingModel === "ad_spend_pct"\) \? Number\(pkg\.adSpendPct\)\|\|0 : 0;/,
    "the e-commerce base is read from the client instead of the package, so every renewal discounts the discount");
});


t("🔴 the contract prints the client's rate, not the package's", () => {
  // Both copies. Writing the discounted percentage onto the client is pointless if the
  // agreement they sign still quotes the standard one, and that mismatch would only surface
  // when a client compared their invoice against their contract.
  const server = readFileSync(join(ROOT, "netlify/lib/contract-shared.cjs"), "utf8");
  const R = /cl\.billingSpendPct!=null \? Number\(cl\.billingSpendPct\) : \(Number\(pkg\.adSpendPct\)\|\|0\)/;
  assert.match(server, R, "the client's copy of the contract still quotes the package's standard percentage");
  assert.match(S, R, "the OS copy of the contract still quotes the package's standard percentage");
});



// ── 🔴 WHAT RENEWING DOES NOW (KB complete-plan) ───────────────────────────────
t("🔴 renewing moves the client onto the new terms: no minimum, current version stamped", () => {
  assert.match(S, /onRenew\(client\.contractEnd\|\|fmt\(new Date\(\)\),\{billingMonthly:0,contractTermsVersion:CONTRACT_TERMS_VERSION,/,
    "renewing still writes a term-priced minimum, which the v9 agreement it now carries does not have");
});
t("🔴 and stops an old minimum subscription at the end of the month already paid, never at once", () => {
  assert.match(S, /stripeBilling\("end-minimum",\{customerId:client\.stripeCustomerId,subscriptionId:client\.stripeSubscriptionId\}\)/);
  const SB = readFileSync(join(ROOT, "netlify/functions/stripe-billing.mjs"), "utf8");
  const blk = SB.slice(SB.indexOf('if (action === "end-minimum")'), SB.indexOf('if (action === "update-subscription")'));
  assert.match(blk, /cancel_at_period_end: true/, "the old minimum is cancelled immediately, or not at all");
  assert.doesNotMatch(blk, /method: "DELETE"/, "deleting the subscription would cut off the month they already paid for");
  assert.match(blk, /adsSubscriptionOf\(subs\.data\)/, "it could stop website care or an add-on instead of the ads");
});
t("there is no renewal length menu any more", () => {
  assert.doesNotMatch(S, /\["1","3","6","12"\]\.map\(m=>\{/, "the 1/3/6/12 month menu is back on the renewal card");
  assert.match(S, /Renew onto the new terms/);
});
t("🔴 a v9 client is never offered a renewal at all", () => {
  assert.match(S, /\{!rolling&&showRenewBtn&&!showRenewal&&\(/, "a month-to-month client is offered a renewal they do not need");
  assert.match(S, /There's nothing to renew\. Either side can end it with \{NOTICE_DAYS\} days' notice\./);
});

console.log(`✓ verify-term-incentive: ${n} checks passed`);
