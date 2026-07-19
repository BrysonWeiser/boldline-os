---
name: pre-client-readiness
topic: Pending
task: know what remains before BoldLine can sign and onboard its first real client
keywords: [first-client, readiness, launch-checklist, stripe-not-started, docusign-go-live, basic-access-resubmit, business-verification, approve-execute]
status: verified
summary: Snapshot 2026-07-07 of everything gating the first client. Hard blockers — Stripe billing (not started at all) and DocuSign production go-live (demo sigs not binding). Automation blockers — Google Ads Basic Access resubmit (+ post-approval approve→execute wire-up) and Meta Business Verification. Supporting — Search Console, custom-domain email, GBP/GA4.
verified: 2026-07-07
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
2. **DocuSign production go-live** — everything works but in DEMO; demo signatures are
   watermarked and NOT legally binding. Needs ~20 successful demo API calls (every Deploy-tab
   test send counts), production account + Go-Live promotion, then regenerate ALL creds
   (see `docusign-integration`).

**Automation blockers (per Bryson's own bar: full automation before client #1):**
3. **Google Ads Basic Access** — ✅ **APPROVED 2026-07-19** (15,000 ops/day; the
   long-standing blocker is cleared — see `google-ads-api`). Pending: run the Deploy-tab
   test card to confirm the creds authenticate end-to-end.
4. **Post-approval code task (NOW UNBLOCKED):** wire ARIA's approved `pendingActions` to real
   `setBudget`/`setStatus` execution (needs live campaign reads; pieces ready in google-ads.mjs).
   Can only be E2E-verified once a real client ad account is linked to the MCC.
5. **Meta Business Verification + App Review** — weeks-long; was at steps 1–3 on 2026-06-25
   (stale — re-check). Only blocks Meta-ads clients; Google-only clients unaffected.

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

**Agreed order:** Search Console → Google Ads resubmit (same day) → Meta verification
(start the clock) → Stripe build → DocuSign go-live (accumulate test sends meanwhile) →
custom email → post-approval approve→execute wire-up.
