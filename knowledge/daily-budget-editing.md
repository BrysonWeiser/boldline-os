---
name: daily-budget-editing
topic: OS app
task: change what one campaign spends per day from the OS, on Google or Meta, including Meta ad-set budgets
keywords: [daily budget, change budget, edit budget, DailyBudgetEditor, setBudget, setAdSetBudget, budgetResourceName, CBO, ABO, ad set budget, campaign budget, budget typo, My Ads budget, campaigns screen budget, individual ads budget]
status: verified
summary: One shared `DailyBudgetEditor` component (index.html) puts a real budget control on the two screens Bryson actually uses — the focused campaign inside **My Ads → Live Ad Performance**, and every row of the **Campaigns** screen. The write already existed on both platforms and on a third screen he never opens (`LiveCampaignsCard`, Package tab), which is why "there is no way to do this" and "the code exists" were both true. Adds `meta-ads.mjs action=setAdSetBudget` because a Meta campaign built by hand in Ads Manager keeps its budget on the AD SET, not the campaign, and the campaign then reports no budget at all. Guards: typo confirmation on a 3x jump AND on a big number set from no known budget, a $100,000/day ceiling, a live look-up of Google's budget id, and the platform's own refusal shown rather than swallowed. `tests/verify-budget-editing.mjs` compiles the component out of index.html and RUNS it (18 checks; 15 mutations caught).
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04):** *"make sure there is a way for me to update the daily budget for my individual ads"* — said right after deciding to move money from the views campaign to the leads campaign, which is exactly the moment a budget control has to exist.

## 🔴 The real bug was placement, not capability

Three separate things were all true at once:
- The budget **write** has existed on both platforms since the approval queue was built (`google-ads.mjs setBudget`, `meta-ads.mjs setBudget`).
- A **hand editor** was added on 2026-09-03 to `LiveCampaignsCard` (budget + end date, with a 3x typo confirm).
- And to Bryson the feature **did not exist**, because `LiveCampaignsCard` lives on a client's Package tab, four taps deep, and the two screens he uses every day both PRINTED the daily budget as plain text with nothing to press:
  - **My Ads → Live Ad Performance** — the per-campaign rows show `$X/day` as a label.
  - **Campaigns** (`CampaignManagerScreen`) — the row's stats line shows `· $X/day`. This is the screen the **phone menu** opens, so on a phone it was the entire campaign-control surface.

**The lesson worth keeping: a control that exists in a place nobody visits is indistinguishable from one that does not exist.** A suite that asked "does the write exist" would have passed the whole time.

## What was built

**`DailyBudgetEditor({client, platform, campaign, onSaved, label})`** in `index.html`, defined just above `LiveAdPerformanceCard`. One component, not a third copy of money-moving code — every guard lives in it once, so a fourth screen gets budget editing by rendering it and cannot get the guards wrong by forgetting to copy one.

Rendered in two places:
- `LiveAdPerformanceCard` — **only when one campaign is focused** (`{sel&&<DailyBudgetEditor …>}`). The card's totals are several campaigns added together and there is no such thing as "the budget" for those.
- `CampaignManagerScreen`'s `row(r)` — on every row, `onSaved={()=>load()}` so the screen re-reads the platform.

## 🔴 A Meta campaign keeps its budget in one of two places

- Campaigns **the OS builds** (`createCampaign`) carry `daily_budget` on the **campaign** (CBO). `setBudget` covers those.
- Campaigns **built by hand in Meta Ads Manager** usually carry it on the **ad set** (ABO). The campaign then truthfully reports **no daily budget at all**, so the OS showed nothing to change, and a campaign-level write would not have been where the money is.

So when a Meta campaign reports no budget of its own, the editor calls `campaignDetail`, finds the ad sets that DO carry a daily budget, names each one on screen, and writes with the new **`action:"setAdSetBudget"` ({adSetId, dailyBudgetDollars})**. A campaign on a **lifetime (total) budget** gets a plain sentence saying so and no input, because there is no safe daily edit for it.

## Guards (all exercised by the suite)

| Guard | Why |
|---|---|
| `after > 0`, numeric | blank/zero/rubbish never reaches a platform |
| ceiling at `$100,000/day` | an absurd number is refused here, not sent |
| **confirm on a 3x jump** | $70/day typed as $700/day is the whole month in three days |
| **confirm on ≥$100/day when the OS knew of no budget** | 🔴 a multiplier rule cannot fire against zero, so the one case with nothing to compare against is the one that would sail through |
| confirm text names the **monthly** cost and **whose** account | "$21,000 a month on Shaun's Roofing's real ad account" |
| Google budget id looked up live when absent | the hourly snapshot stores no `budgetResourceName`, so needing one would work on the Campaigns screen and fail on My Ads |
| campaign missing from the account → named error, no write | a deleted/renamed campaign says so |
| platform refusal shown, never reported as saved | Meta rejects budgets under its minimum |

## The stale-number trap

My Ads rows come from the **stored hourly snapshot** (`adPerf`), not a live read. Without an override the number he just changed would keep reading as the old one for up to an hour and the save would look like it did nothing. So `LiveAdPerformanceCard` holds a `budgets` map keyed `"<platform>-<id>"`, and **both** the focused campaign and the row list read the overridden copy (`camps`) — fixing one and not the other would leave the number disagreeing with itself on the same screen.

## The suite — `tests/verify-budget-editing.mjs`

It **compiles `DailyBudgetEditor` out of index.html with `@babel/standalone` and runs it** against a hook harness (a `useState` backed by an array, plus a re-render driver), a `React.createElement` that records a tree instead of drawing one, and fake `metaCall`/`gadsCall`/`window.confirm` that record every call. Buttons are found by their visible text and pressed. That is what makes it possible to assert the thing that actually matters: that a press reaches the platform, **with the right id**, and that a typo is stopped on the way.

18 checks. Mutations verified caught, including: the ad-set write aimed at the campaign id, the cold-start confirm removed, the zero check removed, the ceiling removed, declining the confirm still writing, the Google budget id guessed instead of looked up, either render site wired shut, `onSaved` dropped, both stale-list regressions, and the server route or its input check removed.

## Files
- `index.html` — `DailyBudgetEditor`; rendered in `LiveAdPerformanceCard` and `CampaignManagerScreen`; `budgets`/`camps` override.
- `netlify/functions/meta-ads.mjs` — `setAdSetBudget()` + `action:"setAdSetBudget"` route + header docs.
- `tests/verify-budget-editing.mjs` — new.
- `tests/verify-campaign-breakdown.mjs`, `tests/verify-campaign-detail.mjs` — updated pins (both had pinned a spelling that moved; both now assert the rule).

## Still true / not built
- `LiveCampaignsCard` keeps its own budget+end-date editor. It is the only remaining second copy of a budget write in the UI; if it is ever touched again, replace its budget half with this component.
- **Google budgets are shared objects in principle.** Everything the OS builds gets one budget per campaign, so editing one campaign's budget affects only it. A budget shared across campaigns in Google Ads would change all of them, and nothing warns about that.
