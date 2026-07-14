---
name: os-alerts-notifications
topic: OS app
task: work on OS owner alerts/notifications (live refresh, toasts, dismissing) and the portal upgrade request
keywords: [refreshClients, seenAlertKeys, dismissedAlerts, notifCount, NotificationsPanel, upgradeRequest]
status: verified
summary: OS alerts are derived from clients; a quiet refreshClients (Supabase realtime + 15s poll + focus refetch) keeps the count live, and new alerts pop a bottom-left toast (seenAlertKeys diff). Contract-expiry/intake alerts are dismissible (dismissedAlerts, keys c7:/c30:/intake). The portal "Upgrade" CTA uses a two-step confirm that persists upgradeRequest → live alert.
verified: 2026-07-02
---

**Live refresh (2026-06-28):** alerts + the bell count are **derived** from `clients` (via `getAlerts()` + `notifCount`), which was originally fetched only once on mount. Fix in `index.html`'s `App`: a quiet `refreshClients()` (re-selects `clients`; no loading flash, no re-seed, no token backfill) driven by three things — a **Supabase realtime** subscription on `clients` (instant), a **15s poll** (fallback), and a **refetch on tab focus/visibility**. Enable instant updates via Supabase Realtime on `clients` (see `supabase-access-model`); without it, ~15s poll / instant-on-focus still work.

**Open-hub sync fix (2026-07-10):** `refreshClients` (and `loadClients`) used to update ONLY the `clients` array, not the separate `activeClient` snapshot that drives the open Client Hub. So when a **client edited their info in the portal** (or the owner in the Client View tab), it saved to Supabase and landed in the `clients` array, but the card the owner was looking at stayed stale — Bryson hit this with an email change. Fix: both refresh paths now also re-sync `activeClient` from the fresh list by `id` (preserving the transient `_initialTab`). Owner edits stay safe because `updateClient` is optimistic AND persists immediately, so a refetch returns the same value it already set (worst case a sub-15s flicker on a mid-write poll race — pre-existing, self-correcting). This is the mechanism that makes "anything the client changes shows up on the owner's end."

**Toasts:** new alerts pop a **bottom-left toast** (auto-dismiss ~6.5s; click → opens the Alerts panel). Detection diffs a `seenAlertKeys` set each time `clients` changes; the set is **seeded on first load** so existing alerts don't toast on open. Covers intake / upgrade / contract / custom `cl.alerts` + pending approvals.

**Dismissible alerts (2026-07-01):** contract-expiry (≤7d and 8-30d) and intake alerts previously had no way to clear. Added a dismiss control (✕ on contract cards, a "Dismiss" button on intake cards) in `NotificationsPanel`. Dismissals persist per client in a `dismissedAlerts` array, keyed so they **auto-resurface correctly**: `c7:<contractEnd>` / `c30:<contractEnd>` (a renewal changes `contractEnd`, so a fresh alert shows again) and `intake`. The bottom-nav bell badge (`notifCount`) respects dismissals. No schema/RLS change (clients are stored as a JSON blob).

**Portal upgrade flow (2026-06-28):** the portal CTA is **"Upgrade"** with a **two-step in-page confirm** (Upgrade → Cancel / Confirm Upgrade Request) instead of a native `confirm()`. On confirm it POSTs `{upgrade:<name>}` to the portal function, which records `data.upgradeRequest` **without** setting `intakeComplete` (a dedicated branch before the intake `mergeFields`) → the owner gets a **live alert** (previously the portal showed "Request Sent" but never persisted, so the owner never saw it). Mirrored in **both** `portal.js` and `makePortalHTML` (see `os-portal-dual-copy`).
