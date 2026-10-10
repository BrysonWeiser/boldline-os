---
name: contract-replace
topic: Contracts
task: cancel, replace or redo a client's advertising agreement after it was signed (signed by mistake, wrong terms, renegotiated)
keywords: [replace agreement, cancel contract, signed by mistake, void signed envelope, docusign void completed, redo contract, new contract, contract history, replacesAgreement, supersede, contract preview phone, signed pdf too big, fitframe]
status: verified
summary: DocuSign cannot void a COMPLETED envelope, so a signed agreement is "cancelled" by sending a new one that says it replaces and cancels the old one. OS Contract tab now has "Need to change or cancel this signed agreement?" > Replace this agreement. It archives the old signing into contractHistory, unlocks the terms, and the next agreement carries a cancels-the-earlier-one clause. The client stays counted (founding) until the new one is signed, because the old one still binds. Signed-PDF preview now scales to fit a phone.
verified: 2026-10-09
---

## Why it exists
Bryson, Fri 2026-10-09 (Springbok Wellness): he thought he had voided the old envelope, Brendon signed it
by mistake, and he needed it cancelled and a new one sent. Same day: the signed-contract preview on the
Contract tab overflowed his iPhone.

## 🔴 The legal shape (do not "fix" this into a delete)
- A completed DocuSign envelope **cannot be voided**. Only in-progress ones can.
- So the old agreement is ended **by agreement**: the new one contains a clause (rendered when
  `cl.replacesAgreement.signedAt` is set, in BOTH `netlify/lib/contract-shared.cjs` and index.html's
  `makeContractHTML` mirror) saying it replaces the Advertising Services Agreement signed on {date}
  (envelope id), that once signed the earlier one is cancelled with no further effect, and nothing is owed under it.
- Until the new one is signed **the old one still binds**, so the client keeps counting:
  `isFoundingClient` (`netlify/lib/founding.mjs`) and `foundingCountsFor` (index.html) both count
  `replacesAgreement.signedAt`. Consistent with "a deal is not real until it is in the OS": a signed
  contract was on the record, and resetting the flag must not silently drop a client from the count.
- Recommend Bryson tells the client first (a text) so a fresh envelope is not a surprise.

## How it works in the OS
`ReplaceAgreementCard` (index.html), shown on the Contract tab when `contractSigned && !internal`, collapsed
by default, two-step confirm. On confirm it saves:
- `contractHistory` (newest first, max 10): `{envelopeId, signedAt, signedContractPath, termsVersion, omits, replacedAt}`
  (the signed PDF in storage is NOT deleted, only unlinked from the live fields)
- `replacesAgreement: {envelopeId, signedAt}`
- resets `contractSigned, contractStatus:"pending", docusignEnvelopeId/Status/SentAt, contractSignedAt,
  signedContractPath, contractTermsVersion, contractOmits` so the terms unlock and Send works again.
A gold note "This replaces the agreement signed {date}" shows while the new one is unsigned.
Nothing is sent to the client by the button itself; Bryson edits terms then presses Send as normal.

## Phone fit
`FitFrame` (index.html) renders an iframe at a natural width and CSS-scales it to the container. The signed
DocuSign PDF uses `natural={840}`; the Contract / Current terms previews use `natural={1}` (never scaled,
their HTML is already responsive). Preview-safety test treats `<FitFrame` as an embed and checks it adds no
`allow-` sandbox permissions.

## Tests
`tests/verify-contract-replace.mjs` (clause in both templates, founding count, card fields, FitFrame use).
