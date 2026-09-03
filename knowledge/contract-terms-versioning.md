---
name: contract-terms-versioning
topic: Contracts
task: add or change a clause in the standard agreement without altering contracts already signed; understand the client delay and abandonment clause; work out which version of the terms a client is on
keywords: [contract terms version, CONTRACT_TERMS_VERSION, contractTermsVersion, terms v1 v2, abandonment clause, client delay, failed to respond, intake not completed, void the contract, cancellation fee, non-refundable setup fee, retroactive clause, signed contract changed, renewal stamps terms, section numbering]
status: verified
summary: New agreements carry a "Client Delay and Abandonment" section (14 days to complete intake, written reminder, 10 day grace, then BoldLine may end it; setup fee non-refundable and the Monthly Minimum stays payable). 🔴 The contract renders FRESH every time it is opened, so terms are VERSIONED: v1 is anything signed before 3 Sep 2026, v2 adds this clause, and a signed agreement never gains a clause it was not signed with. Renewal stamps the current version, which the date inference alone could never do because renewing leaves contractSignedAt on the original date. 15 checks, six mutations.
verified: 2026-09-02
---

**Bryson, 2026-09-02:** *"make sure in the contract from now on say something like if a
client fails to respond, complete intake form, etc. the contract is voided and there is a fee
charged as well (this will be for future clients not Sebastian until he renews his
contract)"*.

## The clause

Section titled **Client Delay and Abandonment**, sitting straight after Client
Responsibilities:

- (a) Intake, access and approvals within **14 days** of the Effective Date.
- (b) If not, or if Client goes silent for **14 consecutive days**, a **written reminder**;
  **10 days** after that, Agency may end the Agreement immediately.
- (c) On such an ending: **setup fee earned and non-refundable**, and the **Monthly Minimum
  stays payable** for each month or part month already run. (One-time hand-off: build fee
  earned, unpaid balance for work done stays payable. It has no Monthly Minimum to refer to.)
- (d) Ending it is **optional**. Agency may instead pause and extend the term.
- (e) Does **not** apply where the delay is Agency's, or a platform outage.

### 🔴 Why the money is worded the way it is

*"...reserved capacity and turned away other work for the committed term, so these amounts
reflect that reservation and the work done, not a penalty."*

**That sentence is the difference between a clause that holds and one a court strikes out.**
A flat punishment for walking away is unenforceable in most US states unless it is a genuine
pre-estimate of loss. The setup fee pays for work already done; the monthly minimum reflects
a slot held open while other work was turned away. Both are real losses, so both survive.

Do not replace this with a round "cancellation fee" number. That is the version that fails.

## 🔴 Versioning, which is the hard half

**This contract renders FRESH every time anyone opens it**, in the OS and in the client
portal. Adding a section unconditionally would put a new obligation, with money attached,
into an agreement a client has already signed. Retroactively and silently. They would open
their portal one day and find a clause they never agreed to, and the only way anybody would
notice is if it were enforced.

| Version | Who |
|---|---|
| **v1** | Signed before **3 Sep 2026**. Today that is exactly one client, Stencil & Thread. |
| **v2** | Everything else, including every unsigned agreement. Adds the clause above. |

Resolution order inside `makeContractHTML`:
1. `cl.contractTermsVersion` when it is a number. Explicit beats inferred, both directions.
2. Otherwise: signed AND `contractSignedAt` before the cutoff → v1; anything else → v2.

🔴 **A signed contract with NO date gets CURRENT terms, deliberately.** An unknown signature
date is far likelier to be a record created after this change than a lost v1 client, and
there is exactly one v1 client whose date is known. Guessing v1 would silently drop the
clause from every new agreement whose date failed to save.

### 🔴 Renewal stamps the version, and the inference could never do it

Renewing sets `contractSigned` again but **leaves `contractSignedAt` on the ORIGINAL
signature date**. So without an explicit stamp, a client who signed under v1 stays on v1 for
ever, which is not what "not Sebastian until he renews" means.

`ContractTabContent`'s renewal writes `contractTermsVersion: CONTRACT_TERMS_VERSION`.

## Adding the NEXT clause

1. Bump `CONTRACT_TERMS_VERSION` in `index.html`.
2. Give the new clause its **own gate** (`termsVersion >= 3`) inside `makeContractHTML`, in
   **both copies** (`netlify/lib/contract-shared.cjs` and `index.html`).
3. Add its own `d<Name>` offset to the section numbers if it slots in mid-document.
4. Add a check that a client on the previous version does **not** get it.

Never add a clause ungated. That is the one move this whole entry exists to prevent.

## Section numbering

The clause slots in mid-document, so everything after it shifts by `dAb`. A check asserts the
headings read **1..N with no gap and no repeat**, on every package and both versions. A
duplicated or skipped section number is exactly what a dispute turns on.

## Testing note

`tests/verify-contract-terms-version.mjs`, 15 checks, running **both real copies** of the
generator over the real client's real signature date. Six mutations, all caught.

🔴 **One mutation silently failed to apply and reported a pass.** Re-landed properly it failed
correctly. A mutation that does not reach the code proves nothing and reads exactly like a
working guard, which is the oldest trap in this repo.

---

## v3, 2026-09-02 — cancelling early costs the remaining term

**Bryson:** *"a clause if the client wants to cancel... they have to tell me in writing and
then pay the remaining months minimum and the set up fee is non refundable and if they only
have less than a month left in their contract then the minimum is $400 (or should we do the
minimum for whatever contract they are on)"*.

🔴 **Written notice and 30 days were ALREADY in the agreement.** Section "Termination (b)"
has required them all along. The only thing that changed is **the amount**.

| | v1/v2 | **v3** |
|---|---|---|
| Early exit costs | one (1) month's Monthly Minimum | **every remaining month of the Committed Term** |
| Part month | not addressed | **counts as a whole month** |
| Setup fee | silent on client-initiated exit | **earned on signing, non-refundable in any amount** |
| Notice | "written notice" | **to the email on page one, effective when received** |
| Discount clawback | yes | yes, unchanged |

### 🔴 His $400 question, answered: their own minimum, never a flat number

Two independent reasons, either of which settles it:

1. **A flat figure bearing no relation to their contract is the shape a court reads as a
   penalty**, not a genuine estimate of loss. The entire clause survives on the liquidated
   damages framing; a $400 number unconnected to the deal undermines it.
2. On every package priced above $400, a $400 tail makes **cancelling in the last month
   cheaper than seeing it out**, which rewards exactly the behaviour the clause exists to
   discourage.

The liquidated-damages wording is kept and extended: *reserved capacity for the whole
Committed Term and turned away other work to hold it.*

Untouched: results-only (no floor to accelerate) and the one-time hand-off (no term at all).
Charging either "the remaining months" would name something that does not exist.

### 🔴 THE BUG THIS RELEASE TAUGHT: a version default written as a literal

The unsigned default read `... ? 1 : 2`. Adding v3 therefore left **every new client silently
on v2**. The clause was in the file, gated correctly, and reached **nobody**. Nothing threw,
nothing looked wrong, and an unsigned contract simply did not contain the term Bryson had
just asked for.

**A default naming a specific version goes stale the moment a version is added, which is
exactly when nobody is looking at it.** It now reads one `TERMS_CURRENT`, and a check fails
if a literal comes back.

### 🔴 And two existing assertions that lied on the way past

Both matched the phrase `early-termination fee equal to`. The new wording made them report
the fee as **GONE when it had only got bigger**. They now assert that cancelling early costs
something, not how it is worded.

A third pinned `CONTRACT_TERMS_VERSION = 2` and had to be edited the day v3 landed, which
teaches the next person to edit it rather than think about it. It no longer pins the number.
The number is pinned **once, behaviourally**: a renewed client must get byte-identical terms
to a brand-new one.

**Lesson for the next clause: assert the RULE, never the sentence.**
