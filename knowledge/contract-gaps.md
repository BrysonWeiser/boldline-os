---
name: contract-gaps
topic: Contracts
task: stop an incomplete agreement being sent, or change what counts as incomplete
keywords: [contract gaps, contractGaps, incomplete contract, missing package on contract, per qualified lead missing, docusign send blocked, brendon voided contract, cant send yet, agreement missing information]
status: verified
summary: On 14 Sept an agreement went to a prospect with no package on it, no platform, and the ENTIRE per-qualified-lead section silently absent, because that clause is gated on the package's pricing model. Nothing warned him and he had to void it. `contractGaps()` now blocks the send button AND the send handler until the agreement is complete, listing what is missing and which tab to fix it on. Every gap is proved by rendering the real contract without that field and finding the damage. 17 checks, six mutations caught.
verified: 2026-09-15
---

## The incident

Bryson, 2026-09-14: *"i just sent him the agreement but i just realized no package is listed
should i have sent the agreement"*. It rendered **Service Package "—", Advertising Platform "—",
$0/mo, Setup Waived** and — the part that made it dangerous — **no per-qualified-lead clause at
all**, because that section is gated on `pkg.pricingModel === "per_lead"` and there was no `pkg`.
He noticed himself, minutes later, and voided it.

Then, 2026-09-15: *"if there is a contract that is missing information such as missing the
package, the cost per qualified lead, etc. instead of letting me send it dont let me send it and
then give a message for what is missing that way I dont ever accidentally send out contracts with
missing information again."*

## 🔴 Why this one is worse than it sounds

**A contract with a gap does not throw, does not warn, and does not look broken.** It renders a
complete, professional, signable document that happens to be missing the clause about money. The
client signs whatever it says. There is no error to notice — only an absence, and an absence in a
legal document is invisible until somebody goes looking for it.

The **per-lead rate is the nastier of the two**, because with the package present everything else
on the page still reads as finished. Only the fee section is gone.

## What blocks a send

`contractGaps(cl, pkg)` in `index.html` (immediately above `makeContractHTML`), returning
`{ what, where }` per gap:

| Gap | Damage in the rendered document |
|---|---|
| No package | Service Package "—", Advertising Platform "—", **and no fee clause at all** |
| Per-lead package with no rate | **No fee clause at all**, rest of the contract looks finished |
| Store with no ad-spend percentage | Same, for the e-commerce half of the pricing model |
| No business name / contact name / email / address | The agreement cannot name or reach the party signing it |
| No start date | The committed term has nothing to count from |

🔴 **The per-lead rate is computed the way the DOCUMENT computes it** — `billingPerLead` falling
back to `PER_LEAD[niche]` — not by checking whether the field is filled in. A blank field is fine
when the niche has a standard rate; a client in a niche with no rate renders a contract with no
fee clause while the field looks perfectly normal. Checking `billingPerLead != null` would have
passed exactly that case.

## 🔴 Blocked in BOTH places

The button is disabled **and** `sendDocuSign` refuses on its own, before the network call.
**Disabling a button is a hint, not a guard**: it is one stale render, one Enter key or one
restored tab away from firing anyway, and what it fires is an irreversible email to a client.

The list renders **above** the button, not below it, and every line says **which tab to fix it
on**. A block that does not tell you how to get past it is just a locked door, and a guard that
annoys him is a guard he learns to route around.

## How it is pinned

`tests/verify-contract-gaps.mjs`:

- **Runs the real `contractGaps`, lifted out of `index.html` and executed**, never a
  re-implementation — a test that restates its subject's assumptions catches nothing.
- **Every gap is proved against a REAL rendered contract.** For each one it renders
  `makeContractHTML` without that field and asserts the damage is actually there (the "—"
  placeholders, the missing fee clause). So a check nobody needs cannot quietly accumulate and
  start blocking sends for no reason.
- **A complete agreement must produce zero gaps**, including a store on a percentage and a
  blank per-lead field in a niche that has a standard rate. This matters as much as the blocking.

Mutations caught: button re-enabled, handler refusal deleted, per-lead check neutered, missing
package no longer flagged, a gap that stops saying where to fix it, and a check pointing at the
wrong field.
