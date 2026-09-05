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

## 🔴 "It worked but nothing updated" (same evening, and it was the button)

Bryson pressed Check now, got a success, and nothing on screen moved. He was right and it was mine.

**The job writes to the database. The open screen was still holding the copy it loaded when he opened it.** So a perfect refresh looked identical to a broken one. The first version's success message even said *"Reopen this screen to see the newest figures"*, which is an instruction standing in for a missing feature. **A button that says it checked must show what it found.**

The press now re-reads the client record and hands it back up through `onUpdate`, so the tiles change under his thumb.

### 🔴 And "nothing happened" was three different answers at once

Each now has its own sentence:
- a platform refused → the error, named, in red
- nothing is linked → "no ad account is linked to this record, so there was nothing to read"
- the numbers are genuinely the same → **"The platforms report exactly the same figures as before, so nothing has changed since the last check"**
- something moved → "Checked just now, and the figures above have been updated"

That last pair is the whole point. Unchanged numbers and a broken button used to be indistinguishable, which is exactly the report he made.

### Two older checks had pinned a spelling and broke

Adding one prop to the card failed `verify-campaign-breakdown` ("the card cannot hold state") and `verify-house-leads` ("clients with a linked account get the same card"). Both were matching the component's **exact prop list**. The house-leads one already carried a comment saying it pinned the rule and not the spelling, and was still pinning a spelling. Both now match the component by name and the render gate, not its arguments.

### 🔴 The harness lesson, which is the same one this codebase keeps learning

Verifying this took six attempts, and three of them failed for reasons that had nothing to do with the product: the browser stub had no auth token, a relative fetch from `file://` is blocked by CORS, and **one harness edit silently did not apply because it targeted a string that did not exist**, so the run reported "unchanged" about data that was never changed. That last one is the exact hazard every mutation run in this repo is written to catch, and it bit the harness itself. **Assert that an edit applied. A replace that matches nothing is indistinguishable from a passing test.**

Proven in a real browser over HTTP: views went 5,260 to 88,888 on screen after the press, the stale warning cleared, and with unchanged data it correctly said so instead.
