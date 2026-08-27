---
name: results-only-billing
topic: OS app
task: charge a client who has no monthly minimum, or debug why approved leads never got invoiced
keywords: [save-card, results-only, no monthly minimum, arrears, card_on_file, setup mode checkout, pending_invoice_items_behavior, charge-leads arrears, resolvePaymentMethod, ensureCustomer, billingStatus card_on_file, founding client billing, awaiting_card]
status: verified
summary: A client with no monthly minimum could not be charged AT ALL — no card could be saved, charge-leads refused, and approved lead fees sat as pending invoice items waiting for a subscription invoice that would never exist. Fixed 2026-08-27: Checkout in mode:"setup" saves a card with no subscription (billingStatus "card_on_file"), and each approved batch of leads raises and charges a standalone invoice immediately. Found and fixed a hand-off client having no checkout button at all in the same pass.
verified: 2026-08-27
---

Built 2026-08-27, days after Bryson's first client signed on **$50 a qualified lead with the
monthly minimum waived for three months**. Every billing path in the OS had assumed a
subscription, so those terms were unbillable.

## 🔴 THE HOLE, EXACTLY

Three things, each of which alone would have been enough:

1. **No card could be saved.** The only route to a saved payment method was creating a
   subscription, and the setup button was hidden entirely when the monthly was 0. So no
   Stripe customer was ever created for the client.
2. **`charge-leads` refused** — *"No billing set up for this client, start the subscription
   first"* — because it required a `customerId`.
3. **Even past that, the money never moved.** Approved lead fees were added as **pending
   invoice items**, which Stripe sweeps onto the next **subscription** invoice. With no
   subscription, nothing ever swept them. They would have sat there indefinitely.

**Five qualified leads: $250 earned, $0 collected, every screen reporting success.** Not an
error, a silent nothing, which is the harder kind to notice.

## What it does now

| The client | How they pay |
|---|---|
| Monthly minimum (managed) | Subscription. Lead fees above the minimum ride the next monthly invoice as a pending item. **Unchanged.** |
| **No minimum (results-only)** | **Card saved with no subscription. Each approved batch of leads is invoiced and charged immediately.** |
| One-time hand-off | A single `mode:"payment"` checkout for the build fee. |

**`save-card`** (new action) creates a Checkout Session in **`mode: "setup"`** — it collects
a card or bank account and attaches it to the customer while charging nothing. The client's
`billingStatus` goes `awaiting_card` → **`card_on_file`** once `sync` sees a payment method.

**🔴 APPROVING PARKS MONEY. IT DOES NOT CHARGE IT.** Clause 4.3 of a results-only contract
reads: *"Nothing is billed in advance. After each month closes, Agency calculates the
Performance Fee for that month and it is charged on the next invoice. Client is billed in
arrears, for results already delivered."* So the two halves are separate on purpose:

- **`charge-leads` (any client)** records the amount as a **pending invoice item**. Nothing
  is charged. `arrears: true` only changes the wording of the line, since a client with no
  minimum must not read "performance fee above monthly minimum".
- **`invoice-leads`** raises ONE standalone auto-charging invoice for everything parked
  since the last one and charges the card. The scheduled **`lead-invoice-run`** calls it on
  the **1st of each month** for every results-only client; an **"Invoice Now"** button in
  the OS calls the same code for what a calendar cannot know about (a client leaving, a
  final bill).

**The first version of this billed on approval, and that was wrong** against the very
contract the first client was signing at the time. Several charges scattered through a month
instead of one bill after it. That is the second time in one day that billing code and the
signed document disagreed, which is why the invariant is now written on both the function
and the test: **the agreement is the specification.**

**"Everything parked since the last invoice", not "everything dated in month X."** It is
precisely what the agreement promises, it cannot double-bill, and there is no
month-boundary case where a lead approved at 00:05 on the 1st lands in the wrong bill.

**🔴 A subscription client is excluded from the month-end run.** Stripe already sweeps their
pending items onto the recurring invoice, so invoicing them here too would charge the same
leads twice.

## Gotchas that are load-bearing

- **🔴 `pending_invoice_items_behavior: "include"` is not optional.** Current API versions
  default to `"exclude"`, which produces an **empty $0 invoice** that trivially "pays" while
  the real charge silently waits for a subscription invoice that is never coming. Caught
  originally in the 2026-07-16 ETF test run, and it would have bitten here identically. The
  code also refuses to report success on an invoice whose `amount_due` is 0.
- **🔴 Setup-mode Checkout does NOT make the card the invoice default.** It attaches it to
  the customer and stops there, so a standalone invoice finds nothing to charge and sits in
  "Retrying" forever. `sync` now sets `invoice_settings.default_payment_method` the moment
  it sees a payment method, and `resolvePaymentMethod()` falls back through
  subscription card → customer default → first card/bank at charge time anyway.
- **The invoice description must not mention a minimum.** Saying "performance fee above
  monthly minimum" to a client whose signed agreement says there is no minimum contradicts
  the one document they read most carefully.
- **A stored Stripe customer id can be a lie** — a test-mode id left behind after going
  live, or one deleted in the dashboard. `ensureCustomer()` verifies it in the current mode
  and quietly replaces it rather than failing at checkout with "No such customer".

## Found in the same pass

- **A hand-off client had NO checkout button at all.** The button was chosen on
  `monthly > 0`, and the hand-off package carries `price: 0` because there is no monthly,
  not because it is free. It fell into the results-only branch, so the one-time payment path
  that already existed in the backend was unreachable from the Billing card. Now three
  branches: one-time build, subscription, save-a-card.
- **`billing-watch` ignored results-only clients entirely.** Its watch list was
  `active / past_due / awaiting_payment`, so an unpaid lead invoice was never noticed, never
  chased and never charged late interest. `card_on_file` is now in that list. It also used
  to recover every past-due client to `"active"`, which would have claimed a subscription
  that does not exist; it now restores `active` or `card_on_file` based on whether there
  really is one.

## What Bryson must confirm before the first real charge

**That `STRIPE_SECRET_KEY` in Netlify is the LIVE key, not the test one.** A results-only
client is the first to be charged through this path, so a test key would take the invoice
and collect nothing.

## Still open (his own point, 2026-08-26, not built)

Moving clients **with** a minimum to arrears billing too, so the invoice is always
whichever-is-higher after the fact rather than the minimum charged in advance. Options and
the cash-flow trade are in KB `pricing-model` under "OPEN DECISION". It does not affect
Sebastian, who has no minimum.

## Guard

`tests/verify-results-only-billing.mjs` — 105 checks, running the REAL handler with `fetch`
stubbed at the Stripe boundary, so auth, routing, form encoding and every guard execute as
they do in production and each Stripe call is captured with its decoded parameters. The
month-end loop runs for real too, with its four outside edges handed in.

Every guard was broken once. **One assertion did not catch its mutation**: the
"a subscribed client is skipped" check used a client whose `billingStatus` was `"active"`,
which the status check already excludes, so it passed whether or not the subscription guard
existed. Rewritten against a client carrying **both** a subscription and `card_on_file` — a
real shape, and one where the subscription guard is the only thing standing. **An assertion
guaranteed by the data is not a test.**
