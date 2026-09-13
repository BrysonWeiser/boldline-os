---
name: lead-check-alert-noise
topic: OS app
task: understand why the lead check alerted, or change how background jobs report their own health
keywords: [lead check is not running, lead check has stopped, gateway timeout, 504, supabase timeout, house-leads, lead mirror, leadSync, heartbeat, retryQuery, loadAllClients, leadMirrorState, alert noise, too many alerts, false alarm, red alert at night, alerts-watch, STALE_HOURS, transient error, blip, retry, job health, my ads lead count frozen]
status: built
summary: On 2026-09-12 at 11pm the 15-minute lead mirror hit one Supabase "Gateway Timeout" reading the client list and sent Bryson a red alert immediately. Nothing was broken and Supabase answered fine a second later. Two defects. (1) No retry, so one momentary error ended the run, even though the retry for exactly this had been written months earlier beside the clock-skew incident and was welded to one query. `retryQuery` is now a general helper and all three Supabase calls in the mirror use it. (2) The job alerted on its own first bad run, at 96 runs a day. It now sends no alerts at all, logs loudly, and returns ok:false so it does not refresh its heartbeat. `alerts-watch` judges the heartbeat from outside every 15 minutes and alerts ONCE if the mirror has genuinely stalled past 2 hours, clearing the flag on recovery so a future stall alerts again. 53 checks, 16 mutations caught.
verified: 2026-09-12
---

**What he saw, 2026-09-12 at 11:00pm Phoenix:** *"🔴 BoldLine Alert — Lead check is not
running. The 15-minute job that mirrors website leads onto My Ads failed at 'reading the
client list': Gateway Timeout."*

Nothing was broken. Supabase answered normally on the next attempt. There was nothing for him
to do, at 11pm, about an alert marked red.

## 🔴 The two defects, and the second is the dangerous one

**1. No retry.** A `504 Gateway Timeout` from Supabase is a momentary blip at their gateway,
not a broken integration. One of them ended the run. The retry for exactly this case had
already been written, months earlier, right beside the `loadAllClients` clock-skew comment
that says *"96 red alerts a day from a 15-minute job, which is how a notification channel gets
muted and then swallows the alert it exists to deliver."* It could not be reused because it
was welded to one specific query. It is now `retryQuery(run, {job, step})` in
`report-shared.mjs`, `loadAllClients` is built on it, and **all three** Supabase calls in
`house-leads-run.mjs` use it: the client read, the `website_leads` read, and the save.

The save is safe to retry because it REPLACES the whole row (`update({ data })` on one id).
**If that ever becomes an append, the retry has to go with it**, or a network hiccup doubles
every lead. Said in the code, and asserted in the suite.

**2. 🔴 The job alerted on its own first bad run.** This is the real lesson. It runs 96 times
a day. A fault lasting an hour is four identical red alerts; a day of it is ninety-six, and
the end of that road is a muted channel that swallows the alert it exists to deliver. The
codebase had already written that exact sentence down. It was written about a different job.

## The rule that came out of it

**A job cannot judge its own health from inside a single run.** It cannot tell a blip from an
outage, because from inside one attempt they look identical, and the failures it never
survives are precisely the ones it cannot report.

So the health call moved OUT:

- `house-leads` now sends **no alerts at all**. It retries, logs loudly, and on failure
  returns `ok:false` and **does not refresh its heartbeat** (`leadSync.at` on the house record).
- `alerts-watch` (every 15 minutes, its own database connection, its own schedule, so it keeps
  working while the mirror cannot) reads that heartbeat through `leadMirrorState` and alerts
  **once** when it is more than 2 hours old.
- The flag `leadMirrorAlertedAt` on the house record stops 15-minute repeats, and is **deleted
  on recovery** so a future stall alerts again. A one-time-only alarm is worse than no alarm,
  because after it has fired once its silence reads as "fine".

Two cases stay deliberately silent and are distinguishable in the log: **never run** (no
heartbeat at all, which is a fresh install or a deleted house account, a different fault with
a different fix) and **unreadable timestamp**. Both would otherwise alarm forever.

## The new alert says what the old one did not

The old one said the lead count was frozen and left him to work out at 11pm whether a lead had
gone missing. The new one leads with **"Your leads are NOT lost"** — they still save to the
Leads screen and he still gets an email and a buzz per lead, because `lead-intake` does that
independently. What freezes is the count and cost per lead on My Ads, and it catches up by
itself on the next good run.

## One definition of stale

`netlify/lib/heartbeats.mjs` now holds `STALE_HOURS` (adPerf 8, leads 2), `hoursSince` and
`leadMirrorState`. `daily-check` imports and re-exports them instead of keeping its own copy.
Before this, `STALE_HOURS.leads` sat in `daily-check` **unused** while nothing server-side
watched the lead mirror at all.
