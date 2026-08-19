---
name: meta-creative-testing
topic: Ads
task: understand or change how Meta ads are automatically improved, or work out why autopilot did or did not write a Meta challenger
keywords: [meta creative testing, meta split test, challenger ad, judgeSplit, META_SPLIT_MIN_IMPRESSIONS, META_SPLIT_MIN_CLICKS_EACH, META_SPLIT_MIN_LIFT, META_SPLIT_COOLDOWN_HOURS, META-TIER-GATE, addAdToAdset, getAdsForCampaign, setAdStatus, adset, image hash, development tier, budget neutral]
status: verified
summary: BUILT 2026-08-19. Autopilot now improves Meta ads on its own, mirroring the Google split-test path one level down (ads inside an AD SET rather than an ad group). It writes ONE challenger creative into a live ad set, then pauses the loser once both have had a fair run. Budget-neutral by construction — budget lives on the campaign/ad set, never on the ad — so the founding invariant holds. The image is held constant so a win means something. GATED to BoldLine-owned accounts while Meta is on Development tier; one named condition to delete at approval. 74 checks, five deliberate breaks confirmed to fail.
verified: 2026-08-19
---

**Bryson, 2026-08-19:** *"I want it to automatically improve the meta ad."*

Before this, Meta got the safety net (overspend trip, dead-spend trip) but nothing that
made the ad better. Creative testing was Google-only.

## 🔴 Why this is allowed to write to a live ad account

Autopilot's founding invariant is **"may always spend LESS, may NEVER spend more without
asking."** Adding an ad looks like it breaks that and does not, for one specific reason:

> **Budget lives on the CAMPAIGN (CBO) or the AD SET. Never on the ad.**

A second creative inside an existing, already-spending ad set changes **which creative the
same money buys**. It cannot raise the bill by a cent. That is the identical argument the
Google path makes about ad groups, and it is the only reason either is permitted.

It creates no campaign, creates no ad set, enables nothing that was paused, and touches no
budget field. `tests/verify-meta-creative-testing.mjs` asserts all of that off the SOURCE
of the block, so it is about what the code *can* do, not what one input makes it do.

## How it works

Per client, per run (every 2 hours), for each live Meta campaign:

1. Read the ads and their **ad-level** 30-day insights, group them **by ad set** — a test
   is between ads competing for the same money.
2. **One ad running + enough impressions** → write a challenger.
3. **Two ads running + both past the click floor** → pause the loser, if the lift is
   decisive.

## The numbers, and why they differ from Google

| | Google | Meta | Why |
|---|---|---|---|
| Impressions before testing | 500 | **1,000** | Meta front-loads whichever ad it predicts will win, so early numbers are its guess as much as the copy |
| Clicks each before judging | 30 | **50** | same reason |
| Lift needed to call it | 25% | **30%** | a smaller gap is Meta's delivery talking, not the creative |
| Cooldown | 168h | **168h** | one action per ad set per week |
| Max ads per group/set | 2 | **2** | one challenger at a time, never a pile |

## 🔴 The image is held constant

The challenger reuses the champion's `image_hash`. If the copy **and** the picture change
together, a win teaches nothing about which change won. The prompt is told the picture is
not changing, so the copy has to carry the difference.

## The judging maths lives in ONE place

`judgeSplit(ads, { minClicks, minLift, convKey })` is **exported** from
`ads-autopilot.mjs` and used by both platforms — Google passes `convKey: "conversions"`,
Meta passes `"leads"`. Extracted specifically so the test exercises the real function
rather than a copy that could drift and pass while production was wrong.

**The rule that matters most:** conversion rate decides whenever conversions exist;
click-through only when there are none. Judging on clicks while leads exist optimises for
traffic, *which is how you win a test and lose the money*. Asserted directly: a click-bait
ad with 300 clicks and 0 leads must never beat one with 60 clicks and 12 leads.

Every exit returns `null` and pauses nothing — fewer than two judged ads, a lift inside the
noise, or winner and loser being the same ad. Not enough evidence is a **refusal**, not a
coin flip.

## 🔴 THE TIER GATE — one line to delete at approval

Meta has BoldLine on **Development tier**: API writes are permitted only to ad accounts
BoldLine itself owns. Running this against a client account today would not just fail, it
would fail **every two hours forever** and raise a failure alert each time.

So the block is gated to the house account. Find **`META-TIER-GATE`** in
`ads-autopilot.mjs` and delete the `cl.internal` condition on that line. Nothing else
changes and it covers every client. (KB `meta-parked-work`, `meta-marketing-api`.)

## An ad built by hand is skipped, not guessed

A champion created in Ads Manager may carry no page id, link, or image hash. Guessing any
of them would post an ad pointing somewhere nobody chose, so the ad set is skipped instead.

## New in `meta-ads.mjs`

| Export | What it does |
|---|---|
| `getAdsForCampaign(adAccountId, campaignId)` | ads + ad-level 30-day insights, merged by ad id. Reads the creative defensively: a hand-built ad missing any level must not throw. |
| `addAdToAdset(adAccountId, {...})` | creative + ad into an **existing** ad set. Refuses without `adsetId`, `pageId`, `linkUrl`, `headline` or `imageHash` (Meta rejects an imageless link ad, and failing early beats a 400 three calls in). |
| `setAdStatus(adId, status)` | pause/resume ONE ad. ACTIVE or PAUSED only. |

## 🟡 The test hole that nearly shipped

The first version of the tier-gate assertion was `/cl\.internal/.test(metaBlock)` — which
matched `systemFor(!!cl.internal)` inside the prompt call, so **it passed with the gate
deleted**. A test that could not fail, guarding the one thing that would have Meta
rejecting writes on a schedule. Caught only by deliberately breaking it. It now pins the
whole gate condition.

**Lesson, again:** assert the invariant, not a string that happens to appear near it.

## Related

`ads-autopilot` (the safety rules and the invariant), `local-conditions` (the challenger is
written against live weather), `meta-parked-work`, `meta-marketing-api`, `ad-copy-voice`
(em dashes are stripped by `cleanMeta`, not merely asked for).
