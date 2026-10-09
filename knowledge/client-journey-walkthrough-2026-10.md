---
name: client-journey-walkthrough-2026-10
topic: Sales funnel
task: check or change the path a new client takes (ad, website, booking, free check, contact form, emails, agreement, welcome), where replies to our emails go, or who customer emails appear to come from
keywords: [client journey, funnel, walkthrough, reply to, reply_to, BOLDLINE_REPLY_TO, fromName, free check silent failure, audit.mjs, contact form auto reply, speed to lead, public email address]
status: fixes LIVE 2026-10-07 (merge f0ac1e7); instant reply + instant phone ping + free-check rewiring LIVE the same evening
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

## Instant reply + instant ping (Bryson: "add both of those things", built + live 2026-10-07)
- `netlify/lib/lead-arrival.mjs` + `netlify/functions/lead-arrived-background.mjs` (public, background, acts only on the id of a
  website_leads row created in the last 15 min, reads everything else from the row; no shared password).
- Website side: `submission-created` saves the row (`.select("id")`), then POSTs `{leadId}` to the OS endpoint; its own old
  auto-reply (`emailLead`, which had an em dash and only ran if the MARKETING site had a verified sender) was removed so there
  is exactly ONE reply. `audit.mjs` does the same instead of the old AUDIT_TRIGGER_SECRET call (that env var is no longer needed).
- OS endpoint: runs `syncHouseLeads` (the same mirror, so the phone push fires in seconds and can't double), sends the instant
  reply for forms `contact` and `recommendation` (pricing quiz "email me a plan", names the package), and starts the free check.
- Reply: `renderEnquiryAck` in client-emails-shared, from "Bryson at BoldLine Media", reply_to bryson@, Calendly 30min button, no
  "today" promise, no dashes. Claimed on the row first (`payload.ackClaimAt`, conditional update with a plain-filter fallback),
  `ackSentAt` on success, `ackTries` max 3, only within 2 hours, never if status moved off new.
- Safety nets: `house-leads` (15 min) runs `sendPendingAcks`; `lead-leak-sweep` (10 min) now STARTS the background audit via
  `startAudit` (key `x-lead-job-key`, sha256(service role + ":lead-jobs")) instead of running it inline, which could never finish
  inside a 30-second scheduled function; a stuck free check alerts once (`stuckAlertedAt`). `calendly-leads` runs the mirror
  when it saves a new booking, so a booked call buzzes on that run (was up to two runs, ~30 min).
- Tests: `verify-lead-arrival` (48, incl. a fake-DB claim race and the fallback), plus updated lead-leak-delivery and
  conversion-loop. Suite 145/145.

## Still open (recommended to Bryson)
- Check the marketing site has a verified sender set, otherwise the instant free-check alert email to Bryson is off.
- ~~Stripe branding~~ DONE 2026-10-08 (his job, in Stripe: Settings, Business, Branding). Icon `boldlinemedia.com/icon.png`,
  logo `boldlinemedia.com/logo.png`, support email + website under Public details.
  🔴 **Colour gotcha (2026-10-08, his screenshot):** Stripe paints the checkout header in the **Brand color**,
  so brand `#C8A84B` (gold) put the gold B logo on a gold block where it vanished, and looked mustard.
  Corrected: **Brand color `#07080C`** (our near-black, the site's own background, so the gold logo pops)
  and **Accent color `#C8A84B`** (gold, used for the Pay button). ✅ **Done: Bryson saved it 2026-10-08.**
