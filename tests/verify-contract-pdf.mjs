// The executed agreement, fetched from DocuSign for the client who owns it.
//
// The portal renders BoldLine's OWN copy of the agreement, marked as signed from the OS's
// record. This endpoint returns what DocuSign actually holds: the signature mark on the page
// plus the Certificate of Completion (signer identity, IP, timestamps, consent to transact
// electronically). That certificate is the part that matters in a dispute and nothing in the
// OS can reproduce it.
//
// 🔴 WHAT THIS SUITE IS REALLY FOR. This hands a signed contract to whoever holds a link, so
// the tests that matter are about WHOSE contract comes back and WHEN nothing should. The
// envelope id must never be accepted from the request: an endpoint that took one would let
// anyone with any valid portal link enumerate every agreement BoldLine has ever sent.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const src = readFileSync(join(ROOT, "netlify/functions/contract-pdf.mjs"), "utf8");
// Comments discuss the dangers at length; the checks are about the code.
const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

// ── 🔴 1. WHOSE CONTRACT COMES BACK ──────────────────────────────────────────
{
  ok("🔴 the envelope id is read from the matched row, never from the request",
    /cl\.docusignEnvelopeId/.test(body) && !/searchParams\.get\(["']envelope/.test(body)
      && !/body\.(envelopeId|envelope)/.test(body),
    "accepting an envelope id would let any valid portal link fetch any client's agreement");

  ok("the client is found by the portal token", /eq\("data->>portalToken", token\)/.test(body));
  ok("and a missing token is refused before anything else",
    body.indexOf("Missing token") < body.indexOf("portalToken"));
  ok("an unknown token is a 404, not an empty PDF", /That link is not valid/.test(body));
}

// ── 2. When there is nothing to hand over, say so ────────────────────────────
{
  ok("🔴 an unsigned agreement is refused",
    /!cl\.contractSigned/.test(body) && /has not been signed yet/.test(body),
    "an envelope exists from the moment it is SENT, so returning it unsigned would label an "
    + "unsigned document as the signed copy");
  ok("and a client with no envelope at all is refused",
    /!cl\.docusignEnvelopeId/.test(body));
  // 🔴 Both checked SEPARATELY. Either alone lets the other case through.
  ok("the two conditions are separate checks, not one combined test",
    body.split("docusignEnvelopeId").length > 2 || /if \(!cl\.contractSigned\)/.test(body));
}

// ── 3. A broken fetch must not become a broken file ──────────────────────────
{
  ok("🔴 an empty response is treated as a failure",
    /byteLength < \d+/.test(body),
    "a zero-byte 200 is a real DocuSign failure mode, and handing over an unopenable file is "
    + "worse than saying it did not work");
  ok("a DocuSign error is not passed through as a PDF", /if \(!res\.ok\)/.test(body));
  ok("network failure is caught rather than thrown at the client", /catch \(e\)/.test(body));
  ok("DocuSign's own error text is logged, not shown to the client",
    /console\.error\("contract-pdf: DocuSign returned"/.test(body) && !/return err\(detail/.test(body));
}

// ── 4. It is a download, and it is not cached ────────────────────────────────
{
  ok("it returns a PDF", /"content-type": "application\/pdf"/.test(body));
  ok("as a download with a real filename", /content-disposition.*attachment/.test(body));
  ok("named after the client, not 'combined.pdf'", /fileName\(cl\.name\)/.test(body));
  ok("🔴 and is never cached in a shared cache",
    /"cache-control": "private, no-store"/.test(body),
    "a signed contract with the access token in the URL must not sit in any shared cache");
}

// ── 5. It asks for the CERTIFICATE too, not just the page ───────────────────
{
  ok("🔴 it requests the combined document",
    /documents\/combined/.test(body),
    "the document alone drops the Certificate of Completion, which is the audit trail and "
    + "the whole reason to prefer this over the OS's own rendering");
  ok("and the envelope id is url-encoded into the path", /encodeURIComponent\(cl\.docusignEnvelopeId\)/.test(body));
}

// ── 6. 🔴 THE BUTTON APPEARS ONLY WHEN THERE IS SOMETHING TO FETCH ──────────
// Rendered, both copies. A button that returns an error is worse than no button.
{
  const { _internal } = await import("../netlify/functions/portal.mjs");
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  const base = { name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-launch", portalToken: "tok-abc", leadsLog: [], commLog: [] };
  const has = (patch) => _internal.makePortalHTML({ ...base, ...patch }, pkg).includes("Download the Signed Copy");

  ok("🔴 shown when signed and there is an envelope", has({ contractSigned: true, docusignEnvelopeId: "env-1" }));
  ok("hidden while it is only sent", !has({ contractSigned: false, docusignEnvelopeId: "env-1" }));
  ok("hidden when signed outside DocuSign", !has({ contractSigned: true }),
    "an early client may have signed an emailed PDF, and there is no e-signed original for them");
  ok("hidden when neither", !has({}));

  const html = _internal.makePortalHTML({ ...base, contractSigned: true, docusignEnvelopeId: "env-1" }, pkg);
  ok("the link carries the client's own portal token", html.includes("contract-pdf?token=tok-abc"));
  ok("🔴 and the envelope id never reaches the page", !html.includes("env-1"),
    "the id is not a secret, but nothing client-side needs it and it should not be handed out");

  // Both copies of the portal must agree, or the preview shows a button the client lacks.
  const os = readFileSync(join(ROOT, "index.html"), "utf8");
  ok("the OS copy offers it too", /Download the Signed Copy/.test(os));
  ok("and gates it on the same two fields",
    /cl\.contractSigned&&cl\.docusignEnvelopeId/.test(os));
}

console.log(`verify-contract-pdf: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
