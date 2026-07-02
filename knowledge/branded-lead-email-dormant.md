---
name: branded-lead-email-dormant
topic: Email
task: enable or understand why the branded HTML lead-notification email is disabled
keywords: [submission-created.mjs, resend-domain-verification, wix-subdomain-MX, onboarding@resend.dev, spam]
status: dead-end
summary: DORMANT/DEAD-END — the branded lead email can't ship: verifying boldlinemedia.com in Resend needs a subdomain MX record Wix won't create, and the onboarding@resend.dev fallback sender lands in spam. So the branded email is dormant; the plain Netlify form notification is used instead. Reactivate only if the domain leaves Wix.
verified: 2026-07-02
---

Goal was a branded HTML lead-notification email (dark + gold, wordmark, fields as a table, a "Reply to <name>" button, AZ timestamp) via Resend in `marketing-site/netlify/functions/submission-created.mjs`, instead of Netlify's plain default.

**Blocker 1 (Wix):** verifying `boldlinemedia.com` in Resend requires a **subdomain MX record**, and **Wix does not support subdomain MX records** (the domain is Wix-registered). So a verified custom sender domain is impossible while the domain stays on Wix.

**Blocker 2 (spam):** the fallback shared sender `onboarding@resend.dev` delivers, but the branded email lands in **spam** from that shared address — not usable as the real inbox ping.

**Final state (dormant):** `submission-created` only sends the branded email when a verified `REPORTS_FROM_EMAIL` is set — **none is** — so no branded/spam sends happen. Bryson **re-enabled the plain Netlify "Form submission notification"** to theboldlinemedia@gmail.com as the reliable inbox ping; the OS Leads tab is the polished view.

**Reactivate only if** the domain moves off Wix (then verify it in Resend and set `REPORTS_FROM_EMAIL`). The lead still reaches the OS regardless — `submission-created` also inserts into `website_leads` independently (see `website-leads-os-tab`).
