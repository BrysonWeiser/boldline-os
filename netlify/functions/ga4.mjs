// GA4 Analytics Data API — read-only marketing-site traffic for the OS.
//
// Surfaces boldlinemedia.com's Google Analytics numbers INSIDE the OS (Website
// tab) so Bryson never has to open the GA4 web UI. Read-only: it only calls
// runReport / batchRunReports.
//
// Auth is a Google Cloud SERVICE ACCOUNT (server-to-server), NOT the OAuth
// refresh-token flow the Google Ads function uses — GA4's Data API is happiest
// with a service account added as a Viewer on the property. We sign a short-
// lived JWT with the service account's private key (RS256, Node crypto — no
// external library) and exchange it for an access token, then call the Data API.
//
// POST body: { action: "summary" }  (owner Supabase session required)
//
// Required Netlify env vars (OS site):
//   GA4_PROPERTY_ID          — the GA4 property's NUMERIC id (Admin → Property
//                              settings; NOT the "G-" Measurement ID).
//   GA4_SERVICE_ACCOUNT_JSON — the full service-account key JSON (the file you
//                              download from Google Cloud), pasted as one value.
//                              Contains client_email + private_key.
//   SUPABASE_SERVICE_ROLE_KEY
//
// The service account's email (client_email) must be added as a VIEWER on the
// GA4 property: GA4 → Admin → Property → Property Access Management → add the
// service-account email with the Viewer role.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// base64url of a Buffer/string (JWT segments are base64url, no padding).
const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// ── Service account -> access token (signed JWT bearer grant) ─────────────────
function loadServiceAccount() {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) { const e = new Error("Missing GA4_SERVICE_ACCOUNT_JSON"); e.stage = "config"; throw e; }
  let sa;
  try { sa = JSON.parse(raw); }
  catch { const e = new Error("GA4_SERVICE_ACCOUNT_JSON is not valid JSON — paste the whole key file as the value."); e.stage = "config"; throw e; }
  if (!sa.client_email || !sa.private_key) {
    const e = new Error("GA4_SERVICE_ACCOUNT_JSON is missing client_email/private_key."); e.stage = "config"; throw e;
  }
  return sa;
}

async function getAccessToken() {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(sa.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const assertion = `${signingInput}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const e = new Error(`auth: ${data.error || resp.status}${data.error_description ? " — " + data.error_description : ""}`);
    e.stage = "auth"; e.detail = data; throw e;
  }
  return data.access_token;
}

// ── GA4 Data API helpers ──────────────────────────────────────────────────────
function propertyId() {
  const pid = String(process.env.GA4_PROPERTY_ID || "").replace(/[^0-9]/g, "");
  if (!pid) { const e = new Error("Missing GA4_PROPERTY_ID (the numeric property id)."); e.stage = "config"; throw e; }
  return pid;
}

async function batchRunReports(accessToken, requests) {
  const pid = propertyId();
  const resp = await fetch(`${DATA_API}/properties/${pid}:batchRunReports`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.error && data.error.message) || `HTTP ${resp.status}`;
    const e = new Error(`report: ${msg}`); e.stage = "report"; e.detail = data; throw e;
  }
  return data.reports || [];
}

const num = (v) => Number(v || 0);
// first metric value of the first row, else 0
const firstVal = (report, i = 0) => {
  const row = report && report.rows && report.rows[0];
  return row ? num(row.metricValues[i] && row.metricValues[i].value) : 0;
};
const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0));

// ── Handler ───────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: owner's Supabase session (same gate as the other integration fns).
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const action = String(body.action || "summary");

  try {
    const accessToken = await getAccessToken();

    if (action === "summary") {
      const cur = { startDate: "28daysAgo", endDate: "today" };
      const prev = { startDate: "56daysAgo", endDate: "29daysAgo" };
      const metrics = [
        { name: "activeUsers" }, { name: "sessions" },
        { name: "screenPageViews" }, { name: "conversions" },
      ];
      const [curTotals, prevTotals, channels, pages] = await batchRunReports(accessToken, [
        { dateRanges: [cur], metrics },
        { dateRanges: [prev], metrics },
        { dateRanges: [cur], dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 6 },
        { dateRanges: [cur], dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 6 },
      ]);

      const totals = {
        users:       { value: firstVal(curTotals, 0), change: pctChange(firstVal(curTotals, 0), firstVal(prevTotals, 0)) },
        sessions:    { value: firstVal(curTotals, 1), change: pctChange(firstVal(curTotals, 1), firstVal(prevTotals, 1)) },
        pageViews:   { value: firstVal(curTotals, 2), change: pctChange(firstVal(curTotals, 2), firstVal(prevTotals, 2)) },
        conversions: { value: firstVal(curTotals, 3), change: pctChange(firstVal(curTotals, 3), firstVal(prevTotals, 3)) },
      };
      const channelRows = (channels.rows || []).map((r) => ({
        label: (r.dimensionValues[0] && r.dimensionValues[0].value) || "(other)",
        sessions: num(r.metricValues[0] && r.metricValues[0].value),
      }));
      const pageRows = (pages.rows || []).map((r) => ({
        path: (r.dimensionValues[0] && r.dimensionValues[0].value) || "/",
        views: num(r.metricValues[0] && r.metricValues[0].value),
      }));

      return json({ ok: true, action, rangeDays: 28, totals, channels: channelRows, pages: pageRows });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("ga4 failed:", err && err.stage, err && err.message, err && err.detail);
    return json({
      ok: false,
      stage: err.stage || "unknown",
      error: err.message || "GA4 request failed",
      detail: err.detail,
    }, 502);
  }
};
