---
name: slack-access-promise
topic: Packages/Delivery
task: find out what a package feature actually commits BoldLine to deliver, or check which sold features have no system behind them yet
keywords: [slack_access, Priority Support same-day replies, vapourware feature, Priority Support + Slack Access, strategy_calls, ugc_consulting, crm_input, page_cro, e-domination, Store Domination, undeliverable feature, contract deliverable, Slack Connect]
status: verified
summary: RESOLVED 2026-08-17 — the feature that read "Priority Support + Slack Access" is now "Priority Support (same-day replies)", so nothing BoldLine sells promises a Slack workspace that does not exist. It sat on exactly ONE package, `e-domination` (Store Domination, $1,200/mo), and was absent from the marketing site but present in the OS, the client portal AND the signed service agreement. Nobody could buy it (e-commerce is Meta-gated), so nothing was mis-sold. Renamed in the three files carrying ALL_FEATURES; id kept because feature ids are never persisted per client. A test now blocks any feature label naming a tool BoldLine does not run, and blocks label drift between the three copies.
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

## ✅ RESOLVED — renamed (Bryson, 2026-08-17: *"yea rename it"*)

**`slack_access` label is now `"Priority Support (same-day replies)"`.** Changed in the three files
that carry `ALL_FEATURES`: `index.html`, `netlify/functions/portal.mjs`,
`netlify/lib/contract-shared.cjs`. Verified end to end by rendering an `e-domination` service
agreement: the deliverable line reads the new wording and **the word "Slack" appears nowhere in the
contract**.

**The id stayed `slack_access` on purpose.** Feature ids are never persisted per client (a client
record stores `packageId`, and the feature list is derived from static config at render time), so
renaming the id would have been churn with no benefit. A comment at the declaration explains the
history so the id does not mislead later.

**Why not "Priority Support" plain:** `priority_comms` ("Priority Communication") already exists on
the lead-gen top tiers. The two labels are close, but **no single client can ever see both** —
`slack_access` is e-commerce only, `priority_comms` is lead-gen only, and upgrade ladders never cross
product lines (KB `package-multi-campaign`). The parenthetical keeps them distinguishable for Bryson
reading the full list.

**Considered and rejected:** setting up a real Slack workspace + Slack Connect per client. It is one
more surface to monitor before the first client exists, and the value ("we reply fast") does not
depend on the tool.

## 🔴 GUARD ADDED so this class of bug cannot return

`tests/verify-packages.mjs` now asserts that **no feature label names a tool BoldLine does not run**
(`/slack/i`, `/discord/i`, `/whatsapp/i`, `/telegram/i`) and that **all three copies carry identical
labels, not just identical ids** — the contract renders from its own copy, so a stale label there is
what a client actually signs. Both assertions were **proved to fail** by temporarily reintroducing
the old label: 3 failures, exactly the right ones, then restored. Suite at **665 assertions**.

## The four siblings are fine, and stay

`ugc_consulting`, `crm_input`, `page_cro`, `strategy_calls` remain `e-domination`-only and unbuilt,
but each is simply **Bryson's own time**, deliverable on day one with no system required. Only the
Slack one named third-party infrastructure, which is what made it the outlier.
