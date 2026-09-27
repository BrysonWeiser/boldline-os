---
name: late-payment-policy
topic: Contracts
task: explain or change what happens when a client pays late; pause or resume a client over an unpaid invoice; understand why a client's ads or landing page went offline
keywords: [late payment, past due, payment failed, late fee, $50 late fee, pause for non-payment, billingPause, billingLate, suspend services, landing page offline, 503 unavailable, resume after payment, three days, ten days, terminate for cause, void contract, interest, 1.5% interest, terms v6, termsVersionOf, docusignSentAt, contract version stamp, Agreement 3.4]
status: verified
summary: BUILT 2026-09-27 as contract terms v6. Bryson asked for 3 days grace, a week of interest, then the contract "automatically voided" with everything "stopped and deleted". Agreed instead, after pushback - day 3 a flat $50 fee (once per invoice) and a PAUSE (live campaigns paused, landing page offline with a neutral 503), NOTHING deleted, paying switches back on exactly what was paused; day 10 Bryson MAY end it for cause and everything owed becomes due, never automatic; no interest. 🔴 Only clients on v6+ terms get this; v1-v5 keep 10 days + 1.5%/mo interest and no pause. 🔴 Fixed a latent bug on the way - nothing stamped the terms version at SEND time, so any version bump silently rewrote contracts already out for signature (Air Suds was one). Now stamped on send, and unstamped records are dated by the earlier of sent/signed. 33 checks, 16 mutations, all caught.
verified: 2026-09-27
---

**His ask (2026-09-27, ~2:40am Phoenix):** *"When a payment is late let's cut the time down from a
10 days to 3 days without interest accumulating and then from there have one week of accumulated
interest before the contract is automatically voided and all ads landing pages etc are stopped and
deleted."* Then *"Do that"* to the counter-proposal below.

## What was changed from his version, and why (agreed)

| He asked | Built | Why |
|---|---|---|
| Contract "voided" | **Terminated for cause** | A voided contract is treated as never having existed, which releases a non-paying client from everything owed. Termination keeps every dollar due (remaining term under v3+). |
| Ads and pages "deleted" | **Paused / offline** | The ad accounts are the CLIENT's (contract: "Client owns the accounts", plus the hard business rule). Deleting destroys their property and invites a claim. And a pause is leverage: "pay and it's back on". A deletion removes their reason to pay. |
| A week of interest | **Flat $50 fee, once per overdue invoice** | 1.5%/mo on $700 for a week is about $2.50. Nobody notices it. The fee is framed as the real cost of chasing, pausing and restoring, not a penalty (the same enforceability logic as KB `contract-terms-versioning`). "Or the maximum permitted by law if less" covers state caps. |
| "Automatically" voided | **Bryson decides at day 10** | Cards fail for boring reasons (expired card, bank fraud hold). A machine firing a good client over a bank glitch is the expensive mistake. The pause IS automatic. |

## Timeline (v6 terms, Agreement 3.4)

| Day past due | What happens | Who does it |
|---|---|---|
| 0 | Card fails. Stripe retries. Client gets the Past-Due email, which for v6 clients now **warns them about day 3 in plain words** (fee, pause, nothing deleted, back on when paid). Owner email + SMS. | Stripe + webhook |
| 3 | $50 late fee added as a pending Stripe invoice item (rides the next invoice). Live campaigns paused (Google ENABLED, Meta ACTIVE only). Landing page(s) serve "temporarily unavailable" (503, no reason given). Owner red alert listing anything that could NOT be paused. | `billing-watch` (daily, 14:30 UTC) |
| Paid | Webhook lifts the pause the moment the invoice that CAUSED it is paid; the daily watch lifts it otherwise. Re-enables exactly the recorded list. | `stripe-webhook` / `billing-watch` |
| 10 | Owner red alert, once: "you can end the contract, nothing happens unless you do". To end it: client, Contract tab, Early termination (the existing ETF panel). | Bryson |

## 🔴 Rules that must not break

- **The client's own contract version decides.** `latePolicyFor(cl)` reads `termsVersionOf(cl)`, the
  SAME resolver that picks which clause the contract prints. v1-v5: 10-day grace, 1.5%/mo interest,
  no fee, no pause, exactly as before. Pausing an older client on day 3 would be BoldLine breaching.
- **Pause never removes.** `billing-pause.mjs` only ever sends PAUSED / ENABLED / ACTIVE. A test
  fails if the words REMOVED or delete appear in it.
- **Resume only what the pause recorded** (`billingPause.paused[]`). A campaign Bryson left off on
  purpose stays off after they pay.
- **Nothing ends a contract automatically.** A test fails if billing-watch grows an ETF charge,
  a subscription cancel, or a contract-status change.
- **The offline page never mentions money.** The visitor is the client's customer.
- Never on BoldLine's own account (`cl.internal`).
- `BILLING_GRACE_DAYS` (test-mode knob) only shortens the OLD interest grace. The v6 three days is a
  contract term, not a tuning knob.

## Where the state lives

- `billingLate` (per client, written daily): `days, amountDue, invoiceId, policy ("pause"|"interest"),
  termsVersion, pauseAfter, endAfter, lateFee, lateFeeItemId, canEnd, interest, itemId`.
- `billingPause`: `{ at, invoiceId, paused:[{p,id,rn,name}], failed:[...], resumedAt, resumed, resumeFailed }`.
  Paused = `at` set and no `resumedAt`. The OS alerts and the Billing card read these.

## 🔴 The bug found on the way: a contract is frozen when it is SENT

The contract renders fresh every time it is opened. Before this, **nothing stamped the terms version
when a contract went out**, so an unstamped record got the newest terms. Bumping to v6 would therefore
have made the OS claim Air Suds (sent 24 Sep, unsigned) agreed to a clause that is not in the
DocuSign envelope they are signing. It had also been true for every earlier bump; it only never bit
because the one signed client (Stencil & Thread) is dated v1.

Fixed two ways:
1. **Sending stamps** `contractTermsVersion: termsVersionOf(client)` alongside `docusignSentAt`.
2. **Unstamped records are dated by the EARLIER of `docusignSentAt` and `contractSignedAt`**: before
   3 Sep 2026 → v1 if signed; before 27 Sep 2026 10:00 UTC → v5; else current. So everything sent or
   signed before v6 renders exactly as it did the day before.

`termsVersionOf` now lives beside `makeContractHTML` in BOTH copies (`netlify/lib/contract-shared.cjs`,
exported; `index.html`), and the harnesses that lift the browser copy lift it too.

🔴 **Still open, noticed not fixed:** `netlify/lib/campaign-live.mjs` reads `contractTermsVersion`
directly (`|| 0`), so an UNSTAMPED v5 client is treated as pre-v5 for the event-start date logic. New
contracts are stamped at send now, so it only affects records sent before 27 Sep. Switch it to
`termsVersionOf` if it ever matters.

## Who is on what, the day it shipped

- Stencil & Thread: v1 (signed 2026-08). Old rules.
- Air Suds: v5 (sent 24 Sep, unsigned). Old rules, even after they sign.
- Brendon (chiropractor) and every contract sent from now on: v6.

## Tests

`tests/verify-late-payment.mjs`: 33 checks covering who gets which terms, both contract copies
byte-identical, the clause wording, the rules by day, pause/resume against fake ad platforms, the
watch and webhook wiring, the offline page, and the client email. 16 mutations, all caught (the one
first survivor, interest-free-by-missing-field, is now pinned). Two older tests pinned the version
NUMBER (5) and were rewritten to assert the rule instead.
