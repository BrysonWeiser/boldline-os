---
name: meta-account-health
topic: Ads/Meta
task: work out why a Meta campaign that says RUNNING has stopped spending, and see it in the OS
keywords: [ad stopped spending, running but no spend, spend cap, spending limit, account_status, disable_reason, amount_spent, accountHealth, accountTrouble, meta account disabled, card declined, ads not delivering, numbers frozen]
status: verified
summary: Every Meta fact the OS held was per campaign, and every one of them can read perfectly healthy while the ACCOUNT underneath refuses to spend another penny. Meta does not mark the campaign broken when that happens, it just stops delivering, so the screen says Running and the numbers freeze with nothing anywhere to explain it. New `getAccountHealth` reads the account's own state (spend cap, amount spent, balance, funding, status), the hourly sync stores it, and the card says in plain words what has stopped it and where to fix it. 🔴 Meta reports money in CENTS, so a $10 cap arrives as "1000" and reading it as dollars is a hundredfold error that would silence the warning entirely. 12 checks, nine mutations caught, verified in a browser.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04):** a campaign marked **RUNNING**, $9.05 spent, not a cent more for seven hours, on a **$14 a day** budget. *"why has the ad not been doing anything for the past few hours"*.

## 🔴 The campaign was not the problem, and the campaign was all we were looking at

Status, effective status, spend, budget: every Meta fact the OS held was per campaign. All of them can be perfectly healthy while the **account** underneath has stopped paying for anything, and **Meta does not mark the campaign as broken when that happens**. It just quietly stops delivering.

The account-level killers, in the order they actually happen to a small advertiser:

- **A lifetime spending limit reached.** The moment `amount_spent` hits `spend_cap`, **every campaign on the account stops**. A cap somebody set at $10 while testing, against $9.05 spent, is the single most common version of this and nothing about it looks like an error.
- **The card.** Declined, expired or removed. The campaign stays "active" and simply does not serve.
- **The account itself** disabled, unsettled, in a grace period or under risk review.

None of these are visible from a campaign read, which is exactly why the OS had no answer.

## What was built

`getAccountHealth(adAccountId)` in `meta-ads.mjs` (+ `action: "accountHealth"`) reads `account_status`, `disable_reason`, `spend_cap`, `amount_spent`, `balance`, `currency` and the funding source. `ads-sync` calls it alongside the campaigns and stores the trimmed result at `adPerf.meta.account`.

`netlify/lib/meta-account-health.mjs` (plus an inlined browser copy, kept in step by a test that extracts and runs both) turns it into one sentence, or nothing at all.

### Choices worth keeping

- 🔴 **Meta reports money in the account's smallest unit.** A $10 cap comes back as `"1000"`. Reading that as dollars is a hundredfold error, and it would mean the warning literally never fires. Pinned with his exact numbers.
- 🔴 **A zero cap means NO cap on Meta**, not a cap of nothing. Treating it as reached would cry wolf on every healthy account.
- 🔴 **It warns at 90% as well as at the wall**, because after the wall the ads are already off.
- 🔴 **An account status Meta invents later is flagged, not assumed healthy.** The optimistic guess is the one that keeps him in the dark.
- **Nothing to say returns null**, which stays distinct from "we did not look".
- **The read is best effort inside its own try/catch.** This is a diagnosis: losing it must never cost us the numbers themselves.

## On screen
A red panel when delivery is blocked, amber when it is close, naming the limit, the amount spent, and where to change it (Meta Ads Manager, Billing, Payment settings). Verified in a browser at 390 and 1280 with an account fixture at exactly his numbers.

## What Bryson should check first when this happens again
1. **Meta Ads Manager, Billing, Payment settings, account spending limit.** This is the one nobody remembers setting.
2. The payment method itself.
3. The ad set's own end date, which is separate from all of the above and stops one campaign rather than the account.
