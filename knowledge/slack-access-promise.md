---
name: slack-access-promise
topic: Packages/Delivery
task: find out what a package feature actually commits BoldLine to deliver, or check which sold features have no system behind them yet
keywords: [slack_access, Priority Support + Slack Access, strategy_calls, ugc_consulting, crm_input, page_cro, e-domination, Store Domination, undeliverable feature, contract deliverable, Slack Connect]
status: verified
summary: `slack_access` ("Priority Support + Slack Access") sits on exactly ONE package, `e-domination` (Store Domination, $1,200/mo e-commerce top tier). Bryson has never set up a Slack workspace, so it is a contract deliverable with nothing behind it. Not urgent today because all e-commerce packages are Meta-dependent and behind the coming-soon gate, so nobody can buy it. It is NOT on the marketing site, but it IS in the OS feature list, the client portal's included list, and the signed service agreement. Four sibling features on the same package are also human-delivered and unbuilt.
verified: 2026-08-17
---

**Bryson, 2026-08-17:** *"for some of the packages it says slack access but tell me what that means
and i dont remember doing anything with slack."* Correct, he never did.

## What it is and where it appears

`slack_access`, labelled **"Priority Support + Slack Access"**, on exactly **one** package:
**`e-domination` "Store Domination", $1,200/mo**, the top e-commerce tier. Not on any lead-gen
package.

Where it shows up, verified by grep:

| Surface | Present? |
|---|---|
| OS feature list (`index.html`) | Yes |
| Client portal included-features (`portal.mjs`) | Yes |
| **Signed service agreement** (`contract-shared.cjs`, rendered into the deliverables list) | **Yes** |
| Marketing site | **No** (zero matches for "slack") |

So it is not being advertised, but it **would be written into a contract** the moment a Store
Domination deal is signed. The intended meaning is a shared Slack channel with the client
(Slack Connect) for same-day replies instead of email only.

## Why it is not on fire today

Every e-commerce package is Meta-based, and Meta packages are behind the `CS:META-SOON` coming-soon
gate (KB `site-coming-soon`, `meta-marketing-api`). The Store Domination CTA is "Join the waitlist",
so **nobody can buy the one package that promises it.** It becomes real the day Meta opens and an
e-commerce client signs.

## 🔴 FOUR SIBLINGS IN THE SAME POSITION

`slack_access` is not alone. These are all `e-domination`-only and all **human-delivered, with no
system behind them**:

| Feature | Label |
|---|---|
| `ugc_consulting` | UGC / Video Creative Consulting |
| `crm_input` | Offer + Pricing Optimization Input |
| `page_cro` | Product Page CRO Input |
| `strategy_calls` | Weekly Strategy Calls |
| `slack_access` | Priority Support + Slack Access |

The other four are just Bryson's time, which he can deliver on day one. **`slack_access` is the only
one that names a specific third-party tool that does not exist yet**, which is what makes it the
odd one out and worth a decision.

Also worth knowing: `cross_retargeting` ("Cross-Channel Retargeting") is the only feature unique to
`c-growth`, so it is a single point of failure in the combined ladder's differentiation.

## Options, with a recommendation

1. **Set up a free Slack workspace + a Slack Connect channel per client.** Free tier is enough for
   this. Real work, and one more surface to monitor before there is a single client.
2. **RECOMMENDED — rename the feature and drop the Slack commitment.** Something like
   "Priority Support (same-day replies)" keeps the value and stops promising a tool he does not run.
   The feature id stays `slack_access` so no data migrates; only the `label` changes, in the three
   files that carry `ALL_FEATURES` (`index.html`, `portal.mjs`, `contract-shared.cjs`).
3. **Leave it and build it when the first e-commerce client signs.** Defensible given the Meta gate,
   but it means a contract clause is true only if he remembers it at signing.

**Not changed yet — awaiting Bryson's choice**, since renaming a sold feature is a product decision,
not a bug fix.
