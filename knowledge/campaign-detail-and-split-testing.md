---
name: campaign-detail-and-split-testing
topic: Ads
task: inspect and edit the inside of a Google campaign, and let autopilot run split tests unattended
keywords: [campaign detail, ad groups, keywords, ad group ad, split test, A/B, challenger ad, ads-autopilot, setAdGroupStatus, setAdStatus, removeKeywords, addKeywords, addResponsiveSearchAd, campaignDetail]
status: verified
summary: Two features. (1) Any Google campaign in the Campaigns screen now expands to show its ad groups, each with its ads (headlines + per-ad metrics) and keywords, with pause/start/delete on the ad group and the ad, remove on any keyword, and inline keyword adding with a per-add match type. (2) `ads-autopilot` now runs SPLIT TESTS unattended: it writes an AI challenger ad into a live ad group that has one ad and enough traffic, then pauses the loser once both ads clear a click floor and the winner shows real lift. Both stay inside the founding invariant, because budget lives on the CAMPAIGN and a second ad inside an ad group cannot raise spend. 45 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"I need a way to be able to go into each of them and view/edit/delete specific ones… I also want to make sure that the ai bots automatically handle updating the live campaigns and testing them (the split testing). I dont want to manually have to do it."*

## 1. Campaign detail

`getCampaignDetail(token, customerId, campaignId)` returns ad groups, each with its ads and its keywords.

**Structure and metrics are fetched as SEPARATE queries, deliberately.** A metrics query carries a date range, and a brand-new or long-paused ad group has no rows inside it — so asking for both at once **silently hides exactly the ad groups you most want to see after a build**. Six queries run in parallel: structure and metrics for ad groups, ads and keywords, merged by id with zeroed metrics as the fallback. The test proves a PAUSED ad group with no metrics rows still appears.

**Writes, all guarded:**
| Action | Notes |
|---|---|
| `setAdGroupStatus` | ENABLED / PAUSED / **REMOVED** |
| `setAdStatus` | REMOVED uses a **remove op**, not a status update — Google models them differently |
| `removeKeywords` | batched into one mutate |
| `addKeywords` | lowercased, match type normalised, bare strings default to PHRASE |
| `addResponsiveSearchAd` | the split-test primitive; validates 3+ headlines, 2+ descriptions, lengths, finalUrl |

**REMOVED is permanent in Google Ads and PAUSED is not**, so every delete path says which one it is doing and the UI spells it out before asking.

**UI:** an **▸ Inside** button on Google rows (Meta has no equivalent read here). Detail loads **on demand** — six GAQL queries per campaign is not something to run for every row on screen. **Every piece-level write re-reads the campaign afterwards**, so the screen shows what Google actually has rather than what the click hoped for. Starting an ad group is confirmed (it begins spending); pausing is not (it only ever spends less).

## 2. Autonomous split testing

**THE INVARIANT HOLDS, and this is the whole reason the feature is allowed.** `ads-autopilot`'s founding rule is *"may always spend LESS without asking, may NEVER spend more without asking."* Creating things sounds like a violation. It is not, because **budget lives on the CAMPAIGN**: a second ad inside an existing ad group changes *which creative the same money buys*. It cannot raise the bill. The split phase provably never calls `setBudget`, never creates a campaign or an ad group, and **sets exactly one thing to ENABLED — the challenger it just wrote** (asserted by counting status *writes*, not string literals; a first version of that test counted `=== "ENABLED"` comparisons too and failed wrongly).

**Two halves, both bounded:**
- **Write a challenger** into a live ad group that has exactly ONE running ad and ≥500 impressions. The prompt is given the champion's headlines and told to take a genuinely different angle, because a reworded version of the same idea teaches nothing and wastes the test.
- **Declare a winner** once both ads clear 30 clicks each and the winner beats the loser by ≥25%. **Conversion rate decides when conversions exist; CTR only when they do not** — judging on CTR while conversions exist optimises for clicks, which is how you win a test and lose the money. The loser is **PAUSED, never removed**, so it can be revived.

**Guards:** one split action per ad group per **week**, max 2 ads per group, the existing 4-action blast cap, and per-client opt-out (`autopilot.splitTest === false`). Owner alerts distinguish SPLIT TEST STARTED / DECIDED from PAUSED, and a split-only run is severity **blue**, not red — it is information, not an emergency.

**Verified by 45 cases:** the six-query split with a paused group surviving, metric merging, micros conversion, ads and keywords attaching to the right group, positives separated from negatives, remove-vs-update op shapes, keyword normalisation, challenger validation, and every clause of the invariant read out of the shipped source.

**NOT built:** Meta creative split testing (Meta's structure is ad sets, a different job), ad-group-level negatives in the UI, and bid adjustments. Autopilot still never raises a budget or starts a paused campaign — those remain approvals, by design.
