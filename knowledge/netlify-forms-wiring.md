---
name: netlify-forms-wiring
topic: Forms/Leads
task: wire up or debug marketing-site form capture and email notifications
keywords: [data-netlify, form-name, bot-field, honeypot, submission-created, recommendation-form]
status: verified
summary: Two static forms (contact + recommendation) are Netlify-Forms-wired (data-netlify=true, name, hidden form-name input, bot-field honeypot, AJAX-POST urlencoded to /). Netlify detects them at build; they appear under the marketing site's Forms tab. Enable notifications in the dashboard; a submission-created function also fires per verified submission.
verified: 2026-07-02
---

Two forms in `marketing-site/index.html`: **`contact`** (contact section) and **`recommendation`** (the quiz's optional email capture at the result step). Each has `data-netlify="true"`, a `name`, a hidden `<input name="form-name">`, and a `bot-field` honeypot. Both AJAX-POST to `/` with the urlencoded `form-name` (Netlify's documented JS pattern), with inline success + a no-JS fallback.

Because `index.html` is static, **Netlify detects the forms at build** and they appear under the **marketing site's** Forms tab after deploy (not the OS site's). Wiring verified 2026-06-30.

**Email notifications** (Bryson, one-time toggle, no code change): marketing site dashboard → **Forms** → select `contact` (and `recommendation`) → **Settings & notifications** → **Add notification** → **Email notification** → send to theboldlinemedia@gmail.com. Submissions are also always listed under **Forms**.

**The `submission-created` magic function:** Netlify automatically runs a function named **exactly** `submission-created` on every *verified* form submission. Ours (`marketing-site/netlify/functions/submission-created.mjs`) does two **best-effort** things per submission: insert the lead into `website_leads` (via `SUPABASE_SERVICE_ROLE_KEY`) AND send the branded email (Resend). Either can fail without blocking the other; it fails soft (logs + returns 200). See `website-leads-os-tab` and `branded-lead-email-dormant`.

Note: with the branded email dormant, keep the plain Netlify form notification on (one reliable ping). If the branded email is ever enabled, delete the plain one so there's one email per lead, not two.
