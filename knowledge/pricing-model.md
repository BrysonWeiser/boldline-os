---
name: pricing-model
topic: Pricing
task: quote a price, change package pricing, explain what a client pays, or work out why a bill is what it is
keywords: [pricing, monthly minimum, greater of, whichever is higher, per-lead fee, ad spend percentage, package price, retainer, management fee, tier, ad budget, MIN_AD_BUDGET, COMBO_MIN_BUDGET, calcMonthlyBill, packageForBudget, pricingModel, adSpendPct, minBudget, combined unlock, Stencil, setup fee, e-commerce pricing, ROAS bonus]
status: verified
summary: Rewritten 2026-08-18 after Stencil & Thread turned the old model down. There is NO management fee. A package's `price` is a monthly MINIMUM and the performance fee counts toward it — the client pays whichever is HIGHER, never both. Lead gen bills per qualified lead; e-commerce bills 15% of ad spend (12% at the top tier). Ad budget decides the tier ($500-2.5k min $400 / $2.5k-10k min $700 / $10k+ min $1,200). Platform is a choice not a price: Google and Meta are identical at the same tier. Combined unlocks at $5,000/mo of ad budget, which is why there is no combined Launch tier. Hard floor of $500/mo ad budget to be a client at all. 1,140 assertions in tests/verify-packages.mjs.
verified: 2026-08-18
---

## Why it changed

**Stencil & Thread**, on `g-launch` at ~$800/mo of ad spend, turned it down in writing:

> *"I don't really understand paying a retainer fee plus a per-lead fee. That's a personal
> opinion, that it should be one or the other. Or at least, not doubling my ad spend."*

He was right on the maths. The old model billed him **roughly 134% of his ad spend** ($400/mo
management + per-lead fees, against $800 of budget), where the industry norm is nearer 10-20%.

**Bryson, 2026-08-18:** *"we set a monthly bottom so if we would only make $180 off of the leads
we generated but the bottom is $200 then they pay the $200 but if we make more than the bottom
then we take whichever is more."* And: *"x amount per lead for regular clients and then x
percentage of ad spend for ecommerce clients."*

## The model, in one line

**Setup fee once. Then each month: the monthly minimum, or the performance fee, whichever is
higher. NEVER both added together.**

| | Lead generation | E-commerce |
|---|---|---|
| Performance fee | per qualified lead | % of that month's ad spend |
| Why | a service business has a lead to count | a store has a sale, and it happens without BoldLine touching it |

## The three rules that shape the catalog

1. **The ad budget decides the tier.** Not the platform, not the salesperson.
2. **Platform is a choice, not a price.** `g-*` and `m-*` are identical in monthly minimum AND
   setup at the same tier. The old catalog charged $600 for Google Growth and $550 for Meta
   Growth for no defensible reason, and prospects notice that.
3. **Combined is a budget unlock**, not a bundle discount. Below `COMBO_MIN_BUDGET` neither
   channel gets enough data to learn.

## The numbers

| Tier | Ad budget | Monthly minimum | Setup (one platform) | Setup (combined) |
|---|---|---|---|---|
| Launch | $500 – $2,500 | **$400** | $750 | — (below the unlock) |
| Growth | $2,500 – $10,000 | **$700** | $1,500 | $2,300 (needs $5,000+) |
| Acquisition | $10,000+ | **$1,200** | $3,000 | $4,900 |

- `MIN_AD_BUDGET = 500` — hard floor to be a managed client at all.
- `COMBO_MIN_BUDGET = 5000` — below this, one platform only.
- E-commerce: `adSpendPct` **15 / 15 / 12** by tier. Percentage never rises with tier (a bigger
  spender pays a smaller share), asserted in the test.

**Combined carries the SAME monthly minimum as one platform at the same tier.** That is the
selling point, not an oversight: both channels for the same monthly, you only pay more to build
it. It is also why the upgrade ladder had to stop ranking by price (see below).

## What was deleted, and why

- **`c-launch` (Full System: Launch).** Combined starts at $5,000 of ad budget, which is above
  the Launch band entirely. A combined Launch tier could only ever be sold to someone it hurts.
- **The ROAS bonus** on all three e-commerce packages. It was a second fee stacked on a
  retainer, which is exactly the structure this rewrite removes. Replaced by the percentage.
- **`google_shopping` from `e-growth`.** Store Growth is now Meta-only, for the same reason
  combined has a floor: splitting a sub-$10k budget across two platforms starves both.

## 🔴 The billing mechanic (this is where a bug would cost real money)

The Stripe subscription still charges **the monthly minimum in advance**. So approving leads must
add **only the amount by which the month's lead value EXCEEDS that minimum** — adding the full
lead value would bill the client twice for the same month, which is the retainer-plus-fee shape
all over again.

Tracked per calendar month on the client as `billingLeadPeriod: { period, earned, charged }`,
because the owner can approve several batches in one month. Each approval tops the invoice up to
`max(0, earned − floor)` and never re-charges what an earlier batch already covered.

Leads are still marked billed when nothing is owed — they ARE accounted for, they just did not
clear the minimum — and the Stripe call is skipped, because Stripe rejects a $0 invoice item.

The invoice line reads **"Performance fee above monthly minimum"**, not "qualified leads", or the
client's own arithmetic will not check out.

## Where the catalog lives (FIVE copies)

| File | What it is |
|---|---|
| `index.html` | the OS — the master copy |
| `netlify/functions/portal.mjs` | what the client sees |
| `netlify/lib/contract-shared.cjs` | what they sign (features only) |
| `netlify/lib/report-shared.mjs` | reports (ids/names/platform only) |
| `netlify/lib/pricing-shared.mjs` | **what gets quoted OUT LOUD** by Deal Prep + Lead Scout |
| `marketing-site/index.html` | what they were sold |

`tests/verify-packages.mjs` compares all of them — **968 assertions**. The fifth copy was never
checked before this rewrite, which was the most expensive gap of the lot: it is the one a model
reads aloud on a live call.

## 🔴 The upgrade ladder now ranks by TIER, not price

`p.price > cur.price` used to define an upgrade. Under this model a single platform and the
combined system deliberately share a minimum at the same tier, so that test **hid the single best
upsell in the catalog**: `g-growth → c-growth` adds an entire channel for the same monthly
minimum. The rule is now: same-or-higher tier, keeps everything (`keepsEverything`), and gains at
least one feature.

## Shared helpers

- `calcMonthlyBill(pkg, { qualifiedLeads, perLeadFee, adSpend })` → `{ floor, earned, billed,
  atFloor, model, basis }`. Duplicated in `index.html`, `portal.mjs` and `pricing-shared.mjs`;
  the test asserts all three agree on the same inputs.
- `packageForBudget(budget, family)` in `pricing-shared.mjs` — the one place that turns an ad
  budget into a tier. Returns `null` below `MIN_AD_BUDGET`, and `null` for combined below
  `COMBO_MIN_BUDGET` (a deliberate hole, not a gap).
- `pkgMinLabel` / `pkgPerfLabel` / `pkgPriceSummary` in `index.html` — every bare `$400/mo` in
  the UI was a misquote once the price became a floor.

## Contract

Section 4 is now **"Monthly Minimum and Performance Fee"** and renders for both models from one
branch. It states the greater-of rule, spells out `THE TWO ARE NEVER CHARGED TOGETHER` in caps,
and describes the billing mechanic (minimum in advance, only the difference added later). The old
per-lead and ROAS-bonus sections are gone. Key Terms say **"Monthly Minimum"**, never
"Management Fee", including in the early-termination clause.

## What Bryson still has to decide

- **The $500 ad-budget floor is temporary and deliberate.** His words: *"we can put a minimum of
  $500/month at least as a required budget for now so I can build a portfolio and start making
  money but flag me after we get to 3-5 clients."* **RAISE IT WITH HIM ONCE HE HAS 3-5 CLIENTS.**
  At $500 of spend a $400 minimum is 80% of their budget, which is the Stencil problem in
  miniature. It is survivable while he has no portfolio and not afterwards.
- ~~A build-and-hand-off offer for sub-floor prospects.~~ **BUILT 2026-08-18** — see KB
  `hand-off-product`. $1,500 once, no monthly, and the setup fee is waived if they convert to
  managed within 6 months.

## Related

`package-multi-campaign` (the catalog bugs this rewrite inherited), `contract-renewal-pricing`
(term discounts still apply, they just move the floor), `business-constraint-ad-spend` (the
client always pays the platform directly), `per-lead-fee-finder`, `revenue-tracking`, `hand-off-product`.
