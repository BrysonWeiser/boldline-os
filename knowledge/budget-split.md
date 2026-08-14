---
name: budget-split
topic: Ads
task: how one monthly ad budget becomes the daily budget on each platform
keywords: [budget split, monthly budget, daily budget, dailyFromMonthly, platformCount, platShare, adPlatformsOf, double spend, Google and Meta both running, burn through budget twice as fast]
status: verified
summary: A monthly ad budget is the TOTAL across every platform, so it is now divided by how many platforms are actually running before it fills a daily-budget field. Before this both launch cards independently derived the FULL monthly figure — $200/mo showed $7/day on Google AND $7/day on Meta, which spends $400/mo and burns the budget in half a month. Caught by Bryson 2026-08-14. Fixed with a `platformCount` prop threaded from the Campaigns tab (the same place that decides which cards render, so the split can never disagree with the cards on screen), plus corrected copy on the setup card, which had literally been instructing him to type the total into each campaign. 36 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"make sure it evenly distributes between google and meta ads if I am running both. I noticed it still $7/day for both ads which would burn through the monthly ad spend twice as quick."* Correct on every count.

**The bug.** `dailyFromMonthly(m)` returned `Math.round(m / 30.4)` — a per-platform daily figure computed from the *total* monthly budget. `GoogleLaunchCard` and `MetaLaunchCard` each called it independently, so with both platforms running, a $200/mo budget produced **$7/day on Google and $7/day on Meta = ~$425/mo**, a little over double. Nothing warned; both cards looked individually correct.

**The copy made it worse, not better.** `MyAdsSetupCards` displayed a single "≈ $7/day" and told him in as many words: *"When you build a campaign below, enter the daily figure shown here."* Following the OS's own instruction was what produced the double spend. That sentence is gone — the card now says the launch cards fill their own daily budgets and split the total evenly, so there is no maths to do by hand.

**THE FIX.** `dailyFromMonthly(m, platforms)` takes a platform count and divides by it (`Math.max(1, …)`, so a missing/zero/undefined count degrades to single-platform behaviour rather than dividing by zero or inflating). The count is threaded in as a **`platformCount` prop from the Campaigns tab** — deliberately from the exact expression that already decides which launch cards to render (`runsGoogle`/`runsMeta`), so **the split can never disagree with the number of cards on screen**. A new shared `adPlatformsOf(client, pkg)` mirrors that same detection for `MyAdsSetupCards`, which has no access to those locals.

| $200/mo | Before | After |
|---|---|---|
| Google only | $7/day | $7/day |
| Meta only | $7/day | $7/day |
| **Both** | **$7/day each → ~$425/mo** | **$3/day each → ~$182/mo** |

**Manual overrides still stick** — typing a number sets `budgetTouched` and the auto-fill stops, exactly as before; the hint just now reads "overriding **your half of** $200/mo" when two platforms are running, with the same inline reset link.

**Rounding, stated honestly:** daily budgets are whole dollars, so a rounded daily figure can overshoot by up to **half a dollar per day per platform (~$15/mo each)**. $200/mo on one platform projects to $212.80, not $200. That is inherent to whole-dollar dailies and is **left as-is deliberately** — Bryson specified "$200/mo → $7/day" himself when he asked for budget linking, and rounding down to $6 would contradict the number he asked for. The test asserts the true bound (`budget + 30.4 × 0.5 × platforms`) rather than a fake tolerance, so a genuine budgeting regression still fails while rounding does not.

**Verified by 36 cases** that extract the REAL helpers out of `index.html` and execute them (not a copy that could drift): the exact $200 case, projected monthly burn inside the rounding bound at $200/$500/$1000/$2500/$3000 on one and two platforms, two platforms never projecting higher than one, zero/undefined/missing share degrading safely, platform detection for the house account (including "Facebook & Instagram" wording) and for client packages, both cards accepting and using `platformCount`, no caller left passing a single argument, and all three pieces of corrected copy present. `index.html` also parse-checked through Babel — a syntax error there takes down the whole OS.

**Not changed, on purpose:** `ads-sync` and `ads-autopilot` still pace the **account total** against the monthly budget. That is correct — the budget is a total, and those jobs watch total spend across both platforms. Only the per-platform *daily fill* needed dividing.
