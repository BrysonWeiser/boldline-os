---
name: event-start-date
topic: Contracts
task: set a contract start date, handle a launch that slips, or understand why the term starts when the ads do
keywords: [start date, effective date, terms v5, event start, campaignLiveAt, goLiveDecision, ads-sync, amendment, slipped launch, go live, spend30d, shiftEnd, reslotTerm]
status: verified
summary: From terms v5 the Start Date IS the day the first campaign begins delivering, not a date somebody guessed at signing - unless `startDateFirm` is set on that client, which prints an agreed exact date instead and stops the OS moving it. 🔴 EFFECTIVE DATE (signing, when work begins and the handover clock runs) AND START DATE (ads live, when the term and the minimum run) ARE DIFFERENT THINGS from v5. A slipped launch is then the agreement working as written, so there is nothing to amend and nothing to re-sign - which matters because this agreement's own amendment clause needs a signed writing from both parties and the email carve-out covers only upgrades and renewals. The Effective Date splits off and becomes the signature date, so the 14-day handover clock starts at signing (where it belongs) while fees start at go-live. `ads-sync` recognises go-live from the PLATFORMS' spend, not our launch button, stamps `campaignLiveAt` once, and moves the dates - but ONLY for v5+ clients, because a v4 client's signed PDF names a fixed date. 113 checks + 23 mutations. A branded `start_confirmed` email auto-sends the written confirmation clause 2.1 promises, only when the dates moved, and deliberately asks for NO signature.
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

## Estimated or exact, per client

Bryson, 2026-09-17: *"make sure that there is an option to put estimated or exact start date"*.
A toggle in the client edit sheet, under the start date, writing `startDateFirm`.

- **Estimated** (default, and the one to leave alone): the agreement says the term starts the day
  the ads go live, with the date shown as an estimate. A slip needs no amendment, and the OS
  moves both dates once the ads spend.
- **Exact date**: the agreement names that day and says the parties agreed it. 🔴 **The OS will
  NOT move it**, because moving a date the client accepted is rewriting a term they signed. For a
  seasonal push or a product drop where a real date has been committed to.

🔴 **Only the Start Date wording changes.** Everything else v5 brought applies either way: the
Effective Date is the signature date, no Monthly Minimum accrues before the Start Date, the delay
clause bills from the Start Date, and **the numbering is identical**, so 2.3 never means two
different things across two BoldLine agreements signed the same week.

## 🔴 Two dates, and they are not the same thing

Bryson, 2026-09-17: *"isnt the start date for the contract for us to start working on the ads not
for the start date of the actual ads?"* Half right, and worth keeping straight:

| | What it is | What hangs off it |
|---|---|---|
| **Effective Date** | the signing date | the agreement is in force, work begins, the client's 14-day handover clock runs |
| **Start Date** | the ads going live (or an agreed date) | the Committed Term, and the Monthly Minimum |

Section 1 never ties the start of WORK to the Start Date, so there is no conflict.

**Why the term runs from the ads rather than from when the build starts:** the Monthly Minimum is
a floor on the performance fee, and the performance fee only exists once ads run. A month with no
ads is a month with nothing for the minimum to be a floor of. The build is paid for by the setup
fee, which the agreement says is earned in full and non-refundable even if the client walks, so
the build is protected without the term having to cover it.

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

## The client's written confirmation

🔴 Clause 2.1 promises "Agency will confirm the Start Date to Client in writing once it occurs",
and for a day after that was written **nothing did it**, which is worse than not promising.

A branded email, `start_confirmed`, now sends itself from `ads-sync` at the same moment the dates
are stamped. It names the confirmed start and end dates and says in terms that there is nothing
to sign.

🔴 **IT CONFIRMS, IT DOES NOT ASK FOR A SIGNATURE.** Bryson's first idea (2026-09-17) was an email
the client signs, so a date could change without a new DocuSign envelope. Under v5 nothing
changes: the agreement already says the term starts when the ads do. Asking for a signature would
imply the date had not been settled, undercut the very clause that makes a slipped launch free,
and re-create the admin the whole change exists to delete. A test bans any ask for a signature in
that template.

🔴 **Sent only when the dates actually MOVED**, i.e. only to a client on the estimate. A client
with an agreed exact date, or on older terms, never receives it, because for them the date did not
change and saying it had would be false. Those are the ones Bryson hears about in amber instead.
Fail-soft: a bounced email never costs the recorded go-live, which is the fact the term depends on.

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
