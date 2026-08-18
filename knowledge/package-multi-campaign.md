---
name: package-multi-campaign
topic: Packages/Sales
task: answer a prospect asking whether their package can run multiple campaigns (one per service), or check which tiers include multi-campaign and split testing
keywords: [c-acquisition, Full System Acquisition, multi_campaign, multiCampaign, Multi-Campaign Strategy, split_testing, splitTesting, g-acquisition, m-acquisition, e-domination, c-growth, g-launch, ad group vs campaign, separate budget per service, Stencil & Thread, PACKAGES_DB, PKG_FEATURES, getUpgradeOptions, UPGRADE_FAMILIES, verify-packages]
status: verified
summary: Multi-campaign is the TOP RUNG of each ladder. ⚠️ PRICES HERE ARE PRE-2026-08-18 and no longer correct — see KB `pricing-model` for the current numbers; the multi-campaign ANSWER below is unchanged. Launch and Growth tiers are single-campaign, so the answer for a g-launch prospect is still no. BUT what a prospect usually wants is a service-specific ad for a service-specific search, which is AD GROUPS, and every tier already gets 3-5; separate campaigns only buy per-service budget/geo/schedule/bidding, and splitting Launch-tier spend makes results worse. Fixed three catalog inconsistencies + an upgrade ladder that offered lead-gen clients an e-commerce package. Guarded by tests/verify-packages.mjs (968 assertions after the 2026-08-18 pricing rewrite).
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

## 🔴 AN UPGRADE MAY NEVER TAKE SOMETHING AWAY (Bryson, 2026-08-17)

*"I want to make sure that each time a client upgrades they keep what they paid for before and they
gain each time they upgrade."* Now **enforced in `getUpgradeOptions`**, not trusted to the catalog.
An upgrade is offered only if it costs more, **carries everything the client already has**, and adds
at least one thing. This matters because the portal shows the client only what an upgrade **gains**,
so one that dropped their call tracking would never have shown them the loss.

**Measured first.** Every family-allowed, price-increasing pair was checked for what it would cost
the client. Four paths were real downgrades sold as upgrades:

| Removed path | What the client would have lost |
|---|---|
| `g-growth` $600 → `c-launch` $650 | custom landing page, call tracking, weekly optimization, competitor research, CRM integration, advanced targeting, advanced reporting |
| `m-growth` $550 → `c-launch` $650 | custom landing page, weekly optimization, retargeting, lookalikes, split testing, advanced reporting |
| `g-acquisition` $900 → `c-growth` $1,000 | scaling roadmap, priority communication |
| `m-acquisition` $850 → `c-growth` $1,000 | full funnel strategy, scaling roadmap, priority communication |

**TWO FEATURES ARE REPLACED, NOT LOST — and a naive superset test breaks without them.** A literal
"must have everything" check would reject `g-launch → g-growth`, the most basic upgrade in the
business, because Growth swaps the standard landing page for a custom one and monthly optimization
for weekly. Modelled explicitly, and these are the **only** real pairs in the catalog (every other
disappearance on a price increase is a genuine loss):

```js
const FEATURE_SUPERSEDES = {
  custom_landing: ["std_landing"],   // a custom page replaces the standard one
  weekly_opt:     ["monthly_opt"],   // weekly optimization replaces monthly
};
```

**Both guards are load-bearing.** The family rule alone would not stop the additive violations, and
the additive rule alone would not stop cross-line selling: `m-growth` genuinely **is** a feature
superset of `e-launch`, so a store client would have been offered a Meta lead-gen package. Asserted
in the test so neither guard gets removed as redundant.

## ✅ RESOLVED: new top rung `c-acquisition` closes both dead ends

Enforcing the additive rule left `g-acquisition` ($900) and `m-acquisition` ($850) with nowhere to
go, because `c-growth` lacks `scaling_roadmap`, `priority_comms` and `full_funnel`. Bryson
(2026-08-17): *"do your recommendation."* Built **`c-acquisition` "Full System — Acquisition"**.

| | |
|---|---|
| Price | **$1,500/mo**, **$4,900** setup |
| Platform | Google + Meta, `leadFee: true` |
| Features | **23**, the exact union of `g-acquisition` + `m-acquisition` + `c-growth` |
| Ad spend band | $9,000–$35,000+/mo |
| Tag | **Most Powerful** (moved off `c-growth`, which is now untagged) |
| Savings | Save $250/mo vs buying both Acquisition tiers separately |

**Pricing derivation, not a guess.** The combined bundle discount already escalates by tier:
`c-launch` saves $100/mo, `c-growth` saves $150/mo, so $250/mo continues it
($900 + $850 = $1,750, less $250). Setup discounts run $250 → $400 → $600
($3,000 + $2,500 = $5,500, less $600 = $4,900). Management lands at 4–17% of the spend band.
**Bryson delegated the number; it is one edit in five files if he wants it different.**

**Feature list is the UNION and nothing more** — asserted in both directions, because "carries
everything the three below it carry" is exactly what makes it a legal upgrade from all three, and
"invents nothing" is what stops it quietly becoming a different product. `std_landing` and
`monthly_opt` are correctly absent (superseded by `custom_landing` / `weekly_opt`). Deliberately
does **not** include the five `e-domination`-only perks (`ugc_consulting`, `crm_input`, `page_cro`,
`strategy_calls`, `slack_access`) — those are e-commerce scope and one of them promises a tool that
does not exist yet (see KB `slack-access-promise`).

**Resulting ladder — every lead-gen package now has a path, and no path loses anything:**

```
g-launch  → g-growth, c-launch, g-acquisition, c-growth, c-acquisition
g-growth  → g-acquisition, c-growth, c-acquisition
g-acq     → c-acquisition
m-launch  → m-growth, c-launch, m-acquisition, c-growth, c-acquisition
m-growth  → m-acquisition, c-growth, c-acquisition
m-acq     → c-acquisition
c-launch  → c-growth, c-acquisition
c-growth  → c-acquisition
c-acq     → (top)          e-launch → e-growth, e-domination → (top)
```

**FIVE copies now, not four.** `report-shared.mjs` and `pricing-shared.mjs` also carry the package
(the latter feeds the Deal Prep quoting prompt, so a missing entry means the AI cannot quote the
top tier). Full list: `index.html`, `portal.mjs`, `contract-shared.cjs`, `report-shared.mjs`,
`pricing-shared.mjs`, plus the marketing site card.

**🔴 MARKETING SITE: the new card is Meta-gated and carries a `CS:META-SOON` sentinel.** Combined
packages depend on Meta, so its CTA is "Join the waitlist" → `#contact`, not Calendly, matching the
other two. The combined grid moved from `.pkg-grid.cols-2` to the default 3-column `.pkg-grid`.
The site's package recommender `tiers.high` for the combined family now points at
`Full System: Acquisition` (was `Full System: Growth`). **`git revert a4b83f0` will NOT restore this
card's CTA** because the card postdates that commit — when Meta is approved, grep `CS:META-SOON`
and flip this one by hand too.

## Guarded by `tests/verify-packages.mjs` — 665 assertions, IN THE REPO

Run `node tests/verify-packages.mjs`. It extracts the real blocks out of each file rather than
restating the catalog (a restatement would just be a fifth copy to drift), and asserts: all four
copies agree on every flag and feature list; **every capability flag matches its feature id** (the
check that caught bug 3, and the one that makes all three bugs impossible to reintroduce); a
combined package keeps everything from both tiers it bundles and costs less than buying them
separately; **no cheaper package is strictly better equipped than a dearer one within a product
line** (the sales-call optics problem, now mechanical); upgrade ladders never cross product lines,
never drop a channel, always cost more and always add something; `c-growth` and `e-domination` are
ladder tops; **every offered upgrade keeps everything the client paid for and adds at least one
thing**; the four removed downgrade paths stay removed; the supersession map stays small and real
(both sides must be actual features, and no package may hold a pair, which would prove one does not
replace the other); the basic `g-launch → g-growth` and `c-launch → c-growth` paths survive the
rule; both guards are proven load-bearing; the **ladder tops are locked to an explicit list**, so a
future catalog edit that strands a package fails loudly instead of shipping a client with no upgrade
path; the house account carries every feature; and the marketing site's multi-campaign and
split-testing bullet counts equal the number of packages carrying those flags, so the site cannot
drift from what the OS believes it sells.

Marketing site re-verified headlessly at **390 / 768 / 1280 / 1600**: 0px overflow at every width,
and the two combined cards stay equal width and height at desktop (370x524 each) with the two new
bullets. See KB `responsive-standards`.
