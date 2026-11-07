// Deleting a client cancels every agreement still waiting for their signature FIRST (KB client-delete-voids).
//
// Bryson, 2026-11-06: "if i delete a client that I am onboarding but they havent signed the agreement yet ... any
// agreements that are still sent but not signed yet are automatically voided". Until now the OS deleted the record
// and left the DocuSign envelope live in their inbox: they could still sign an agreement for a client that no longer
// existed, nothing would record it, and the signed PDF would land with nobody to file it against.
//
// 🔴 CANCEL FIRST, DELETE SECOND, AND NOT AT ALL IF A CANCEL FAILS. Deleting first would throw away the only record of
// which envelopes exist. A cancel DocuSign refused leaves a signable agreement out there, so the client stays put and
// Bryson is told why; trying again later is safe.
// Pure: DocuSign and the database are passed in, so the order and the refusals are testable without either.

// Every agreement the record knows about: the ads agreement, the website agreement, and earlier ones kept on file.
export function agreementsOf(d = {}) {
  const out = [], seen = new Set();
  const add = (id, kind) => { const s = String(id || "").trim(); if (/^[A-Za-z0-9-]{8,64}$/.test(s) && !seen.has(s)) { seen.add(s); out.push({ id: s, kind }); } };
  add(d.docusignEnvelopeId, "ads");
  add(d.websiteDeal && d.websiteDeal.agreement && d.websiteDeal.agreement.envelopeId, "website");
  for (const h of Array.isArray(d.contractHistory) ? d.contractHistory : []) add(h && h.envelopeId, "earlier");
  return out;
}

// DocuSign states a client can still sign from. "completed", "declined" and "voided" are finished; a "created" draft
// was never sent, so nobody can sign it.
export const SIGNABLE = ["sent", "delivered", "correct"];
export const VOID_REASON = "This agreement was cancelled by BoldLine Media.";

// { ok, voided, error }. `getStatus(id)` -> DocuSign status string, or null when DocuSign has no such envelope.
export async function deleteClientWithAgreements(client, { getStatus, voidEnvelope, deleteRow, configured = true }) {
  const d = (client && client.data) || {};
  const name = d.name || "This client";
  const list = agreementsOf(d);
  if (list.length && !configured) return { ok: false, voided: 0, error: `${name} has an agreement in DocuSign, and DocuSign isn't connected right now, so they weren't deleted.` };
  let voided = 0;
  for (const a of list) {
    let status;
    try { status = await getStatus(a.id); }
    catch (e) { return { ok: false, voided, error: `Couldn't check ${name}'s agreement with DocuSign, so they weren't deleted. Try again in a minute.` }; }
    if (!SIGNABLE.includes(String(status || "").toLowerCase())) continue;
    try { await voidEnvelope(a.id, VOID_REASON); voided++; }
    catch (e) { return { ok: false, voided, error: `DocuSign wouldn't cancel ${name}'s unsigned agreement, so they weren't deleted. Try again in a minute.` }; }
  }
  try { await deleteRow(client.id); }
  catch (e) { return { ok: false, voided, error: `${voided ? "Their unsigned agreement was cancelled, but " : ""}${name} couldn't be deleted. Try again.` }; }
  return { ok: true, voided, error: "" };
}
