---
name: client-lifecycle
topic: Ops / procedures
task: the standard procedure for onboarding, renewing, and offboarding a client (and which emails fire at each step)
keywords: [onboarding, offboarding, renewal, client procedure, lifecycle, welcome, ad account access, contract, invoice, thank you, approval, portal approval]
status: verified
summary: The end-to-end BoldLine client procedure agreed with Bryson 2026-07-30, with the branded lifecycle emails mapped to each step. Onboarding = create → contract → (Welcome+Access emails) → billing (Invoice→Receipt) → portal intake → build → owner approves campaign → live → reports. Renewal = 30-day alert → Renewal email → Renew on Contract tab. Offboarding = contract ends → Thank-You email → remove manager access (client keeps account) → archive. Emails are HYBRID-automated (receipts/past-due auto; rest one-tap w/ getAlerts reminders — see client-email-center).
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
HYBRID (Bryson 2026-07-30): transactional (Receipt, Past-Due) auto; relationship emails one-tap with milestone reminders. Full detail + what's built vs pending in **client-email-center**.

## ⏳ PENDING — client-side approval in the portal (Bryson 2026-07-30, NOT BUILT YET)
Bryson: "When there's something the client needs to approve (e.g. the landing page), there must be a spot in their Client View to review + approve it, and they must be auto-notified about anything needing approval."
- **Where:** the served client portal (`netlify/functions/portal*` — note the OS mirrors a preview of the portal in index.html; portal is the SERVED copy, dual-copy gotcha). Add an "Approvals" / "Needs your review" section.
- **What flows through it:** landing page first (preview + Approve / Request changes); later, anything else needing client sign-off.
- **Data:** likely a `client.approvals[]` array (item = {id, kind:"landing_page", title, previewUrl/html, status:"pending|approved|changes", note, ts}); owner pushes an item from the OS; client Approve/Request-changes writes back via the portal token endpoint (same pattern as portal save/upgrade/media).
- **Notify:** email the client automatically when an approval is queued (reuse report-shared.sendEmail + a branded dark template like client-emails-shared); surface their decision back to the owner (OS alert/notification + commLog).
- Mirrors the existing OWNER-side approval queue (pendingActions) but client-facing.
