// Send ONE fake lead to a client's own system, from the OS, on demand.
//
// Bryson, 2026-09-03, prepping a call where Shaun wants to watch a lead arrive live:
// *"can you build a button to automatically send a test from the os right now too"*.
//
// The plumbing was already there and unreachable. `forwardLead(client, lead, {dryRun:true})`
// has honoured Shaun's `test=true` dry run since 1 September — it signs and posts the real
// request, his endpoint validates the whole thing, answers `{"ok":true,"test":true}` and
// RECORDS NOTHING. Nothing in the OS ever passed that flag, so the only way to prove the
// connection worked was to wait for a real lead, which is exactly the wrong time to find out.
//
// 🔴 THE DRY RUN IS THE POINT, NOT A CONVENIENCE. A test that writes a junk contact into a
// client's pipeline is a test nobody runs twice, and the first thing it teaches them is that
// our software makes mess. It also dedupes in a separate key namespace on his side, so a dry
// run can never suppress the real lead that follows it.
//
// 🔴 AND IT NEVER TOUCHES THE CLIENT RECORD. `forwardLead` normally stamps its result onto
// the lead so a retry can tell what already went; there is no lead here to stamp, and the
// result is handed straight back to the screen instead. A test that mutated the record would
// be a preview that changes something real, which is the standing rule this repo enforces.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { forwardLead, crmTarget, crmFormat } from "../lib/crm-forward.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Obviously fake, and obviously fake TO A HUMAN reading it on the other end. If a dry run
// ever slipped through as real, the row must announce itself rather than look like a lead
// somebody should call.
export const testLead = (now = new Date()) => ({
  leadId: `boldline-test-${now.getTime()}`,
  receivedAt: now.toISOString(),
  name: "BoldLine Test Lead",
  firstName: "BoldLine",
  email: "test@boldlinemedia.com",
  phone: "+15555550100",
  message: "This is a connection test sent from BoldLine OS. Nothing to action.",
  page: "boldline-os-test",
  source: "test",
  // Attribution fields carry recognisable placeholders so the mapping on the other end can
  // be checked end to end, not just "did a request arrive".
  gclid: "TEST-GCLID",
  clickAt: now.toISOString(),
  utmSource: "boldline",
  utmMedium: "test",
  utmCampaign: "connection-test",
  // Both consents deliberately ABSENT, not "no". A test must not assert a permission for a
  // person who does not exist, and absent is what a real untouched form sends.
});

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);

  const { data: row, error } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!row) return json({ ok: false, error: "No such client." }, 404);
  const client = row.data || {};

  // Said in words Bryson can act on: this is the whole message he gets when it is not set up.
  if (!crmTarget(client)) {
    return json({ ok: false, error: "There is no address to send leads to yet. Add it under Edit, then Campaign, in the \"Send leads on to\" box." }, 400);
  }

  const res = await forwardLead(client, testLead(), { dryRun: true });
  // `forwardLead` returns null only when there is nothing configured or the lead was already
  // sent, and neither can be true here, so a null means the shape changed under us.
  if (!res) return json({ ok: false, error: "The send did not run. Check the address is filled in." }, 500);

  return json({
    ok: !!res.ok,
    // What actually happened, in the words of the thing that happened. A 401 means the secret
    // or the signature did not match, and that is worth saying rather than "failed".
    status: res.status || null,
    attempts: res.attempts || 1,
    format: crmFormat(client),
    error: res.ok ? "" : (res.error || (res.status === 401
      ? "Their system rejected the password (401). The shared secret in the OS does not match theirs."
      : `Their system answered ${res.status}.`)),
  });
};
