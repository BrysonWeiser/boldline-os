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
