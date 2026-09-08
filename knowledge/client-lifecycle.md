---
name: client-lifecycle
topic: Ops / procedures
task: the standard procedure for onboarding, renewing, and offboarding a client (and which emails fire at each step)
keywords: [onboarding, offboarding, renewal, client procedure, lifecycle, welcome, ad account access, contract, invoice, thank you, approval, portal approval]
status: verified
summary: The end-to-end BoldLine client procedure agreed with Bryson 2026-07-30, with the branded lifecycle emails mapped to each step. Onboarding = create → contract → (Welcome+Access emails) → billing (Invoice→Receipt) → portal intake → build → owner approves campaign → live → reports. Renewal = 30-day alert → Renewal email → Renew on Contract tab. Offboarding = contract ends → Thank-You email → remove manager access (client keeps account) → archive. Emails: as of 2026-08-02 Welcome, Receipt, Past-Due, Renewal AUTO-send on their triggers (Stripe webhook + billing-watch); Invoice, Ad-Account Access, Thank-You stay one-tap w/ getAlerts reminders — see client-email-center.
verified: 2026-07-30
---

## 🚀 Onboarding (signed → live)
1. Close on a call → **create the client** in the OS (name, contact, email, package, monthly/setup fee).
2. Send the **contract** (Contract tab → DocuSign). Client signs → `contractSigned`/`contractStatus:"active"`.
   - → **Welcome + Portal** email, then **Ad-Account Access** email (getAlerts nudges both; one-tap send).
3. Client grants **manager access** to their ad account (they own it + pay spend directly — hard constraint).
4. Set up **billing** (Billing tab → Stripe checkout) → **Invoice** email (nudged when `billingStatus:"awaiting_payment"`). Client pays → **Receipt** (auto once wired).
5. Client fills the **portal** (business info, brand voice, media). Bots build the campaign + landing page.
6. **Owner approves** the campaign in the OS approval queue → it goes live (campaign-launch-approval).
   - ⚠️ NEW REQUEST (Bryson 2026-07-30, NOT BUILT): the CLIENT should also review/approve deliverables (esp. the **landing page**) from their **Client View / portal**, and be **auto-notified** when something needs their approval. See "Pending: client-side approval" below.
7. Reports go out on the package cadence (weekly/monthly; owner gets a weekly internal briefing).

## 🔄 Renewal
1. ~30 days before `contractEnd` → getAlerts raises `contract_30` + an **email_renewal** reminder → send the **Renewal** email.
2. Client agrees → **Renew** on the Contract tab (extends the term; clears the alerts).

## 👋 Offboarding (not renewed)
1. Contract ends / `contractStatus:"expired"` → **email_thankyou** reminder → send **Thank-You / Offboarding** (final report + "your ad account stays yours" handoff).
2. Remove BoldLine **manager access** (client keeps the account + everything built), pause/hand off campaigns, settle any final invoice/ETF (Contract tab), then **archive** the client.

## Email automation
HYBRID (Bryson 2026-07-30; expanded 2026-08-02): AUTO-sent = Welcome+Portal (Stripe checkout.session.completed), Receipt (invoice.paid), Past-Due (invoice.payment_failed), Renewal (billing-watch ~30d before end). ONE-TAP w/ OS alert = Invoice (needs lead review), Ad-Account Access, Thank-You. Full detail in **client-email-center**.

## ⏳ PENDING — client-side approval in the portal (Bryson 2026-07-30, NOT BUILT YET)
Bryson: "When there's something the client needs to approve (e.g. the landing page), there must be a spot in their Client View to review + approve it, and they must be auto-notified about anything needing approval."
- **Where:** the served client portal (`netlify/functions/portal*` — note the OS mirrors a preview of the portal in index.html; portal is the SERVED copy, dual-copy gotcha). Add an "Approvals" / "Needs your review" section.
- **What flows through it:** landing page first (preview + Approve / Request changes); later, anything else needing client sign-off.
- **Data:** likely a `client.approvals[]` array (item = {id, kind:"landing_page", title, previewUrl/html, status:"pending|approved|changes", note, ts}); owner pushes an item from the OS; client Approve/Request-changes writes back via the portal token endpoint (same pattern as portal save/upgrade/media).
- **Notify:** email the client automatically when an approval is queued (reuse report-shared.sendEmail + a branded dark template like client-emails-shared); surface their decision back to the owner (OS alert/notification + commLog).
- Mirrors the existing OWNER-side approval queue (pendingActions) but client-facing.

## 🔴 2026-09-07 — FOUR GAPS BETWEEN "SIGNED" AND "RUNNING", FOUND IN A SWEEP

Bryson asked for a full audit of the site, the bots, the OS and the reports. Every finding
below sat in the same blind spot: **what the OS does for a client who has signed but whose ads
have not started.** Nothing was erroring. Each would have surfaced only as a client
relationship quietly going wrong.

### 1. A performance report was going to go out for a campaign that never existed

`dueForMonthly` counts 30 days from `contractStart`. `isReportable` checked active, non-demo,
has-an-email, and **never asked whether there was anything to report.** Stencil & Thread signed
30 August, so on **29 September** BoldLine's first client was going to receive an automatically
written monthly performance report about ads that had never run, with a copy to Bryson, two days
before the honest conversation he had already scheduled with himself for the 30th.

> 🔴 **A report with nothing in it is worse than no report.** It burns the one thing a founding
> client is actually buying, which is the belief that somebody is watching their money.

New `hasAdActivity(client)`: `adPerf.syncedAt` exists AND impressions, 30-day spend or live
campaigns is above zero. **Ad activity only, deliberately.** Leads are not the test, because a
client with no campaign can still have rows in `leadsLog` — Stencil & Thread's were two FAKE
test leads used to debug the text-back — and counting those would let the guard pass and produce
a report describing leads that were never real.

**The owner briefing is NOT gated on it.** The week a client's ads have not started is the week
Bryson most needs telling. Only the client-facing send is withheld, and the monthly run's skip
reason says which of the two skips happened.

### 2 + 3. The entire onboarding sequence was gated on payment, so a founding client got nothing

Welcome, ad-account access, and the day 2 and day 5 nudges all waited on `emailAuto.welcome`,
which **only `stripe-webhook` ever set, and only on `checkout.session.completed`.**

That is not an edge case, it is the founding offer. **Founding terms are results-only with no
monthly minimum, so a client can be fully signed and correctly owe nothing for weeks.** Stencil
& Thread signed 30 August and by 7 September had received nothing automatic at all — no welcome,
no portal link, and crucially no ad-account-access email, *while the single thing blocking their
launch was ad-account access.* The automation built to chase exactly that had never been allowed
to start.

**Bryson's call:** *"Signing that way nothing is blocked and doesn't send even if payment isn't
processed."* `client-nurture` now sends the welcome when `contractSigned` or an active contract
is seen. Both paths set and check the same flag, so whichever fires first wins and the other
becomes a no-op; a client who pays at signing is unaffected. The OS email catalog said
`auto: "when they pay"`, which was then a *wrong label*, and a wrong label is worse than none
because he would stop watching for it. Now "when they sign".

### 4. Nothing had ever asked anyone for a review

The review system was complete: the form on the marketing site, the approve-before-display step,
the rendering, even the live Google review link. **No code anywhere asked a client to leave one.**
A review wall nobody is invited to fill in stays empty forever, and no social proof is the
biggest weakness in the sales conversation while BoldLine has one client.

New `review_request` email, sent **once per client, ever**, and conservatively: active contract,
real ad activity, at least 10 delivered leads, at least 45 days in, and never in the same run as
a milestone celebration. It offers the site and Google routes, and ends by inviting a complaint
instead — *"if anything is not going the way you hoped, reply to this instead"* — which is the
honest version of asking and stops a bad review before it is public.

### The alert that would have caught all of it on day seven

Eight days of BoldLine's first and only client going nowhere and **nothing in the OS said so.**
The closest existing alert, `noLeads`, could not fire, because the two fake test leads meant
`leads === 0` was false. New `neverLaunched`: active, 7+ days since contract start, no ad
activity ever. Once, on the transition, like every other alert here.

`noLeads` now also requires `hasAdActivity`, because firing it at a campaign that never existed
tells Bryson to *"check targeting/tracking"* — **the wrong diagnosis pointed at the wrong
system.** Never launched and launched-but-failing are different problems with different fixes.

**Verification:** new `tests/verify-client-lifecycle-gaps.mjs`, 27 checks, **7 of 7 mutations
caught.** Full suite 65 suites, 0 failures. One existing guard in `verify-client-emails` caught
the new review template legitimately (every button must not silently fall back to the bare
marketing site); it was widened by exactly one anchor, `#reviews`, and both original failure
modes were re-tested and still bite.
