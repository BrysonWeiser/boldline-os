// DocuSign JWT Grant auth + envelope send.
//
// Sends a BoldLine Media service agreement to a recipient for e-signature.
// Secured by the owner's Supabase session (the same login the admin dashboard
// uses) — verified server-side before anything is sent.
//
// POST body:
//   { recipientEmail, recipientName?, documentHtml?, subject? }
//     - documentHtml omitted  -> sends a built-in connection-test agreement
//       (used by the "Send Test Envelope" button on the Deploy tab)
//     - documentHtml provided -> sends that contract (the real "Send via
//       DocuSign" button passes the rendered service agreement)
//
// Returns: { ok, envelopeId, status }  — the caller persists contract status.
//
// Required Netlify env vars:
//   DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
//   DOCUSIGN_PRIVATE_KEY, DOCUSIGN_BASE_PATH, SUPABASE_SERVICE_ROLE_KEY

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// ── DocuSign config (from env) ───────────────────────────────────────────────
const DS = {
  ik: process.env.DOCUSIGN_INTEGRATION_KEY,
  userId: process.env.DOCUSIGN_USER_ID,
  accountId: process.env.DOCUSIGN_ACCOUNT_ID,
  privateKey: process.env.DOCUSIGN_PRIVATE_KEY,
  basePath: process.env.DOCUSIGN_BASE_PATH || "https://demo.docusign.net",
};
// Auth server differs from the REST base path:
//   demo/sandbox -> account-d.docusign.com   ·   production -> account.docusign.com
const authServer = DS.basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com";

// Invisible (white-on-white) anchor token the signature tab is placed on.
const SIGN_ANCHOR = "/BL_SIGN_HERE/";

const escapeHtml = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

// ── JWT Grant: build a signed assertion, exchange for an access token ─────────
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

// ── Document helpers ─────────────────────────────────────────────────────────
const signingBlock = (name) =>
  `<div style="margin-top:36px;padding-top:14px;border-top:1px solid #bbb;font-family:Georgia,serif">`
  + `<div style="font-size:12px;color:#444;margin-bottom:30px">Sign below to accept this agreement:</div>`
  + `<div style="font-size:13px;color:#111">X<span style="color:#ffffff;font-size:9px"> ${SIGN_ANCHOR} </span></div>`
  + `<div style="border-top:1px solid #111;width:240px;margin-top:2px"></div>`
  + `<div style="font-size:11px;color:#666;margin-top:4px">${escapeHtml(name)}</div></div>`;

// Make sure the document carries the signature anchor exactly once.
function ensureAnchor(html, name) {
  if (html.includes(SIGN_ANCHOR)) return html;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, signingBlock(name) + "</body>");
  return html + signingBlock(name);
}

function testAgreementHTML(name) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>`
    + `<body style="font-family:Georgia,serif;color:#1a1a1a;padding:32px;font-size:13px;line-height:1.7">`
    + `<h1 style="text-align:center">BoldLine Media — Connection Test</h1>`
    + `<p style="text-align:center;color:#666;font-size:11px">This is a DocuSign integration test, not a real contract.</p>`
    + `<p>This envelope confirms that BoldLine Media's DocuSign integration can authenticate (JWT Grant) and send a document for e-signature. No service is being purchased and no payment is owed.</p>`
    + `<p>If you received this email, the integration works. You can sign it to confirm the full round-trip, or simply ignore it.</p>`
    + signingBlock(name)
    + `</body></html>`;
}

// ── Envelope send ────────────────────────────────────────────────────────────
async function sendEnvelope(accessToken, { subject, documentHtml, recipientEmail, recipientName }) {
  const envelope = {
    emailSubject: subject,
    documents: [{
      documentBase64: Buffer.from(documentHtml).toString("base64"),
      name: "BoldLine Media Service Agreement",
      fileExtension: "html",
      documentId: "1",
    }],
    recipients: {
      signers: [{
        email: recipientEmail,
        name: recipientName,
        recipientId: "1",
        routingOrder: "1",
        tabs: {
          signHereTabs: [{
            anchorString: SIGN_ANCHOR,
            anchorUnits: "pixels",
            anchorXOffset: "0",
            anchorYOffset: "-6",
          }],
        },
      }],
    },
    status: "sent",
  };

  const resp = await fetch(`${DS.basePath}/restapi/v2.1/accounts/${DS.accountId}/envelopes`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(envelope),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(`send: ${data.errorCode || resp.status}${data.message ? " — " + data.message : ""}`);
    e.stage = "send";
    e.detail = data;
    throw e;
  }
  return data; // { envelopeId, status, statusDateTime, uri }
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  // Config present?
  const missing = Object.entries({
    DOCUSIGN_INTEGRATION_KEY: DS.ik,
    DOCUSIGN_USER_ID: DS.userId,
    DOCUSIGN_ACCOUNT_ID: DS.accountId,
    DOCUSIGN_PRIVATE_KEY: DS.privateKey,
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return json({ ok: false, error: `Missing env vars: ${missing.join(", ")}` }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: require the owner's Supabase session (single-owner app — any valid
  // dashboard session is the owner).
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try {
    body = JSON.parse((await req.text()) || "{}");
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const recipientEmail = String(body.recipientEmail || "").trim();
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return json({ ok: false, error: "A valid recipientEmail is required" }, 400);
  }
  const recipientName = String(body.recipientName || "Authorized Signatory").trim().slice(0, 100);
  const isTest = !body.documentHtml;
  const documentHtml = ensureAnchor(
    typeof body.documentHtml === "string" && body.documentHtml.length > 50
      ? body.documentHtml
      : testAgreementHTML(recipientName),
    recipientName,
  );
  const subject = String(body.subject || (isTest
    ? "BoldLine Media — DocuSign Connection Test"
    : "Please sign: BoldLine Media Service Agreement")).slice(0, 200);

  try {
    const accessToken = await getAccessToken();
    const result = await sendEnvelope(accessToken, { subject, documentHtml, recipientEmail, recipientName });
    return json({ ok: true, envelopeId: result.envelopeId, status: result.status, test: isTest, sentTo: recipientEmail }, 200);
  } catch (err) {
    console.error("docusign-send failed:", err && err.stage, err && err.message, err && err.detail);
    return json({
      ok: false,
      stage: err.stage || "unknown",
      error: err.message || "DocuSign request failed",
      detail: err.detail,
    }, 502);
  }
};
