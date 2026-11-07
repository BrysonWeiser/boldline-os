// Deleting a client cancels every agreement still waiting for their signature first (KB client-delete-voids).
// Run: node tests/verify-client-delete.mjs
//
// Bryson, 2026-11-06: "if i delete a client that I am onboarding but they havent signed the agreement yet ... any
// agreements that are still sent but not signed yet are automatically voided". What this stops, worst first:
//  1. A deleted client still able to sign a live agreement nobody has a record of.
//  2. The record deleted first, losing the only list of which agreements exist.
//  3. A signed agreement (which DocuSign can't cancel) blocking a delete, or being "cancelled".
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { agreementsOf, deleteClientWithAgreements, SIGNABLE, VOID_REASON } from "../netlify/lib/client-delete.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const A = "aaaaaaaa-1111-2222-3333-444444444444", W = "bbbbbbbb-1111-2222-3333-444444444444", H = "cccccccc-1111-2222-3333-444444444444";

// A fake DocuSign and database that record the order things happen in.
const rig = (statuses, { voidFails = [], statusFails = [], deleteFails = false } = {}) => {
  const log = [];
  return { log, deps: {
    getStatus: async (id) => { log.push(["status", id]); if (statusFails.includes(id)) throw new Error("docusign 500"); return id in statuses ? statuses[id] : null; },
    voidEnvelope: async (id, why) => { log.push(["void", id, why]); if (voidFails.includes(id)) throw new Error("docusign 400"); },
    deleteRow: async (id) => { log.push(["delete", id]); if (deleteFails) throw new Error("db"); },
  } };
};
const client = (data) => ({ id: "c1", data: { name: "Air Suds", ...data } });

// ── 1. Which agreements it knows about ──────────────────────────────────────────────────────────────────────────────
ok("🔴 the ads agreement, the website agreement and earlier ones on file, each once",
  JSON.stringify(agreementsOf({ docusignEnvelopeId: A, websiteDeal: { agreement: { envelopeId: W } }, contractHistory: [{ envelopeId: H }, { envelopeId: A }] }).map((x) => x.kind)) === '["ads","website","earlier"]');
ok("junk and blanks are ignored", agreementsOf({ docusignEnvelopeId: "", websiteDeal: { agreement: { envelopeId: "<x>" } } }).length === 0);
ok("only agreements someone could still sign are cancelled", JSON.stringify(SIGNABLE) === '["sent","delivered","correct"]');

// ── 2. The order, and the refusals ──────────────────────────────────────────────────────────────────────────────────
{
  const { log, deps } = rig({ [A]: "sent", [W]: "delivered" });
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A, websiteDeal: { agreement: { envelopeId: W } } }), deps);
  ok("🔴 an unsigned ads agreement and an opened-but-unsigned website agreement are both cancelled, THEN the client is deleted",
    r.ok && r.voided === 2 && JSON.stringify(log.map((x) => x[0])) === '["status","void","status","void","delete"]', JSON.stringify(log));
  ok("the reason they see is plain and has no dash", log[1][2] === VOID_REASON && !/[—–]/.test(VOID_REASON));
}
{
  const { log, deps } = rig({ [A]: "sent" }, { voidFails: [A] });
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A }), deps);
  ok("🔴 if DocuSign won't cancel it, the client is NOT deleted, and he's told why", !r.ok && !log.some((x) => x[0] === "delete") && /wouldn't cancel Air Suds's unsigned agreement, so they weren't deleted/.test(r.error));
}
{
  const { log, deps } = rig({}, { statusFails: [A] });
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A }), deps);
  ok("🔴 if DocuSign can't even be asked, nothing is deleted", !r.ok && !log.some((x) => x[0] === "delete") && /Couldn't check/.test(r.error));
}
{
  const { log, deps } = rig({ [A]: "completed", [H]: "voided", [W]: "declined" });
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A, contractHistory: [{ envelopeId: H }], websiteDeal: { agreement: { envelopeId: W } } }), deps);
  ok("🔴 a signed, already-cancelled or declined agreement is left alone, and the delete goes ahead", r.ok && r.voided === 0 && !log.some((x) => x[0] === "void") && log.some((x) => x[0] === "delete"));
}
{
  const { log, deps } = rig({});
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A }), deps);
  ok("an agreement DocuSign no longer has is nothing to cancel", r.ok && r.voided === 0 && log.some((x) => x[0] === "delete"));
}
{
  const { log, deps } = rig({});
  const r = await deleteClientWithAgreements(client({}), { ...deps, configured: false });
  ok("a client with no agreement at all is deleted without touching DocuSign", r.ok && !log.some((x) => x[0] !== "delete"));
  const r2 = await deleteClientWithAgreements(client({ docusignEnvelopeId: A }), { ...deps, configured: false });
  ok("🔴 with an agreement but DocuSign disconnected, nothing is deleted", !r2.ok && /DocuSign isn't connected/.test(r2.error));
}
{
  const { deps } = rig({ [A]: "sent" }, { deleteFails: true });
  const r = await deleteClientWithAgreements(client({ docusignEnvelopeId: A }), deps);
  ok("if the delete itself fails after cancelling, he's told both halves", !r.ok && r.voided === 1 && /unsigned agreement was cancelled, but Air Suds couldn't be deleted/.test(r.error));
}

// ── 3. Wired in ─────────────────────────────────────────────────────────────────────────────────────────────────────
const UI = src("index.html"), FN = src("netlify/functions/client-delete.mjs");
const DEL = UI.slice(UI.indexOf("const deleteClient = useCallback("), UI.indexOf("const updateLead = useCallback("));
ok("🔴 the OS deletes through the server step, never straight from the screen", /fetch\("\/\.netlify\/functions\/client-delete"/.test(DEL) && !/from\("clients"\)\.delete\(\)/.test(UI));
ok("🔴 the card only disappears after the server says it's done, and a refusal is shown", DEL.indexOf("if(!r||!r.ok){ setClientError(") < DEL.indexOf("setClients(prev=>prev.filter("));
ok("ARIA's 'delete client' tells the truth either way", /r&&r\.ok\?`Deleted \$\{target\.name\}\./.test(UI) && /was NOT deleted: /.test(UI));
ok("the confirm box says the unsigned agreement will be cancelled first", /Their agreement is still waiting for a signature, so it will be cancelled in DocuSign first\./.test(UI));
ok("owner only, and it checks DocuSign's real status (not just what the record says)", /db\.auth\.getUser\(jwt\)/.test(FN) && /dsGet\(`\/envelopes\/\$\{encodeURIComponent\(envId\)\}`\)/.test(FN) && /status: "voided", voidedReason: reason/.test(FN));

console.log(`verify-client-delete: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
