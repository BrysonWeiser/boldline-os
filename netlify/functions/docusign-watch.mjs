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
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { dsGet, isConfigured } from "../lib/docusign-auth.mjs";
import { needsCheck, decideFromEnvelope, decideNudge } from "../lib/docusign-status.mjs";

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const noteFor = (decision, nudge, patch) =>
  decision.note === "signed" ? `Agreement signed via DocuSign on ${fmt(patch.contractSignedAt)}. Contract is now active.`
  : decision.note === "declined" ? "Client DECLINED the DocuSign agreement."
  : decision.note === "voided" ? "The DocuSign agreement was voided."
  : nudge ? "Reminder raised: agreement still unsigned."
  : "";

export async function runWatch({ loadClients, fetchEnvelope, saveClient, alert, sendEmail, now = () => new Date() }) {
  const rows = (await loadClients()) || [];
  const pending = rows.filter((r) => needsCheck(r.data));
  const summary = { pending: pending.length, checked: 0, signed: 0, declined: 0, voided: 0, nudged: 0, unchanged: 0, errors: 0 };

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
  return summary;
}

export const summaryLine = (s) =>
  `docusign-watch: ${s.pending} awaiting, ${s.checked} checked, ${s.signed} signed, ` +
  `${s.declined} declined, ${s.voided} voided, ${s.nudged} nudged, ${s.errors} errors`;

const handler = async () => {
  // A missing variable should skip quietly. This runs every fifteen minutes and an
  // unconfigured integration must not page Bryson ninety-six times a day.
  if (!isConfigured()) return new Response("DocuSign not configured — skipped", { status: 200 });

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const summary = await runWatch({
    loadClients: async () => {
      const { data, error } = await supabase.from("clients").select("id, data");
      if (error) throw new Error(`client lookup failed: ${error.message}`);
      return data;
    },
    fetchEnvelope: (envelopeId) => dsGet(`/envelopes/${encodeURIComponent(envelopeId)}`),
    saveClient: async (id, data) => {
      const { error } = await supabase.from("clients").update({ data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    alert: dispatchAlert,
    sendEmail: autoSendClientEmail,
  });

  const line = summaryLine(summary);
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("docusign-watch", handler);
