---
name: package-multi-campaign
topic: Packages/Sales
task: answer a prospect asking whether their package can run multiple campaigns (one per service), or check which tiers include multi-campaign
keywords: [multi_campaign, multiCampaign, Multi-Campaign Strategy, g-acquisition, m-acquisition, e-domination, g-launch, c-growth, ad group vs campaign, separate budget per service, Stencil & Thread, PACKAGES_DB, PKG_FEATURES]
status: verified
summary: Only 3 of 11 packages include multi-campaign — Google Acquisition ($900), Meta Acquisition ($850), Store Domination ($1,200). Everything else is single-campaign. BUT the thing a prospect usually wants (a service-specific ad for a service-specific search) is AD GROUPS, which every tier already gets 3-5 of; separate campaigns only buy separate budget/geo/schedule/bidding per service, and at Launch-tier spend splitting the budget makes results worse. The flag is a scope promise with ZERO code enforcement, though the client portal does show it in the not-included column.
verified: 2026-08-15
---

**Asked on a live sales call (Bryson, 2026-08-15, prospect Stencil & Thread on `g-launch`):** *"with that package could we run multiple different campaigns — a campaign for one service and a campaign for another service they offer"* (explicitly NOT A/B split testing).

## Which tiers include it — verified in code, site, contract and portal (all four agree)

`multiCampaign` flag in `PACKAGES_DB` + `multi_campaign` in `PKG_FEATURES`:

| Package | Price | multiCampaign |
|---|---|---|
| `g-launch` Launch System | $400/mo | ✕ |
| `g-growth` Growth System | $600/mo | ✕ |
| **`g-acquisition` Acquisition System** | **$900/mo** | **✓** |
| `m-launch` Launch System | $350/mo | ✕ |
| `m-growth` Growth System | $550/mo | ✕ |
| **`m-acquisition` Acquisition System** | **$850/mo** | **✓** |
| `c-launch` Full System — Launch | $650/mo | ✕ |
| `c-growth` Full System — Growth | $1,000/mo | ✕ |
| `e-launch` Store Launch | $450/mo | ✕ |
| `e-growth` Store Growth | $750/mo | ✕ |
| **`e-domination` Store Domination** | **$1,200/mo** | **✓** |

Four copies of this data exist and were checked against each other: `index.html` (`PACKAGES_DB`
+ `PKG_FEATURES`), `netlify/functions/portal.mjs`, `netlify/lib/contract-shared.cjs`, and
`marketing-site/index.html` (the public feature bullet "Multi-campaign structure" appears on
exactly those three cards). **They are in sync — do not assume that stays true after a pricing
edit, since it is a four-way dual-copy.** `pricing-shared.mjs` carries a fifth copy but omits
the capability flags entirely.

## 🔴 THE PORTAL SHOWS THE CLIENT WHAT THEY DON'T HAVE

`portal.mjs:140-141` builds two lists: features included, **and** features excluded that an
upgrade would unlock. So a `g-launch` client logging in **sees "Multi-Campaign Strategy" sitting
in the not-included column.** A verbal promise of multi-campaign on Launch is contradicted by
their own dashboard. This is the binding constraint on what can be said on a call.

## The reframe that actually answers the prospect (use this)

The question sounds like it needs multiple campaigns. It usually does not.

- **What they want:** someone searching service A sees an ad about service A.
- **What delivers that:** **ad groups**, and the ad generator already builds **3-5 intent-themed
  ad groups** inside one campaign, each with its own keywords and its own full responsive search
  ad. Available on **every tier**, Launch included. (See KB `ad-generator`.)
- **What separate CAMPAIGNS add, and nothing more:** separate daily budget, separate geo
  targeting, separate ad schedule, separate bid strategy per service.

## Recommend AGAINST splitting at Launch spend — this is not an upsell moment

`g-launch` ad spend band is **$750–$2,500/mo**. Split into two campaigns that is roughly
**$12/day each**. Smart bidding needs conversion volume to learn, and two starved campaigns both
learn slower than one healthy one. Charging $500/mo more to make month-one results worse is a
bad trade and a bad look. The honest framing: ad groups now, separate campaigns when spend
scales and they want budget *locked* per service, which is the natural Acquisition trigger.

## 🔴 ZERO CODE ENFORCEMENT — it is a contract promise, not a guardrail

Grepped `google-ads.mjs` and `ads-autopilot.mjs`: **zero** references to `multiCampaign` /
`multi_campaign`. Nothing stops a Launch client having five campaigns. The flag's only
behavioural use anywhere is a bot description string (`index.html:538`, Keyword Research reads
"Multi-campaign structure." vs "Single campaign structure."). Everything else is feature lists.
So the boundary is held by the contract and the portal, not the software.

## Two pricing inconsistencies found while checking — OPEN, not decided

1. **`c-growth` is $1,000/mo with `multiCampaign: false`, while `g-acquisition` is $900/mo with
   `true`.** The most expensive lead-gen package, tagged "Most Powerful", is structurally weaker
   than a cheaper one. Visible to any prospect comparing columns.
2. **`c-growth` also has `splitTesting: false` at $1,000/mo, while `m-growth` has it at $550/mo.**

Both look like artifacts of the combined tiers being authored separately from the single-platform
ladders. **Raised with Bryson 2026-08-15; no decision yet.** If they get fixed, all four copies
of `PACKAGES_DB`/`PKG_FEATURES` plus the marketing site bullets must move together.
