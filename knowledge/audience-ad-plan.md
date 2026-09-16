---
name: audience-ad-plan
topic: Ads
task: build a whole campaign for one of BoldLine's own audiences, or change how hard a push level pushes
keywords: [push level, audience ad plan, test the waters, standard, go hard, split test, ab test, a/b, multiple ad groups, extraAds, AudienceAdPlanCard, adPlan, PUSH_LEVELS, VERDICT_CLICKS, too thin, cost per click, my own ads, package tier for my ads]
status: verified
summary: One control per audience instead of a package tier — Test the waters / Standard / Go hard — that writes the ads, points them at that audience's live page, sets the budget and builds the whole campaign PAUSED for approval. On Google the level sets how many ad groups; on Meta it sets how many versions of the ad go in the one ad set, so the split test runs from the first impression instead of a thousand impressions later. Shows how many days until a winner can be called, using autopilot's own click thresholds, and says plainly when a plan is too thin to learn anything. Client detail > Assets > Build Ads For An Audience, on the My Ads account.
verified: 2026-09-15
---

**Bryson, 2026-09-15:** *"what if I want to build an ad with multiple ad groups and have it do
a/b split testing and the full works ... maybe having it so I can select each package tier like
how I do for clients except it's for my own ads. Again I'm open to ideas and criticism."*

## 🔴 Why the package tier was the wrong dial

Worth writing down, because it will come up again. **A client's tier is decided BY their ad
budget, and what it controls is what they PAY** — the monthly minimum and how the per-lead fee
works (see KB `pricing-model`). Picking a tier for his own ads is picking a budget with extra
steps, and it drags pricing language into a screen that has nothing to sell.

The question he actually wants to answer is **how hard to push one audience**, which is a
different question. So: three push levels, and the only thing they change is how many buckets
the same money is split into.

## 🔴 The two platforms deliberately do NOT get the same treatment

A **Google responsive search ad tests its own headlines and descriptions against each other,
continuously**. That IS the split test, run by Google at the asset level. Splitting the
generator's 15 headlines across two weaker ads would make it worse. So on Google the level sets
**how many ad groups (themes)** get built: 1 / 3 / 5.

A **Meta ad does no such thing** — one ad is one fixed piece of copy. So there the level sets
**how many versions of the copy sit in the one ad set**: 2 / 3 / 4.

Forcing them to look the same would have meant shipping something worse on one of them.

## The Meta gap this closes

`ads-autopilot` already writes a challenger into a running Meta ad set and pauses the loser, but
only **after that ad set has served about a thousand impressions** — until then there is nothing
to challenge. A campaign built with one ad spends every one of those impressions learning
nothing about which message works. `createCampaign` now takes **`extraAds`** and builds them
into the **same ad set**, PAUSED, **reusing the same image hash**, so the test is running from
the first impression.

Three invariants, all pinned by tests:
- **Same ad set.** Budget lives on the campaign and the ad set, never on an ad, so extra ads
  divide the money rather than adding to it. A second ad set would double the spend.
- **Same picture, different words.** Change both at once and a winner tells you nothing about
  either. Autopilot holds the image constant for the same reason.
- **Best effort.** By the time the extras run, the campaign, its ad set and one complete ad
  already exist. Throwing would report "launch failed" for a campaign sitting fully built in
  the account, and he would build it twice. A campaign with one ad is the old behaviour, not a
  broken one.

## 🔴 The honest warning, and why it is built on autopilot's numbers

The card says, before anything is built, **how many days until a winner can be called**:

> *"This splits your money 3 ways. At $8 a click it takes about 44 days before there is enough
> traffic to tell which version is winning. That is on the slow side. Dropping to Test the
> waters would get you an answer sooner."*

The click counts it quotes (**30 on Google, 50 on Meta, per ad**) are lifted from
`SPLIT_MIN_CLICKS_EACH` and `META_SPLIT_MIN_CLICKS_EACH` in `ads-autopilot.mjs`, and a test
**reads that file and compares**. If they ever drift, the screen promises a verdict the system
will never give, which is worse than showing no estimate at all.

Cost per click uses **his own 30-day average** from `adPerf` when the account has at least 20
clicks, otherwise a deliberately un-optimistic assumption ($8 Google, $1.50 Meta — BoldLine bids
on ad-management keywords, which are expensive). Editable either way. Under 20 clicks it refuses
to average: a wrong number anchored on screen is worse than an honest assumption.

**It is allowed to say no to everything.** At $400/mo against $8 clicks the account buys about
fifty clicks a month, and no arrangement of them produces a verdict — every level reads as
too thin, and a test pins that. Softening it there to look less discouraging would be lying at
exactly the moment it matters most.

## Guards on the build itself

Every refusal sends **nothing**: no budget, no linked account, no target location (without one
Google shows the ads in every country on earth), no picture for Meta, and no live audience page.

🔴 **The live-page rule is checked TWICE** — the dropdown only offers live pages, and `build()`
re-checks at spend time. The second is not redundant: only it survives a page switched off after
it was picked, and a test constructs exactly that, because **two guards that can only ever be
tested together are one guard with a spare**.

## Testing notes worth keeping

`tests/verify-audience-ad-plan.mjs` — 74 checks, **11/11 mutations caught**.

🔴 **The harness re-implemented the card's own filter and stopped testing it.** Deleting the
card's live-only filter changed nothing, because the test was doing its own filtering. Fixed by
running the card's actual line. Same lesson as `verify-app-boots`: a harness that supplies what
the real page does not is a second implementation that happens to agree.

🔴 **A mutation caught a wrong EXPECTATION, not a wrong fix.** The first version asserted that
$400/mo on the lightest level was fine. It is not, and the code was right — 37 days. The test
was rewritten around a budget where the levels genuinely differ, and the $400 case became its
own assertion.
