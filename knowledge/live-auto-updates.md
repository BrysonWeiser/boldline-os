---
name: live-auto-updates
topic: OS Architecture
task: understand or extend how OS views auto-update live without a full-page refresh
keywords: [useLiveData, realtime, supabase_realtime, poll, visibilitychange, refreshClients, loadLeads, silentReload, blog_posts, clients-live, leads-live]
status: verified
summary: Every live surface in the OS runs through one useLiveData(load,{table,interval,active}) hook — Supabase realtime (instant, when the table is in supabase_realtime) + interval poll + tab-focus/visibility refetch, all re-running `load`. Wired for clients (15s), website_leads (20s), and blog posts (30s, function-backed). All three are now in the realtime publication (blog_posts added 2026-07-19), so all update instantly. No full-page reload needed for any of them.
verified: 2026-07-19
---

## The primitive
`useLiveData(load, { table, interval = 15000, active = true, channel })` — defined at
module scope in `index.html` (just above `ALL_FEATURES`). It re-runs `load` on **three
independent triggers** so a change anywhere shows up on its own:
1. **Supabase realtime** — `postgres_changes` on `table` (`event:"*"`). Instant, but only
   fires when `table` is in the `supabase_realtime` publication (Supabase → Database →
   Replication). **Omit `table`** for function-backed data the browser can't read directly.
2. **Interval poll** — the guaranteed fallback if realtime is off/lagging.
3. **Tab focus + visibility** — an immediate catch-up when you return to the tab.

`active` gates the whole effect (e.g. wait until auth/data is ready). Cleanup removes the
channel, clears the interval, and drops the listeners.

## What's wired (each needs NO page refresh)
- **`clients`** (core — client hub, billing, pending actions, contract, media, alerts, the
  dashboard, revenue): `useLiveData(refreshClients, { table:"clients", interval:15000, active: dataState==="ready" })`.
  `refreshClients` also re-syncs the OPEN `activeClient` by id (so a client's portal edit
  updates the card you're looking at). This carries the bulk of the OS — almost everything
  lives in the per-client `data` JSON blob.
- **`website_leads`** (Leads tab): `useLiveData(loadLeads, { table:"website_leads", interval:20000 })`.
- **Blog / Content posts** (function-backed via `blog-admin`, owner-authed): a stable
  `silentReload` (calls `blog-admin` `list`, no loading spinner) behind
  `useLiveData(silentReload, { table:"blog_posts", interval:30000 })`. So scheduled/
  autopublished posts and edits from another tab appear on their own.
  - **Guard:** `silentReload` no-ops while a foreground op is mid-flight
    (`opBusyRef` = `genState!=="idle" || busyId || bulkProgress`) so a background reload
    never yanks the list out from under a running generate/bulk/per-post action.
  - `opBusyRef` is a **ref** (not deps) so `silentReload` keeps a stable identity — otherwise
    the realtime channel would tear down/rebuild on every state change.

## Realtime publication — all three tables ON (blog_posts added 2026-07-19)
`clients`, `website_leads`, and `blog_posts` are all in the `supabase_realtime` publication,
so all three push instantly (poll + focus stay as fallbacks).

**Menu path (Supabase UI as of 2026-07-19):** the toggle is under **Database → Publications**
(left sidebar, DATABASE MANAGEMENT group) → open **`supabase_realtime`** → toggle the table on.
NOTE: the old "Database → **Replication**" menu is now a *different* feature (read replicas /
analytics pipelines / destinations) — do NOT send anyone there for realtime. To add a future
table: same page, toggle it on, and make sure an RLS SELECT policy exists for the
`authenticated` role (the OS reads under the publishable/anon key). No code change needed —
the hook already subscribes. (See `supabase-access-model`.)

## Not on this hook (by design)
Action-triggered function calls — media upload/delete, call-tracking provision/release,
google-ads test, docusign send, stripe billing — are user-initiated **mutations** that
update local state from their own response. They aren't background feeds, so there's no
staleness to poll away.

## Adding a new live view later
Give the loader (that sets state) to `useLiveData`. Pass `table` only if the browser can
read that table directly under RLS **and** it's in the realtime publication; otherwise omit
`table` and rely on poll + focus (like blog). Gate with `active` if it must wait for auth.

Shipped + merged to main 2026-07-18 (`b69910e`); headless render harness passed with zero
page errors. See DEPLOYS row `cdc02d5`.
