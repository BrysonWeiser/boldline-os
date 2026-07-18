---
name: billing-automation
topic: OS app
task: change how billing enforcement works — fee waivers/discounts, late-payment tracking, late interest, or early-termination billing
keywords: [billing-watch.mjs, charge-etf, billingLate, billingSetup, waive setup fee, discount, late interest, 1.5%, past_due, early termination fee, ETF, invoice item, getAlerts billing, Adjust Fees]
status: verified
summary: Contract-enforcement automation — BUILT 2026-07-16. (1) Fee adjust/waive UI on the BillingCard (billingMonthly/billingSetup overrides flow into contract doc + checkout; setup $0 = "Waived" on the contract). (2) getAlerts now raises red/yellow billing alerts (past_due, interest accruing, checkout unpaid, ETF owed). (3) billing-watch.mjs (daily 14:30 UTC Netlify schedule) syncs unpaid invoices from Stripe, stores billingLate{days,amountDue,interest} on the client, accrues 1.5%/mo interest pro-rated daily AFTER a 10-day grace as ONE pending Stripe invoice item (auto-rides the next monthly invoice), and emails OWNER_EMAIL on transitions (newly late / interest started / recovered). (4) Early-termination panel on the Contract tab auto-computes ETF = 1 month fee + term-discount clawback and can bill it via new stripe-billing action charge-etf (standalone auto-charge invoice + cancel_at_period_end). No new env vars needed. TEST-MODE E2E VERIFIED 2026-07-16 (waiver + discount + checkout-skip + ETF auto-charge all green on the third round; late-watch Part B confirmed next morning).
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

**GOTCHA 2 (same test, next attempt):** the $600 invoice then sat in "Retrying" — Checkout
attaches the card to the SUBSCRIPTION (default_payment_method on the sub), not as the customer's
invoice default, so a standalone invoice has no card to charge. Fix: charge-etf resolves a PM
(subscription's card → customer invoice default → first saved card) and passes it as the
invoice's `default_payment_method` before /pay.

**TEST-MODE E2E (2026-07-16, Bryson):** waiver/discount/checkout-skip verified on dummy clients;
ETF path green on round 3 ("ETF invoice charged and PAID", $600 invoice Paid in Stripe, no
leftover pending items) after gotchas 1+2 above were caught by rounds 1–2. Late-payment sim
(open $100 send-invoice + BILLING_GRACE_DAYS=0) checked the following morning. Test recipe for
reruns: sk_test swap → dummy client → Adjust Fees (waive+discount) → checkout 4242 → mark
signed/active → ETF bill; late sim = open send-invoice due today + BILLING_GRACE_DAYS=0 →
next 14:30 UTC run → owner email + red alert + pending interest item.

**Copy button fix (2026-07-16):** the Contract tab's "Copy" used to copy the contract's raw
HTML (useless to Bryson — pasted as a wall of code, mistaken for a broken link). Now "Copy
Client Link" copies the client's portal URL (/portal?token=…) where they can read the contract.
The DocuSign SIGNING link is never in the OS — DocuSign emails it to the client directly.

**LATE-PAYMENT WATCHER — VERIFIED 2026-07-18.** Confirmed end-to-end on the manual "Run now":
watcher processed the billed clients (`checked 4, updated 1`), flipped the test client to
`past_due`, and **sent the owner the "payment failed — $100 overdue, 1 day past due" email**
(1.5%/mo interest line present). Owner alert + status + email all green. The earlier doubt (first
daily run at 0 days late) was just whole-day counting — it fires correctly once ≥1 day late.

**GOTCHA 3 — a test/live STRIPE_SECRET_KEY mismatch silently breaks the watcher for the OTHER
mode's clients (caught 2026-07-18).** While `STRIPE_SECRET_KEY` was the `sk_test_` key for the
late-payment test, billing-watch threw `No such customer … a similar object exists in live mode,
but a test mode key was used` for every LIVE client (e.g. DetailKing ATL) — meaning real clients
had NO late-payment enforcement, no alert, no email, the whole time the test key was in place.
The per-client `try/catch` keeps the run alive (still `checked 4`) so the failure is invisible
unless you read the function log. Lesson: the test-key swap is not just cleanliness — it actively
disables live billing enforcement. Swap back to `sk_live_` the moment a test is done.

**Home-dashboard surfacing fix (2026-07-18).** `getAlerts` correctly raised the red `past_due`
alert, and it showed on the client card + Alerts tile count + Alerts segment list — but the Home
dashboard's inline "Urgent alerts" banners only rendered expiring contracts + upgrade requests,
so a payment failure never appeared on the dashboard itself (you had to drill into the client).
Fixed in `index.html` (HomeScreen): red `billing_late`/`billing_interest`/`etf_due` alerts now
lead the dashboard banners, above expiring contracts.

**✅ CLEANUP COMPLETE — 2026-07-18. Late-payment billing is fully live and verified end-to-end.**
1. ✅ `netlify.toml` billing-watch schedule reverted from the TEMP `*/20 * * * *` to `30 14 * * *`
   (daily) — merged + deployed.
2. ✅ Netlify env `BILLING_GRACE_DAYS=0` **deleted** (10-day grace restored).
3. ✅ `STRIPE_SECRET_KEY` swapped back to the live `sk_live_` key.
4. ✅ Test-mode dummy clients (`TEST — delete me`, `test2`, `test3`) deleted from the OS.
**Live-key verification (Run now, 2026-07-18):** `billing-watch: checked 1 billed client(s),
updated 0` with NO error line — the prior `No such customer … test mode key` failure on the live
client is gone, confirming GOTCHA 3 is resolved and real clients are covered again. (Leftover
test-mode Stripe objects — test customer, $100 invoice, ~$0.05 interest item, $600 ETF invoice —
remain in Stripe TEST mode only; sandboxed, harmless, optional to clear.)
