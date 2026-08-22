---
name: live-stats
topic: Reporting
task: check whether a number on a screen or in a report is live, or fix somewhere reading a stored field that nothing writes
keywords: [live data, stand ins, client.cpl, cost per lead never computed, liveStats, adPerfStats, platformLabel, platform wrong, alerts-watch cplBlowout, dead alert, report data, leads counter, stale field]
status: verified
summary: A sweep for stand-in data found two real defects. The Overview platform tile read the PACKAGE rather than the account, so the house account said "Google + Meta" while running Meta only, disagreeing with the health score two cards below. And `client.cpl` is never written by any code path, yet five things read it as live, including an alert meant to warn about wasted spend, which therefore could never fire.
verified: 2026-08-22
---

## What he asked

Bryson, 2026-08-22, looking at his own Overview: *"The platform is wrong. Do a quick check
on that and anything else that shows data that it is all live accurate data not stand ins."*

## 1. The platform tile read the package, not the account

For a paying client the package platform **is** the answer, because it is what they bought.
The house account has no package it bought: it carries `HOUSE_PKG`, a catch-all whose
platform string is the fixed text **"Google + Meta"**. So his Overview said Google + Meta
while he runs Meta only.

**The tell that made it a real defect rather than a nitpick:** the Ad Health Score two
cards below already knew better, because it reads `adPlatformsOf`, which reads the account.
Two cards on one screen, disagreeing about the same fact.

`platformLabel(cl, pkg)` is now the one answer. For the house account it reports which
accounts are actually **linked**, since that is what can spend; with nothing linked it
falls back to what he ticked in Edit and **says so** ("Meta (not linked yet)") rather than
implying the account is live. Both Overview tiles, the pipeline header and the client list
row read it.

## 🔴 2. `client.cpl` is never computed by anything

It is set to `0` when a client is created and hardcoded on the demo records. **No code path
anywhere has ever written a real value to it.** Five things read it as though it were live:

| reader | what the dead field did to it |
|---|---|
| server health score | the cost-per-lead points were unreachable for every real client |
| client report prompt | every report ever generated said "Not yet tracked" |
| owner rollup's over-target list | could never list anyone |
| OS Reports tab, including a card headed **"Data Used in This Report"** | showed a dash forever |
| 🔴 `alerts-watch` CPL-blowout alarm | **could never fire** |

That last one is not cosmetic. It is a warning he believes is watching his money.

`liveStats(cl)` in `report-shared.mjs` now computes both numbers from the two sources the
OS screens already use: the lead log, and the ad-spend snapshot `ads-sync` stores. One
definition, used by all five, so a report, an alert and the screen cannot quote three
different figures.

**Two rules inside it worth keeping:**

- **`cpl` is `null`, never `0`, when it cannot be measured.** A zero reads as "leads are
  free", which is worse than "unknown" — and a zero is exactly what a stored-but-never-
  written field looks like.
- 🔴 **The 30-day window must match `adPerfStats` in `index.html`.** Spend is a trailing
  30-day figure from the ad platforms, so dividing it by ALL-TIME leads would understate
  cost per lead by however long the account has existed, and the number would get quietly
  better every month for no reason. `verify-live-stats` pins both expressions by name,
  because two copies of one rule is exactly how a report ends up quoting a different number
  from the screen it describes.

Also fixed while in there: the Reports tab counted **20** pipeline steps via `buildBots`
while the screen shows **17** for the house account. The comment directly above it had been
claiming since before it was true that "a report can never quote a different number from
the screen Bryson is looking at". It now uses `botsFor` and holds.

## What was checked and found healthy

Recorded so it is not re-checked: ad budget, niche, leads, views, clicks, spend and the
"updated N hours ago" stamp on the Live Ad Performance card all read live data already.
The demo records carry invented leads and CPL **on purpose** and are flagged `demo`; there
is now a test that every hardcoded non-zero seed sits inside a demo record, so an invented
number can never be seeded onto a real account.
