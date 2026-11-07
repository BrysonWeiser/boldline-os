---
name: client-delete-voids
topic: Clients
task: delete a client safely, cancelling any DocuSign agreement still waiting for their signature first
keywords: [delete client, deleting a client, void agreement, void envelope, cancel agreement, unsigned agreement, docusign void, voidedReason, client-delete, deleteClientWithAgreements, agreementsOf, onboarding client deleted]
status: LIVE 2026-11-06
summary: Bryson, 2026-11-06 - "if i delete a client that I am onboarding but they havent signed the agreement yet ... any agreements that are still sent but not signed yet are automatically voided". Deleting used to remove the record straight from the browser and leave the DocuSign envelope live. Now the delete goes through a server step that checks every agreement on the record with DocuSign (ads, website, earlier ones), voids the ones still signable (sent / delivered / correct), and only then deletes. If DocuSign can't be reached or refuses a void, the client is NOT deleted and the OS says why.
verified: 2026-11-06
---

## How it works
- `netlify/functions/client-delete.mjs` (POST { id }, owner only) + pure `netlify/lib/client-delete.mjs`.
- `agreementsOf(data)`: `docusignEnvelopeId` (ads agreement), `websiteDeal.agreement.envelopeId`, every
  `contractHistory[].envelopeId`; deduped.
- For each: GET the real status from DocuSign (404 = gone, nothing to do). Status in `SIGNABLE`
  (sent, delivered, correct) -> PUT `status: "voided"` with reason "This agreement was cancelled by BoldLine Media."
  (the signer gets DocuSign's own "voided" email with that line). completed / declined / voided / created are left.
- 🔴 Order: cancel FIRST, delete SECOND. Any failure (DocuSign unreachable, not connected, or refusing) stops before
  the delete, because the record is the only list of which envelopes exist and a signable agreement must never outlive
  it. A delete that fails after cancelling reports both halves.
- OS: `deleteClient` in App calls it and removes the card only after `ok`; errors show in the client error banner.
  ARIA's "delete client" confirm reports the truth ("NOT deleted: ..." or "Deleted X. Their unsigned agreement was
  cancelled in DocuSign first."). The Edit client > Delete confirm box says the unsigned agreement will be cancelled.
- Nothing else deletes clients (the browser `from("clients").delete()` call is gone and a test bans it).

## Not covered (offered, not built)
- Unpaid Stripe invoices sent before signing (website deposit / first invoice) are not voided on delete.
- Resending an ads agreement while an older one is unsigned overwrites `docusignEnvelopeId`, so that older envelope is
  not tracked (pre-existing; the send button is meant to be blocked while one is awaiting).

## Tests
`tests/verify-client-delete.mjs` (17 checks).
