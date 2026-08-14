---
name: house-account-full-services
topic: OS app
task: why the internal My Ads account carries every service and shows a client-style pipeline
keywords: [house account, my ads, internal client, bl-house, HOUSE_PKG, full services, pipeline tab, bot statuses, stage, c-growth, package features, dogfooding]
status: verified
summary: The internal My Ads account used to sit on the sellable "c-growth" tier (18 of 32 features) with its Pipeline tab, Status section and stage chip hidden as "client-only". Bryson 2026-08-14 wanted both changed — he wants to watch his own campaign move through the same build stages a client does, and expects the house account to always carry the full service stack. Added a non-sellable `bl-house` package whose feature list is the UNION of every tier (so a new feature anywhere is granted automatically), unhid Pipeline + Status, and migrated the existing record in place on load so no linked ad accounts or media are lost. 32 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"for my ads campaign I want to see just like how for clients do their status in the pipeline (building, researching, etc.) I also expect I will always receive the full services the company offers."*

**What was wrong, part 1 — the house account was on a SELLABLE tier.** `makeInternalClient()` hard-coded `packageId: "c-growth"` with the comment "combined → both Google + Meta launch cards". That got the launch cards rendering, which was the only goal at the time, but it also meant BoldLine's own account was capped at a mid tier: **18 of the 32 features that exist**, with `splitTesting` and `multiCampaign` off.

**THE FIX: a package that is not for sale.** `HOUSE_PKG` (`bl-house`) carries every capability flag `true` and a feature list built as the **union of every other tier**:
```js
PKG_FEATURES[HOUSE_PKG_ID] = [...new Set(Object.values(PKG_FEATURES).flat())];
```
Written as a union rather than a hand-typed list **on purpose** — adding a feature to any package anywhere grants it to the house account automatically, with nothing to remember and no way for it to silently fall behind. That is what "I will ALWAYS receive the full services" has to mean in code.

**Gained on migration (14 features):** `std_landing`, `monthly_opt`, `split_testing`, `multi_campaign`, `scaling_roadmap`, `priority_comms`, `full_funnel`, `google_shopping`, `abandoned_cart`, `ugc_consulting`, `crm_input`, `page_cro`, `strategy_calls`, `slack_access`. **18 → 32.**

**Deliberately NOT in `PACKAGES_DB`.** `ALL_PKGS` is derived from it and drives every package picker, the marketing site's tables and the upgrade list, so putting the house package there would have leaked an internal $0 "Full System" tier into places clients see. `findPkg` resolves it separately instead, and `getUpgradeOptions` returns `[]` for it (it is already on everything, and there is nobody to sell to). Priced at `$0` with `leadFee: false` so it can never be counted as revenue.

**What was wrong, part 2 — the pipeline was hidden.** Three separate filters treated the whole delivery view as client-only:
| Where | Was hidden | Now |
|---|---|---|
| Detail tabs | `contract`, **`pipeline`**, `emails`, `log` | `contract`, `emails`, `log` |
| Edit sheet sections | **`status`**, **`bots`** | none |
| Header chip | `"Internal — house account"` replaced the stage | `House account` chip **+** the real stage chip |

Contract, Emails and Log stay hidden because they need a counterparty — there is no contract with himself and nobody to log comms with. Pipeline and Status are about the WORK, which applies identically to his own ads.

**The existing record is migrated in place, not recreated.** The house account already carries the linked Google Ads customer ID, the Meta ad account, the media library and the saved content ideas, so a "delete and recreate" would have cost real state. `ensureTokens()` (the existing on-load backfill) now also detects `c.internal && c.packageId !== HOUSE_PKG_ID`, rewrites the package, and **seeds statuses for the newly-granted bots** so the Pipeline tab shows the full stack instead of blank rows — spreading `...(c.botStatuses || {})` LAST so any status already set wins over the seed. The `needsHousePkg` check is part of the early-return condition, not just the body, or the short-circuit would have skipped the migration entirely on a record that was otherwise complete.

**Verified by 32 cases** with the package tables and helpers extracted from `index.html` and executed: the house list contains every feature any tier offers and is longer than the top sellable tier, no duplicates, all seven capability flags on, both platforms, weekly optimisation, the upgrade genuinely gains services, the package is absent from `PACKAGES_DB` and `ALL_PKGS` but still resolves through `findPkg` while real ids and unknown ids behave unchanged, no upgrades are offered for it, it is free and fee-less, `pkgHasFeature` works against it, all three UI filters are correctly changed, and the migration is wired into the load path preserving existing statuses. Plus a Babel parse-check of the app.
