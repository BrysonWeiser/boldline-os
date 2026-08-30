---
name: client-email-center
topic: OS app
task: send branded, professional client emails (welcome, invoice, renewal, thank-you, etc.) from within the OS with one click
keywords: [client emails, email center, EmailCenterTab, client-email, client-emails-shared, welcome email, invoice email, receipt, past due, renewal, thank you, onboarding, ad account access, branded email, dark theme email, lifecycle emails, EMAIL_TYPES]
status: verified
summary: A per-client "Emails" tab lets Bryson preview, edit, and one-click-send 8 polished DARK-THEME lifecycle emails with the client's details auto-filled — welcome+portal, ad-account access, contract-signed, invoice, receipt, past-due, renewal, thank-you/offboarding. Templates + branding live server-side (client-emails-shared.mjs); client-email.mjs (owner-JWT) renders/sends via the existing Resend sender (report-shared.sendEmail), so they send today with no new config. Built 2026-07-30. 2026-08-02: invoice email's Pay button now resolves a REAL Stripe hosted-invoice URL (pay page + scan-to-pay QR) via new stripe-billing `invoice-link` action, falling back to the Checkout link then the portal; welcome+portal and thank-you/offboarding confirmed fully working (thank-you is prompted by the getAlerts `email_thankyou` alert when a contract ends).
verified: 2026-08-02
---

**Why (Bryson, 2026-07-30):** wanted everything sent to clients to look professional + clean (not a plain email), **dark-themed** (not bright), sendable **from inside the OS with one click**, with client-specific info **auto-filled**, plus a **preview** and a way to **edit** before sending.

**⛔ STANDING RULE — NO EMOJIS in anything a CLIENT sees (Bryson, 2026-08-03):** emojis read unprofessional. Applies to every client-facing surface — all lifecycle email templates (subjects/preheaders/bodies), the lead auto-reply + follow-ups (lead-intake / lead-followup), the AI-written performance reports (buildClientPrompt says "no emojis or decorative symbols"), the newsletter, and the **client portal** (portal.mjs). Removed the 🎉 (milestone), the ✓ from "You're all set", and the portal's 🔗/💳/🔧/⚙/💬/📎/🎉/📸. **Functional monochrome UI glyphs are NOT emojis and stay:** ✓ (Approve button / "Approved" badge / feature ticks), ✕ (delete), ▶ ▾ ▴ → etc. **Left alone (internal-only, only Bryson sees):** the `EMAIL_TYPES` tab icons (👋🔑… in the OS Emails tab) and owner-alert severity emojis (🔴⚠️✅ in dispatchAlert / billing-watch / getAlerts). When authoring any NEW client-facing copy, keep it emoji-free by default.

**The 8 emails (client lifecycle):** `welcome` (welcome + portal login + what's next), `onboarding_access` (grant BoldLine manager access to their ad account — reinforces "you own + pay for the account"), `contract_signed`, `invoice` (itemized setup + monthly + **per-lead line "Qualified leads — N × $rate"**, gold "Pay Securely Online" button → Stripe), `receipt` (payment confirmation), `past_due` (polite dunning + update-payment link), `renewal` (term-ending nudge), `thank_you` (offboarding + "your ad account stays yours" + final report). Catalog = `EMAIL_TYPES` in client-emails-shared.mjs; add a new one by adding a `T.<id>` template fn + an `EMAIL_TYPES` entry. (There is also a 9th branded template, `approval_request`, fired on deliverable creation — not in the EMAIL_TYPES tab catalog.)

**Files:**
- `netlify/lib/client-emails-shared.mjs` — the **dark email shell** (`emailShell()`: #070810 bg, #0C0D18 card w/ gold top-border, serif "BoldLine Media" wordmark, table-based + all-inline styles so it survives email clients; `<meta color-scheme dark>`), content helpers (h1/p/button/detailBox/steps/signoff), the `T` template map, `EMAIL_TYPES` catalog, and `renderClientEmail(type, ctx)` → `{subject, html}`. Imports only `GOLD` + `escapeHTML` from report-shared. Signoff = "Bryson — BoldLine Media".
- `netlify/functions/client-email.mjs` — owner-JWT gated (same pattern as blog-admin/newsletter-admin). Actions: `types` (→ EMAIL_TYPES), `render` ({type, ctx} → subject+html), `send` ({to, subject, html} → sends via **report-shared `sendEmail`** = Resend + REPORTS_FROM_EMAIL). Sending needs only the already-set RESEND_API_KEY + REPORTS_FROM_EMAIL (client reports already use them), so **no new env vars / not gated on the domain move**.
- `index.html` `EmailCenterTab` — the **Emails** tab in ClientHub (added to TABS after Contract; hidden for `client.internal` My Ads). Lists the 8 with Preview buttons; opens a modal with a **Preview/Edit toggle** — Preview renders the real email in an `<iframe srcDoc>`, Edit uses the shared **VisualEditor** (WYSIWYG) on the body + an editable Subject; plus **Reset** (re-render defaults) and **Send Now**. On send it appends a `commLog` entry ("Sent \"<label>\" email to <email>"). `ctx` auto-fills from the client: businessName=client.name, contactName, packageName (pkg.name), monthly (billingMonthly||pkg.price), setup (billingSetup||pkg.setup), portalUrl (`origin/portal?token=<portalToken>`), date. **`payUrl` (2026-08-02):** a `useEffect` calls `stripeBilling("invoice-link",{customerId})` on mount and stores the client's real Stripe **hosted-invoice URL**; `buildCtx` sends `payUrl || client.billingCheckoutUrl || ""` so the invoice Pay button is a genuine Stripe pay page (card/bank + QR), falling back to the Checkout link, then (template) the portal.

**Verified 2026-07-30:** both new .mjs `node --check` clean; OS babel-compiles; all 8 templates rendered headlessly to PNG (dark brand correct, gold buttons, itemized invoice box, numbered steps) and sent to Bryson to review.

**Links verified 2026-07-30:** audited every href across all 8 templates — each email has exactly ONE working https button (portal or Stripe pay link), no dead/placeholder links. Fixed an edge case: buttons rendered empty when a client had no portalUrl/payUrl → every `button()` now falls back to `SITE` (https://boldlinemedia.com) so an email never ships without a working CTA.

**Automation model — AUTO + one-tap hybrid (Bryson 2026-07-30, expanded 2026-08-02 → "flip the safe ones to automatic"):**
- **✅ AUTO-SENT server-side (BUILT 2026-08-02)** via `netlify/lib/client-email-auto.mjs` (`autoSendClientEmail(cl,type,extra)` + `buildClientCtx` — server twin of EmailCenterTab.buildCtx; portal URL from `process.env.URL`, package name from pricing-shared PACKAGES; fail-soft, never throws; logs the same `Sent "<label>" email … (automatic)` commLog line so the OS reminder clears):
  - **Welcome + Portal** ← Stripe `checkout.session.completed` (stripe-webhook.mjs)
  - **Payment Receipt** ← Stripe `invoice.paid`. **ITEMIZED (2026-08-02):** the webhook passes the paid invoice's own `lines.data` (management fee + "Qualified leads delivered — N leads" + any interest, cleaned of the "(rides next monthly invoice)" suffix) + `hosted_invoice_url`; the receipt template renders each line + a green "Total paid" + a **View / Download Invoice** button to the Stripe hosted invoice (full breakdown + PDF). Falls back to the old flat "Amount paid" + Open-Portal button when no line data. This is the client's automatic monthly itemized statement (auto-charge model — they're charged, this is the detailed receipt, not a pay-me email).
  - **Payment Past-Due** ← Stripe `invoice.payment_failed` (payUrl = the failed invoice's `hosted_invoice_url`)
  - **Renewal Reminder** ← billing-watch.mjs daily, ~30 days before `contractEnd`
  - **Ad-Account Access, Onboarding Nudge, Lead Milestone** ← NEW daily job **`netlify/functions/client-nurture.mjs`** (schedule `0 16 * * *`, BUILT 2026-08-03):
    - **Ad-Account Access** — ~1 day after Welcome (once). Was one-tap; now auto.
    - **Onboarding Nudge** (new template `onboarding_nudge`) — day 2 + day 5 after Welcome IF `!intakeComplete`, to chase a stalled onboarding. Steps 1+2 are gated on `emailAuto.welcome` so they never back-fill onto pre-existing/live clients.
    - **Lead Milestone** (new template `lead_milestone`) — celebratory email at 10/25/50/100/250/500/1000/2500/5000 leads. `emailAuto.milestonesSent` is **seeded on first sight** (marks already-earned thresholds without emailing) so existing clients only get FUTURE crossings. Applies to all active clients (not gated on welcome).
  - **Idempotency:** flags on `cl.emailAuto` — `welcome` (bool) + `welcomeAt` (ISO, set by the webhook), `receiptInvoiceId`, `pastDueInvoiceId`, `renewalForEnd`, `access` (bool), `onboardingNudges` (["d2","d5"]), `milestonesSent` (number[]). Re-runs never double-send.
- **✋ STILL ONE-TAP (with an OS alert so Bryson is nudged):** **Invoice** (needs his lead review first — junk flagging — and Stripe already emails its own; alert `email_invoice` on `awaiting_payment`), **Thank-You/Offboarding** (`email_thankyou` on contract end). **Contract Signed** stays optional one-tap (redundant with the auto Welcome; no separate DocuSign "signed" webhook exists). (Ad-Account Access moved to AUTO 2026-08-03 — its `email_access` reminder still shows as a fallback until the auto-send logs it.)
- **Lead nurture extended (lead-followup.mjs, 2026-08-03):** the un-actioned-lead follow-up sequence went from day 1 + 3 to **day 1 / 3 / 7 / 14**, each with its own escalating-but-warm copy + subject; still stops the moment the lead's status leaves "new". Branded as the CLIENT's business (leadEmailHTML), SMS + email.
- **Reminders double as auto-send FALLBACK:** `getAlerts(cl)` still emits the blue `email_*` reminders; when the auto-send succeeds it logs the commLog line and the reminder clears, but if an auto-send fails (no email on file / Resend down) the reminder stays so Bryson can one-tap it. Best-effort note: two near-simultaneous Stripe events could race on `cl.emailAuto` (worst case a duplicate/again email) — acceptable at solo volume.
- **GOTCHA (dedup with Stripe's own emails):** Stripe also auto-emails its own receipt/invoice; if the branded **Receipt** is on, turn OFF Stripe's customer emails (Dashboard → Settings → Customer emails) to avoid two.
- **Still pending:** deep-link `email_*` reminders to the Emails tab (`_initialTab:"emails"`); revisit whether to auto-send the remaining one-tap ones after a few real clients.

**✅ Stripe pay link + QR — BUILT 2026-08-02 (Bryson asked "link or barcode for stripe payment"):** new `stripe-billing` action **`invoice-link {customerId}`** returns a real Stripe **hosted-invoice URL** — it prefers an OPEN (unpaid, payable) invoice, else the most recent invoice with a `hosted_invoice_url`. That page is a genuine pay page: card/bank **and** a scan-to-pay **QR code** (so "link or barcode" is satisfied by Stripe's own page, no QR generated in the email itself). EmailCenterTab fetches it into `payUrl` (fallback: Checkout link → portal). Invoice template fine-print now reads "pay by card or bank — or scan the QR code to pay from your phone." Verified 2026-08-02 (rendered invoice email → real payUrl in button, QR copy present, amount row present, clean portal fallback when payUrl empty). NOTE on the auto-charge model: ongoing clients are auto-charged and Stripe emails its own invoice/receipt automatically, so this branded invoice email is a courtesy / pay-early / past-due path — the automation still does the actual collecting.

**✅ Invoice email itemizes leads — 2026-08-02 (Bryson):** the invoice now shows a
per-lead line **"Qualified leads — N × $rate" = $total** and folds it into Amount due
(subject total too). `buildCtx` (EmailCenterTab) computes `leadCount` = leads that are
`!billed && !notBillable` (same billable set as the Billing card), `leadRate` =
`billingPerLead ?? PER_LEAD[niche] ?? 0`, `leadTotal` = count×rate. Template guards: row
only shows when `leadCount>0 && leadTotal>0` (no "$0" row when rate unset). Fine-print now
reads "management and per-lead fees only." Verified: render with 3×$75 → $225 line +
$1,325 due; 0-lead and 0-rate cases show no row.

**Possible next touches (not built):** auto-send hooks (e.g., fire `welcome` on contract-signed, `receipt` on Stripe payment) instead of manual one-click. Light-mode note: emails are intentionally DARK per Bryson; a few email clients may force-light them, which is acceptable.

## 🔴 2026-08-26 — THE INVOICE EMAIL CONTRADICTED THE SIGNED CONTRACT

Bryson, before sending the first one to a real client: *"just to double check that all the
buttons actually work for the branded emails."* Nine of ten were fine. The tenth was
**overcharging every managed client, every month**.

**The invoice added the monthly minimum AND the full lead value.** Section 4.1 of every
managed agreement says in capitals *"THE TWO ARE NEVER CHARGED TOGETHER"* — the fee is the
**greater of** the two. So a client on a $700 minimum who produced $900 of qualified leads
was invoiced **$1,600 of fees instead of $900**. An overcharge of exactly the minimum, on the
one document a client reads most carefully, contradicting the contract they had signed. It
had been wrong since the 2026-08-18 pricing rewrite: the model changed, the contract
followed, and the invoice did not.

**Fixed.** The invoice now bills `setup + max(minimum, leads)` and, crucially, **says where
the other number went**, because a client who knows they have a minimum will look for it:
- Leads win → *"Your $700 monthly minimum is included in the above, not added"*
- Minimum wins → *"5 qualified leads at $75 counted toward the minimum, not added"*
- Results-only client → the $0 minimum line is gone entirely
- **Results-only client with no leads → not an invoice at all.** Subject becomes *"Nothing due
  this month"*, because a bill for $0 invites a confused reply and the agreement promises
  they owe nothing.

## Buttons: all ten verified

Every template's buttons resolve to the client's real portal link. Confirmed by rendering all
ten and extracting every `href`. **A new client gets `portalToken` at creation**
(`AddClientSheet`), so the links work from day one.

🔴 **The failure mode to know about:** every button is `c.portalUrl || SITE`, so a client
with no portal token silently gets the plain marketing homepage. That **looks like it
worked** — no error, no broken link, just a customer landing on a sales page instead of their
account. Nobody reports it. `verify-client-emails` now fails on any button that resolves
without a token.

**68 checks in `tests/verify-client-emails.mjs`, two deliberate breaks confirmed to fail**
(re-adding the two fees, and stranding a button on the plain site). Templates are RENDERED
and read, never pattern-matched. The suite also asserts no template anywhere says *"management
fee"*, which is the phrase the first client rejected in writing.

## 🔴 2026-08-26 (backend audit) — the past-due email told everyone $0 had failed

Found auditing the backend rather than the UI. The **Past-Due** email printed `c.monthly`,
but `buildClientCtx` (the SERVER-side context builder that auto-sends use) defaults `monthly`
to **0** unless a client carries an explicit override, and the Stripe webhook that fires this
email passed **only a pay link, never an amount**.

So every client whose payment bounced was told *"your most recent payment of $0 didn't go
through"* — on the one email whose entire job is getting paid. Confusing enough to be ignored.

**Fixed both ends.** The webhook now passes the real failed figure, preferring
`amount_remaining` (what is still outstanding after any partial payment, which is what the
client must actually clear) over `amount_due`. The template states it when it has it and
**says nothing about a figure when it does not** — an unstated amount is recoverable, a wrong
one is not.

### 🔴 THE TESTING LESSON, AND IT IS THE SAME ONE AS THE useMemo CRASH
The existing suite rendered every template with a **hand-built context**, assembled from what
the templates need rather than from what the server really passes. It passed cleanly on a
broken email. The new section renders through **`buildClientCtx`, the real builder**, for the
two client shapes that actually exist (standard, and founding with the minimum waived), and
asserts no auto-sent email ever shows a bare `$0`. **A harness more permissive than
production is not a test.**

**115 checks (was 68), two deliberate breaks confirmed** (restoring `c.monthly` in the
template, and the webhook dropping the amount).

## Backend audit, same session — what was checked and found clean
- **All 83 backend modules import without error.** A module that throws on import is a
  function that 500s on its first real request and nothing else would notice.
- **All 14 scheduled jobs point at files that exist.** `monthly-report` runs on a DAILY cron
  by design: it checks each day whether any client has passed 30 days since their last send
  (`dueForMonthly`), so the cadence is per client, not per cron.
- **All 7 background functions carry the `-background` suffix** Netlify requires.
- **`calcMonthlyBill` is the canonical greater-of** (`billed: Math.max(floor, earned)`) and
  is correct. No backend file anywhere sums a monthly with a lead total.
- **The receipt email takes its figure from Stripe's real `amount_paid`**, so it was never
  affected by the `monthly` default that broke past-due.


## 🔴 2026-08-30 — a hand-sent email now records itself (first-client bug)

Sending from this tab used to write a comm-log line and **nothing onto `emailAuto`**, the
flag set the automatic senders use to avoid firing twice. Bryson sent the Welcome + Portal
email by hand the morning his first client signed, which meant:

- **The client would have got it twice.** `stripe-webhook` sends `welcome` on
  `checkout.session.completed` unless `emailAuto.welcome` is set.
- **The onboarding sequence would never have started.** `client-nurture` gates the
  ad-account request and the day 2 / day 5 intake nudges on `emailAuto.welcome`, and counts
  the delay from `welcomeAt`.

`emailAutoPatch(type, client)` in `client-emails-shared.mjs` now returns what a manual send
should record, mirrored in `index.html` and compared by a test. Covered: `welcome`
(+`welcomeAt`), `onboarding_access`, `renewal` (keyed to `contractEnd`, like billing-watch).

**Deliberately NOT covered, and asserted as such:** `receipt`, `past_due` and
`onboarding_nudge` dedupe on a specific Stripe invoice id or nudge step. A manual send does
not know those, and inventing a value would suppress a genuine later send for a different
invoice.

**Where the checklist is, since this came up in the same breath:** open the client, the
**Overview** tab, top card, titled *"Getting <name> Live"*. It names ONE next thing and
splits what he can do from who he is waiting on. It hides itself once the launch is done.


## 2026-08-30 — which emails are automatic, and recording one sent elsewhere

**Eight of the ten send themselves. Only `invoice` and `thank_you` are Bryson's.**

| Email | Fires |
|---|---|
| `welcome` | when they pay (stripe-webhook, `checkout.session.completed`) |
| `contract_signed` | the moment they sign (docusign-watch) |
| `onboarding_access` | a day after the welcome (client-nurture) |
| `onboarding_nudge` | day 2 and day 5, until intake is done (client-nurture) |
| `receipt` | when a payment goes through (stripe-webhook) |
| `past_due` | when a payment fails (stripe-webhook) |
| `renewal` | 30 days before the term ends (billing-watch) |
| `lead_milestone` | 10 / 25 / 50 / 100 leads (client-nurture) |
| **`invoice`** | **he sends it** |
| **`thank_you`** | **he sends it** (getAlerts reminds him when a contract ends) |

`EMAIL_TYPES[].auto` carries the trigger text, and **a test verifies it against the real
senders** by scanning them for `autoSendClientEmail(cl, "…")` / `email: "…"`. A wrong label
is worse than none in both directions: *Automatic* on something nothing sends means the
client silently never gets it; *You send this* on something automatic is how a duplicate
ships. An email that becomes automatic later is caught rather than mislabelled.

**"Already sent" button.** Records the `emailAuto` flag without emailing anything, for a
message sent from his own inbox or by hand before the recording fix. Only appears where it
would change something. Used once for the first client's welcome, because sending it twice
to correct the record was the wrong trade.
