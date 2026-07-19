---
name: supabase-access-model
topic: Supabase
task: understand which Supabase key and role the OS vs the marketing site uses, and how to enable realtime
keywords: [SUPABASE_SERVICE_ROLE_KEY, publishable-key, SUPABASE_URL, RLS, supabase_realtime, replication]
status: verified
summary: OS reads/writes as the authenticated role via the publishable key under RLS; the marketing site inserts via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). SUPABASE_URL is a non-secret constant baked into code (no env var). Enable live updates via Database → Replication → supabase_realtime.
verified: 2026-07-02
---

- **OS app:** logs the owner in and reads/updates via the **publishable (anon) key** as the `authenticated` role, governed by **RLS** policies. (The publishable key and project URL already appear in the app code — refer to them by name only, never paste the values.)
- **Marketing site:** server-side inserts (website leads, blog reads/writes) use `SUPABASE_SERVICE_ROLE_KEY`, which **bypasses RLS**. This key must be added on the *marketing* Netlify site's own env-var list, separate from the OS site (Supabase dashboard → Project Settings → API → `service_role` secret; mark "Contains secret values"; scope Production/Previews/Branch-deploys/Runners).
- **`SUPABASE_URL` is a non-secret constant baked directly into the code** (same convention as the existing report-generation features), so it does **not** need an env var. Only the service-role key is owed to the marketing site (an earlier note said two vars — that was a correction; it is one).
- **Enable Realtime** (for instant OS updates): Supabase dashboard → **Database → Publications** → open the `supabase_realtime` publication → toggle the table on. (As of 2026-07-19 `clients`, `website_leads`, and `blog_posts` are all on.) ⚠️ The menu item literally named **"Replication"** is now a *different* feature (read replicas / analytics pipeline destinations) — NOT realtime; use **Publications**. Without realtime, the OS still updates within ~15-30s via polling fallback (and instantly on tab-focus). See KB `live-auto-updates`.
