// Watches every outstanding DocuSign envelope and closes the loop when one is signed.
//
// Bryson, 2026-08-27, right after DocuSign went live: *"can you make it so the os
// automatically knows when he signed and updates it and sends me a notification."*
//
// Before this, "Send via DocuSign" was a one-way door. The envelope went out and the OS
// never heard back, so `contractSigned` was a box Bryson ticked from memory. That is the
// same class of problem as a hand-ticked launch checklist (KB `house-pipeline-honesty`):
// a stored flag that nobody updates drifts from reality and is trusted anyway.
//
// 🔴 POLLING, NOT A WEBHOOK, AND THAT IS A DELIBERATE CHOICE.
// DocuSign Connect (their push notifications) would be instant, but it is not on the
// eSignature Standard plan this account runs, and it would need a new public endpoint, a
// shared secret and signature verification. Polling reuses the JWT auth that was proven
// working an hour ago, needs zero configuration in DocuSign, and cannot be broken by
// someone changing a setting there. The cost is a delay of up to fifteen minutes on
// "your client signed", which nobody will ever notice.
//
// 🔴 THE LOOP TAKES ITS WORLD AS ARGUMENTS. `runWatch` is handed the four things it
// touches — read clients, read an envelope, save a client, raise an alert — so the guards
// that only fire on a bad day (a lookup that throws, a save that fails) are exercised by
// the real loop in tests instead of being reasoned about. The handler below is the only
// place that knows about Supabase and DocuSign.
//
// Required env: the five DOCUSIGN_* vars plus SUPABASE_SERVICE_ROLE_KEY. Alerts ride the
// existing dispatchAlert (email + push + SMS), so nothing new needs configuring.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { dsGet, dsGetBytes, isConfigured } from "../lib/docusign-auth.mjs";
import { needsCheck, decideFromEnvelope, decideNudge } from "../lib/docusign-status.mjs";
import { needsArchive, fetchAndStore, combinedDocumentPath, CONTRACT_BUCKET } from "../lib/docusign-archive.mjs";

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const noteFor = (decision, nudge, patch) =>
  decision.note === "signed" ? `Agreement signed via DocuSign on ${fmt(patch.contractSignedAt)}. Contract is now active.`
  : decision.note === "declined" ? "Client DECLINED the DocuSign agreement."
  : decision.note === "voided" ? "The DocuSign agreement was voided."
  : nudge ? "Reminder raised: agreement still unsigned."
  : "";

export async function runWatch({ loadClients, fetchEnvelope, saveClient, alert, sendEmail, fetchDocument, storeDocument, now = () => new Date() }) {
  const rows = (await loadClients()) || [];
  const pending = rows.filter((r) => needsCheck(r.data));
  const summary = { pending: pending.length, checked: 0, signed: 0, declined: 0, voided: 0, nudged: 0, unchanged: 0, errors: 0, archived: 0, archiveErrors: 0 };

  for (const row of pending) {
    const cl = row.data;
    let envelope = null;
    try {
      envelope = await fetchEnvelope(cl.docusignEnvelopeId);
      summary.checked++;
    } catch (e) {
      // 🔴 A FAILED LOOKUP CHANGES NOTHING. An expired token, a rate limit or a network
      // blip must never be read as "not signed yet" and must certainly never flip a record.
      // The next run tries again fifteen minutes later.
      summary.errors++;
      console.error(`docusign-watch: could not read envelope for ${cl.name}:`, e.message);
      continue;
    }

    const at = now();
    const decision = decideFromEnvelope(cl, envelope, at);
    // Never nudge in the same run as something worth interrupting him for. Merely
    // RECORDING that an envelope moved from sent to delivered is not that — an envelope
    // can be opened and still be four days overdue, and both facts belong in one write.
    const nudge = decision.alert ? null : decideNudge(cl, at);
    const patch = { ...(decision.patch || {}), ...((nudge && nudge.patch) || {}) };
    const alertPayload = decision.alert || (nudge && nudge.alert) || null;

    // 🔴 THE COPY IS FETCHED BEFORE THE SAVE, so a client that signs is recorded as signed
    // AND holding its document in one write rather than two. If the fetch fails the save
    // still happens with everything else: the signature is the fact that matters, and the
    // second pass below picks the document up on a later run.
    let archived = null;
    if (decision.note === "signed" && fetchDocument && storeDocument) {
      try {
        archived = await fetchAndStore({ client: cl, id: row.id, fetchDocument, storeDocument, now });
      } catch (e) {
        summary.archiveErrors++;
        console.error(`docusign-watch: could not store the signed copy for ${cl.name}:`, e.message);
      }
    }
    if (archived) Object.assign(patch, archived);

    if (Object.keys(patch).length) {
      const note = noteFor(decision, nudge, patch);
      const next = {
        ...cl, ...patch,
        ...(note ? { commLog: [{ date: fmt(at), note, cat: "contract", ts: at.getTime() }, ...(cl.commLog || [])] } : {}),
      };
      try {
        await saveClient(row.id, next);
      } catch (e) {
        // 🔴 IF THE SAVE FAILED, DO NOT ALERT. Telling Bryson a contract is active when the
        // record still says pending is worse than telling him nothing: he would act on it,
        // and the next run would alert him all over again.
        summary.errors++;
        console.error(`docusign-watch: could not save ${cl.name}:`, e.message);
        continue;
      }
      // Counted after the save, not after the upload. A stored file the record does not
      // point at is not a copy anybody can find, and the catch-up pass will redo it.
      if (archived) summary.archived++;
      if (decision.note === "signed") summary.signed++;
      else if (decision.note === "declined") summary.declined++;
      else if (decision.note === "voided") summary.voided++;
      else if (nudge) summary.nudged++;
      else summary.unchanged++;
    } else {
      summary.unchanged++;
    }

    if (alertPayload) { try { await alert(alertPayload); } catch (e) { console.error("docusign-watch: alert failed:", e.message); } }

    // The client's own confirmation, sent at the one moment it is genuinely useful.
    // Fail-soft: a bounced email must never undo a correctly recorded signature.
    if (decision.email) {
      try { await sendEmail(cl, decision.email); }
      catch (e) { console.error("docusign-watch: client email failed:", e.message); }
    }
  }

  // ── 🔴 THE CATCH-UP PASS, AND IT IS NOT OPTIONAL ───────────────────────────
  //
  // `needsCheck` stops looking at a client the instant `contractSigned` is true, which is
  // right for the status question and fatal for this one. If the document fetch above failed
  // on the single run that mattered — an expired token, a rate limit, a network blip — that
  // client would have no signed copy for the life of their agreement and nothing would ever
  // try again. So every sweep also looks for signed clients with no stored document and has
  // another go. It is a no-op the moment they all have one.
  //
  // It also covers every client who signed BEFORE this existed, which on the day it shipped
  // was all of them.
  if (fetchDocument && storeDocument) {
    for (const row of rows.filter((r) => needsArchive(r.data))) {
      const cl = row.data;
      try {
        const patch = await fetchAndStore({ client: cl, id: row.id, fetchDocument, storeDocument, now });
        await saveClient(row.id, { ...cl, ...patch });
        summary.archived++;
      } catch (e) {
        // Quiet on purpose. This retries every fifteen minutes and a client whose envelope
        // DocuSign will not hand over must not page Bryson ninety-six times a day.
        summary.archiveErrors++;
        console.error(`docusign-watch: catch-up copy for ${cl.name} failed:`, e.message);
      }
    }
  }

  return summary;
}

export const summaryLine = (s) =>
  `docusign-watch: ${s.pending} awaiting, ${s.checked} checked, ${s.signed} signed, ` +
  `${s.declined} declined, ${s.voided} voided, ${s.nudged} nudged, ${s.errors} errors, ` +
  `${s.archived} signed copies stored, ${s.archiveErrors} copy failures`;

const handler = async () => {
  // A missing variable should skip quietly. This runs every fifteen minutes and an
  // unconfigured integration must not page Bryson ninety-six times a day.
  if (!isConfigured()) return new Response("DocuSign not configured — skipped", { status: 200 });

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const summary = await runWatch({
    // Retries a transient lookup rather than paging on it; the reasoning lives on
    // `loadAllClients`, which the monthly invoicer shares.
    loadClients: () => loadAllClients(supabase, "docusign-watch"),
    fetchEnvelope: (envelopeId) => dsGet(`/envelopes/${encodeURIComponent(envelopeId)}`),
    saveClient: async (id, data) => {
      const { error } = await supabase.from("clients").update({ data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    alert: dispatchAlert,
    sendEmail: autoSendClientEmail,
    // The completed document, flattened by DocuSign into one PDF with the certificate page.
    // `dsGetBytes` rather than `dsGet`, because `dsGet` parses JSON and would quietly hand
    // back an empty object for a PDF body.
    fetchDocument: (envelopeId) => dsGetBytes(combinedDocumentPath(envelopeId)),
    storeDocument: async (path, bytes) => {
      // 🔴 PRIVATE, unlike the photo bucket. A signed agreement carries the client's address,
      // their fee and their signature, and must never sit at a URL that works for anyone
      // holding it. Creating a bucket that exists is a no-op, so this is safe on every run.
      await supabase.storage.createBucket(CONTRACT_BUCKET, { public: false }).catch(() => {});
      const { error } = await supabase.storage.from(CONTRACT_BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error(error.message);
    },
  });

  const line = summaryLine(summary);
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("docusign-watch", handler);
