---
name: scale-prompt
topic: Ads
task: change when the OS suggests scaling ad spend, or work out why a scale alert did or did not fire
keywords: [scale, scale or keep as is, raise budget, budget limited, scaleReady, scaleCheck, SCALE_MIN_LEADS, SCALE_STEP, set_daily_budget, spend more, ads-sync alert, approval queue budget]
status: built
summary: An hourly check inside ads-sync that asks whether to raise a budget, and never raises one itself. It fires only when the account is BOTH performing and actually out of budget, because raising a budget that is not being spent changes nothing. One-click approval reuses the queue's existing guarded set_daily_budget path, so no new route to real money was written.
verified: 2026-08-24
---

## What he asked for

Bryson, 2026-08-24: *"for my own ads when it thinks we should scale i want to get an alert
prompting me to either scale or keep it as is"*.

## 🔴 This is the one direction the autopilot may not move on its own

The founding invariant (KB `ads-autopilot`) is that the bot **may always spend LESS and may
NEVER spend more without asking**. So this asks, and everything about the design follows from
that: it produces an alert plus a decision in the approval queue, and it **writes no campaign
change of any kind**. There is a test asserting `ads-sync` still contains no `setBudget`,
`setStatus` or `activateCampaign` call.

The one-click "Scale" reuses the approval queue's **existing** `set_daily_budget` execution,
which already works on both platforms behind the human approval gate. **No new path to real
money was written for this feature.**

## When it fires, and the condition most advice gets wrong

Four things must all be true, and each is observable:

1. something is live,
2. **at least 3 leads in the last 30 days** — one lucky lead is not a track record, and it
   makes cost per lead look spectacular,
3. 🔴 **the budget is actually running out**, and
4. cost per lead is at or under the target the rest of the OS already uses
   (`PER_LEAD[niche] || 75`), so the number is consistent with the health score, the reports
   and the CPL alarm rather than being a fifth definition.

**Condition 3 is the one that matters.** Raising a budget that is not being spent changes
**nothing**. An account spending $120 of a $213 budget is constrained by targeting, creative
or bid, and a bigger number just sits there unused while looking like action was taken. The
check requires `budget.state === "warn"`, the 85% to 105% band: pressed against the cap.

**Deliberately silent when already OVER budget.** That case has its own red alert telling him
to bring spend down. Two alerts saying opposite things about one account is worse than one.

## The suggested step

**+25%, never a doubling.** Doubling a budget usually restarts the platform's learning phase
and makes performance worse for a fortnight, which is the opposite of scaling. A tiny budget
still moves by at least a dollar rather than rounding to nothing.

**With more than one live campaign the alert still goes out but the one-click change does
not.** Picking which campaign gets the money would be a guess about his own strategy.

## Behaviour

Transition-only, like every other alert in `ads-sync`: it asks once when the picture forms,
not hourly. Choosing "keep as is" leaves `adSyncState.scaleReady` true, so it stays quiet
until the conditions genuinely break and re-form. The queue item is deduped by id, and is
**prepended** to `pendingActions` rather than replacing them.

Severity is **blue**, not red. It is an opportunity, not an emergency.

Both choices are stated in words, because that is what he asked for: *"Either is a fair call.
Scaling buys more of what is working; keeping it as is holds your costs where they are.
Nothing changes until you choose."*

**35 checks in `verify-scale-prompt.mjs`**, running the real check sliced out of the shipped
function. Seven deliberate breaks confirmed to fail, including dropping the budget-limited
condition, dropping the performance condition, accepting one lucky lead, turning the step
into a doubling, and picking a campaign when several are running.
