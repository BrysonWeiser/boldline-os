---
name: stripe-billing
topic: OS app
task: set up, debug, or extend Stripe billing (recurring management-fee subscription) in the OS
keywords: [stripe-billing.mjs, stripe-webhook.mjs, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, checkout-session, us_bank_account, billingStatus, BillingCard, subscription]
status: verified
summary: Recurring management-fee billing via Stripe. Owner clicks "Set Up Recurring Billing" on a client's Contract tab → stripe-billing.mjs creates a subscription-mode Checkout Session (card + ACH) at the package's monthly price + one-time setup fee → client pays once, auto-charges monthly. stripe-webhook.mjs keeps billingStatus in sync. Charges the SERVICE FEE ONLY, never ad spend. Built 2026-07-10 (hand-rolled Stripe REST, no SDK). Env vars STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET still need to be added in Netlify; test in Stripe test mode before the first real client.
verified: 2026-07-10
---

**What it does:** collects BoldLine's recurring **management fee** (the package `price`) as an
auto-charging Stripe subscription, plus the one-time **setup fee** (the package `setup`) on the
first invoice. Option-3 model (Bryson's pick 2026-07-09): auto-charge, with **card OR US bank /
ACH** offered at checkout. **HARD RULE:** charges the service fee ONLY — never ad spend (client
pays Google/Meta directly, owns their account). See `business-constraint-ad-spend`.

**Pieces (all built 2026-07-10):**
- `netlify/functions/stripe-billing.mjs` — owner-authed (same Supabase-JWT pattern as
  docusign-send/google-ads). Actions:
  - `create-checkout` → creates/reuses a Stripe Customer (metadata.clientId) + a
    **subscription-mode Checkout Session** (`payment_method_types:["card","us_bank_account"]`,
    line item 1 = recurring monthly `price_data`, line item 2 = one-time setup `price_data`,
    metadata.clientId on session + subscription). Returns `{url, customerId}`.
  - `sync` → reads the customer's latest subscription + last paid invoice **straight from Stripe**
    (webhook-independent). Powers the "Refresh Status" button, so billing is usable even before
    the webhook endpoint is configured.
  - `portal` → Stripe Billing Portal session (update card/bank, view invoices).
- `netlify/functions/stripe-webhook.mjs` — **public but signature-verified** (HMAC-SHA256 over
  `${t}.${rawBody}`, hand-rolled with node crypto — no SDK). On `checkout.session.completed`,
  `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted` it updates the
  matching client's `data` blob (found by `metadata.clientId`) via the Supabase service role.
- Front end: `BillingCard` component inside `ContractTabContent` (index.html). Status-driven UI:
  none → "Set Up Recurring Billing"; awaiting_payment → shows the payment link (copy/open) +
  Refresh; active → "Auto-charging $X/mo" + Manage in Stripe + Refresh; past_due → "Fix Payment
  Method"; canceled → set up again.

**Client data fields (in the `data` blob, auto-persist via the clients table):**
`stripeCustomerId`, `stripeSubscriptionId`, `billingStatus`
(none|awaiting_payment|active|past_due|canceled), `billingCheckoutUrl`, `billingMonthly`,
`billingSetup`, `lastPaymentAt`, `lastInvoiceAmount`, `billingNextCharge`.

**Why hand-rolled REST, no `stripe` SDK:** matches the codebase (google-ads.mjs, docusign-send.mjs
all call REST directly with fetch); zero new dependencies to install/bundle. Form-encoding uses
PHP-style nested keys (`a[b][c]=v`, arrays `a[0][b]=v`) via `encodeForm()`.

**SETUP STILL NEEDED (Bryson, in Netlify → OS site → Environment variables):**
1. `STRIPE_SECRET_KEY` = the **live** secret key (Stripe → Developers → API keys → reveal Secret
   key `sk_live_...`). Paste straight into Netlify, never into chat or a file.
2. `STRIPE_WEBHOOK_SECRET` = the endpoint signing secret (`whsec_...`) from step 3.
3. Stripe → Developers → **Webhooks → Add endpoint**: URL
   `https://<os-site>/.netlify/functions/stripe-webhook`; events `checkout.session.completed`,
   `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   (SUPABASE_SERVICE_ROLE_KEY already exists on the OS site.)

**TEST-MODE END-TO-END PASSED 2026-07-10.** Bryson set `STRIPE_SECRET_KEY` (sk_test) +
`STRIPE_WEBHOOK_SECRET` (whsec) in Netlify, created the webhook endpoint
(`https://boldlinemedia.netlify.app/.netlify/functions/stripe-webhook`, 5 events, Snapshot
payload, API 2025-11-17.clover), redeployed, then set up billing on a dummy client and paid with
test card 4242 → the BillingCard flipped to green **Billing Active** ($600/mo). Full loop verified:
Checkout → subscription → OS sync. **To go LIVE:** swap the two Netlify env vars to the live
`sk_live_`/`whsec_` (live-mode webhook endpoint) and redeploy — no code change.

**Original note (still true) — can't be verified in this sandbox (no live Stripe):** the one-time
setup fee rides the first invoice as a second one-time line item in subscription-mode Checkout;
confirmed working in the 2026-07-10 test. **One API detail to watch on that first test:** we bill the one-time setup fee as
a second (one-time) line item inside the subscription-mode Checkout Session. Stripe supports mixing
recurring + one-time line items in `mode:subscription`; if a future Stripe change ever rejects it,
switch that line to `subscription_data[add_invoice_items]` in stripe-billing.mjs (one-spot change,
clearly commented).

**Not built yet (future):** client-portal self-serve pay (v1 = owner sends the checkout link);
proration on mid-cycle package upgrades; dunning email customization (Stripe's default retries
apply). ACH takes a few days to clear and can fail on insufficient funds → shows as past_due, Stripe
auto-retries.
