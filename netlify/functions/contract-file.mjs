// A short-lived link to the document a client ACTUALLY SIGNED.
//
// Bryson, 2026-09-16: *"make it so it only ever shows the correct version"*.
//
// The agreement the OS draws on screen is re-rendered from the client record every time it
// is opened, so it tracks whatever the record says today. The document in DocuSign is a
// snapshot taken at send time and never changes. Those are two different things and only the
// second one is the contract. `docusign-watch` now stores that PDF against the client, and
// this hands out a link to it so the OS can show the real one.
//
// 🔴 THE FILE IS PRIVATE AND STAYS PRIVATE. It carries the client's business address, their
// fee and their signature. It lives in a private bucket, so there is no public URL to leak,
// and every read goes through a signed link that expires within the hour. This endpoint is
// the only way to get one, and it requires the owner's session.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { CONTRACT_BUCKET, VIEW_URL_TTL_SECONDS, fetchAndStore, combinedDocumentPath } from "../lib/docusign-archive.mjs";
import { dsGetBytes, isConfigured } from "../lib/docusign-auth.mjs";

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Not configured" }, 500);

  // Auth: the owner's Supabase session, the same check `docusign-send` makes. Single-owner
  // app, so any valid dashboard session is Bryson.
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const clientId = String(body.clientId || "").trim();
  if (!clientId) return json({ ok: false, error: "Missing clientId" }, 400);

  const { data: row, error } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
  if (error) {
    console.error("contract-file lookup failed:", error);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!row) return json({ ok: false, error: "No such client" }, 404);

  const cl = row.data || {};
  let path = String(cl.signedContractPath || "");

  // 🔴 FETCH IT NOW RATHER THAN MAKE HIM WAIT FOR THE SWEEP. The scheduled watcher stores the
  // document within fifteen minutes of a signature, and every client who signed BEFORE this
  // existed is picked up on its catch-up pass. But the moment Bryson actually opens a
  // contract is the moment he wants to see it, so if it is not stored yet this fetches and
  // stores it on the spot. Same shared step the watcher runs, so there is one implementation.
  if (!path && cl.contractSigned && cl.docusignEnvelopeId && isConfigured()) {
    try {
      const patch = await fetchAndStore({
        client: cl,
        id: row.id,
        fetchDocument: (envelopeId) => dsGetBytes(combinedDocumentPath(envelopeId)),
        storeDocument: async (p, bytes) => {
          await supabase.storage.createBucket(CONTRACT_BUCKET, { public: false }).catch(() => {});
          const { error: upErr } = await supabase.storage.from(CONTRACT_BUCKET)
            .upload(p, bytes, { contentType: "application/pdf", upsert: true });
          if (upErr) throw new Error(upErr.message);
        },
      });
      // Recorded so the next open is instant and the sweep stops retrying. A failure to save
      // the pointer is not fatal: the file is there and the next run writes it.
      await supabase.from("clients")
        .update({ data: { ...cl, ...patch }, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      path = patch.signedContractPath;
    } catch (e) {
      console.error(`contract-file: could not fetch the signed copy for ${cl.name}:`, e.message);
    }
  }

  // 🔴 NOT AN ERROR, AND THE DIFFERENCE MATTERS TO WHAT THE SCREEN SAYS. "We do not have the
  // signed copy yet" is a real and temporary state, and the OS has to say that rather than
  // fall back to showing a re-render as though it were the agreement.
  if (!path) return json({ ok: true, ready: false, reason: "no signed copy stored yet" }, 200);

  // 🔴 THE PATH IS TAKEN FROM THE RECORD, NEVER FROM THE REQUEST. Signing whatever path a
  // caller asks for would turn an authenticated session into a way to read any file in the
  // bucket, which is every client's agreement.
  if (!path.startsWith(`${row.id}/`)) {
    console.error(`contract-file: stored path ${path} does not belong to client ${row.id}`);
    return json({ ok: false, error: "stored path is not valid" }, 500);
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(CONTRACT_BUCKET).createSignedUrl(path, VIEW_URL_TTL_SECONDS);
  if (signErr || !signed) {
    console.error("contract-file sign failed:", signErr);
    return json({ ok: false, error: "could not open the signed copy" }, 500);
  }

  return json({
    ok: true,
    ready: true,
    url: signed.signedUrl,
    expiresInSeconds: VIEW_URL_TTL_SECONDS,
    signedAt: cl.contractSignedAt || "",
    storedAt: cl.signedContractStoredAt || "",
  }, 200);
};
