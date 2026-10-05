// The one place review-request emails are SENT. Every 15 minutes; almost every run does nothing.
//
// 🔴 CLAIM, THEN SEND, THEN RECORD. A row moves queued -> sending (or sent -> reminding) with a
// conditional update that only succeeds if nobody else got there first; only the run that won the
// claim sends. Each send also carries an idempotency key, so if a run dies between "sent" and
// "recorded", the retry is absorbed by Resend instead of reaching the customer twice. A claim older
// than 30 minutes is treated as that crash and handed back. Rules: ../lib/review-requests.mjs.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients, retryQuery } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { planReviewSends, afterSend, renderReviewEmail, fromAddress, inSendWindow, isMissingTable, normEmail, MAX_ATTEMPTS } from "../lib/review-requests.mjs";

const OPEN = ["queued", "sending", "sent", "reminding"];
const BASE = () => String(process.env.URL || "https://boldlinemedia.netlify.app").replace(/\/$/, "");

export const optOutUrl = (base, token) => `${base}/.netlify/functions/review-optout?t=${encodeURIComponent(token)}`;

// Everything the run needs from the outside world is passed in, so the test can run it for real.
export async function runReviewSends({ loadClients, loadOpen, loadHistory, loadOptOuts, claim, update, send, alert,
  now = Date.now(), reportsFrom = "", base = "", caps = {} }) {
  const open = await loadOpen();
  if (open.missingTable) return { skipped: "table not set up" };
  const clientsById = Object.fromEntries((await loadClients()).map((r) => [r.id, { ...(r.data || {}), id: r.id }]));
  const optedOut = new Set((await loadOptOuts()).map((r) => `${r.client_id}|${normEmail(r.email)}`));
  const history = await loadHistory(new Date(now - 864e5).toISOString());
  const plan = planReviewSends(open.rows, { clientsById, history, optedOut, now, ...caps });
  const out = { sent: 0, reminded: 0, failed: 0, reset: plan.resets.length, stopped: plan.stops.length };

  for (const { row, to } of plan.resets) await update(row.id, { status: to, claimed_at: null }, row.status);
  for (const { row, reason } of plan.stops) await update(row.id, reason === "opted_out"
    ? { status: "opted_out", opted_out_at: row.opted_out_at || new Date(now).toISOString() }
    : { status: "stopped", stopped_at: new Date(now).toISOString(), last_error: "client no longer in the OS" }, row.status);

  if (!inSendWindow(now)) return { ...out, skipped: "outside the send window" };
  const from = (client) => fromAddress(client, reportsFrom);
  const finalFailures = [];

  for (const { row, kind, from: fromStatus } of plan.sends) {
    const client = clientsById[row.client_id];
    const sender = from(client);
    if (!sender) { finalFailures.push({ client, error: "REPORTS_FROM_EMAIL is not set" }); break; }
    const claimedTo = kind === "first" ? "sending" : "reminding";
    // 🔴 Lost the claim means another run has it. Not ours to send.
    if (!(await claim(row.id, fromStatus, claimedTo, new Date(now).toISOString()))) continue;
    const unsub = optOutUrl(base, row.token);
    const mail = renderReviewEmail(client, row, kind, { unsubscribeUrl: unsub });
    let ok = true, error = "";
    try {
      await send({
        from: sender, to: row.email, subject: mail.subject, html: mail.html, text: mail.text,
        replyTo: normEmail(client.email) || undefined,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        idempotencyKey: `review-${row.id}-${kind}`,
      });
    } catch (e) { ok = false; error = String((e && e.message) || e); }
    const patch = afterSend(row, kind, ok, error, now);
    await update(row.id, patch, claimedTo);
    if (ok) out[kind === "first" ? "sent" : "reminded"]++;
    else { out.failed++; if (patch.status === "failed" || patch.status === "stopped") finalFailures.push({ client, error }); }
  }

  if (finalFailures.length && alert) {
    const who = [...new Set(finalFailures.map((f) => (f.client && f.client.name) || "a client"))].join(", ");
    await alert({
      title: `Review request emails are failing (${who})`,
      body: `${finalFailures.length} review request email${finalFailures.length === 1 ? "" : "s"} gave up after ${MAX_ATTEMPTS} tries. Last error: ${finalFailures[0].error}`,
      severity: "red",
      smsText: `BoldLine: review request emails failing for ${who}.`,
    });
  }
  return out;
}

const resendSend = async ({ from, to, subject, html, text, replyTo, headers, idempotencyKey }) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}), headers }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

export default withFailureAlert("review-requests-run", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.RESEND_API_KEY) return new Response("skipped", { status: 200 });
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const job = "review-requests-run";
  const res = await runReviewSends({
    loadOpen: async () => {
      const { data, error } = await retryQuery(() => supabase.from("review_requests").select("*").in("status", OPEN)
        .order("created_at", { ascending: true }).limit(2000), { job, step: "open rows" });
      if (error && isMissingTable(error)) return { missingTable: true };
      if (error) throw new Error(`review rows read failed: ${error.message}`);
      return { rows: data || [] };
    },
    loadClients: () => loadAllClients(supabase, job),
    loadOptOuts: async () => {
      const { data, error } = await retryQuery(() => supabase.from("review_requests").select("client_id, email")
        .not("opted_out_at", "is", null).limit(10000), { job, step: "opt-outs" });
      if (error) throw new Error(`opt-out read failed: ${error.message}`);
      return data || [];
    },
    loadHistory: async (since) => {
      const { data, error } = await retryQuery(() => supabase.from("review_requests").select("client_id, sent_at, reminded_at")
        .or(`sent_at.gte.${since},reminded_at.gte.${since}`).limit(5000), { job, step: "today's sends" });
      if (error) throw new Error(`history read failed: ${error.message}`);
      return data || [];
    },
    claim: async (id, fromStatus, to, at) => {
      const { data, error } = await supabase.from("review_requests").update({ status: to, claimed_at: at })
        .eq("id", id).eq("status", fromStatus).select("id");
      return !error && !!(data && data.length);
    },
    update: async (id, patch, expect) => {
      const { error } = await supabase.from("review_requests").update(patch).eq("id", id).eq("status", expect);
      if (error) console.error(`${job}: update failed for ${id}: ${error.message}`);
    },
    send: resendSend,
    alert: dispatchAlert,
    reportsFrom: process.env.REPORTS_FROM_EMAIL || "",
    base: BASE(),
    caps: {
      ...(Number(process.env.REVIEW_DAILY_CAP) > 0 ? { dailyCap: Number(process.env.REVIEW_DAILY_CAP) } : {}),
    },
  });
  console.log(`${job}:`, JSON.stringify(res));
  return new Response(JSON.stringify(res), { status: 200 });
});
