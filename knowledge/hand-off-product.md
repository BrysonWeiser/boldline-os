---
name: hand-off-product
topic: Pricing
task: sell, build, deliver or price the one-time Launch & Hand Off, or work out what happens when a hand-off client comes back
keywords: [hand off, handoff, one-time build, h-handoff, Launch and Hand Off, one_time, pricingModel one_time, no monthly, setup waiver, 6 month credit, handoffPaidAt, settle-in, HANDOFF_SETTLE_IN_DAYS, handover pack, handover playbook, handoffIsFinished, downsell, sub-floor budget, Stencil]
status: verified
summary: BUILT 2026-08-18. A one-time build for businesses below the $500/mo ad-budget floor, or who want the build without the monthly. $1,500 once, no monthly, no per-lead fee, no term. Includes the same build a managed client gets, two optimization passes over 30 days, a written handover playbook and a training call. Then BoldLine is finished, and every recurring job stops touching the account. If they move onto a managed plan within 6 months the setup fee is WAIVED automatically. Stripe sells it as mode:"payment", the contract swaps its term/fees/termination sections wholesale, and the OS tracks the whole lifecycle on one card.
verified: 2026-08-18
---

**Bryson, 2026-08-18:** *"build the hand off and properly price it."* Then, the question that
turned it from a SKU into a product: *"if and when someone buys the one time setup how will
that work for me? how will I build it and give it to them and then track if they come back as
a recurring client within 6 months?"*

## Why it exists

Stencil & Thread was the exact prospect: willing to pay for the work, unwilling to pay a
monthly fee bigger than his ad budget. Under the greater-of model he still would not qualify
for a managed plan (his budget was $800 and the minimum is $400, which is half his spend).
Turning that away is turning away cash **and** a future managed client.

## 🔴 Why $1,500, defended by three relationships

Each is asserted in `tests/verify-packages.mjs` section 3h, so a later edit cannot quietly
break the logic:

1. **Below managed Launch across its minimum term.** $750 setup + 3 × $400 = **$1,950**. So
   hand-off is genuinely the cheaper door while buying strictly less.
2. **Above the $750 managed setup.** That setup fee is deliberately underpriced because it
   buys a recurring client. With no recurring revenue behind it, the build must pay for
   itself. This is the answer to "why is the one-time more than your setup fee?"
3. **At the honest bottom of the market.** An agency charges $1,500-$3,500 for a one-time
   campaign + landing page build.

## The shape

| | Value |
|---|---|
| id | `h-handoff`, family `h`, tier `handoff` (TIER_RANK **0**, below Launch) |
| `price` | **0** — meaning "no monthly", NOT "free" |
| `setup` | 1500 — the entire fee |
| `pricingModel` | `one_time` |
| `optimizationFreq` | `none` |
| Platform | Google only (the only one deliverable today) |

`calcMonthlyBill` returns `{billed:0, atFloor:false, model:"one_time"}` in **all three**
implementations. `atFloor:false` is load-bearing: without it the billing card would tell the
owner a handed-off client is "under the minimum" every month forever and invite him to chase
a client who owes nothing.

## What's in it (and deliberately not)

**In:** the GOOD build. Custom landing page, call tracking, conversion tracking, keyword and
competitor research, ad copy. Plus `handover_docs` and `settle_in`.

**Out:** every ongoing feature. No monthly report, no optimization cadence, no split testing,
no retargeting, no scaling roadmap. There is nobody running it after settle-in, and promising
a monthly report would be selling a ghost.

## 🔴 The upgrade-ladder exemption, and why it is not a loophole

A hand-off **skips the "never take anything away" rule**. Everything in it is a ONE-TIME
DELIVERABLE the client already owns: the landing page stays up, the tracking stays wired, the
playbook is in their inbox. No managed plan can take any of it away.

Without the exemption the ladder would offer them **nothing**, because a hand-off includes a
custom page and call tracking that Launch-tier management does not, so every managed plan
looks like a downgrade on paper while obviously being an upgrade in reality.

The exemption is keyed on the **source** being one-time (`oneTimeSource`), so no managed
client gains the same freedom. Asserted both ways: every managed lead-gen plan is reachable
from a hand-off, and **nothing ever upgrades INTO one** — that would be a cancellation
wearing an upgrade's clothes.

## The lifecycle — three dates from one stored field

`handoffPaidAt` is stamped by the **Stripe webhook** on `checkout.session.completed` when
`metadata.oneTime === "1"` or `mode === "payment"`, so the clock starts when the money lands
rather than whenever someone next opens the app. A manual "start the clock" button exists for
a client paid by bank transfer or a hand-sent invoice.

| Date | Derived | What changes |
|---|---|---|
| paid | stored | the clock starts |
| settle-in ends | paid + **30 days** | BoldLine's obligations end |
| credit expires | paid + **6 months** | the setup waiver dies |

## 🔴 Every recurring job must stop at settle-in

`handoffIsFinished(client)` is exported from `report-shared.mjs` and checked by:

- `isReportable` / `isOwnerBriefable` — no performance reports, no owner briefings
- `ads-autopilot` — `continue` at the top of the client loop. Changing bids in somebody
  else's account after the work is over is unpaid work AND a promise never made.
- `lead-followup` — theirs to chase now. Ours doing it puts BoldLine's name in front of a
  customer it no longer represents.

## The delivery, as the OS presents it

One `HandOffCard` on the client's Overview tab, showing a five-step timeline: build it, two
optimization passes, send the handover pack, remove your access, call before the waiver ends.
Alerts fire at each milestone, including a **red** one if settle-in ended and the pack was
never sent — worse than a missed deadline, because they paid for it.

**The handover pack** (`netlify/functions/handover-pack.mjs`) is AI-written per client, not a
generic PDF: what they own, a weekly routine under 30 minutes, a monthly check, **"leave these
alone"** (the section that earns the document), warning signs, and when to call. Em dashes are
stripped in code regardless of the prompt. It renders in the OS so Bryson reads exactly what
the client will read before sending — a generated document nobody proofreads is a liability.

## The waiver applies itself

`handleManualUpgrade` waives the setup fee (`billingSetup: 0`) when a one-time client converts
inside the window, stamps `handoffCreditApplied`, and says so in the alert. Outside the window
the fee stands and the alert says that instead. **It is applied rather than remembered**,
because it is exactly the thing that gets forgotten in the excitement of a conversion.

## Billing and contract

- **Stripe:** `create-checkout` takes `oneTime:true` → `mode:"payment"`, build fee only, and
  `subscription_data` is **omitted** rather than sent empty (payment mode rejects it outright).
- **Contract:** sections 2 (Term), 3 (Fees) and the termination clause **swap wholesale**, and
  a new section 4 covers the build, the settle-in, the handover, and the waiver. It states
  `ON COMPLETION OF HANDOVER, AGENCY'S OBLIGATIONS ARE FULLY DISCHARGED` and `CLIENT IS NOT
  ENROLLED IN ANY SUBSCRIPTION`. Both shapes are asserted, **including that neither leaks into
  the other** — a half-adapted agreement is the dispute this product invites.

## Selling it

**Do NOT lead with it.** It is a smaller sale and offering it early gives a prospect who could
afford managed an easy way to spend less and get less. Full downsell script in
`docs/SALES-CALL-PLAYBOOK.md`. The site card sits on the Google panel (permanent, NOT gated by
the Meta flip), and the recommender has an "Under $500" budget band that routes here with a
different pitch entirely.

## 🟡 Deliberately not built

- **An e-commerce hand-off.** Bryson has never run an e-commerce client and Meta is not
  approved. Selling a hand-off he cannot support is worse than not offering it.
- **A Meta hand-off.** Same reason. The card and the package are Google-only until Meta opens.
- **Hosting the landing page after handover.** Not decided. If BoldLine keeps hosting it there
  is an ongoing cost against a one-time fee. **Raise this with Bryson before the first sale.**

## Related

`pricing-model` (the greater-of model this sits beside), `per-lead-fee-finder`, `stripe-billing`,
`contract-renewal-pricing`.
