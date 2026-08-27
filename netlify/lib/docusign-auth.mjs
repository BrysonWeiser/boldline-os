// DocuSign JWT auth, in one place.
//
// Extracted 2026-08-27 when a SECOND function needed to call DocuSign (the envelope-status
// watcher). Copying eighty lines of signing code would have created exactly the drift that
// bit the contract and the portal on the same day: two implementations of one thing, and a
// fix landing in only one of them.
//
// Nothing here is new. It is the code that was already proven working against production.

import crypto from "node:crypto";

const DS = {
  ik: process.env.DOCUSIGN_INTEGRATION_KEY,
  userId: process.env.DOCUSIGN_USER_ID,
  accountId: process.env.DOCUSIGN_ACCOUNT_ID,
  privateKey: process.env.DOCUSIGN_PRIVATE_KEY,
  basePath: process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net",
};
// Auth server differs from the REST base path:
//   demo/sandbox -> account-d.docusign.com   ·   production -> account.docusign.com
// 🔴 This is also the ONLY switch between practice and live. Removing "demo" from
// DOCUSIGN_BASE_PATH is what moved auth to production on 2026-08-27.
export const authServer = DS.basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com";

export { DS };

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Reconstruct canonical PEM formatting no matter how the key arrived: tolerate
// literal "\n" escape sequences, surrounding quotes, and — the most common
// paste failure — line breaks lost when pasted into a single-line UI field.
// As long as the BEGIN/END markers and base64 body survived, this rebuilds a
// valid PEM by re-wrapping the body at the standard 64-char width.
function normalizeKey(raw) {
  let k = String(raw || "").replace(/\\n/g, "\n").trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  const m = k.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return k;
  const body = m[2].replace(/\s+/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") || body;
  return `-----BEGIN ${m[1]}-----\n${wrapped}\n-----END ${m[1]}-----`;
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: DS.ik,
    sub: DS.userId,
    aud: authServer,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  let signature;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsigned);
    signature = signer.sign(normalizeKey(DS.privateKey))
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (err) {
    const raw = String(DS.privateKey || "");
    const e = new Error("Could not sign with DOCUSIGN_PRIVATE_KEY — check the key was pasted in full (BEGIN/END lines included).");
    e.stage = "sign";
    // Structural facts only — never the key content itself — so we can
    // diagnose a bad paste without ever seeing the secret.
    e.detail = {
      charLength: raw.trim().length,
      lineCount: raw.split("\n").length,
      hasBeginMarker: /-----BEGIN [A-Z ]+-----/.test(raw),
      hasEndMarker: /-----END [A-Z ]+-----/.test(raw),
      hasLiteralBackslashN: /\\n/.test(raw),
    };
    throw e;
  }

  const resp = await fetch(`https://${authServer}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // The classic "consent_required" lands here if the one-time consent grant
    // was never completed for this Integration Key + User ID.
    const e = new Error(`auth: ${data.error || resp.status}${data.error_description ? " — " + data.error_description : ""}`);
    e.stage = "auth";
    e.detail = data;
    throw e;
  }
  return data.access_token;
}

export { getAccessToken, normalizeKey, b64url };

// One authenticated GET against the REST API, for anything that only needs to READ.
// Kept here so callers never rebuild the base path or the auth header by hand.
export async function dsGet(path) {
  const token = await getAccessToken();
  const url = `${DS.basePath}/restapi/v2.1/accounts/${DS.accountId}${path}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(`docusign ${resp.status}: ${data.message || data.errorCode || "request failed"}`);
    e.stage = "read";
    e.detail = data;
    throw e;
  }
  return data;
}

// Whether DocuSign is configured at all. A missing variable should skip the job quietly
// rather than throw on every scheduled run.
export const isConfigured = () => !!(DS.ik && DS.userId && DS.accountId && DS.privateKey);
