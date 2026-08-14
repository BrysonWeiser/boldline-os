---
name: house-health-score
topic: OS app
task: how BoldLine's own ad account is scored, and why it is not the client formula
keywords: [health score, house account, my ads, calcHouseHealth, houseHealthFactors, ad health, internal client health, adPerf shape, ads-sync snapshot]
status: verified
summary: The client health formula scores a RELATIONSHIP (contract signed, contract active, runway to contract end), none of which exists on the house account — so it forfeited 2 points permanently, was hard-capped at 6.6/10 with perfect ads, and 2 of the points it did earn were free because `contractSigned`/`intakeComplete` are hardcoded true. Added `calcHouseHealth`: seven observable factors summing to exactly 10, each carrying the reason it scored what it did, shown in an "Ad Health Score" card. Client scoring is untouched. Also fixed a real bug found while building it — `deriveBotStatuses` read an `adPerf.campaigns` ARRAY that ads-sync never writes. 34 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"make sure to build a health score rating that works for my own ads (leave the client ones alone they work good now)."*

**The problem, measured rather than asserted.** The client formula scores a relationship: contract signed, intake returned, contract status `active`, 30+ days of runway. The house record has `contractStatus: "internal"` (not `"active"`) and `contractEnd: ""` (so `daysUntil` is `NaN`), which **forfeits 2 points permanently**. Running the shipped formula against the real record:

| House account | Score |
|---|---|
| As it sits today | **4.1 / 10** |
| With ads running perfectly | **6.6 / 10** (hard ceiling) |

Worse, 2 of the points it *did* earn were free: `contractSigned` and `intakeComplete` are **hardcoded `true`** in `makeInternalClient()`, so they were never evidence of anything.

**THE FIX: `calcHouseHealth`, seven observable factors summing to exactly 10.** No contract terms, because there is no counterparty. Every factor is a fact the OS can read, and every one carries a written reason, the same visible-factor approach as Lead Scout.

| Factor | Max | Scoring |
|---|---|---|
| Ad accounts linked | 1.0 | proportional to the platforms actually being run |
| Conversion tracking proven | 1.5 | 1.5 with conversions, 0.5 linked but none yet |
| Campaign live | 2.0 | 2.0 live, 1.0 built-but-paused |
| Monthly budget set | 1.0 | binary |
| Spending within budget | 1.5 | 1.5 ok, 0.75 warn, **0 over** |
| Leads arriving | 2.0 | 1.0 / 1.5 / 2.0 at >0, >5, >15 |
| Landing page published | 1.0 | 1.0 published, 0.5 drafted |

**"Ad accounts linked" is proportional on purpose** — running Google + Meta and linking only one is genuinely half done, and a flat "linked: yes" would have hidden that.

**Pacing reads `adPerf.budget.state` from ads-sync**, so over-budget scores **zero** and the reason says "Pacing at 180% of budget". A health score that stayed green while the account overspent would be worse than no score.

**Routing:** `calcHealth` returns `calcHouseHealth(cl)` for `cl.internal` and is otherwise byte-identical for clients. The server's `calcHealth` needs **no** house branch — `isReportable` excludes internal accounts, and `alerts-watch.evalConditions` returns `{}` for them, so a server-side health call never sees the house record. Verified in the tests rather than assumed.

**UI:** the existing health card was gated `!client.internal`, so the house account showed none at all. It now gets an **"Ad Health Score"** card listing each factor with its points, its max, and its reason.

**🔴 REAL BUG FOUND WHILE BUILDING THIS — the pipeline derivation read a shape that does not exist.** `deriveBotStatuses` (shipped an hour earlier) did `Array.isArray(perf.campaigns)` and `perf.spend30`. **`ads-sync` writes neither.** It writes COUNTS: `adPerf.google.campaigns` / `.live` (numbers), `adPerf.meta.*`, a rolled-up `adPerf.totals.{liveCampaigns, spend30d, conversions}`, and `adPerf.budget.{monthly, pacing, pct, state}`. So against real data `camps` was always `[]` and every campaign-driven step — keywords, ads, qc, tracking-done, search terms, performance, budget-active — **would have sat at its lowest state forever, silently.** Fixed in both mirrored copies. The lesson: the fixtures were invented from the field names I expected rather than read out of the writer, so 71 tests passed against a shape production never produces. **When testing against another job's output, build the fixture from that job's source.**

**Verified by 34 cases**, including the real ads-sync snapshot shape driving every campaign-derived step correctly, built-vs-paused, the old array shape being gone from both copies, the factors summing exactly to the score and the maxima summing to exactly 10, no factor exceeding its max, each factor moving for the right reason (half-linked, unconverted, paused, over-budget, warn-budget, the three lead tiers, drafted page), the 1-10 clamp, `calcHealth` routing internal records to the house formula while a real client still matches the server formula exactly, and the server formula having no internal branch. All prior suites re-run green after the fixture correction: health 28, shared 25, pipeline 71, house 32, budget 36, copy 26, geo 24.
