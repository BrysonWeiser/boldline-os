---
name: meta-delivery-states
topic: Ads/Meta
task: read a Meta campaign's status correctly, tell "switched on" from "serving right now", and explain IN_PROCESS / ADSET_PAUSED / DISAPPROVED to Bryson
keywords: [effective_status, effectiveStatus, IN_PROCESS, in process, ADSET_PAUSED, PENDING_REVIEW, DISAPPROVED, WITH_ISSUES, PENDING_BILLING_INFO, not delivering, metaOn, metaDelivering, campaignIsOn, META_DELIVERY, live vs delivering, campaign says paused but is running]
status: verified
summary: Meta reports `status` (the campaign's own switch) AND `effective_status` (whether it is serving). The OS had two disagreeing definitions of "live" and one sentence for every non-serving state. New `netlify/lib/meta-status.mjs` splits the question into `metaOn` (the switch, what Pause acts on, what the snapshot stores as `live`) and `metaDelivering` (serving, what `ads-autopilot` needs before moving money). `index.html` gains a `META_DELIVERY` table so each state gets its own plain-English explanation, and `campaignIsOn` so every screen agrees. 🔴 `IN_PROCESS` is NOT a fault: it is Facebook applying an edit, which is what you see right after changing a budget from the OS, and it clears itself. 20 checks, 8 mutations caught, verified in a real browser against the exact state from Bryson's screenshot.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04):** minutes after pausing the views campaign and raising the budget on the leads one, he sent a screenshot of the Campaigns screen reading **Live · Not delivering**, under:

> "Meta says this campaign is on, but it isn't serving (in process) — usually the ad set or the ad underneath is paused. Fix it in Meta Ads Manager."

on a campaign showing **786 impressions, 13 clicks, $9.05 spent, $14/day**.

## 🔴 Bug one: `IN_PROCESS` is not a fault, and the OS said it was

`IN_PROCESS` is Facebook still **applying an edit**. It is the single most likely state straight after a budget change made from the OS, it clears itself (usually well within the hour), and the campaign keeps delivering while it does.

The old code showed **one sentence for every non-`ACTIVE` effective status**, and that sentence was written for `ADSET_PAUSED`. So a normal, transient, self-healing state was reported with the explanation for a broken one, and it told him to go and fix it. **A wrong explanation is worse than none: none makes him ask, wrong makes him act.**

Now `META_DELIVERY` (in `index.html`, because the browser cannot import a lib) maps each state to `{fault, chip, note}`:

| Effective status | Fault? | Chip | Meaning |
|---|---|---|---|
| `IN_PROCESS` | no | Updating | Facebook applying a change you made; clears itself |
| `PENDING_REVIEW` | no | In review | waiting on approval, usually hours |
| `PREAPPROVED` | no | Approved | approved ahead of its start time |
| `ADSET_PAUSED` | **yes** | Not delivering | the ad set inside it is paused |
| `CAMPAIGN_PAUSED` | **yes** | Not delivering | paused on Facebook's end |
| `DISAPPROVED` | **yes** | Rejected | the ad was rejected |
| `WITH_ISSUES` | **yes** | Has a problem | Facebook flagged something |
| `PENDING_BILLING_INFO` | **yes** | No payment method | no working card on the ad account |
| anything else | yes | Not delivering | generic line that **names the state** |

🔴 The fallback matters as much as the table: a table alone would go **silent** on any state Facebook invents later, which is a silent loss of a real signal. The old code at least printed the raw status.

## 🔴 Bug two (had not surfaced yet, and was worse): two definitions of "live"

- `CampaignManagerScreen` read the campaign's **own `status`** → it said **Live**.
- `ads-sync` read **`effectiveStatus || status`** → so the hourly snapshot stored `live: false`.

Within the hour the same campaign would have appeared in **My Ads** as **Paused**, under *"Not running, so it has not been seen by anyone and has spent nothing"* — of a campaign seen 786 times that had spent real money. **Both halves false, from one word being asked to mean two things.**

**`netlify/lib/meta-status.mjs`** now answers the two questions separately:
- **`metaOn(c)`** = `status === "ACTIVE"`. This is what Pause/Start act on and what the OS means by a campaign being on. `googleOn` = `ENABLED`.
- **`metaDelivering(c)`** = `metaOn(c) && (!effectiveStatus || effectiveStatus === "ACTIVE")`.

Who uses which, and why:
- **`ads-sync`** stores **both** per campaign (`live` from the switch, `delivering` from serving). `liveList` and the pacing maths deliberately use the **switch**: a campaign that is on but in review still has that money committed and will spend it the moment Facebook lets it through.
- **`ads-autopilot`** uses **`metaDelivering`** (its old behaviour, unchanged, now named honestly). It moves money between campaigns on performance, and a campaign that is on but blocked has no performance to judge, so shifting budget into it would be shifting it into nothing. **The comment there says this explicitly so nobody "fixes" one job to match the other.**
- **The browser** uses `campaignIsOn(c)`, which reads the raw `status` and falls back to the stored `live` flag only for snapshots written before the status was kept.

🔴 **The browser deciding for itself is what made the fix reach him immediately.** His stored snapshot already had `live:false`; waiting for `ads-sync` would have left the screen he reported from still saying the campaign had never run. Verified in a real browser with a snapshot deliberately flagged `live:false`: the row still reads **Running**, keeps its 786 views, and carries the Updating chip plus its explanation.

## Where it shows

- **Campaigns screen row** — chip (amber only when it is a fault) plus the state's own sentence.
- **My Ads campaign row** — same chip and sentence, and 🔴 the row **keeps its real numbers**. The old row had only two branches (`live` / not), so this state had to borrow one, and it borrowed "never ran".
- **My Ads focused campaign** — the same explanation under the big tiles.

## The suite — `tests/verify-delivery-states.mjs`

Extracts `META_DELIVERY` / `metaDelivery` / `campaignIsOn` from `index.html` and **runs them**, alongside the server lib. The first three cases are the screenshot itself. It also asserts every explanation is jargon-free and dash-free, that the string `effectiveStatus || c.status` is gone from `ads-sync`, and that the autopilot's deliberate difference is still explained in place.

20 checks. Mutations caught: the original server bug restored, `IN_PROCESS` marked a fault again, `ADSET_PAUSED` un-flagged, the unknown-state fallback removed, My Ads trusting the stale flag again, the Campaigns screen re-growing its own definition of on, the snapshot dropping `delivering`, and the autopilot switching to the switch.

## Files
- `netlify/lib/meta-status.mjs` (new) — `metaOn`, `metaDelivering`, `googleOn`, `googleDelivering`.
- `netlify/functions/ads-sync.mjs` — `summarize(campaigns, isLive, isDelivering, spendKey)`; stores both.
- `netlify/functions/ads-autopilot.mjs` — same behaviour, now imported and named.
- `index.html` — `META_DELIVERY`, `metaDelivery`, `campaignIsOn`; both screens.
- `tests/verify-delivery-states.mjs` (new).
