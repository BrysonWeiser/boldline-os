---
name: contract-special-terms
topic: Contracts
task: add a negotiated extra to a client's contract before sending it; understand why the AI is not allowed to edit the agreement itself; change or remove a special term; fix a term on an already-signed contract
keywords: [special terms, contract terms, edit contract, custom clause, negotiated terms, agreed on the call, first month free, discount clause, notice period, contract-terms.mjs, SpecialTermsCard, specialTerms, flagRisky, clause, addendum, rider, amendment, contract locked, signed contract, precedence]
status: verified
summary: Bryson types what he agreed in plain words, a model writes it up as contract clauses, he reads and edits them, and they render in one "Special Terms" section before the signatures. 🔴 THE AI NEVER EDITS THE AGREEMENT ITSELF, only appends to that one bounded section, because a model with a free hand over contract text could quietly weaken the liability cap or move the governing law and nobody would notice until it mattered. Nothing saves itself; the server never writes to the client record. A signed agreement refuses new terms, since the contract renders fresh every time and editing after signature would rewrite the document the client already signed. 16 checks, nine mutations.
verified: 2026-09-02
---

**Bryson, 2026-09-02:** *"I need a way for the ai to edit the contracts on the go before I
send them. So what I mean is I want there to be a section where I input the agreed upon
price or any other details i want and the ai will add them to the contract"*.

## 🔴 First: the price half already worked

Worth checking before building anything. `billingMonthly`, `billingSetup`,
`contractTermMonths` and the per-lead rate **already merge into the agreement** from the
client record, set on the Billing card. If a price is wrong in a contract, that is where to
fix it, not here.

What had nowhere to go was **everything else**: a first month at half price, a free logo
refresh, sixty days' notice instead of thirty. Those were living in his head.

## Where it is

Client → **Contract** tab → **Special Terms** card, deliberately placed **above** the Send
via DocuSign button, because terms met after the Send button are met too late.

Type the note → **Write it up** → read the draft → **Add to the agreement** → edit or remove
any clause in place afterwards.

## 🔴 The safety model, which is most of what was built

**The AI never edits the agreement.** It produces ADDITIONAL clauses that land in one
bounded `Special Terms` section, and has no other way to touch the document.

That is not caution for its own sake:
- A model with a free hand over contract text could quietly weaken the **limitation of
  liability**, move the **governing law**, or undo the **arbitration clause**. Nobody would
  notice until it mattered.
- It keeps an attorney review of the base document meaningful. The base never moves, and
  everything negotiated sits in one place to read.

**Pinned by rendering the contract with and without terms and asserting everything else is
byte-identical.** If a clause could ever reach any other part of the document, that fails.

**Nothing saves itself.** The function reads the record to check for a signature and
**never writes to it**; a check fails if a `.update(` ever appears. Bryson accepts the draft
himself. A contract term that appeared without a person reading it is the same bug with a
friendlier face.

## 🔴 A signed agreement is frozen

The OS renders the contract **fresh every time it is shown**, so editing terms after
signature would silently rewrite the document the client already put their name to. The
server refuses with a **409** (its own status, so the OS can tell it apart from a generic
failure) and the card locks to read-only.

**A change after signing is an amendment, and an amendment is a new signed document.**

## Precedence, and why it is placed last

The section says: *"Where these Special Terms conflict with any earlier section of this
Agreement, these Special Terms control."*

A later clause stating that it controls is the standard, unambiguous way to vary an earlier
one. Varying a section in place would leave two readings of the same point, which is exactly
what a dispute turns on. It renders **before the signatures** so it is signed with everything
else.

## Escaping

Clause text is escaped in both copies. 🔴 **The check that matters is not the script tag.**
It is a clause that closes the paragraph and opens a **forged section heading**
(`</p><h2>1. Services and Scope</h2><p>Agency provides nothing.`), making the document appear
to say something it does not.

## Risky topics: flagged, never blocked

`flagRisky()` names six areas — liability, governing law and disputes, IP ownership, who pays
for ads, how the agreement ends, exclusivity — and shows *"Read these twice. They change …"*.

**Not blocked on purpose.** He is entitled to negotiate any of them, and a tool that refuses
to write what he agreed is a tool he stops using. Flagging puts the warning on the clause
that deserves a second read.

The **one** thing the prompt refuses outright is the hard business constraint: no clause may
ever have BoldLine paying for, fronting, holding or being billed for a client's ad spend. It
goes in `problems` instead of becoming a clause.

Also refused rather than guessed: a note too vague to write from. A vague clause is worse
than no clause, because it looks settled and is not.

## Two copies

`makeContractHTML` exists in `netlify/lib/contract-shared.cjs` (what the CLIENT reads in the
portal and what DocuSign sends) and in `index.html` (what Bryson reads). Both were changed.
The suite runs **both real generators** over the same clients and compares the rendered
section.

🔴 **Two mutations first failed on the DRIFT check rather than on their own assertion**,
because only the server copy was mutated. Re-run against both copies they failed correctly.
Mutating one copy of a two-copy thing only ever proves the drift check works.
