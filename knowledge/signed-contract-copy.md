---
name: signed-contract-copy
topic: Contracts
task: show, store or reason about the agreement a client actually signed; why the OS copy and the DocuSign copy differ
keywords: [signed contract, docusign, snapshot, re-render, contractView, signedContractPath, client-contracts bucket, contract-file, contract-pdf, combined document, certificate of completion, archive, drift]
status: verified
summary: There were TWO copies of every agreement and only one was the contract. The OS copy re-renders from the client record on every open, so editing a date or a fee silently changed what the OS, and the CLIENT'S PORTAL, called their agreement. The DocuSign copy is a snapshot frozen at send time and is the legally operative one. Built 2026-09-16 - the watcher now fetches the completed PDF into a PRIVATE `client-contracts` bucket, the OS viewer archives on demand so nobody waits for the sweep, and a catch-up pass retries forever so one failed fetch never means no copy. `contractView` (mirrored in index.html, pinned by a test) gives three states, and the middle one, signed-but-not-fetched, SAYS SO rather than falling back to the re-render. The re-render is now folded away and labelled "Today's terms, rebuilt from this record". 65 checks + 16 mutations.
verified: 2026-09-16
---

## The defect

Bryson, 2026-09-16, having worked out for himself what happens in DocuSign when a contract date
changes in the OS: *"make it so it only ever shows the correct version"*.

- **The OS copy RE-RENDERS.** `makeContractHTML` builds the agreement from the client record
  every time it is drawn, so a changed start date, fee or package changes it instantly.
- **The DocuSign copy is a SNAPSHOT.** `docusign-send.mjs` renders once, base64s that HTML into
  the envelope and uploads it. DocuSign flattens it to a PDF. It never re-renders. **That frozen
  PDF is the legally operative document.**

Both were titled "Your Agreement", in the OS and in the client's own portal. So an edit on our
side changed what a client was shown as their contract, silently, with no way for them to check.
The OS recorded THAT they signed and WHEN, never WHAT.

## What was built

**Storage.** `netlify/lib/docusign-archive.mjs` holds the pure decisions; the fetching lives in
its callers. The completed document (`/documents/combined`, which is the signed pages AND the
Certificate of Completion) goes into the **private** `client-contracts` bucket, keyed
`<clientId>/<envelopeId>.pdf`.

- 🔴 **Private, and deliberately not the photo bucket.** `client-media` is created `public: true`
  because landing pages load from it. A signed agreement carries the client's address, their fee
  and their signature.
- 🔴 **Keyed by ENVELOPE, not by date or client alone**, so a renewal does not overwrite the
  original agreement.
- 🔴 **Only a real PDF counts.** DocuSign answers errors with a JSON body and a zero-byte 200 is
  a documented failure mode. `looksLikePdf` checks the `%PDF-` magic and there is a 1000-byte
  floor. A stored error page the OS then shows as a client's contract is this bug again, worse.

**Three places fetch it, one helper builds the path** (`combinedDocumentPath`): the scheduled
watcher, the OS viewer, and the client's own `contract-pdf` download. Three hand-built copies of
one URL is the drift this project keeps getting bitten by.

**Two ways it lands.**
1. `docusign-watch` fetches it on the run that records the signature, BEFORE the save, so the
   signature and its document land in one write.
2. 🔴 **A CATCH-UP PASS, which is not optional.** `needsCheck` stops looking at a client the
   instant `contractSigned` is true, so a single failed fetch would have meant no copy for the
   life of that agreement. Every sweep also looks for signed clients with no stored document and
   tries again. It also covers every client who signed before this existed.
3. `contract-file.mjs` archives ON DEMAND when Bryson opens a contract that has not been picked
   up, so he never waits fifteen minutes.

🔴 **A file failure NEVER costs a signature.** The save happens regardless; the copy catches up.

## What the screens may claim

`contractView(client)` returns three states, and the middle one used to be a lie:

| State | Means | What is shown |
|---|---|---|
| `draft` | nothing signed | the re-render, correctly, because it IS what gets sent |
| `pending` | signed, copy not fetched yet | 🔴 an amber card SAYING SO. Never the re-render as the agreement |
| `signed` | the PDF is stored | the signed PDF, in an iframe on an expiring signed URL |

The re-render still exists, folded away, titled **"Today's terms, rebuilt from this record"**
with an explicit "This is not the signed agreement". It is genuinely useful for spotting drift.

🔴 `contractView` is **mirrored in `index.html`** because the OS is one static file that cannot
import it. `verify-preview-safety` compares the two with whitespace stripped.

**The portal too**, which is the worse half: the client's own page now says "Your Signed
Agreement", and the written-out terms below say "if anything here ever differs from your signed
copy above, the signed copy is the one that applies". Both copies of the portal, as always.

## Privacy

- The bucket is private; every read is a signed URL valid for one hour, fetched on demand and
  never written to the record.
- `contract-file` requires the owner's Supabase session and takes the path **from the record**,
  never from the request. Signing whatever path a caller asks for would turn one session into
  every client's agreement.
- The signed-PDF iframe is given no `allow-same-origin` and no `allow-forms`.

## Tests

`tests/verify-signed-contract.mjs` (65 checks) plus new rows and assertions in
`verify-preview-safety` (the manifest now also covers non-`srcDoc` embeds, scoped to `src={...}`
so the saved-page viewer, which opens in its own tab, stays out of scope). **16 mutations
verified**, including: a JSON error body accepted as a contract, a near-empty response stored,
`pending` collapsed into `signed`, the catch-up pass removed, the bucket made public, the viewer
signing any requested path, the session check removed, the re-render shown open, its warning
label dropped, and the two copies of the rule disagreeing.

`verify-contract-pdf` had two assertions grepping for a URL literal that moved into the shared
helper; they now RUN the helper, which is stronger than the string was.

## Still true

The OS is not a system of record for signatures. If this ever needs to stand up formally, the
DocuSign account is the origin and the stored PDF is a copy of it. What changed is that the copy
now exists and nothing pretends a re-render is it.
