---
name: contract-replace
topic: Contracts
task: cancel, replace or redo a client's advertising agreement after it was signed (signed by mistake, wrong terms, renegotiated)
keywords: [replace agreement, cancel contract, signed by mistake, void signed envelope, docusign void completed, redo contract, new contract, contract history, replacesAgreement, supersede, contract preview phone, signed pdf too big, fitframe]
status: verified
summary: DocuSign cannot void a COMPLETED envelope, so a signed agreement is "cancelled" by sending a new one that says it replaces and cancels the old one. OS Contract tab now has "Need to change or cancel this signed agreement?" > Replace this agreement. It archives the old signing into contractHistory, unlocks the terms, and the next agreement carries a cancels-the-earlier-one clause. The client stays counted (founding) until the new one is signed, because the old one still binds. Signed-PDF preview is drawn with pdf.js and trimmed to the text column so it reads on a phone (shrinking the whole page made text too small).
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

## Phone fit (two rounds, same evening)
1. First try: `FitFrame` (iframe at a natural width, CSS-scaled). Fit the screen, but Bryson: "now the agreement
   preview is to small". A letter page's wide white margins plus shrinking = unreadable. Also iOS draws a PDF in
   an iframe at 612px (1pt = 1px), so `natural={840}` was wrong anyway.
2. Now `PdfPages` (index.html): loads pdf.js 3.11.174 from cdnjs on demand (`isEvalSupported:false`), reads each
   page's text positions to find the column the writing sits in, ignoring the top 36pt (DocuSign's envelope-ID
   stamp sits outside the margin and would undo the trim), and draws every page on a canvas so that column fills
   the width (max 760px on big screens), in a 560px scroll box. Pages whose text runs wider than page one's
   (DocuSign's certificate page) are drawn whole. Up to 30 pages. If pdf.js fails it falls back to
   `FitFrame natural={612}`. The Contract / Current terms previews still use `FitFrame natural={1}` (never
   scaled, their HTML is responsive). Preview-safety test treats `<FitFrame` as an embed; the fallback keeps the
   literal title "Signed agreement" so the manifest matches.
   Checked headlessly with a Letter PDF of the contract + a fake stamp at 390 and 1280 (pdf.js served locally;
   unpkg/cdnjs are not reachable from the test browser, route them to `osdeps/node_modules`).

3. Round three, Bryson: "the code at the top is just slightly cut off still". The envelope-ID stamp starts ~70pt
   left of the column, so excluding it clipped it. Now the stamp is measured separately (top 36pt band) and the
   trim's LEFT edge moves out to include it; the right edge stays the writing's. Costs ~14% text size versus the
   pure column trim; deliberately not made symmetric (that would cost ~25%).

4. Round four, Bryson: "make sure it's even on both sides ... it used to fit before". Widening only the left made
   the page lopsided and the text smaller. Now: trim is the writing's column + 14pt on BOTH sides (round-2 size),
   and the thin top strip holding the stamp (top of page to just under the stamp, never into the writing) is
   redrawn shifted right so the stamp starts at the column's left edge. Mechanics: each page is rendered in full
   to an offscreen canvas, then cut into the visible canvas (body at x0, stamp strip at stamp.l - pad). If the
   stamp is wider than the column, the trim instead widens evenly on both sides. The preview therefore moves the
   stamp a little; "Open it full size" is DocuSign's untouched file. `pdfTextSpan` now returns
   `{l, r, top, stamp:{l, r, bottom}}` (distances from the page's left and top edges).

## Tests
`tests/verify-contract-replace.mjs` (clause in both templates, founding count, card fields, FitFrame use).
