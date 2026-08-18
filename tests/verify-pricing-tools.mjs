// The two tools built alongside the 2026-08-18 pricing rewrite:
//   1. the Per-Lead Fee Finder (netlify/functions/lead-fee.mjs + LeadFeeFinder in the OS)
//   2. revenue by month from real invoices (stripe-billing "revenue" + RevenueScreen)
//
// Run: node tests/verify-pricing-tools.mjs
//
// Neither can be checked by reading. The fee finder's guard rails only matter when the
// model returns something silly, and the revenue rollup only matters on the invoice
// shapes that are rare in practice and expensive when wrong (a refund, a void, a late
// payment landing in the wrong month). So both are exercised against stubbed inputs.

import { readFileSync } from "node:fs";
import * as shared from "../netlify/lib/pricing-shared.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const feeSrc = readFileSync("netlify/functions/lead-fee.mjs", "utf8");
const billSrc = readFileSync("netlify/functions/stripe-billing.mjs", "utf8");
const os = readFileSync("index.html", "utf8");

// ── 1. packageForBudget: the bands must be total and non-overlapping ─────────
// Every dollar at or above the floor has to land in exactly one package, or a prospect
// falls into a gap on a live call and Bryson has nothing to quote.
{
  const { packageForBudget, MIN_AD_BUDGET, COMBO_MIN_BUDGET, PACKAGES } = shared;
  eq("below the floor buys nothing", packageForBudget(MIN_AD_BUDGET - 1, "g"), null);
  eq("zero buys nothing", packageForBudget(0, "g"), null);
  eq("nonsense buys nothing", packageForBudget("abc", "g"), null);

  for (const fam of ["g", "m", "e"]) {
    for (let b = MIN_AD_BUDGET; b <= 60000; b += 97) {
      const p = packageForBudget(b, fam);
      ok(`$${b} in ${fam} resolves to a package`, !!p, "budget band gap");
      if (!p) break;
    }
  }
  eq("the floor itself buys the Launch tier", packageForBudget(shared.MIN_AD_BUDGET, "g").id, "g-launch");
  eq("just under the growth band is still Launch", packageForBudget(2499, "g").id, "g-launch");
  eq("the growth band starts exactly at its floor", packageForBudget(2500, "g").id, "g-growth");
  eq("the top band is open-ended", packageForBudget(500000, "g").id, "g-acquisition");

  // Combined is a deliberate hole below the unlock, not a gap to be filled.
  eq("combined is unavailable below the unlock", packageForBudget(COMBO_MIN_BUDGET - 1, "c"), null);
  eq("combined opens exactly at the unlock", packageForBudget(COMBO_MIN_BUDGET, "c").id, "c-growth");

  // No budget may match two packages in the same family, or the tier is ambiguous.
  for (const fam of ["g", "m", "c", "e"]) {
    for (const b of [500, 2500, 4999, 5000, 9999, 10000, 25000]) {
      const hits = PACKAGES.filter((p) => p.id.startsWith(fam + "-")
        && b >= p.minBudget && (p.maxBudget === null || b < p.maxBudget));
      ok(`$${b} matches at most one ${fam} package`, hits.length <= 1, hits.map((p) => p.id).join(","));
    }
  }
}

// ── 2. The fee finder's guard rails ─────────────────────────────────────────
// These exist because the number goes straight onto a sales call and onto a client
// record. The prompt asks for sane values; this is what happens when it does not get
// them. Re-implemented from the source rather than imported, because the module needs
// Supabase and Anthropic at import time.
{
  const clampInt = (v, lo, hi, fallback) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  const guard = (out, anchor) => {
    const fee = clampInt(out.fee, 10, 5000, anchor);
    let feeLow = clampInt(out.feeLow, 10, 5000, Math.round(fee * 0.7));
    let feeHigh = clampInt(out.feeHigh, 10, 5000, Math.round(fee * 1.4));
    if (feeLow > feeHigh) [feeLow, feeHigh] = [feeHigh, feeLow];
    feeLow = Math.min(feeLow, fee);
    feeHigh = Math.max(feeHigh, fee);
    return { fee, feeLow, feeHigh };
  };

  eq("a sane fee passes through", guard({ fee: 75, feeLow: 60, feeHigh: 95 }, 75).fee, 75);
  // A fee under $10 can never clear any monthly minimum, which would quietly turn
  // performance pricing into a flat rate without anyone deciding to.
  eq("a $0 fee is lifted to the floor", guard({ fee: 0, feeLow: 0, feeHigh: 0 }, 45).fee, 10);
  eq("a negative fee is lifted to the floor", guard({ fee: -30, feeLow: -50, feeHigh: -10 }, 45).fee, 10);
  eq("an absurd fee is capped", guard({ fee: 999999, feeLow: 1, feeHigh: 999999 }, 45).fee, 5000);
  eq("a missing fee falls back to the table anchor", guard({}, 90).fee, 90);
  eq("a non-numeric fee falls back to the table anchor", guard({ fee: "lots" }, 55).fee, 55);
  // A range quoted backwards on a call is a real mistake, not a cosmetic one.
  {
    const g = guard({ fee: 75, feeLow: 95, feeHigh: 60 }, 75);
    ok("a reversed range is put back in order", g.feeLow <= g.feeHigh, `${g.feeLow}..${g.feeHigh}`);
    ok("the range always contains the fee", g.feeLow <= g.fee && g.fee <= g.feeHigh, `${g.feeLow}..${g.fee}..${g.feeHigh}`);
  }
  for (const bad of [
    { fee: 75, feeLow: 90, feeHigh: 200 },   // low above the fee
    { fee: 75, feeLow: 10, feeHigh: 40 },    // high below the fee
    { fee: 75 },                             // no range at all
  ]) {
    const g = guard(bad, 75);
    ok(`range always contains the fee (${JSON.stringify(bad)})`,
      g.feeLow <= g.fee && g.fee <= g.feeHigh, `${g.feeLow}..${g.fee}..${g.feeHigh}`);
  }
}

// ── 3. The fee finder's month projection uses the real billing maths ────────
// The projection is the part that tells Bryson a fee is too low to ever clear the
// minimum. If it drifted from calcMonthlyBill it would say the opposite.
{
  const project = (pkgId, budget, cpl, fee) => {
    const pkg = shared.PACKAGES.find((p) => p.id === pkgId);
    const leads = Math.max(0, Math.round(budget / cpl));
    const b = shared.calcMonthlyBill(pkg, { qualifiedLeads: leads, perLeadFee: fee });
    return { leads, ...b, pctOfSpend: Math.round((b.billed / budget) * 100) };
  };
  // A roofer at $3,000 of budget, leads costing $150, fee $75: 20 leads, $1,500 earned,
  // comfortably over the $700 minimum.
  const good = project("g-growth", 3000, 150, 75);
  eq("20 leads at $75 earns $1,500", good.earned, 1500);
  eq("and that is what they pay", good.billed, 1500);
  eq("which is 50% of their ad spend", good.pctOfSpend, 50);
  ok("a healthy month is not at the floor", !good.atFloor);

  // The case the projection exists to catch: a fee so low it never clears the minimum,
  // so the client is on a flat rate and the performance pitch is fiction.
  const flat = project("g-growth", 3000, 150, 15);
  eq("a $15 fee on 20 leads earns only $300", flat.earned, 300);
  eq("so they pay the $700 minimum", flat.billed, 700);
  ok("and the projection flags it as at-floor", flat.atFloor);

  // A tiny budget cannot clear a minimum at any sane fee — which is the honest reason
  // there is a floor on ad budget at all.
  const tiny = project("g-launch", 600, 150, 75);
  eq("4 leads at $75 earns $300", tiny.earned, 300);
  eq("so they pay the $400 minimum", tiny.billed, 400);
  eq("which is 67% of their ad spend", tiny.pctOfSpend, 67);
  ok("a tiny budget is flagged as at-floor", tiny.atFloor);
}

// ── 4. Revenue rollup: the invoice shapes that would silently corrupt a total ─
// Re-implements the classification the "revenue" action performs, and checks it against
// the statuses Stripe actually emits. A draft counted as revenue inflates the month; a
// refund not subtracted does the same and is worse, because the money left again.
{
  const COUNTED = new Set(["paid", "open"]);
  const roll = (invoices) => {
    const byMonth = new Map();
    for (const inv of invoices) {
      if (!COUNTED.has(inv.status)) continue;
      const ts = inv.period_end || (inv.status_transitions && inv.status_transitions.finalized_at) || inv.created;
      const key = new Date(ts * 1000).toISOString().slice(0, 7);
      const row = byMonth.get(key) || { collected: 0, outstanding: 0, refunded: 0, invoices: 0 };
      row.invoices += 1;
      row.collected += Number(inv.amount_paid || 0);
      row.refunded += Number(inv.post_payment_credit_notes_amount || 0) + Number(inv.pre_payment_credit_notes_amount || 0);
      if (inv.status === "open") row.outstanding += Number(inv.amount_due || 0);
      byMonth.set(key, row);
    }
    const out = {};
    for (const [k, r] of byMonth) out[k] = { ...r, net: (r.collected - r.refunded) / 100 };
    return out;
  };
  const AUG = Math.floor(Date.UTC(2026, 7, 20) / 1000);   // 2026-08
  const JUL = Math.floor(Date.UTC(2026, 6, 20) / 1000);   // 2026-07

  const r = roll([
    { status: "paid",          amount_paid: 70000, amount_due: 70000, period_end: AUG },
    { status: "open",          amount_paid: 0,     amount_due: 45000, period_end: AUG },
    { status: "draft",         amount_paid: 0,     amount_due: 99900, period_end: AUG },
    { status: "void",          amount_paid: 0,     amount_due: 88800, period_end: AUG },
    { status: "uncollectible", amount_paid: 0,     amount_due: 77700, period_end: AUG },
    { status: "paid",          amount_paid: 50000, amount_due: 50000, period_end: JUL,
      post_payment_credit_notes_amount: 10000 },
  ]);
  eq("August collected only the paid invoice", r["2026-08"].collected, 70000);
  eq("August counts the open invoice as outstanding", r["2026-08"].outstanding, 45000);
  eq("drafts, voids and write-offs are not revenue", r["2026-08"].invoices, 2);
  eq("August net is the collected amount", r["2026-08"].net, 700);
  eq("July nets the refund out", r["2026-07"].net, 400);
  ok("a draft never reaches a month", !JSON.stringify(r).includes("999"));

  // A late payment must land in the month it was FOR, not the month it cleared. This is
  // what makes month-on-month comparison mean anything.
  const late = roll([{ status: "paid", amount_paid: 60000, amount_due: 60000,
    period_end: JUL, status_transitions: { finalized_at: AUG }, created: AUG }]);
  eq("a late payment lands in the month it covers", late["2026-07"].net, 600);
  ok("and not in the month it cleared", !late["2026-08"]);

  // With no period at all, fall back rather than dropping the invoice on the floor.
  const noPeriod = roll([{ status: "paid", amount_paid: 20000, created: AUG }]);
  eq("an invoice with no period still counts", noPeriod["2026-08"].net, 200);
}

// ── 5. The wiring is actually there ─────────────────────────────────────────
// Sections 2 and 4 re-implement logic that lives in the functions, so they can only
// stay honest if the originals are pinned. Change a bound in the source and these fail,
// which forces the re-implementation above to be updated with it rather than silently
// testing a fossil.
ok("the fee clamp bounds are still 10..5000", /clampInt\(out\.fee, 10, 5000, anchor\)/.test(feeSrc),
  "if this moved, update section 2 of this test to match");
ok("the range is still forced to contain the fee",
  /feeLow = Math\.min\(feeLow, fee\);/.test(feeSrc) && /feeHigh = Math\.max\(feeHigh, fee\);/.test(feeSrc));
ok("the reversed-range swap is still there", /\[feeLow, feeHigh\] = \[feeHigh, feeLow\]/.test(feeSrc));

ok("lead-fee requires an owner session", /supabase\.auth\.getUser\(jwt\)/.test(feeSrc));
ok("lead-fee refuses an empty request", /Type a niche or a company name first/.test(feeSrc));
ok("lead-fee anchors on the niche table", /getNicheLeadFee/.test(feeSrc));
ok("lead-fee resolves the package from the budget", /packageForBudget/.test(feeSrc));
ok("lead-fee projects the month with the shared maths", /calcMonthlyBill/.test(feeSrc));
ok("lead-fee tells the model the fee and the minimum are never both charged",
  /WHICHEVER IS HIGHER/.test(feeSrc) && /Never both added together/.test(feeSrc));
ok("lead-fee bans em dashes in what Bryson reads out", /No em dashes/.test(feeSrc));
ok("lead-fee has a model fallback", /const MODELS = \[/.test(feeSrc));

ok("the OS has a fee finder component", /function LeadFeeFinder\(/.test(os));
ok("the fee finder calls its own function", /\/\.netlify\/functions\/lead-fee/.test(os));
ok("Deal Prep offers the fee finder", /What should I charge per lead\?/.test(os));
ok("the billing card offers the fee finder", /what should this be\?/.test(os));
ok("the fee finder can write the rate onto the client", /billingPerLead:f/.test(os));

ok("stripe-billing has a revenue action", /action === "revenue"/.test(billSrc));
ok("revenue ignores drafts and voids", /COUNTED = new Set\(\["paid", "open"\]\)/.test(billSrc));
ok("revenue subtracts credit notes", /credit_notes_amount/.test(billSrc));
ok("revenue keys months on the period covered", /inv\.period_end \|\|/.test(billSrc));
ok("revenue pages through Stripe", /starting_after/.test(billSrc));
ok("the revenue screen reads Stripe", /stripeBilling\("revenue"/.test(os));
// The rename that matters: a floor presented as revenue is the exact mistake the old
// screen made, and it under-reports a good month.
ok("the dashboard no longer calls the floor recurring revenue", !/Monthly Recurring Revenue/.test(os));
ok("the dashboard calls it a floor", /Guaranteed Monthly Floor/.test(os));
ok("the revenue screen separates the floor from what was invoiced",
  /Guaranteed floor by client/.test(os) && /What you actually invoiced/.test(os));
ok("the revenue screen only compares finished months", /isCurrent/.test(os));
ok("ARIA is told the floor is a minimum, not revenue", /guaranteed monthly floor/.test(os));

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-pricing-tools: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
