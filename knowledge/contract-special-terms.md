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

## 2026-09-28 — a draft came back blank with no reason (Springbok's lead definition)

Bryson pasted a four-part qualified-lead definition plus the monthly review call. The card said
"Nothing could be written from that. See below." and below was EMPTY: zero clauses AND zero problems.
Most likely cause (could not be reproduced without the live key): the model returned the arrays as
JSON-encoded STRINGS, a known tool-use habit on longer nested answers, and `Array.isArray` silently
threw everything away. Fixed in `contract-terms.mjs`:
- `coerceList` / `toClauses` accept an array, a JSON string of one, a single object, or a bare sentence.
- An empty draft with no reason is now an **error with an instruction** (press again, or split the
  note; "too long" if the model hit `max_tokens`), and the raw input is logged for next time.
- `max_tokens` 2000 → 4000 so a long definition is not cut off mid-answer.
- The card only says "see below" when there is a reason below.
Tests: +5 in `verify-special-terms` (21), mutation caught.

### Same evening: the real cause was THINKING eating the token budget

After the fix above, Bryson got "too long, split it" on one paragraph. The draft had stopped at
`max_tokens`: **claude-sonnet-5 runs adaptive thinking when `thinking` is omitted, and thinking tokens
count against `max_tokens`**, so it deliberated through all 4,000 and wrote nothing. Now
`thinking: { type: "disabled" }` (valid on Sonnet 5, and compatible with the forced tool call) and
`max_tokens: 8000`. The "split it" message is gone: a long paragraph is not his problem to solve.

🔴 **Same trap, not yet fixed, in other Sonnet 5 calls with no `thinking` set and small budgets:**
`lead-fee.mjs` (1500), `outreach-draft.mjs` (1600), `handover-pack.mjs` (3000), `content-studio`,
`ad-gen-shared` (meta/creatives 3000, shorten 2000). They fall back to claude-opus-4-8 when the first
model fails, which may be masking it. Check each for `stop_reason: "max_tokens"` before trusting it.

### Third round the same night: stop guessing, make it fail-safe and self-explaining

Still failing after thinking was disabled, and the cause could not be seen from here (no API key in
the workspace). So instead of a fourth guess:
- **Two models, in order**: claude-sonnet-5 (thinking disabled) then **claude-opus-4-8** (no thinking
  field), the same fallback every other drafting function already had.
- **`readDraft`** reads the tool input as an object, as a JSON string, wrapped one level down, with
  `terms`/`items` for clauses and `title`/`name`, `body`/`clause`/`content` as field synonyms.
- **When both fail, the card shows "Details for Claude:"** with each model's stop reason, output
  tokens and the first 220 characters of what it returned. The next screenshot names the cause.
- 🔴 **The endpoint itself is now RUN in the test** (`verify-special-terms`, 29 checks) with fetch
  stubbed for Supabase and the Messages API: normal answer, stringified lists, stringified input,
  wrapped input, first model out of room then second succeeds, first model errors, both fail with
  details, a real "problems" reason. Three mutations caught (no fallback, thinking back on, string
  input not parsed).
