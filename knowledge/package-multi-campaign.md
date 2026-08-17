---
name: package-multi-campaign
topic: Packages/Sales
task: answer a prospect asking whether their package can run multiple campaigns (one per service), or check which tiers include multi-campaign and split testing
keywords: [multi_campaign, multiCampaign, Multi-Campaign Strategy, split_testing, splitTesting, g-acquisition, m-acquisition, e-domination, c-growth, g-launch, ad group vs campaign, separate budget per service, Stencil & Thread, PACKAGES_DB, PKG_FEATURES, getUpgradeOptions, UPGRADE_FAMILIES, verify-packages]
status: verified
summary: Multi-campaign is the TOP RUNG of each ladder — g-acquisition $900, m-acquisition $850, c-growth $1,000, e-domination $1,200. Launch and Growth tiers are single-campaign, so the answer for a g-launch prospect is still no. BUT what a prospect usually wants is a service-specific ad for a service-specific search, which is AD GROUPS, and every tier already gets 3-5; separate campaigns only buy per-service budget/geo/schedule/bidding, and splitting Launch-tier spend makes results worse. Fixed three catalog inconsistencies + an upgrade ladder that offered lead-gen clients an e-commerce package. Guarded by 366 committed assertions in tests/verify-packages.mjs.
verified: 2026-08-17
---

**Asked on a live sales call (Bryson, 2026-08-15, prospect Stencil & Thread starting on `g-launch`):**
*"with that package could we run multiple different campaigns — a campaign for one service and a
campaign for another service they offer"* (explicitly NOT A/B split testing).

## Which tiers include multi-campaign (AFTER the 2026-08-17 fix)

The rule is now clean and easy to say on a call: **multi-campaign is the top rung of each ladder.**

| Package | Price | multiCampaign | splitTesting |
|---|---|---|---|
| `g-launch` Launch System | $400/mo | ✕ | ✕ |
| `g-growth` Growth System | $600/mo | ✕ | ✕ |
| **`g-acquisition` Acquisition System** | **$900/mo** | **✓** | ✓ |
| `m-launch` Launch System | $350/mo | ✕ | ✕ |
| `m-growth` Growth System | $550/mo | ✕ | ✓ |
| **`m-acquisition` Acquisition System** | **$850/mo** | **✓** | ✓ |
| `c-launch` Full System — Launch | $650/mo | ✕ | ✕ |
| **`c-growth` Full System — Growth** | **$1,000/mo** | **✓ (was ✕)** | **✓ (was ✕)** |
| `e-launch` Store Launch | $450/mo | ✕ | ✕ |
| `e-growth` Store Growth | $750/mo | ✕ | ✓ |
| **`e-domination` Store Domination** | **$1,200/mo** | **✓** | ✓ |

**The answer for Stencil & Thread did not change:** `g-launch` is single-campaign.

## The reframe that actually answers the prospect (use this on calls)

The question sounds like it needs multiple campaigns. It usually does not.

- **What they want:** someone searching service A sees an ad about service A.
- **What delivers that:** **ad groups**. The ad generator already builds **3-5 intent-themed ad
  groups** in one campaign, each with its own keywords and its own full responsive search ad, on
  **every tier including Launch**. (KB `ad-generator`.)
- **What separate CAMPAIGNS add, and nothing more:** separate daily budget, separate geo
  targeting, separate ad schedule, separate bid strategy per service.

**Recommend AGAINST splitting at Launch spend — this is not an upsell moment.** The `g-launch` band
is **$750–$2,500/mo**. Split in two that is roughly **$12/day each**. Smart bidding needs
conversion volume to learn, and two starved campaigns both learn slower than one healthy one.
Charging $500/mo more to make month-one results worse is a bad trade. Ad groups now, separate
campaigns when spend scales and they want budget *locked* per service. That is the honest
Acquisition trigger.

## 🔴 THE PORTAL SHOWS CLIENTS WHAT THEY DON'T HAVE

`portal.mjs` builds two lists: features included, **and** features excluded that an upgrade would
unlock. So a `g-launch` client logging in **sees "Multi-Campaign Strategy" in the not-included
column.** A verbal promise of multi-campaign on Launch is contradicted by their own dashboard.
This is the binding constraint on what can be said on a call.

## Three catalog inconsistencies found and fixed (2026-08-17, Bryson: *"yes fix it"*)

The catalog encodes the same fact **twice** — a capability flag in `PACKAGES_DB`
(`multiCampaign: true`) and a feature id in `PKG_FEATURES` (`"multi_campaign"`) — and nothing kept
them agreeing. All three bugs were that pair drifting apart:

1. **`c-growth` was missing `split_testing`.** Measured, not guessed: it was the **only** feature
   missing from the union of `g-growth` + `m-growth`, the two tiers it bundles (`c-launch` had zero
   gaps). An authoring slip, not a decision. A client paying $1,000/mo lacked something `m-growth`
   has at $550.
2. **`c-growth` was missing `multi_campaign`** while `g-acquisition` had it **$100 cheaper**. A
   prospect comparing the two columns would find the cheaper package better equipped. Added, which
   also makes the ladder rule sayable: top rung of every ladder gets it.
3. **`e-domination` had `multiCampaign: true` and the site sold "Multi-campaign structure" on the
   Store Domination card, but `multi_campaign` was absent from its feature list** — so a $1,200/mo
   client would have seen it in their *not-included* column, contradicting what they were sold.
   **Found by the new test, not by reading**; it was invisible to inspection because the flag and
   the site both said yes.

**Changed in all four copies** (`index.html`, `netlify/functions/portal.mjs`,
`netlify/lib/contract-shared.cjs`, `marketing-site/index.html`). `pricing-shared.mjs` holds a
fifth partial copy with prices but no capability flags, so it needed no edit.

## 🔴 ALSO FIXED: upgrade ladders were cross-selling e-commerce to lead-gen clients

`getUpgradeOptions` matched on the `platform` **string**, and `"Meta + Google"` contains
`"Google"`. Consequences, measured from the real function:

- **`c-growth`'s only "upgrade" was `e-domination` — Store Domination.** A roofer on the $1,000
  Full System was shown one upsell: an e-commerce package.
- **Every `g-*` and `m-*` client was offered Store Growth and Store Domination** too.

Replaced with family-scoped ladders:

```js
const PKG_FAMILY = (id) => String(id || "").split("-")[0];
const UPGRADE_FAMILIES = { g: ["g","c"], m: ["m","c"], c: ["c"], e: ["e"] };
```

Two rules: **e-commerce and lead generation never cross-sell**, and **a combined client is never
offered a single-platform package** (it would drop a channel they already pay for). Broadening up
(`g-*`/`m-*` into `c-*`) is a real upgrade; narrowing never is. `c-growth` now correctly returns
**no upgrade options** — it is the top of the lead-gen ladder. That is the honest answer, not a bug.
Adding a "Full System — Acquisition" rung is a pricing decision for Bryson, not something to fake
with a cross-sell.

## 🟡 STILL OPEN: one upgrade path trades away features

`g-growth` ($600) is still offered `c-launch` ($650), which **adds** Meta ads, pixel and unified
reporting but **removes** call tracking, the custom landing page, weekly optimization, competitor
research, CRM integration and advanced reporting. The portal only renders what an upgrade
**gains**, so the client is never told what they would lose. Not a strict downgrade (it trades
depth for breadth, which is arguable), so it was left alone rather than silently redesigned.

**Why the obvious fix was rejected:** filtering upgrades to strict feature supersets would break
the most basic path of all, `g-launch → g-growth`, because `g-growth` swaps `std_landing` for
`custom_landing` and so is not a superset. Modelling "custom supersedes standard" is real product
work. Two honest options when Bryson wants it: model feature supersession, or have the portal show
a "what changes" list instead of a gains-only list.

## Guarded by `tests/verify-packages.mjs` — 366 assertions, IN THE REPO

Run `node tests/verify-packages.mjs`. It extracts the real blocks out of each file rather than
restating the catalog (a restatement would just be a fifth copy to drift), and asserts: all four
copies agree on every flag and feature list; **every capability flag matches its feature id** (the
check that caught bug 3, and the one that makes all three bugs impossible to reintroduce); a
combined package keeps everything from both tiers it bundles and costs less than buying them
separately; **no cheaper package is strictly better equipped than a dearer one within a product
line** (the sales-call optics problem, now mechanical); upgrade ladders never cross product lines,
never drop a channel, always cost more and always add something; `c-growth` and `e-domination` are
ladder tops; the house account carries every feature; and the marketing site's multi-campaign and
split-testing bullet counts equal the number of packages carrying those flags, so the site cannot
drift from what the OS believes it sells.

Marketing site re-verified headlessly at **390 / 768 / 1280 / 1600**: 0px overflow at every width,
and the two combined cards stay equal width and height at desktop (370x524 each) with the two new
bullets. See KB `responsive-standards`.
