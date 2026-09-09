---
name: revenue-tracking
topic: Billing
task: see how much BoldLine actually earned in a month, or work out why the revenue screen shows what it shows
keywords: [revenue, MRR, monthly recurring revenue, guaranteed floor, invoices by month, stripe revenue action, RevenueScreen, collected, outstanding, refunded, credit notes, period_end, draft invoice, void invoice, month on month]
status: verified
summary: REBUILT 2026-08-18. The revenue screen used to add up package prices and call it "Monthly Recurring Revenue" — under the greater-of pricing model that is a FLOOR, not income, so it under-reported every good month. Actual revenue now comes from Stripe invoices via a new `revenue` action, keyed on the period each invoice COVERS so a late payment lands in the month it was for. Drafts, voids and write-offs excluded; credit notes subtracted. Month-on-month comparison uses only FINISHED months. The floor is still shown, clearly labelled and visually separate.
verified: 2026-08-18
---

**Bryson, 2026-08-18:** *"I want to make sure in the os ... that we do something to track how much
I am making per month or maybe the previous month based on the invoices sent since we now dont
have a monthly recurring revenue."*

## The problem

The old screen summed `pkg.price` across clients. Under the pricing model rewritten the same day,
`price` is a **monthly minimum**: a good month bills MORE than it and no month bills less. So the
number was never what he earned, and after the change it stopped being even a decent guess.

## Where the truth is

**Stripe.** Reconstructing revenue from the OS's own records would drift the first time an
invoice was voided, refunded, or paid late. New action `{ action: "revenue", months }` in
`netlify/functions/stripe-billing.mjs`.

## 🔴 The four decisions that make the number correct

| Decision | Why it matters |
|---|---|
| Only `paid` and `open` count | a **draft** is not money and may never be finalized; **void** was cancelled; **uncollectible** was written off. Counting a draft inflates the month. |
| Keyed on `period_end`, falling back to `finalized_at` then `created` | a **late payment lands in the month it was FOR**. Without this, month-on-month comparison means nothing. |
| Credit notes subtracted (pre- and post-payment) | money that went back out was never earned, and not subtracting it is worse than counting a draft. |
| Only **finished** months are compared | comparing a half-finished month to a whole one always reads as a collapse, which ruins a morning for no reason. |

Paged (`starting_after`, 12 pages max) — one page today, cheap insurance for the year this is
still running with forty clients.

## The screen

- **Hero: this month so far**, net, with collected vs outstanding underneath.
- **Three tiles:** last full month, average finished month, and the **guaranteed floor** — kept
  visually separate and labelled, because it is the one number next month guarantees.
- **Month by month**, expandable to a per-client breakdown, bar-scaled against the best month.
- **Guaranteed floor by client** at the bottom, replacing the old per-client MRR list. Demo and
  internal accounts excluded.
- Stripe failing is not fatal: an amber note explains, and the floor still renders from the OS's
  own records.

## Renames that were not cosmetic

- Dashboard hero: *"Monthly Recurring Revenue"* → **"Guaranteed Monthly Floor"**.
- ARIA's business summary now says *"guaranteed monthly floor ... (the MINIMUM billed; actual
  revenue is whichever is higher of that or the month's lead fees)"* — it was reporting a floor as
  revenue and would have reasoned from it.

## Guarded by `tests/verify-pricing-tools.mjs`

The rollup is exercised against stubbed invoices covering every status Stripe emits, a refund, a
late payment, and an invoice with no period. Counting drafts as revenue was confirmed to fail it.

## Related

`pricing-model`, `billing-automation`, `per-lead-fee-finder`.

---

## 🔴 2026-09-09 — THE PER-CLIENT NUMBERS WERE THE PRICE LIST, NOT THE CONTRACT

Bryson, looking at Sebastian's Overview: *"make sure the actual revenue tracker for each client
is accurate based on the contract not just the package"*. The card read **$400/mo min · $750
setup**. Sebastian is a founding client: **setup waived, no monthly minimum, $50 a qualified
lead**. All three numbers were wrong, and they were wrong in our favour, which is the
embarrassing direction.

Six places already read the override fields correctly. **Four did not**, so the OS quoted two
different prices for the same client depending which screen he was on:

| Where | Was | Now |
|---|---|---|
| Overview **Monthly Revenue** card | `pkg.price` / `pkg.setup` / `PER_LEAD[niche]` | the contract |
| Overview **Monthly minimum** tile | `pkg.price` | the contract |
| Dashboard **MRR** total | summed `pkg.price` for every client | summed contracted floors |
| Revenue screen floor rows | monthly right, **setup** still `pkg.setup` | both from the contract |

One helper, `contractTerms(client, pkg)`, returns `{monthly, setup, perLead, setupWaived,
monthlyWaived, resultsOnly}`. `billingMonthly` / `billingSetup` / `billingPerLead` are the
contract; the package is only a default.

🔴 **`!= null`, NEVER `||`, and this is the whole bug.** A waived setup and a zero monthly are
both legitimate values and both falsy, so `client.billingSetup || pkg.setup` silently
reinstates the fee the client was told he would not pay. The discount is stored as `0` and `0`
is falsy. An empty string still means "not set", so a cleared field falls back to the package
rather than charging nothing.

Two things the card now says out loud:
- A **results-only** client leads with `$50/qualified lead` instead of a minimum he does not
  pay.
- A waiver is **named against the list price it replaces** ("Founding terms. The package lists
  $400/mo and $750 setup"), because a deal that reads like a mistake gets "corrected" by
  somebody six months from now.

And `setupWaived` is false when the package has no setup fee at all — there is nothing to
waive, and claiming otherwise to a client is a claim that is not true.

`tests/verify-contract-terms.mjs` — 21 checks, extracting and RUNNING the helper against
Sebastian's real record. 9 mutations, all caught.
