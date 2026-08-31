---
name: docusign-signature-watch
topic: OS app
task: make the OS notice by itself when a client signs, or debug why a signed contract still shows pending
keywords: [docusign-watch.mjs, docusign-status.mjs, docusign-auth.mjs, envelope status polling, delivered is not signed, contractSigned auto flip, docusignEnvelopeId, docusignSentAt, docusignNudgedAt, decideFromEnvelope, needsCheck, decideNudge, contract_signed email, docusign connect webhook]
status: verified
summary: A scheduled job polls DocuSign every 15 min and flips a client to signed by itself, alerts Bryson, and emails the client their confirmation. "delivered" means OPENED, not signed — treating it as signed is the bug the whole suite guards. Declined and voided raise red alerts. Uncertainty (unknown status, failed lookup, failed save) changes nothing and never alerts.
verified: 2026-08-27
---

Built 2026-08-27, an hour after DocuSign production went live. Bryson: *"can you make it so
the os automatically knows when he signed and updates it and sends me a notification."*
This is the return path that `docusign-integration` listed as its last TODO.

## What it does

Every 15 minutes, for each client that has an envelope out and is not yet marked signed:
ask DocuSign where that envelope got to, and act on the answer.

| Envelope status | What happens |
|---|---|
| `completed` | `contractSigned: true`, `contractStatus: "active"`, `contractSignedAt` set from DocuSign's own timestamp; green alert to Bryson (email + push + SMS); the client is auto-sent the `contract_signed` email; a note goes in their comm log |
| `created` / `sent` / `delivered` | only `docusignStatus` is recorded. **No alert, no email, no flip.** |
| `declined` | red alert with the reason, `contractStatus` stays `pending`, nothing emailed to the client |
| `voided` | red alert ("send a fresh one"), contract stays pending |
| anything else, or no status | **nothing changes at all** |

Plus a **chase reminder**: an envelope unsigned for `NUDGE_AFTER_DAYS` (3) days raises one
yellow alert, stamped in `docusignNudgedAt` so it is said **once**, not 96 times a day.

## 🔴 "delivered" IS NOT SIGNED

DocuSign marks an envelope `delivered` the moment the recipient **opens the email**. It is
the single most misread status in that API. Reading it as signed would mark a contract
active, fire "they signed!" to Bryson's phone, and send the client "your agreement is on
file" before they had read a word of it. `IN_FLIGHT` in `docusign-status.mjs` exists to keep
that explicit, and `verify-docusign-watch.mjs` asserts all four wrong outcomes for each
in-flight status.

## Design decisions worth not re-litigating

- **Polling, not DocuSign Connect (webhooks).** Connect would be instant, but it is not on
  the eSignature Standard plan this account runs, and it would need a new public endpoint, a
  shared secret and signature verification. Polling reuses the JWT auth already proven
  working, needs zero configuration inside DocuSign, and cannot be broken by someone changing
  a setting there. Cost: up to 15 minutes of delay, which nobody notices.
- **The decision is pure and lives apart from the fetching.** `netlify/lib/docusign-status.mjs`
  takes a client + an envelope and returns `{ patch, alert, email, note }`. It touches no
  network, so the branches that only happen when a client declines at 2am are testable.
- **The loop takes its world as arguments.** `runWatch({ loadClients, fetchEnvelope,
  saveClient, alert, sendEmail, now })` — the handler is the only thing that knows about
  Supabase and DocuSign. That is what lets the tests execute the bad-day guards for real
  instead of reasoning about them.
- **Auth was extracted, not copied.** `netlify/lib/docusign-auth.mjs` now holds the JWT
  signing that `docusign-send.mjs` used to own, because two copies of one thing is exactly
  the drift that bit the contract and the portal on the same day.

## 🔴 The three "do nothing" guards

Each one is a way Bryson could be told something false:

1. **A lookup that throws changes nothing.** An expired token or a rate limit must never
   read as "not signed yet". The next run tries again.
2. **If the save fails, no alert is sent.** Telling him a contract is active while the record
   still says pending is worse than silence: he would act on it, and the next run would alert
   him all over again.
3. **An already-signed client is never even looked up.** The row that is never read is the
   row that can never be re-flipped or re-alerted.

Fail-soft in the other direction: a dead notification channel or a bounced client email never
undoes a correctly recorded signature.

## Where Bryson sees it

The client's **Contract tab**. Before this the card only knew what had happened in that page
session, so a refresh showed a fresh "Send via DocuSign" button on a contract already sitting
in the client's inbox (an easy way to send the same thing twice, on a plan capped at 10
envelopes a month). It now reads the stored status: *Waiting on Signature* / *Opened, Not
Signed Yet* / *They Declined to Sign* / *Agreement Voided*, with how long it has been, and
the button becomes a quieter "Send Another Copy".

## Files

- `netlify/lib/docusign-status.mjs` — the pure decision (`needsCheck`, `decideFromEnvelope`, `decideNudge`)
- `netlify/lib/docusign-auth.mjs` — shared JWT auth + `dsGet()`
- `netlify/functions/docusign-watch.mjs` — `runWatch()` + the scheduled handler
- `netlify.toml` — `[functions."docusign-watch"] schedule = "*/15 * * * *"`
- `tests/verify-docusign-watch.mjs` — 92 checks; every guard was broken once and the suite
  caught all ten mutations (including "treat delivered as signed" and "alert even when the
  save failed")

No new environment variables. It reuses the five `DOCUSIGN_*` vars plus
`SUPABASE_SERVICE_ROLE_KEY`, and alerts ride the existing dispatcher. If DocuSign is not
configured the job exits quietly rather than paging 96 times a day.

## Watch out for

**The 10-envelopes-a-month plan ceiling.** Reads do not count against it, only sends, but a
"Send Another Copy" does. See `docusign-integration`.


## 2026-08-31 — the contract renders its own signature block

`contractSignedAt` was being stored and shown nowhere. The agreement in the portal still
displayed empty signature lines and `Date: ______` after signing, which reads as unsigned.

`makeContractHTML` (both copies) now branches on `contractSigned && contractSignedAt`:

- **Client side:** signer name, *"Signed electronically via DocuSign"*, and the real date.
- **Agency side:** *"Issued by BoldLine Media LLC"*, NOT "signed". 🔴 `docusign-send` sends
  **exactly one signer, the client**. Claiming Bryson signed would be a fabrication on a
  legal document. If a genuine counter-signature is ever wanted, add him as a second signer
  in `docusign-send` first.
- **No recorded date:** falls back to the blank form. A date we invented is worse than a
  blank line.

🔴 **THE UNSIGNED BRANCH IS LOAD-BEARING AND MUST STAY BLANK.** `/BL_SIGN_HERE/` is the anchor
DocuSign attaches its signature box to, and `docusign-send` renders the document while
`contractSigned` is still false. If the executed block ever renders for an unsigned client,
the anchor disappears and the client receives a contract with nowhere to sign — the same
failure as the original `SIGN_ANCHOR` bug. Tested harder than the signed branch for that
reason.

### ✅ BUILT 2026-08-31 — the executed PDF is downloadable

`netlify/functions/contract-pdf.mjs`, `GET ?token=<portalToken>`. Fetches
`/envelopes/{id}/documents/combined` — the signed document **plus the Certificate of
Completion**. `combined` on purpose: the document alone drops the audit trail, which is the
only reason to prefer this over the OS's own rendering.

🔴 **The envelope id is read from the row the token matched and is NEVER accepted from the
request.** An endpoint that took an envelope id would let anyone holding any valid portal
link enumerate every agreement BoldLine has ever sent.

Other rules worth keeping: `contractSigned` and `docusignEnvelopeId` are checked
**separately** (an envelope exists from the moment it is SENT, so the id alone would return
an unsigned document labelled as the signed copy); an empty or failed DocuSign response is
refused rather than passed through, since **a zero-byte 200 is a real DocuSign failure mode**;
`private, no-store`, because the token is in the URL. The portal button appears only when both
conditions hold, so an early client who signed an emailed PDF never sees an option that
errors.
