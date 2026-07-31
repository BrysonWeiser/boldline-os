---
name: pwa-push
topic: OS app
task: web-push notifications — make OS alerts buzz Bryson's phone/desktop; set up VAPID keys + the push_subscriptions table; debug push not arriving
keywords: [web push, push notification, VAPID, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, push_subscriptions, pushManager, service worker push, dispatchAlert, sendPushToAll, push-shared, notificationclick, PushToggle, applicationServerKey, userVisibleOnly]
status: verified
summary: Phase 2 of the PWA is BUILT + device-verified working end-to-end (2026-07-31) — OS alerts deliver as phone/desktop push notifications via a third fail-soft channel inside dispatchAlert, so EVERY major-issue alert (billing, approvals, perf crash, no-leads, CPL blowout, login, job failures, upgrade requests) reaches subscribed devices automatically. Setup done: 2 Netlify env vars (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY) + a Supabase push_subscriptions table. See the "Real-world setup gotchas" section — the code was correct throughout; every failure was a paste error or an Android/Windows OS notification setting.
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
- **Paste gotcha (hit 2026-07-31):** Bryson pasted the env-var NAME into Netlify's VALUE field, so
  `VAPID_PUBLIC_KEY`'s value was `"VAPID_PUBLIC_KEY BAbSh…"`. The browser then rejected it with
  *"Failed to execute 'subscribe' on 'PushManager': The provided applicationServerKey is not valid."*
  Fix: `push-shared.mjs` now runs both keys through a `cleanKey()` normalizer (strips a leading label /
  `=`/`:` / quotes / whitespace and takes the trailing token), so a name-prefixed or newline-padded paste
  self-heals — no Netlify re-edit needed, just re-tap Turn on after the redeploy. A truly invalid-key
  error that ISN'T a paste artifact means the value is genuinely wrong.

**Real-world setup gotchas (all hit + resolved 2026-07-31 — the CODE was correct throughout; every
failure was a paste error or an OS-level notification setting):**
- **`sent:1, failed:0` is the key signal.** web-push ENCRYPTS the payload with the subscription's keys
  BEFORE the HTTP call, so a bad/missing subscription fails locally (failed:1). `sent:1` therefore proves
  the subscription is well-formed AND the push service (FCM) accepted it — so any "no notification" from
  that point on is device-side display, NOT our code.
- **Env-var paste error:** see the `cleanKey` gotcha above (name pasted into Netlify's value field).
- **Android (Samsung Galaxy) ate the push silently — the #1 mobile culprit:** Samsung's battery manager
  puts Chrome to "sleep" and drops web pushes. Fix on the phone: **Settings → Apps → Chrome → Battery →
  Unrestricted**, and **Settings → Battery → Background usage limits → Sleeping/Deep-sleeping apps →
  remove Chrome**. (Also confirm Chrome + the site's notifications are allowed and DND is off.)
- **Windows desktop showed nothing** until Windows notifications were enabled (Win+I → System →
  Notifications → on + Chrome on, Do-not-disturb off) — DevTools → Application → Service Workers → the
  **Push** button fires the SW handler locally (no FCM) and is the definitive "does display work" test.
- **Notification opened the browser, not the app:** the subscription was created in the Chrome TAB, and/or
  the site was a home-screen SHORTCUT, not an installed WebAPK. Fix: install via Chrome ⋮ → **"Install and
  create shortcut"** (newer Chrome merged the label) → the app launches full-screen with no address bar,
  then **subscribe from INSIDE the installed app**. Note: the tab and the installed PWA have SEPARATE push
  subscriptions for the same origin, so subscribing in both leaves two rows (dupe notifications) — turn one
  off, or clear the tab's. There is no reliable server-side same-device dedupe; multiple rows are the
  legitimate multi-DEVICE model.
- **Status-bar icon was a white box:** Android renders the small status-bar icon from the ALPHA channel
  only (a white silhouette), so a solid app icon becomes a white square. Fix: a dedicated monochrome
  transparent **`badge-96.png`** (BL monogram silhouette) passed as `badge:`; the full-color `icon:` still
  shows in the expanded notification. (Can't show a full-color icon in the status bar — Android limitation.)
- **Notification `tag`:** do NOT set a shared per-severity tag (`"boldline-"+severity`) — two same-severity
  alerts then collapse into one (second replaces first). Left tag unset so each alert is its own notification.
- **`urgency:high`** on `webpush.sendNotification` helps the push service wake the device promptly (mobile).
- **Duplicate subscriptions on one phone:** browser-side "turn off" via Chrome/Android settings does NOT
  delete the stored DB row (only the in-app Turn-off button, which calls `?action=unsubscribe`, does), so
  duplicates can linger and each still gets `sent`. Resolved with a TEMPORARY `?action=reset` (wipe all)
  then a single re-subscribe from the installed app. `sent:0 "no subscriptions"` after a reset + a failed
  Turn-on means the site's notification permission is BLOCKED — re-allow it (long-press app → App info →
  Notifications → On, or Chrome → Site settings → Notifications → the site → Allow), reopen the app, Turn on.
- **Diagnostics:** temporary `?action=debug` (sub count / push-service host / hasKeys — no secrets) and
  `?action=reset` (wipe all subs) were added to troubleshoot, then REMOVED after verification. Re-add from
  git history if ever needed again.

**Verified (2026-07-31):** all modules `node --check` clean; `web-push` imports; index.html Babel-transforms
clean; full app boots with 0 pageerrors (render harness); `PushToggle` renders in the bell sheet on-brand
at 390px. Live end-to-end push delivery is Bryson's to confirm on his device after the setup above (needs a
real device + push service + the env vars/table — not reproducible headlessly). See `pwa-build` for Phase 1,
`major-issue-alerts` for the alert triggers this rides on.
