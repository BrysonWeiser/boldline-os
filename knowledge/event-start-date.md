---
name: event-start-date
topic: Contracts
task: set a contract start date, handle a launch that slips, or understand why the term starts when the ads do
keywords: [start date, effective date, terms v5, event start, campaignLiveAt, goLiveDecision, ads-sync, amendment, slipped launch, go live, spend30d, shiftEnd, reslotTerm]
status: verified
summary: From terms v5 the Start Date IS the day the first campaign begins delivering, not a date somebody guessed at signing. A slipped launch is then the agreement working as written, so there is nothing to amend and nothing to re-sign - which matters because this agreement's own amendment clause needs a signed writing from both parties and the email carve-out covers only upgrades and renewals. The Effective Date splits off and becomes the signature date, so the 14-day handover clock starts at signing (where it belongs) while fees start at go-live. `ads-sync` recognises go-live from the PLATFORMS' spend, not our launch button, stamps `campaignLiveAt` once, and moves the dates - but ONLY for v5+ clients, because a v4 client's signed PDF names a fixed date. 77 checks + 15 mutations.
verified: 2026-09-17
---

## Why

A contract was signed with a date chosen a week or two ahead, before anyone knew when the client
would hand over their ad account. That date is an operative term of a **frozen** PDF (KB
`signed-contract-copy`), and section 12 of the agreement requires amendments to be "in a writing
signed (including electronically) by both parties", with an email carve-out that covers **only
package upgrades and renewal terms**. So every slipped launch cost a proper amendment.

It happened to **Stencil & Thread** — Sebastian was given the concession by hand on 2026-09-07,
that his term starts the day the ads switch on — and was about to happen to **Air Suds**. Twice
is a pattern, so Bryson asked for it to become the wording: *"yea do that"* (2026-09-17).

## What v5 says

| | v4 and earlier | v5 |
|---|---|---|
| Effective Date | the start date | **the signature date** |
| Start Date | a fixed date | **the day the first campaign begins delivering** |
| Key Terms shows | `Oct 1, 2026` | `The day the ads go live` + `estimated Oct 1, 2026` |
| 14-day handover clock | from the start date | from the Effective Date, i.e. **signing** |
| Monthly Minimum accrues | from the Effective Date | **from the Start Date** |

New clause 2.1 defines it, says the printed date "is an estimate for planning and does not itself
begin the term", and promises Agency will confirm the real date in writing. A new 2.2 carries the
three-month commitment and adds "No Monthly Minimum accrues before the Start Date". Renewal and
Holdover renumber to 2.3 and 2.4 **only under v5**.

🔴 **Splitting the Effective Date off fixed a real backwardness.** With one field, the clause
giving the client fourteen days to hand over account access ran from a date *after* the launch
that access enables. Now it runs from signing.

## How the date gets recorded

`netlify/lib/campaign-live.mjs` holds the decision; `ads-sync` wires it in, because that job
already pulls spend from Google and Meta on a schedule.

🔴 **SPEND IS THE PROOF, NOT OUR LAUNCH BUTTON.** A campaign can be switched on and sit in review
delivering nothing, and a campaign can be started by hand in Ads Manager where our button never
ran. Money leaving the client's account is the one signal that is unambiguous, is recorded by the
platform rather than by us, and matches what the client was told the date would mean.

- Stamps `campaignLiveAt` **once**, never re-stamps.
- Moves `contractStart` to that day and **shifts** `contractEnd` by the same number of days, so a
  term someone set by hand survives (same rule as `reslotTerm` in the edit sheet; a test runs
  both and compares).
- 🔴 **Only for v5+ clients.** A v4 client has a fixed date in a frozen PDF, so rewriting their
  start date automatically would recreate, at scale, the exact drift fixed the day before. Their
  go-live is still recorded and Bryson gets an **amber** alert saying nothing changed and why.
  A v5 client gets a green one.
- Skips the house account. Skips a launch on the planned day (records it, changes nothing).

## What Bryson does when it fires

Nothing legal. Tell the client the confirmed dates, which clause 2.1 promises. The platform's own
record is the proof if it ever mattered.

## Tests

`tests/verify-event-start-date.mjs`, 77 checks, **15 mutations verified**: an old client's dates
rewritten, a non-delivering campaign starting the term, the stamp repeating, the house account
included, a custom term thrown away, the gate lowered to v4, the contract reverting to a fixed
date, the estimate becoming operative, billing running from signature, two clauses sharing 2.2,
`TERMS_CURRENT` left behind, the renewal stamp left behind, the sync ignoring go-live, the patch
discarded, and an amendment-needed alert dressed as good news.

🔴 **Bumping terms means bumping TWO numbers**: `TERMS_CURRENT` in the renderer (both copies) and
`CONTRACT_TERMS_VERSION` in the OS, which is what a renewal stamps. `verify-contract-terms-version`
already catches the second being left behind, and did.
