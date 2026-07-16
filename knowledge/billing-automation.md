---
name: billing-automation
topic: OS app
task: change how billing enforcement works — fee waivers/discounts, late-payment tracking, late interest, or early-termination billing
keywords: [billing-watch.mjs, charge-etf, billingLate, billingSetup, waive setup fee, discount, late interest, 1.5%, past_due, early termination fee, ETF, invoice item, getAlerts billing, Adjust Fees]
status: verified
summary: Contract-enforcement automation — BUILT 2026-07-16. (1) Fee adjust/waive UI on the BillingCard (billingMonthly/billingSetup overrides flow into contract doc + checkout; setup $0 = "Waived" on the contract). (2) getAlerts now raises red/yellow billing alerts (past_due, interest accruing, checkout unpaid, ETF owed). (3) billing-watch.mjs (daily 14:30 UTC Netlify schedule) syncs unpaid invoices from Stripe, stores billingLate{days,amountDue,interest} on the client, accrues 1.5%/mo interest pro-rated daily AFTER a 10-day grace as ONE pending Stripe invoice item (auto-rides the next monthly invoice), and emails OWNER_EMAIL on transitions (newly late / interest started / recovered). (4) Early-termination panel on the Contract tab auto-computes ETF = 1 month fee + term-discount clawback and can bill it via new stripe-billing action charge-etf (standalone auto-charge invoice + cancel_at_period_end). No new env vars needed. NOT yet live-tested against real Stripe.
verified: 2026-07-16
---

**Setup fee on first invoice:** already handled since 2026-07-10 — create-checkout line item 2 is
the one-time setup fee on the FIRST invoice (verified in the test-mode E2E). This entry covers
everything built on top (2026-07-16).

**1. Manual discount / waive (BillingCard, status none/canceled):** "Adjust Fees" → inputs for
Monthly + Setup (with "Waive Setup Fee" one-tap = $0) → Apply persists `billingMonthly` /
`billingSetup` on the client. Everything downstream reads those: `makeContractHTML` (Key Terms
shows "Waived" when 0; §3.1 reads "Any one-time Setup Fee…"), create-checkout (skips the setup
line item when 0 — pre-existing `if(setup>0)` branch), BillingCard display ("setup fee waived" +
gold "Adjusted" chip), revenue views. **GOTCHA:** `billingSetup` can legitimately be `0` — always
use `cl.billingSetup!=null ? cl.billingSetup : pkg.setup`, never `||`. Reset-to-Standard restores
package pricing. Bryson's plan: waive setup for the first 3–5 clients.

**2. Owner alerting (getAlerts in index.html):** derived automatically from stored fields —
`billingStatus==="past_due"` → red (message upgrades to "interest accruing, auto-added to next
invoice" when `billingLate.interest>0`); `awaiting_payment` + checkout link → yellow;
`cl.etf && !etf.settled` → red/yellow "ETF owed". Feeds AlertBadge, the Alerts screen, and Home.

**3. Late tracking + interest (netlify/functions/billing-watch.mjs, netlify.toml schedule
"30 14 * * *"):** for each client with a stripeCustomerId and billingStatus in
active/past_due/awaiting_payment: pulls open invoices, oldest = anchor; daysLate from
due_date||created; writes `billingLate:{days,amountDue,interest,invoiceId,itemId}` (cleared on
recovery); flips billingStatus past_due↔active. Interest = overdue × 1.5% × (daysLate−10)/30,
maintained as ONE Stripe invoice item (updated daily while pending; recreated if consumed) —
pending items are automatically swept onto the next subscription invoice, which §3.4 of the
Agreement explicitly authorizes. Owner emails only on TRANSITIONS: newly late / interest started
/ recovered (no daily spam). Uses report-shared's sendEmail (Resend). All env vars already
existed — no Netlify setup step.

**4. Early termination (Contract tab):** "Client leaving early? Calculate Early Termination" →
panel shows the Agreement math: ETF = 1 × effective monthly; clawback = (standard rate −
discounted rate) × months already billed this term (months = calendar months elapsed since
contractStart + 1 for the advance-billed cycle, capped at contractTermMonths). Buttons: **Record
Only** (stores `cl.etf`, red alert until settled, "Mark Settled" chip) or **Bill via Stripe +
End Subscription** (action `charge-etf` in stripe-billing.mjs: invoice items for ETF + clawback →
standalone `collection_method:charge_automatically` invoice → immediate /pay attempt, falls back
to Stripe dunning → `cancel_at_period_end:true`). Recording also pulls contractEnd in to 30 days
out (the notice period) when that is sooner. `cl.etf={date,etfFee,clawback,monthsBilled,total,
billed,settled,invoiceId?,invoiceUrl?}`.

**What stays manual (by design):** actually pausing campaigns on suspension (§3.4 says "may" —
owner's judgment call, the alert prompts it); waiving/settling an ETF; the 30-day notice email
itself. Renewal-window nudges were already automated (contract_30/contract_7 alerts).

**GOTCHA (caught in the 2026-07-16 test):** on current Stripe API versions, creating an
invoice does NOT sweep in pending invoice items by default (`pending_invoice_items_behavior`
defaults to "exclude"). charge-etf's standalone invoice came out $0, auto-"paid", and the OS
falsely reported the ETF settled while the items silently queued for the next monthly invoice.
Fix: pass `pending_invoice_items_behavior:"include"` + guard that rejects an empty invoice.

**NOT yet live-tested against Stripe** (charge-etf + the invoice-item accrual). Test recipe =
same sk_test swap as contract-renewal-pricing: dummy client → pay 4242 → (a) record ETF w/ bill →
check standalone invoice paid in Stripe; (b) simulate late: create an open invoice with a past
due_date via Stripe dashboard → run billing-watch manually (curl the function URL) → expect
billingLate on the client + owner email + pending invoice item after day 10.
