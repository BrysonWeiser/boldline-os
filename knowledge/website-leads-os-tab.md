---
name: website-leads-os-tab
topic: Forms/Leads
task: understand or debug how website leads flow into the OS Leads section
keywords: [website_leads, website_leads_auth_delete, LeadsScreen, leads-live, deleteLead, submission-created]
status: verified
summary: Marketing-site form submissions insert into the website_leads table (via service-role) and surface in the OS "Leads" tab: filter chips, status, notes, realtime + 20s poll + toast, delete. Table is live (2026-06-30). Degrades gracefully if the table is missing.
verified: 2026-07-02
---

**Table `website_leads`** (`docs/sql/website-leads-schema.sql`, LIVE since 2026-06-30): BoldLine's own inbound leads from the marketing site (separate from per-client customer leads). Columns: `form, name, business, email, message, recommended, status (new/contacted/won/lost/archived), notes, payload, created_at`. RLS **on**: policies for the `authenticated` role (the OS reads/updates via the publishable key) including `website_leads_auth_delete`; the marketing site **inserts via the service-role key** (bypasses RLS). Added to the `supabase_realtime` publication.

**Pipe-in:** `submission-created.mjs` inserts each submission into `website_leads` (best-effort, alongside the branded owner email). The table is live and the marketing site already has `SUPABASE_SERVICE_ROLE_KEY`, so leads flow end to end.

**Instant lead auto-reply (Bryson, 2026-08-10, speed-to-lead):** `submission-created.mjs` now ALSO emails the LEAD an instant branded-dark acknowledgment (`emailLead` → "Thanks for reaching out, <first name>" + a gold "Book a quick call" button to Calendly) on every contact/quiz submission, so ready-to-talk prospects can book immediately instead of waiting. Runs as the 3rd best-effort task in the handler's `Promise.allSettled` (DB save / owner email / lead auto-reply); fail-soft, no emojis (client-facing). **DEPENDENCY / GOTCHA:** it (and the branded owner email + the review/lead-leak owner pings) only send when **`REPORTS_FROM_EMAIL` is set on the MARKETING site's Netlify env** (to the verified `BoldLine Media <hello@boldlinemedia.com>`). That was historically unset on marketing (domain wasn't verifiable on Wix) — if leads/owner aren't getting branded emails, set it (same value as the OS site). `RESEND_API_KEY` on marketing is already the full-access key (from newsletter go-live).

**OS "Leads" section** (root `index.html`): a bottom-nav tab (envelope icon, green badge = count of `new`), a `LeadsScreen` with filter chips (All/New/Contacted/Won/Lost), and `LeadCard`s showing name/business, a Contact-vs-Quiz badge, email (mailto), the message or recommended package, a status dropdown, a Reply button, a notes field (saves on blur), and relative time.

**Live:** a `leads-live` realtime channel + a 20s poll + focus refetch, plus a bottom-left "New lead" toast that deep-links to the Leads tab. Degrades gracefully if the table doesn't exist yet (empty state, no crash).

**Delete:** each card has a "Delete lead" control (inline Cancel/Delete confirm) for spam/test leads; `deleteLead` does an optimistic local remove + a `website_leads` delete via the `website_leads_auth_delete` RLS policy.
