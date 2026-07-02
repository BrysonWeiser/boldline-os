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

**Pipe-in:** `submission-created.mjs` inserts each submission into `website_leads` (best-effort, alongside the branded email). The table is live and the marketing site already has `SUPABASE_SERVICE_ROLE_KEY`, so leads flow end to end.

**OS "Leads" section** (root `index.html`): a bottom-nav tab (envelope icon, green badge = count of `new`), a `LeadsScreen` with filter chips (All/New/Contacted/Won/Lost), and `LeadCard`s showing name/business, a Contact-vs-Quiz badge, email (mailto), the message or recommended package, a status dropdown, a Reply button, a notes field (saves on blur), and relative time.

**Live:** a `leads-live` realtime channel + a 20s poll + focus refetch, plus a bottom-left "New lead" toast that deep-links to the Leads tab. Degrades gracefully if the table doesn't exist yet (empty state, no crash).

**Delete:** each card has a "Delete lead" control (inline Cancel/Delete confirm) for spam/test leads; `deleteLead` does an optimistic local remove + a `website_leads` delete via the `website_leads_auth_delete` RLS policy.
