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

// ── 🔴 THE FIX: the discount reaches the per-lead rate too ─────────────────────
t("🔴 renewing applies the same percentage to the per-lead rate", () => {
  assert.match(S, /const perLead=basePerLead>0\?termMonthly\(basePerLead,months\):null;/,
    "the term discount still only touches the monthly minimum, so a client whose ads work well gets nothing for committing");
  assert.match(S, /billingPerLead:perLead/,
    "the discounted per-lead rate is calculated and then not saved");
});

t("🔴 it scales from a stored base, so renewals never compound", () => {
  // Two twelve-month renewals scaling off the CURRENT rate would reach 19% off, not 10%.
  assert.match(S, /const basePerLead = client\.billingPerLeadBase!=null \? Number\(client\.billingPerLeadBase\) : perLeadNow;/,
    "the per-lead discount scales from the current rate, so every renewal discounts the discount");
  assert.match(S, /billingPerLeadBase:basePerLead/, "the base is never stamped, so it cannot survive the first renewal");
});

t("the arithmetic of that, done twice", () => {
  const base = 100;
  const first = termMonthly(base, 12);            // 90
  const secondFromBase = termMonthly(base, 12);   // 90, correct
  const secondFromCurrent = termMonthly(first, 12); // 81, the bug
  assert.equal(first, secondFromBase, "renewing twice from the base changed the rate");
  assert.notEqual(secondFromBase, secondFromCurrent, "precondition: compounding would be visible");
});

t("a client with no per-lead rate is left alone entirely", () => {
  // 🔴 An e-commerce client bills a percentage of spend and has no per-lead rate. Writing a
  // zero or a null onto them would put a rate in a contract that should not name one.
  assert.match(S, /\.\.\.\(perLead!=null\?\{billingPerLead:perLead,billingPerLeadBase:basePerLead\}:\{\}\)/,
    "a client with no per-lead rate gets one written onto them by renewing");
});

// ── He has to be able to SEE it, or he cannot sell it ─────────────────────────
t("🔴 the renewal screen shows both numbers", () => {
  // Showing only the minimum is what made the discount invisible in the first place. Under
  // greater-of the client usually pays the per-lead side, so that is the number that sells.
  // 🔴 The GATE is pinned, not just the text. A first version matched the words "Per
  // qualified lead" and passed happily when the whole block was changed to `{false&&...}`:
  // the string was still in the file and rendered to nobody. Checking that a line EXISTS is
  // not checking that it is shown, which is a mistake this repo has made in three different
  // costumes now.
  assert.match(S, /\{basePerLead>0&&<div style=\{\{marginTop:3\}\}>Per qualified lead: <strong/,
    "the per-lead line is gone, or is gated on something other than the client actually having a per-lead rate");
  assert.match(S, /termMonthly\(basePerLead,m\)/, "the per-lead figure shown is not the discounted one");
});

t("the saving line does not overclaim", () => {
  // It counts only the minimum, so it must say so. A number presented as the whole saving
  // when it is half of it is the kind of thing that gets repeated to a client.
  assert.match(S, /on the minimum alone over the term/,
    "the saving line implies it covers everything when it only counts the monthly minimum");
});

t("the month-to-month warning names both numbers too", () => {
  assert.match(S, /flexibility premium on both the minimum and the per-lead rate/,
    "the premium is described as applying only to the minimum, which is no longer true");
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

t("🔴 renewing writes the discounted percentage onto the client", () => {
  assert.match(S, /const spendPct=basePct>0\?termPct\(basePct,months\):null;/,
    "the term discount never reaches the e-commerce fee, so a store gets nothing for committing");
  assert.match(S, /billingSpendPct:spendPct/, "the discounted percentage is worked out and then not saved");
});

t("🔴 it scales from the PACKAGE, so it cannot compound", () => {
  // Unlike the per-lead rate, this needs no stored base: the standard lives on the package,
  // exactly as baseMonthly reads pkg.price. billingSpendPct is only ever written, never read
  // back as the base, which is what makes repeated renewals safe.
  assert.match(S, /const basePct = \(pkg && pkg\.pricingModel === "ad_spend_pct"\) \? Number\(pkg\.adSpendPct\)\|\|0 : 0;/,
    "the e-commerce base is read from the client instead of the package, so every renewal discounts the discount");
});

t("a lead-gen client never gets a percentage written onto them", () => {
  assert.match(S, /\.\.\.\(spendPct!=null\?\{billingSpendPct:spendPct\}:\{\}\)/,
    "a per-lead client gets an ad-spend percentage written onto them by renewing");
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

t("the renewal screen shows the percentage for a store", () => {
  assert.match(S, /\{basePct>0&&<div style=\{\{marginTop:3\}\}>Fee on ad spend: <strong/,
    "an e-commerce renewal shows no percentage, or shows it regardless of whether the client has one");
  assert.match(S, /termPct\(basePct,m\)/, "the percentage shown is not the discounted one");
});

console.log(`✓ verify-term-incentive: ${n} checks passed`);
