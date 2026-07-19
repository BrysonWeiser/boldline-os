---
name: pre-client-readiness
topic: Pending
task: know what remains before BoldLine can sign and onboard its first real client
keywords: [first-client, readiness, launch-checklist, stripe-not-started, docusign-go-live, basic-access-resubmit, business-verification, approve-execute]
status: verified
summary: As of 2026-07-19 almost nothing blocks SELLING/onboarding a Google-ads client — Stripe live, Google Ads live + approve→execute built, Search Console done. Remaining are timed-to-the-deal (DocuSign production cutover — parked by choice, same-day flip), a should-do (AZ attorney review of the contract draft), and in-flight (Meta verification submitted 2026-07-19 ~2-day review, then App Review weeks — only gates Meta-ads clients). Optional credibility: custom-domain email, Twilio paid upgrade.
verified: 2026-07-19
---

Snapshot of first-client readiness as of **2026-07-07**. The OS itself (site, blog, leads,
portal, landing pages, media, reports, alerts) is built and live — the gaps are external
approvals, billing, and legal signing. Update or retire items here as they complete.

**FACT (2026-07-08): BoldLine Media IS a registered LLC.** Use its exact legal name + EIN
consistently across Stripe, the business bank account, and Meta Business Verification.
**Mercury APPROVED 2026-07-09** (login = brysonaweiser@gmail.com, org = the LLC). Post-approval
checklist: 2FA on, grab routing + account numbers (account → Account details), order the
physical debit card. Next: the full Stripe activation in ONE sitting (Bryson's call) —
register with theboldlinemedia@gmail.com, LLC path, exact legal name + EIN, Mercury numbers
in the payout step. The moment Stripe exists, the OS billing-flow build starts (service fee
ONLY, never ad spend).

**Stripe ACTIVATED (live) 2026-07-09** — login theboldlinemedia@gmail.com; LLC / single-member,
category "Other marketing services", statement descriptor BOLDLINE MEDIA, payouts →
Mercury Checking ••7212 automatic weekly (Mondays); Stripe Tax + Climate declined (revisit Tax
with a CPA later). `pk_live_...` keys present. Skipped Connect/Radar setup-guide items (Connect
is for marketplaces — not our model). **NEXT: build the OS billing flow (service fee ONLY).**
The LIVE SECRET KEY goes straight into a Netlify env var (e.g. STRIPE_SECRET_KEY), never pasted
in chat or committed — Netlify's scanner also fails the build if a key value lands in a file.

**Hard blockers (cannot sign/bill a client without):**
1. ~~**Stripe**~~ — **FULLY DONE + LIVE 2026-07-14.** Account activated 2026-07-09; OS billing flow
   built + test-passed 2026-07-10; flipped to live keys + live webhook 2026-07-14 (see
   `stripe-billing`). Recurring management-fee subscription, card+ACH, Contract-tab BillingCard.
   Bills the service fee ONLY, never ad spend. Ready to bill a real client.
2. **DocuSign production go-live** — ⏸ **PARKED BY CHOICE 2026-07-19 until a client is close**
   (same-day flip). Demo sending works today (real envelopes, just watermarked/non-binding).
   Go-live stalled (the 2026-07-15 verification-form envelope voided; no IK in prod yet) — when a
   deal's imminent, do the whole cutover in one sitting: re-run go-live + complete the form,
   activate the paid eSignature+API plan (~$25-45/mo), swap the 5 env vars, one test send. See
   `docusign-integration`.
2b. **AZ attorney review of the service agreement** — the full contract is built + data-driven
   but is a DRAFT; get ~1 hour of an Arizona attorney's review before a real client signs
   (see `service-agreement`). Schedule now so it's never the thing holding up a signature.

**Automation blockers (per Bryson's own bar: full automation before client #1):**
3. **Google Ads Basic Access** — ✅ **APPROVED + VERIFIED LIVE 2026-07-19** (15,000
   ops/day; Deploy-tab test card green: authenticated API v24, MCC confirmed — see
   `google-ads-api`). This blocker is fully cleared.
4. **Approve→execute** — ✅ **BUILT 2026-07-19** (see `google-ads-api`): ARIA reads live
   campaigns, proposes ⚡-executable actions, and Bryson's Approve fires the real
   `setBudget`/`setStatus`. ⚠ E2E verification still pending the first real client ad
   account linked to the MCC (no live campaigns exist yet).
5. **Meta Business Verification + App Review** — Business Verification **SUBMITTED 2026-07-19,
   in review (~2 business days)**; after it clears → Access verification (~5 days) → App Review
   for `ads_management` (weeks). Dev app "BoldLine OS" created, portfolio connected (see
   `meta-marketing-api`). Only blocks **Meta-ads** clients; Google-only clients unaffected — so
   NOT a blocker for taking a Google client today.

**Supporting (not gating, but pre-client smart):**
6. ~~Google Search Console~~ — **DONE 2026-07-07** (domain property verified via Wix DNS TXT,
   apex sitemap submitted, homepage already indexed; details in `pending-seo-next-steps`).
7. Custom-domain email bryson@boldlinemedia.com (cold-call credibility; root-domain MX on Wix
   should work — the Resend dead-end was a SUBDOMAIN record; may unlock branded lead emails).
8. Optional: GA4, Google Business Profile (see `pending-seo-next-steps`).
9. Verify the Netlify Forms email-notification toggle is ON (marketing site → Forms) — one
   ping per lead while the branded email stays dormant.
10. Nice-to-haves: DocuSign envelope status sync (signed → auto-flip contract "active");
    exercise the real Contract-tab send once during the 20-call accumulation.

11. Twilio paid upgrade (~$20/mo off trial) — unlocks SMS report/alert notifications and removes
    the per-number verification friction on call tracking. Optional; do when convenient.

**BOTTOM LINE (2026-07-19):** BoldLine can **sell and onboard a Google-ads client now** — Stripe
(bill), Google Ads (run + ARIA approve→execute), site/portal/landing/leads/blog/reports are all
live. Only two things must be true before a client SIGNS: (a) the AZ attorney review (should),
and (b) the DocuSign production cutover (same-day, timed to the deal). Meta-ads clients also wait
on Meta App Review. Everything else is optional credibility. The real bottleneck now is sales.

**Original agreed order (mostly complete):** Search Console → Google Ads → Meta verification →
Stripe → DocuSign go-live → custom email → approve→execute. Only DocuSign cutover + custom email
+ Twilio remain, all deferrable.
