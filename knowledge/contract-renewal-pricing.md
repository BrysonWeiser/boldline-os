---
name: contract-renewal-pricing
topic: OS app
task: change how contract renewal pricing / term discounts work, or the renewal flow on the Contract tab
keywords: [termMonthly, termRate, termRateLabel, TERM_RATE, renewMonths, handleRenew, contractTermMonths, billingMonthly, update-subscription, renewal discount, month-to-month premium]
status: verified
summary: Term-based renewal pricing — BUILT 2026-07-15. New clients always start on a 3-month term at the standard package rate. At RENEWAL the client picks 1/3/6/12 months; month-to-month is +10%, 3mo is the standard anchor (0%), 6mo −5%, 12mo −10%, applied to the package's monthly price. v1 = pricing math + renewal UI (per-term price + savings) + contract doc reflect the term & effective rate. v2 = renewal pushes the new monthly to the live Stripe subscription automatically via a new `update-subscription` action (no manual Stripe edit). Charges management fee ONLY, never ad spend.
verified: 2026-07-15
---

**Bryson's model (2026-07-15):** keep the 3-month minimum for brand-new clients at the
standard rate. At renewal, reward commitment: month-to-month costs a little more, longer
terms get a discount. Anchored so the package `price` = the 3-month rate (renewing at 3mo =
no change, zero friction for existing clients).

**Kill switch + dials (the only two lines to edit):** at the top of the pricing block in
index.html — `const TERM_PRICING_ENABLED = true;` and `const TERM_RATE = {…}`. Set
`TERM_PRICING_ENABLED=false` to flatten everything to the plain standard rate (no premium/
discount at any length) — this is the "put rates back to normal" switch, independent of any git
rollback and affects nothing else. Edit `TERM_RATE` decimals to re-tune percentages anytime.
`termRate()` returns 0 for every length when disabled, so the UI shows all terms at the standard
price and the month-to-month premium note hides (guarded by `termRate(1)>0`).

**Rates** (`TERM_RATE` in index.html, fraction applied to the standard monthly):
`{1:+0.10, 3:0, 6:−0.05, 12:−0.10}`. Helpers next to `monthsLabel`:
- `termRate(months)` → fraction (0 if unknown length)
- `termMonthly(base, months)` → `Math.round(base*(1+rate))` (whole dollars)
- `termRateLabel(months)` → "+10%" / "−10%" / "Standard rate"

Example ($600 Growth): 1mo $660 · 3mo $600 · 6mo $570 · 12mo $540 (a signed year saves the
client $1,440 vs month-to-month — and locks retention, which is worth far more to us). Rates
are trivial to re-tune: edit the one `TERM_RATE` object.

**v1 — front end (all in `index.html`):**
- Renewal panel in `ContractTabContent` (Contract tab): the 1/3/6/12 buttons now show each
  term's monthly price + rate label; a summary line shows the effective $/mo, the flexibility-
  premium note for month-to-month, and "$X saved over the term vs month-to-month" for discounts.
- `handleRenew` is now async. It computes `termMonthly` off `baseMonthly` (= `pkg.price` ||
  `client.billingMonthly`) and calls `onRenew(newEnd, {contractTermMonths, billingMonthly})`.
  The parent (`ClientDetail`, the `onRenew` prop) merges those onto the client so the term and
  the agreed monthly persist.
- `makeContractHTML`: Management Fee now shows the **effective** monthly (`cl.billingMonthly ||
  pkg.price`), a new **Contract Term** meta row shows `monthsLabel(contractTermMonths||3)`, and
  a **Renewal** clause explains the term-based pricing. New-client contracts fall back to the
  package rate + the term picked in the Add-Client wizard (wizard now persists
  `contractTermMonths` via `setTerm`).
- `BillingCard` now prefers `client.billingMonthly` over `pkg.price` for the monthly, so a term-
  discounted renewal flows into a *fresh* checkout at the right price too.

**v2 — auto-update live Stripe subscription (`netlify/functions/stripe-billing.mjs`):**
- New action **`update-subscription`** `{customerId?, subscriptionId?, monthlyAmount, packageName?}`.
  Resolves the subscription (passed id → else customer's latest), then rewrites the existing
  recurring line item **in place** (passes `items:[{id, price_data:{…}}]` to the subscription
  update endpoint) to the new monthly. `proration_behavior:"none"` → new rate applies from the
  **next invoice**, no mid-cycle proration surprise. Owner-authed (same Supabase-JWT pattern).
- **GOTCHA (caught in the 2026-07-15 test-mode run):** subscription updates REJECT inline
  `price_data[product_data]` — that's Checkout-only. Error: "Received unknown parameter:
  items[0][price_data][product_data]. Did you mean product?". Fix: `price_data.product` must be
  the **existing product id** off the current line item (`item.price.product`), creating a
  product first only if missing. Checkout (`create-checkout`) legitimately keeps `product_data`.
- `handleRenew` only calls it when `client.stripeSubscriptionId` && `billingStatus==="active"`
  && the rate actually changed. On success the renewal panel shows "Stripe subscription updated
  — now auto-charging $X/mo"; on failure it renews the contract anyway and tells the owner to
  update the amount manually in Stripe (amber note).
- Shared `stripeBilling(action, extra)` helper (hoisted above `BillingCard`) is used by both the
  BillingCard and the renewal flow.

**Manual Stripe billing change (owner, no code):** Stripe Dashboard → **Customers** → the client
→ their **Subscription** → **Update subscription** → **Edit** the line item's price → set the new
monthly → choose "None" for proration → save. (Or **Billing Portal** via the BillingCard's
"Manage in Stripe" for card/bank + invoices.) v2 makes this automatic on renewal; the manual path
is the fallback if the auto-update ever fails.

**Not applied to initial contracts** (by design): the first term is always 3-month standard rate.
Term pricing kicks in only at renewal.
