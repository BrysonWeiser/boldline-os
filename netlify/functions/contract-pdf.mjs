// The EXECUTED agreement, straight from DocuSign.
//
// Bryson, 2026-08-31, after the portal started rendering its signature block as signed:
// he wanted the real thing. What the portal shows is BoldLine's own rendering of the
// agreement, marked as signed from the OS's record. This returns the document DocuSign
// actually holds: the client's signature mark on the page, plus the Certificate of
// Completion (signer identity, IP, timestamps, consent to do business electronically).
// That certificate is the part that matters if anything is ever disputed, and nothing in
// the OS can reproduce it.
//
// GET /.netlify/functions/contract-pdf?token=<portalToken>
//   -> application/pdf, or a JSON error.
//
// 🔴 THE TOKEN IS THE CLIENT'S CREDENTIAL AND THE ONLY THING THAT PICKS THE ENVELOPE.
// The envelope id is never accepted from the request. It is read from the row the token
// matched, so holding one client's link can only ever return that client's contract. An
// endpoint that took an envelope id would let anyone with any valid portal link enumerate
// every agreement BoldLine has ever sent.
//
// Env: SUPABASE_SERVICE_ROLE_KEY + the DocuSign credentials (shared with docusign-send).

import { createClient } from "@supabase/supabase-js";
import { DS, getAccessToken } from "../lib/docusign-auth.mjs";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const err = (message, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status, headers: { "content-type": "application/json" },
  });

// The filename a client ends up with in their downloads folder. Their own business name,
// because "combined.pdf" tells them nothing six months from now.
const fileName = (name) =>
  `${String(name || "BoldLine").replace(/[^A-Za-z0-9 &-]/g, "").trim().replace(/\s+/g, "-") || "BoldLine"}-Signed-Agreement.pdf`;

export default async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return err("Missing token");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return err("Server not configured", 500);

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("clients").select("id, data").eq("data->>portalToken", token).maybeSingle();
  if (error) return err("Could not look up that link", 500);
  if (!data) return err("That link is not valid", 404);

  const cl = data.data || {};
  // 🔴 Both conditions, separately. An envelope exists from the moment it is SENT, so
  // checking only for the id would hand back an unsigned document labelled as the signed
  // copy — a worse lie than showing nothing.
  if (!cl.docusignEnvelopeId) return err("There is no e-signed copy of this agreement.", 404);
  if (!cl.contractSigned) return err("This agreement has not been signed yet.", 409);

  const missing = ["ik", "userId", "accountId", "privateKey"].filter((k) => !DS[k]);
  if (missing.length) return err("E-signature is not configured", 500);

  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    console.error("contract-pdf auth failed:", e && e.message);
    return err("Could not reach DocuSign", 502);
  }

  // `combined` is the signed document AND the Certificate of Completion in one file, which
  // is the pair you want together. Asking for the document alone drops the audit trail.
  const url = `${DS.basePath}/restapi/v2.1/accounts/${DS.accountId}`
    + `/envelopes/${encodeURIComponent(cl.docusignEnvelopeId)}/documents/combined`;

  let res;
  try {
    res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    console.error("contract-pdf fetch failed:", e && e.message);
    return err("Could not reach DocuSign", 502);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("contract-pdf: DocuSign returned", res.status, detail.slice(0, 300));
    return err("DocuSign could not return that document right now.", 502);
  }

  const pdf = await res.arrayBuffer();
  // A zero-byte 200 is a real DocuSign failure mode, and handing the client an empty file
  // that their reader refuses to open is worse than telling them it did not work.
  if (!pdf || pdf.byteLength < 1000) {
    console.error("contract-pdf: DocuSign returned", pdf ? pdf.byteLength : 0, "bytes");
    return err("The signed copy came back empty. Please try again shortly.", 502);
  }

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName(cl.name)}"`,
      // Never cached anywhere shared: this is a signed contract, and the token is in the URL.
      "cache-control": "private, no-store",
    },
  });
};
