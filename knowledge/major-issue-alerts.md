---
name: major-issue-alerts
topic: OS app
task: real-time "something major came up" alerts to Bryson — SMS + email + in-app — for billing failures, client performance crashes, runaway/inefficient spend, and system/job failures
keywords: [alerts, major issue, alerts-watch, dispatchAlert, withFailureAlert, alerts-shared, perf crash, no leads, cpl blowout, spend spike, billing failure, system failure, SMS alert, getAlerts]
status: verified
summary: Beyond the scheduled reports, BoldLine OS pushes a real-time alert the moment something MAJOR trips (Bryson, 2026-07-25). Channels: EMAIL + SMS (via netlify/lib/alerts-shared.mjs dispatchAlert) + IN-APP (derived live in index.html getAlerts()). Triggers: (1) billing/payment failure — billing-watch.mjs; (2) client performance crash — health <5 on an active client; (3) live campaign with zero leads after 14d; (4) CPL 2x+ target (runaway/inefficient spend proxy) — all three via the daily alerts-watch.mjs; (5) system/integration failure — any scheduled job crashing, via withFailureAlert wrapper. De-duped so no daily spam. SMS delivery itself waits on the paid Twilio upgrade (trial A2P block); email + in-app work now.
verified: 2026-07-25
---

**Bryson's ask (2026-07-25):** "If something major comes up then I should get an alert about it." Chose channels = SMS + Email + In-app; triggers = billing/payment failure, client performance crash, abnormal ad spend spike, system/integration failure.

**Architecture — two sides:**
- **PUSH (email + SMS):** `netlify/lib/alerts-shared.mjs` → `dispatchAlert({title, body, severity, smsText})` sends an alert-styled email (`OWNER_EMAIL`) + an SMS (`OWNER_PHONE`), each fail-soft (one channel failing never blocks the other, never throws). Reused by every watcher.
- **IN-APP:** derived LIVE in `index.html`'s `getAlerts(cl)` from the same stored client fields — nothing is persisted for the bell to show an alert; it appears/disappears with the data. The watcher and getAlerts use the SAME thresholds (kept in sync by hand across the two runtimes).

**The triggers:**
1. **Billing / payment failure** — `netlify/functions/billing-watch.mjs` (daily). Already emailed the owner + fed the in-app red alert (via stored `billingLate` → getAlerts); 2026-07-25 added an **SMS** on the newly-late transition. Transition-gated (no daily repeat).
2. **Client performance crash** — active-stage client (`active`/`optimizing`/`scaling`) whose `calcHealth(cl) < 5`.
3. **Live campaign, zero leads** — active-stage, `adBudget` set, `leads===0`, and 14+ days since `contractStart` (grace so brand-new campaigns don't false-alarm).
4. **CPL blowout** — `leads>0 && cpl >= 2×` the client's target (`PER_LEAD[niche]||50`). This is the stored-data **proxy for "abnormal ad spend"**.
   - Triggers 2–4 live in **`netlify/functions/alerts-watch.mjs`** (daily `0 17 * * *`), exported helper `evalConditions(cl)`. It PUSHES email+SMS only on a NEW trip, de-duped via `cl.alertState = {perfCrash,noLeads,cplBlowout}` persisted per client; recovery clears the flag silently (in-app alert just disappears; no recovery spam). The matching in-app alerts are the `perf_crash`/`no_leads`/`cpl_blowout` entries added to `getAlerts()`.
5. **System / integration failure** — `withFailureAlert(jobName, handler)` (alerts-shared) wraps the scheduled handlers (`alerts-watch`, `billing-watch`, `weekly-report`, `monthly-report`, `os-report`); any unhandled throw → an alert ("<job> failed to run") then re-returns 500 so Netlify still logs the failure. Config-missing is also surfaced monthly by ARIA's OS report ("Missing Required Configuration").

**DEFERRED / future (do when live campaign spend is flowing):** true real-time **ad-SPEND-spike** detection (spend far above the set budget/pace) needs live per-client spend pulled from the Google/Meta APIs, which only exists once campaigns run. Today's `cplBlowout` + `noLeads` are the stored-data stand-ins. Wire the real budget-vs-actual-spend check into `alerts-watch.mjs` (per-client `gadsCall`/`metaCall` spend pull) when campaigns are live. Meta side also gated on Meta App Review.

**SMS is OFF for now (Bryson, 2026-07-25).** The trial Twilio account's A2P 10DLC block makes texts fail, so `sendSMS` (report-shared.mjs) now short-circuits unless env var **`SMS_ENABLED=1`** is set in Netlify. This kills SMS for BOTH alerts and report digests with one switch. Email + in-app work now; to turn SMS back on after upgrading Twilio to paid, just set `SMS_ENABLED=1` (no code change). `dispatchAlert` still "reports" sms as sent since sendSMS returns without throwing — harmless.

**Verified 2026-07-25:** all touched modules `node --check` clean; `evalConditions` unit-tested across healthy/crash/no-leads/blowout/internal/non-active/grace-window cases (correct); `getAlerts()` block parse-and-run tested in isolation (emits perf_crash/no_leads/cpl_blowout correctly). OS status tab gained a "Major-Issue Alerts" entry.
