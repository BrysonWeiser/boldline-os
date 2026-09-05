---
name: ads-sync-stall
topic: Ads
task: tell whether the hourly ad numbers are actually updating, force a refresh, and prove the sync still runs
keywords: [analytics not updating, ads-sync stalled, adSyncStale, ads-sync-now, check now, numbers stopped, updated hours ago, scheduled function skipped, best effort schedule]
status: verified
summary: Bryson asked whether his ad numbers were still updating after a few hours of no movement, and neither he nor the OS could answer. Three causes looked identical on screen: the job ran and nothing changed, the job ran and the platform refused, or the job never ran (Netlify schedules are best effort and a 2.5h gap with zero errors has happened here before). Now the card WARNS past 2.5 hours and carries a **Check now** button backed by `ads-sync-now.mjs`, an owner-authed endpoint that RUNS the scheduled job itself rather than a copy. Also adds `tests/verify-ads-sync-runs.mjs`, which actually EXECUTES `summarize` for the first time: every existing suite read that file as text, so a runtime break in the day's earlier change would have left all of them green while the numbers silently froze. 15 checks, nine mutations caught.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04 evening):** *"Make sure that the analytics for my ads are updating. They haven't updated in a few hours now"*.

## 🔴 The first suspect was my own change, and nothing proved it innocent

Earlier the same day `summarize` gained a fourth argument and both call sites were rewritten to pass a second predicate (see `meta-delivery-states`). **Every suite that touches `ads-sync.mjs` reads it as TEXT. Not one of them ever called it.** So a change that made it throw at runtime would have left every check green while the numbers on his screen quietly stopped moving, and the only symptom would be exactly what he reported.

Worse, the failure would have been invisible on the server too: each platform's read sits inside its own try/catch, so a throw becomes `ok: false` for that platform and **the run still reports success to Netlify, hourly, forever**.

`tests/verify-ads-sync-runs.mjs` now extracts and RUNS the real `summarize` and `trimCampaign` against realistic Google and Meta payloads. It confirmed the change was sound, and it pins the regression directly: calling `summarize` the old three-argument way must **throw**, because a silent stale call site is the whole failure mode.

## 🔴 Three causes, one appearance

When the figures stop moving:
1. the job ran and nothing had changed,
2. the job ran and the ad platform refused,
3. **the job never ran** — Netlify schedules are best effort, and a two-and-a-half hour gap with no error has been seen on this account before.

The card showed how old the numbers were and never said whether that was normal, so all three looked the same.

**Now:** `adSyncStale` trips past 2.5 hours (the job is hourly), the timestamp turns amber, and a line says *"They normally refresh every hour, so something skipped."* The lead mirror has had exactly this warning for a fortnight; the ad numbers never did.

## Check now

`netlify/functions/ads-sync-now.mjs`, owner-authed, POST only.

- 🔴 **It runs the scheduled job itself** (`import runAdsSync from "./ads-sync.mjs"`), not a reimplementation. Two versions of the arithmetic that decides what he is looking at, and the copy nobody runs hourly is the one that drifts. Same pattern as `house-leads-sync`.
- 🔴 **Owner only.** It spends nothing and writes only our own snapshot, but it hits both ad platforms' APIs on demand, and an open endpoint that does that is a way for a stranger to burn our rate limit by holding down a button.
- The job's own `withFailureAlert` wrapper is left intact, so a failed press raises the same alarm a failed hour would. That is right: a press that fails is as much a problem as an hour that fails.
- A refused refresh is shown as an error. Reporting success on a failure is the exact class of bug this whole card is about.

One press separates all three causes in about ten seconds: numbers move means the schedule slipped, an error means that error is the answer, nothing changed means nothing had changed.

## Verified
In a real browser with a snapshot deliberately aged five hours: the age shows, the warning appears, the button is offered, and no sideways scroll at 390 or 1280.

## Files
- `netlify/functions/ads-sync-now.mjs` (new).
- `index.html` — `adSyncStale`, the warning, the Check now button and its result line.
- `tests/verify-ads-sync-runs.mjs` (new).
