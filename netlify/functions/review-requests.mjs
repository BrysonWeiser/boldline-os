// Review requests, the owner side: list them, queue new ones, stop one, preview the email.
//
// Owner-JWT gated and service-role backed, like outreach.mjs. 🔴 NOTHING IS SENT FROM HERE. Adding
// only queues; the scheduled `review-requests-run` is the one place that sends, so the caps, the
// send window and the claim-before-send rule cannot be skipped by a second code path.
// Every rule lives in ../lib/review-requests.mjs.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { reviewsDeclined, normReviewUrl, parseCustomers, addVerdicts, renderReviewEmail, reviewStats, isMissingTable, newToken, normEmail } from "../lib/review-requests.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const SETUP = "One-time setup needed: run docs/sql/review-requests-schema.sql in Supabase. Ask Claude for the steps.";
const COLS = "id, client_id, name, email, status, attempts, last_error, created_at, sent_at, reminded_at, stopped_at, opted_out_at";

export const handle = async (req, { supabase, now = Date.now() }) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const clientId = url.searchParams.get("client") || "";
  const tableErr = (error) => isMissingTable(error)
    ? json({ ok: false, needsSetup: true, error: SETUP }, 200)
    : json({ ok: false, error: error.message }, 500);

  const loadClient = async () => {
    if (!clientId) return { error: "client required" };
    const { data, error } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "That client is no longer in the OS." };
    return { client: { ...(data.data || {}), id: data.id } };
  };

  if (action === "list") {
    if (!clientId) return json({ ok: false, error: "client required" }, 400);
    const { data, error } = await supabase.from("review_requests").select(COLS)
      .eq("client_id", clientId).order("created_at", { ascending: false }).limit(500);
    if (error) return tableErr(error);
    return json({ ok: true, requests: data || [], stats: reviewStats(data || []) });
  }

  if (action === "preview") {
    const { client, error } = await loadClient();
    if (error) return json({ ok: false, error }, 400);
    if (!normReviewUrl(client.googleReviewUrl)) return json({ ok: false, error: "Add their Google review link first." }, 400);
    const sample = { name: "Jane Smith", email: "jane@example.com" };
    return json({ ok: true, first: renderReviewEmail(client, sample, "first", { unsubscribeUrl: "(unsubscribe link)" }),
      reminder: renderReviewEmail(client, sample, "reminder", { unsubscribeUrl: "(unsubscribe link)" }) });
  }

  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  let body = {};
  try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  if (action === "add") {
    const { client, error } = await loadClient();
    if (error) return json({ ok: false, error }, 400);
    // 🔴 They said no. The screen hides the button too; this is the check that cannot be skipped.
    if (reviewsDeclined(client)) return json({ ok: false, error: "This client said no to review requests. Turn them back on in the Reviews tab first." }, 400);
    // 🔴 No link, no queue. A queued email with nowhere to send people is a promise we cannot keep.
    if (!normReviewUrl(client.googleReviewUrl)) return json({ ok: false, error: "Add their Google review link first, then save." }, 400);
    const parsed = Array.isArray(body.customers)
      ? { customers: body.customers.map((c) => ({ name: String((c && c.name) || ""), email: normEmail(c && c.email) || String((c && c.email) || "") })), bad: [] }
      : parseCustomers(body.text);
    const { data: existing, error: exErr } = await supabase.from("review_requests")
      .select("email, status, created_at, opted_out_at").eq("client_id", clientId).limit(5000);
    if (exErr) return tableErr(exErr);
    const { add, skipped } = addVerdicts(parsed.customers, existing || [], { now });
    const skippedAll = [...parsed.bad.map((l) => ({ email: l.slice(0, 60), reason: "no email address on that line" })), ...skipped];
    if (!add.length) return json({ ok: true, added: 0, skipped: skippedAll });
    const rows = add.map((c) => ({ client_id: clientId, name: c.name || null, email: c.email, source: "owner", status: "queued", token: newToken() }));
    const { error: insErr } = await supabase.from("review_requests").insert(rows);
    if (insErr) return tableErr(insErr);
    return json({ ok: true, added: rows.length, skipped: skippedAll });
  }

  if (action === "stop") {
    const id = url.searchParams.get("id") || "";
    if (!id) return json({ ok: false, error: "id required" }, 400);
    // Only a row that is waiting can be stopped. One mid-send ("sending") is left alone: it is
    // seconds from done, and stopping it could not un-send it anyway.
    const { data, error } = await supabase.from("review_requests")
      .update({ status: "stopped", stopped_at: new Date(now).toISOString() })
      .eq("id", id).in("status", ["queued", "sent"]).select("id");
    if (error) return tableErr(error);
    if (!data || !data.length) return json({ ok: false, error: "That one already went out or was already stopped." }, 409);
    return json({ ok: true });
  }

  return json({ ok: false, error: "unknown action" }, 400);
};

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);
  return handle(req, { supabase });
};
