---
name: suspicious-login-alert
topic: OS app
task: the suspicious-login (new sign-in location) security alert — how it detects a login from an unusual location and emails Bryson
keywords: [suspicious login, login alert, new location, login-watch, login_events, geolocation, security alert, sign-in, netlify geo]
status: verified
summary: The OS emails an alert when the owner account is signed into from a country/region it's never been signed into before (Bryson, 2026-07-27). On a successful password sign-in the OS fire-and-forgets a call to netlify/functions/login-watch.mjs, which reads Netlify's edge geolocation (context.geo — no external geo-IP service), compares the sign-in's country+region to the login_events history, records the event, and on a never-seen combo fires dispatchAlert (email; SMS gated off). Needs a one-time SQL migration (docs/sql/login-events-schema.sql); fails soft until then.
verified: 2026-07-27
---

**Ask (Bryson, 2026-07-27):** get alerted if the OS is logged into from a different location than usual (possible account compromise).

**How it works:**
- **Trigger:** `LoginScreen.handleSubmit` (index.html) — after `signInWithPassword` succeeds it grabs `data.session.access_token` and **fire-and-forgets** `fetch("/.netlify/functions/login-watch", {POST, Authorization: Bearer <token>})`. Never awaited → never blocks or delays sign-in; any failure is swallowed.
- **`netlify/functions/login-watch.mjs`** (owner-JWT verified via `supabase.auth.getUser`): reads **`context.geo`** (Netlify edge geolocation → city/subdivision/country; falls back to the `x-nf-geo` base64 header) + the IP (`context.ip` / `x-nf-client-connection-ip`). Loads the last 300 rows of `login_events`, builds a set of seen `country|region` keys, and:
  - **firstEver** (empty table) → record only, no alert (establishes the baseline).
  - **new** = the current `country|region` isn't in history → **`dispatchAlert`** ("New sign-in location for BoldLine OS", email + in-app-less; SMS gated off via SMS_ENABLED) with the location + IP and "if this wasn't you, change your password."
  - Always inserts the login event (`is_new_location` flagged). Granularity = **country + region** (not city) to avoid false alarms from mobile/ISP IP drift within the same area.
- **`docs/sql/login-events-schema.sql`** — `login_events(id, ip, city, region, country, is_new_location, created_at)`, RLS on / service-role only. **Bryson runs this once** in the Supabase SQL Editor. Until it exists, login-watch **fails soft** (catches the missing-table error, no-ops, sign-in unaffected).
- **Channel:** EMAIL only in practice right now (SMS is globally gated off via `SMS_ENABLED`; flip that on after the Twilio upgrade and login alerts text too). No in-app bell entry — a security alert's value is reaching Bryson off-app.

**Scope note:** this watches the OWNER sign-in (the only real login; client portals are token-based, no login). The Meta/Google ad automation runs on server-side tokens, unrelated.

**Setup for Bryson:** run `docs/sql/login-events-schema.sql` in Supabase → done. The first time you sign in after that, your normal location is recorded silently; only a sign-in from a new country/region alerts. OS status tab ("Suspicious-Login Alert" under ARIADeployTab) reflects this.

**Verified 2026-07-27:** login-watch `node --check` clean; OS babel-compiles (env,react) clean with the handleSubmit hook + status entry; fail-soft path returns ok when the table is absent.
