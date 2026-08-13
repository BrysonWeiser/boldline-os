---
name: ads-autopilot
topic: OS app
task: the only job allowed to change a live ad account on its own — auto-pause on overspend or dead spend, opt-in budget rebalance
keywords: [ads autopilot, auto pause, overspend trip, dead spend, rebalance, guarded write, ADS_AUTOPILOT, kill switch, cooldown, blast radius, spend less never more, offline bots]
status: verified
summary: `netlify/functions/ads-autopilot.mjs` runs every 2 hours on Netlify's servers (nothing open anywhere) and is the FIRST and ONLY job permitted to write to a live ad account. One safety rule governs everything: **the bot may always spend LESS without asking, and may NEVER spend more without asking.** It pauses campaigns pacing 30%+ over the monthly budget, pauses campaigns that burned real money over 30 days with zero conversions, and (opt-in per client, default OFF) shifts daily budget from the worst to the best cost-per-conversion campaign without raising the account total by a cent. It never creates a campaign, never enables one, never raises a budget, never touches targeting. Global kill switch `ADS_AUTOPILOT=off`; per-client `autopilot.enabled=false`. Built 2026-08-13. 32-case harness, all passing.
verified: 2026-08-13
---

**Why (Bryson, 2026-08-13):** *"I want to make sure everything for the clients will always be running even when im offline (ads ai's)."* The audit that prompted it: 11 scheduled jobs already ran server-side, but **zero of them wrote to an ad account** — every campaign change went through his approval. Ads themselves always ran (they live on Google's/Meta's servers), and monitoring always ran, but nothing reacted. I recommended waiting for a client + a month of real spend data before automating reactions; **he chose to build now**, which is his call and is recorded as such.

**THE SAFETY MODEL, and it is the whole design:**
> **The bot may always spend LESS without asking. The bot may NEVER spend more without asking.**

Every permitted action either pauses a campaign or moves budget sideways. The worst case of a bug is therefore *an ad that stopped running* — recoverable in one click from the Campaigns screen — never a client's card being drained overnight. That inversion is what makes an unattended writer acceptable against the hard business constraint (the client's money, in the client's account).

**Schedule: `15 */2 * * *` (every 2 hours).** Deliberately not daily — an overspend caught 20 hours late has already cost the money. Offset from `ads-sync` and it does its **own live read** rather than trusting the stored `adPerf` snapshot; a spend decision must never be made on stale data.

**The three actions:**
1. **Overspend trip** — pacing (max of projected daily×30.4 and actual 30-day spend) exceeds `monthly × 1.30`. Pauses the **biggest spenders first** (fastest way under the line with the fewest campaigns stopped) until projected pacing is back to roughly the budget.
2. **Dead-spend trip** — a live campaign with **zero** conversions that has spent more than `max($150, 25% of the monthly budget)` over 30 days.
3. **Rebalance — OPT-IN, default OFF** (`client.autopilot.rebalance === true`). Moves up to 15% of the worst cost-per-conversion campaign's daily budget to the best, per run, with an explicit assertion that the account total does not rise. **Default-off on purpose:** with no conversion history the "best" and "worst" are noise, and moving budget on noise is worse than doing nothing.

**Every guard, and why each exists:**
| Guard | Reason |
|---|---|
| `ADS_AUTOPILOT=off` env | Global kill switch, checked first thing every run |
| `client.autopilot.enabled === false` | Per-client opt-out — a client who wants zero automation |
| **No monthly budget on file → skip entirely** | There is no line to pace against; guessing a budget is how a bot pauses a healthy campaign |
| **A failed platform read → skip the whole client** | Partial data makes a healthy account look like it's overspending on the half we CAN see |
| 24-hour cooldown per campaign | Stops flapping and stops a bad threshold compounding |
| Max 4 actions per client per run | Blast-radius cap regardless of what the maths says |
| Write failures counted separately | A failed pause is never reported as a pause, and never alerts as one |

**Every action alerts** (SMS + email + push) naming the client, the campaign, the platform and the reason, and states plainly that nothing was started and no budget was raised. Actions append to `client.autopilot.log` (capped at 60) which also drives the cooldown.

**Exports added:** `setStatus` + `setBudget` from both `google-ads.mjs` and `meta-ads.mjs` (they were module-private). Additive; the interactive paths are unchanged.

**Verified 2026-08-13 — 32 cases, all passing** (stub-tree harness, same recipe as `ads-sync`): **the core invariant asserted directly** (no write ever ENABLES a campaign, raises a budget, or creates anything), overspend and dead-spend trips fire with correct reasons, under-budget accounts are untouched, no-budget and failed-read clients are skipped without writes, both kill switches work, the cooldown blocks and then expires correctly, rebalance is off by default and when enabled moves budget with the account total **unchanged to the cent** in the right direction, a failing write is counted as a failure and never alerts as a success, the 4-action cap holds against 10 candidates, and the house account is included and named as "My Ads" rather than a client.

**STILL NOT AUTOMATED, on purpose:** creating campaigns, enabling campaigns, raising budgets, targeting changes. `createCampaign` still builds PAUSED and still needs approval (KB `campaign-launch-approval`). The bot cannot start spending money; it can only stop it.

**TUNE HERE:** the dials are named constants at the top of the file — `TRIP_MARGIN`, `DEAD_MIN_SPEND`, `DEAD_MIN_SHARE`, `COOLDOWN_HOURS`, `REBALANCE_MAX_SHIFT`, `MAX_ACTIONS_PER_CLIENT`. **Revisit them after the first month of real client spend** — they were chosen from reasoning, not data, which was the substance of the recommendation to wait.
