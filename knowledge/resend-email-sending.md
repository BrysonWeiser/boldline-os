---
name: resend-email-sending
topic: Email
task: send transactional or notification email from a serverless function via Resend
keywords: [RESEND_API_KEY, REPORTS_FROM_EMAIL, onboarding@resend.dev, resend, fail-soft]
status: verified
summary: Email is sent via Resend using RESEND_API_KEY (+ optional REPORTS_FROM_EMAIL sender). Used by OS report/blog emails and the marketing submission-created function. The marketing site needs only RESEND_API_KEY; if REPORTS_FROM_EMAIL is unset it falls back to onboarding@resend.dev. Functions fail soft.
verified: 2026-07-02
---

- **Provider: Resend.** Env vars: `RESEND_API_KEY` (required) and `REPORTS_FROM_EMAIL` (sender; optional on the marketing site).
- Used by the OS (report generation, and `blog-autopublish` "new post is live" to `OWNER_EMAIL`) and by the marketing site's `submission-created.mjs` (branded lead email — but see `branded-lead-email-dormant` for why that one is currently off).
- **Marketing site simplification (2026-06-30):** only `RESEND_API_KEY` is needed there. If `REPORTS_FROM_EMAIL` is unset, the function falls back to sender `BoldLine Media <onboarding@resend.dev>`, which Resend delivers to the account owner's own inbox.
- Netlify hides secret env values once saved → create a **fresh** Resend key for the marketing site rather than copying the OS's.
- Functions **fail soft** (log + return 200) if email env vars are missing, so a mail failure never blocks the rest of the request.
- Bryson's setup: resend.com → API Keys → create key → add as `RESEND_API_KEY` on the *marketing* Netlify site → redeploy.
