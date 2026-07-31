---
name: pwa-push
topic: OS app
task: web-push notifications — make OS alerts buzz Bryson's phone/desktop; set up VAPID keys + the push_subscriptions table; debug push not arriving
keywords: [web push, push notification, VAPID, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, push_subscriptions, pushManager, service worker push, dispatchAlert, sendPushToAll, push-shared, notificationclick, PushToggle, applicationServerKey, userVisibleOnly]
status: verified
summary: Phase 2 of the PWA is BUILT (2026-07-31) — OS alerts now deliver as phone/desktop push notifications via a third fail-soft channel inside dispatchAlert, so EVERY major-issue alert (billing, approvals, perf crash, no-leads, CPL blowout, login, job failures, upgrade requests) reaches subscribed devices automatically. Needs one-time setup: 2 Netlify env vars (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) + a Supabase push_subscriptions table. Dormant + harmless until configured.
verified: 2026-07-31
---

**What it does:** turns every `dispatchAlert()` alert into a Web Push notification on the owner's
installed PWA / subscribed browsers, on top of the existing email + SMS channels. Because it hooks
`dispatchAlert` (not each caller), all existing triggers get it for free — see `major-issue-alerts`.

**Architecture (all additive, all fail-soft):**
- **Send side — `netlify/lib/push-shared.mjs`:** `sendPushToAll({title,body,severity,url})` loads every
  stored subscription and delivers an encrypted Web Push via the `web-push` npm lib (added to
  package.json). Prunes dead endpoints on 404/410 so the list self-cleans. Never throws.
- **Wired into `dispatchAlert`** (`alerts-shared.mjs`) as a 3rd channel via **dynamic `import()`** so
  `web-push` only initializes when an alert actually fires (keeps other function bundles lean). Push
  body = `body || smsText || title`.
- **Subscribe/manage — `netlify/functions/push.mjs`** (modern runtime → no 4KB Lambda env cap):
  `GET ?action=key` returns the public VAPID key; `POST ?action=subscribe|unsubscribe` store/remove a
  subscription; `POST ?action=test` sends a test push. Called at `/.netlify/functions/push` (no redirect
  needed; SW skips `/.netlify/`).
- **Service worker (`service-worker.js`, bumped to CACHE_VERSION v2):** added `push` (always
  `showNotification`, required under `userVisibleOnly`) + `notificationclick` (focus the open OS window
  or open `/`) handlers.
- **Front end (`index.html`):** a **`PushToggle`** component at the top of `NotificationsPanel` (the bell
  sheet). "Turn on" → `Notification.requestPermission()` (called first, inside the click gesture — order
  matters) → fetch public key → `pushManager.subscribe({userVisibleOnly:true, applicationServerKey})` →
  POST the subscription. Shows On/Off + a "Send a test notification" button. Hidden entirely where push
  is unsupported (e.g. iOS Safari in a tab — iOS only supports Web Push in an *installed* PWA, 16.4+).

**Security / secret-scan:** no VAPID value is ever committed. The **public** key is served at runtime by
the push function (fetched by the browser), the **private** key lives only in Netlify env. The
`push_subscriptions` table has **RLS on with no policies**, so the anon/publishable key can't touch it —
only the service-role functions (which bypass RLS) read/write it. VAPID subject is a committed constant
(the public OS site URL) — no secret.

**⚙️ ONE-TIME SETUP Bryson must do (until then it's dormant — subscribe shows "Push isn't set up on the
server yet", sends no-op):**
1. **Create the Supabase table.** Supabase dashboard → SQL Editor → New query → paste + Run:
   ```sql
   create table if not exists push_subscriptions (
     endpoint text primary key,
     subscription jsonb not null,
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );
   alter table push_subscriptions enable row level security;
   ```
   (RLS on + no policies = locked to the service role. Correct and intended.)
2. **Add 2 Netlify env vars** on the **OS site** (`boldlinemedia.netlify.app`, NOT the marketing site) →
   Site configuration → Environment variables → Add: `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (values
   were generated with `require('web-push').generateVAPIDKeys()` and handed to Bryson in chat — regenerate
   the same way if lost; changing them invalidates existing subscriptions, so he'd re-tap "Turn on").
   Redeploy (or it applies on next deploy).
3. Open the OS → bell (Alerts) → **Phone notifications → Turn on** → allow → **Send a test notification**.

**Gotchas:**
- `web-push` is CommonJS; imported as `import webpush from "web-push"` in ESM — works on Node 22 / Netlify.
- The public VAPID key must be converted to a `Uint8Array` (`urlB64ToUint8`) for `applicationServerKey`.
- SW updates roll because `/service-worker.js` is served no-cache (Phase 1) — the v2 push handlers reach
  existing installs automatically.
- Changing VAPID keys later invalidates all stored subscriptions (they'd 410 and auto-prune); users just
  re-tap Turn on.

**Verified (2026-07-31):** all modules `node --check` clean; `web-push` imports; index.html Babel-transforms
clean; full app boots with 0 pageerrors (render harness); `PushToggle` renders in the bell sheet on-brand
at 390px. Live end-to-end push delivery is Bryson's to confirm on his device after the setup above (needs a
real device + push service + the env vars/table — not reproducible headlessly). See `pwa-build` for Phase 1,
`major-issue-alerts` for the alert triggers this rides on.
