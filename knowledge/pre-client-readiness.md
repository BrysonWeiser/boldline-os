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

**Hard blockers (cannot sign/bill a client without):**
1. **Stripe — NOT STARTED (Task #10).** No way to collect the management fee. Bills the
   service fee ONLY, never ad spend (see `business-constraint-ad-spend`).
2. **DocuSign production go-live** — everything works but in DEMO; demo signatures are
   watermarked and NOT legally binding. Needs ~20 successful demo API calls (every Deploy-tab
   test send counts), production account + Go-Live promotion, then regenerate ALL creds
   (see `docusign-integration`).

**Automation blockers (per Bryson's own bar: full automation before client #1):**
3. **Google Ads Basic Access resubmit** — token still Explorer (API works on test accounts
   only). Resubmit referencing live boldlinemedia.com + a business-model/MCC note; do NOT
   reuse the rejected responses (see `google-ads-api`). NOTE: this gates the API/bots only —
   manual campaign management through the MCC web UI is NOT blocked, so a client could be
   serviced by hand if a deal lands early.
4. **Post-approval code task:** wire ARIA's approved `pendingActions` to real
   `setBudget`/`setStatus` execution (needs live campaign reads; pieces ready in google-ads.mjs).
5. **Meta Business Verification + App Review** — weeks-long; was at steps 1–3 on 2026-06-25
   (stale — re-check). Only blocks Meta-ads clients; Google-only clients unaffected.

**Supporting (not gating, but pre-client smart):**
6. Google Search Console (~10 min; also evidence for the Ads resubmission — do it FIRST, same day).
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
