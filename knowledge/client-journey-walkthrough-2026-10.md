---
name: client-journey-walkthrough-2026-10
topic: Sales funnel
task: check or change the path a new client takes (ad, website, booking, free check, contact form, emails, agreement, welcome), where replies to our emails go, or who customer emails appear to come from
keywords: [client journey, funnel, walkthrough, reply to, reply_to, BOLDLINE_REPLY_TO, fromName, free check silent failure, audit.mjs, contact form auto reply, speed to lead, public email address]
status: fixes LIVE 2026-10-07 (merge f0ac1e7); instant reply + faster ping approved, being built
summary: Bryson, 2026-10-07, picked "walk the whole path a new client takes". Live crawl of boldlinemedia.com (49 pages) found no broken links; two Calendly links (30min ads, website), four real forms. Fixed: (1) every email now carries reply_to bryson@boldlinemedia.com, the address CONFIRMED to forward (hello@, the sender, is not confirmed routed), (2) emails to a client's CUSTOMERS are sent as that business with reply_to the business, (3) the free-check form said "Got it" even when the request was saved nowhere, (4) public pages showed a gmail address, now bryson@boldlinemedia.com. Recommended, not built: an instant reply to contact-form enquiries, and a faster than 15-minute phone ping.
verified: 2026-10-07
---

## How each enquiry travels (as found)
- **Book a Call** (Calendly 30min / website): Calendly's own confirmation to the prospect. `calendly-leads` (every 15 min)
  writes a website lead with callKind; `house-leads` (every 15 min) mirrors it and PUSHES Bryson's phone.
- **Free Lead-Leak Check** (/free-check/, /get-started/ top form): marketing-site `audit.mjs` saves `website_leads`
  (form lead_leak), emails Bryson (only if that site has a verified sender set), fires the OS audit bot; `lead-leak-sweep`
  (every 10 min) is the backstop. Prospect gets the audit email.
- **Contact form / wizard** (/contact/): Netlify Forms -> `submission-created` saves the lead + Netlify's plain notification.
  🔴 The prospect gets NOTHING by email. Bryson's phone push comes from house-leads, so up to 15 minutes.
- After signing: docusign-status sends contract_signed; stripe-webhook welcome/receipt/past_due; client-nurture onboarding
  access + nudges + milestone + review request; ads-sync start_confirmed; billing-watch renewal. All flag-guarded (no doubles).

## Fixes (code)
- `sendEmail` in report-shared: `reply_to` defaults to `BOLDLINE_REPLY_TO` (bryson@, Cloudflare Email Routing -> business gmail).
  New `fromName` puts a different display name on the same verified sender address. Newsletter broadcasts get reply_to too.
- lead-intake + lead-followup: `fromName: client.name, replyTo: client.email`. (review-requests-run already did this.)
- audit.mjs: `notifyOwnerNewRequest` returns true; if `!leadId && !alerted` -> 503, and leadleak.html checks `r.ok`.
- Error messages + contact page + Organization schema email: bryson@boldlinemedia.com instead of the gmail.
- Pinned in verify-email-brand sections 6 and 7.

## Still open (recommended to Bryson)
- Instant "got it" reply to contact-form enquiries (new automated email to real people: needs his yes).
- Faster phone ping for website enquiries (currently the 15-minute mirror).
- Check the marketing site has a verified sender set, otherwise the instant free-check alert email to Bryson is off.
