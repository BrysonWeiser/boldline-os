// Google Ads API — OAuth token exchange + read / guarded-write operations.
//
// Mirrors the DocuSign function's shape: secured by the owner's Supabase
// session, structured stage-tagged errors, and a no-input "test" action for a
// one-click connectivity check on the Deploy tab.
//
// One MCC (manager) refresh token operates across every linked client account
// via the login-customer-id header. Money is in "micros" ($1 = 1,000,000).
//
// POST body: { action, customerId?, ... }
//   "test"      -> listAccessibleCustomers (no customerId) — proves the token +
//                  developer-token authenticate. The smoke test.
//   "campaigns" -> { customerId } GAQL read: campaigns + last-30-day metrics.
//   "setBudget" -> { customerId, budgetResourceName, dollars } guarded write.
//   "setStatus" -> { customerId, campaignResourceName, status } guarded write.
//
// Required Netlify env vars:
//   GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET,
//   GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_MANAGER_CUSTOMER_ID,
//   SUPABASE_SERVICE_ROLE_KEY
//   (optional) GOOGLE_ADS_API_VERSION — see API_VERSION note below.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

// ⚠️ The single value most likely to need changing at live-test time. Google
// sunsets API versions ~yearly; if a call returns "version not found" or
// "deprecated", set GOOGLE_ADS_API_VERSION in Netlify to a current one — no
// code change or redeploy logic needed beyond the env var.
// Default bumped v18 → v24 on 2026-07-19: v18 was sunset and its REST path 404'd
// the live-connection test. Google keeps ~3 major versions live (v22/v23/v24 as of
// Jul 2026); v24 is the newest GA. When v24 sunsets (~14mo), set GOOGLE_ADS_API_VERSION
// in Netlify to a current one — no code change needed.
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v24";
const ADS_BASE = `https://googleads.googleapis.com/${API_VERSION}`;

const G = {
  devToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  clientId: process.env.GOOGLE_ADS_CLIENT_ID,
  clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  mcc: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// IDs are 10 digits; UI + env store them with dashes (123-456-7890). API wants
// digits only.
const digits = (id) => String(id || "").replace(/[^0-9]/g, "");
const dollarsToMicros = (d) => Math.round(Number(d) * 1e6);
const microsToDollars = (m) => Number(m || 0) / 1e6;

// Google Ads nests the useful error message a few levels down.
function apiErrMsg(stage, status, data) {
  const ge = data && data.error && data.error.details && data.error.details[0]
    && data.error.details[0].errors && data.error.details[0].errors[0];
  const msg = (ge && ge.message) || (data && data.error && data.error.message) || `HTTP ${status}`;
  return `${stage}: ${msg}`;
}

// ── OAuth: refresh token -> access token ──────────────────────────────────────
async function getAccessToken() {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: G.clientId,
      client_secret: G.clientSecret,
      refresh_token: G.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    const e = new Error(`auth: ${data.error || resp.status}${data.error_description ? " — " + data.error_description : ""}`);
    e.stage = "auth";
    e.detail = data;
    throw e;
  }
  return data.access_token;
}

const baseHeaders = (accessToken, withLoginCustomer = true) => {
  const h = {
    authorization: `Bearer ${accessToken}`,
    "developer-token": G.devToken,
    "content-type": "application/json",
  };
  if (withLoginCustomer) h["login-customer-id"] = digits(G.mcc);
  return h;
};

// ── Smoke test: which accounts can this MCC's credentials see? ────────────────
async function listAccessibleCustomers(accessToken) {
  const resp = await fetch(`${ADS_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: baseHeaders(accessToken, false), // this endpoint is about the user, not a login-customer
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("test", resp.status, data));
    e.stage = "test"; e.detail = data; throw e;
  }
  // "customers/1234567890" -> "123-456-7890"
  return (data.resourceNames || [])
    .map((rn) => digits(rn.split("/")[1]))
    .filter(Boolean);
}

// ── GAQL read: campaigns + last-30-day metrics ────────────────────────────────
async function getCampaigns(accessToken, customerId) {
  const query = `SELECT campaign.id, campaign.name, campaign.status,
      campaign.resource_name, campaign_budget.resource_name,
      campaign_budget.amount_micros, metrics.impressions, metrics.clicks,
      metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC`;
  const resp = await fetch(`${ADS_BASE}/customers/${digits(customerId)}/googleAds:search`, {
    method: "POST",
    headers: baseHeaders(accessToken),
    body: JSON.stringify({ query }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("campaigns", resp.status, data));
    e.stage = "campaigns"; e.detail = data; throw e;
  }
  return (data.results || []).map((r) => ({
    id: r.campaign && r.campaign.id,
    name: r.campaign && r.campaign.name,
    status: r.campaign && r.campaign.status,
    campaignResourceName: r.campaign && r.campaign.resourceName,
    budgetResourceName: r.campaignBudget && r.campaignBudget.resourceName,
    dailyBudget: microsToDollars(r.campaignBudget && r.campaignBudget.amountMicros),
    impressions: Number((r.metrics && r.metrics.impressions) || 0),
    clicks: Number((r.metrics && r.metrics.clicks) || 0),
    cost: microsToDollars(r.metrics && r.metrics.costMicros),
    conversions: Number((r.metrics && r.metrics.conversions) || 0),
  }));
}

// ── Guarded write: change a campaign's daily budget ───────────────────────────
async function setBudget(accessToken, customerId, budgetResourceName, dollars) {
  const body = { operations: [{
    update: { resourceName: budgetResourceName, amountMicros: String(dollarsToMicros(dollars)) },
    updateMask: "amount_micros",
  }] };
  const resp = await fetch(`${ADS_BASE}/customers/${digits(customerId)}/campaignBudgets:mutate`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("setBudget", resp.status, data));
    e.stage = "setBudget"; e.detail = data; throw e;
  }
  return data;
}

// ── Guarded write: pause / enable a campaign ──────────────────────────────────
async function setStatus(accessToken, customerId, campaignResourceName, status) {
  const s = String(status || "").toUpperCase();
  if (s !== "PAUSED" && s !== "ENABLED") {
    const e = new Error("status must be PAUSED or ENABLED"); e.stage = "setStatus"; throw e;
  }
  const body = { operations: [{
    update: { resourceName: campaignResourceName, status: s },
    updateMask: "status",
  }] };
  const resp = await fetch(`${ADS_BASE}/customers/${digits(customerId)}/campaigns:mutate`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("setStatus", resp.status, data));
    e.stage = "setStatus"; e.detail = data; throw e;
  }
  return data;
}

// ── Create a full Search campaign, ALL PAUSED ─────────────────────────────────
// One atomic googleAds:mutate using temp (negative) resource names so budget →
// campaign → ad group → responsive search ad → keywords all reference each other
// in a single all-or-nothing request. Manual CPC (no conversion tracking needed),
// Search network only. Everything PAUSED — nothing spends until it's enabled.
// Runs on the CLIENT's own linked account (their customerId + their billing).
// ⚠ NOT yet verified against a live linked account — the Google Ads API is strict;
// expect first-run tweaks (bidding-strategy rules, RSA asset minimums, budget-name
// uniqueness). Dry-run against a real linked client before relying on it.
async function createCampaign(accessToken, p) {
  const cid = digits(p.customerId);
  const err = (m) => Object.assign(new Error(`createCampaign: ${m}`), { stage: "createCampaign" });
  if (!cid) throw err("customerId required");
  if (!p.landingUrl) throw err("landingUrl required");
  if (!/^https?:\/\//i.test(String(p.landingUrl))) throw err("landingUrl must start with http:// or https://");
  if (!(Number(p.dailyBudgetDollars) > 0)) throw err("dailyBudgetDollars must be > 0");
  const headlines = (Array.isArray(p.headlines) ? p.headlines : []).map((h) => String(h || "").trim()).filter(Boolean).slice(0, 15);
  const descriptions = (Array.isArray(p.descriptions) ? p.descriptions : []).map((d) => String(d || "").trim()).filter(Boolean).slice(0, 4);
  const keywords = (Array.isArray(p.keywords) ? p.keywords : []).map((k) => String(k || "").trim()).filter(Boolean).slice(0, 20);
  if (headlines.length < 3) throw err("at least 3 headlines required (Google requires 3+ for a responsive search ad; each ≤30 chars)");
  if (descriptions.length < 2) throw err("at least 2 descriptions required (each ≤90 chars)");
  if (!keywords.length) throw err("at least 1 keyword required");
  const badH = headlines.find((h) => h.length > 30);
  if (badH) throw err(`headline over 30 characters: "${badH}"`);
  const badD = descriptions.find((d) => d.length > 90);
  if (badD) throw err(`description over 90 characters: "${badD}"`);

  const name = String(p.name || "BoldLine Search Campaign").slice(0, 120);
  const mtRaw = String(p.matchType || "PHRASE").toUpperCase();
  const matchType = ["BROAD", "PHRASE", "EXACT"].includes(mtRaw) ? mtRaw : "PHRASE";
  const budgetRN = `customers/${cid}/campaignBudgets/-1`;
  const campaignRN = `customers/${cid}/campaigns/-2`;
  const adGroupRN = `customers/${cid}/adGroups/-3`;
  const cpcMicros = String(dollarsToMicros(Number(p.cpcBidDollars) > 0 ? p.cpcBidDollars : 2));

  const mutateOperations = [
    { campaignBudgetOperation: { create: {
      resourceName: budgetRN,
      name: `${name.slice(0, 80)} Budget ${Date.now()}`, // budget names must be unique per account
      amountMicros: String(dollarsToMicros(p.dailyBudgetDollars)),
      deliveryMethod: "STANDARD",
      explicitlyShared: false,
    } } },
    { campaignOperation: { create: {
      resourceName: campaignRN,
      name,
      status: "PAUSED",
      advertisingChannelType: "SEARCH",
      manualCpc: {},
      campaignBudget: budgetRN,
      networkSettings: {
        targetGoogleSearch: true,
        targetSearchNetwork: false,
        targetContentNetwork: false,
        targetPartnerSearchNetwork: false,
      },
    } } },
    { adGroupOperation: { create: {
      resourceName: adGroupRN,
      name: `${name} — Ad Group`.slice(0, 120),
      campaign: campaignRN,
      status: "PAUSED",
      type: "SEARCH_STANDARD",
      cpcBidMicros: cpcMicros,
    } } },
    { adGroupAdOperation: { create: {
      adGroup: adGroupRN,
      status: "PAUSED",
      ad: {
        finalUrls: [String(p.landingUrl)],
        responsiveSearchAd: {
          headlines: headlines.map((t) => ({ text: t })),
          descriptions: descriptions.map((t) => ({ text: t })),
        },
      },
    } } },
    ...keywords.map((k) => ({ adGroupCriterionOperation: { create: {
      adGroup: adGroupRN,
      status: "ENABLED", // keywords enabled is fine — the campaign itself is PAUSED, so $0
      keyword: { text: k, matchType },
    } } })),
  ];

  const resp = await fetch(`${ADS_BASE}/customers/${cid}/googleAds:mutate`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify({ mutateOperations }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("createCampaign", resp.status, data));
    e.stage = "createCampaign"; e.detail = data; throw e;
  }
  const results = data.mutateOperationResponses || [];
  const rn = (key) => { const r = results.find((x) => x && x[key]); return r && r[key] && r[key].resourceName; };
  return {
    campaignResourceName: rn("campaignResult"),
    budgetResourceName: rn("campaignBudgetResult"),
    adGroupResourceName: rn("adGroupResult"),
    adResourceName: rn("adGroupAdResult"),
    keywordsCreated: results.filter((x) => x && x.adGroupCriterionResult).length,
    status: "PAUSED",
    note: "Created PAUSED — review it in Google Ads, then enable to start spend. Nothing spends until you do.",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const missing = Object.entries({
    GOOGLE_ADS_DEVELOPER_TOKEN: G.devToken,
    GOOGLE_ADS_CLIENT_ID: G.clientId,
    GOOGLE_ADS_CLIENT_SECRET: G.clientSecret,
    GOOGLE_ADS_REFRESH_TOKEN: G.refreshToken,
    GOOGLE_ADS_MANAGER_CUSTOMER_ID: G.mcc,
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return json({ ok: false, error: `Missing env vars: ${missing.join(", ")}` }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: owner's Supabase session (same gate as docusign-send).
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const action = String(body.action || "test");

  try {
    const accessToken = await getAccessToken();

    if (action === "test") {
      const accounts = await listAccessibleCustomers(accessToken);
      const mcc = digits(G.mcc);
      return json({ ok: true, action, apiVersion: API_VERSION, mccId: mcc,
        accounts, mccVisible: accounts.includes(mcc), count: accounts.length });
    }

    if (action === "campaigns") {
      if (!digits(body.customerId)) return json({ ok: false, error: "customerId required" }, 400);
      const campaigns = await getCampaigns(accessToken, body.customerId);
      return json({ ok: true, action, customerId: digits(body.customerId), campaigns });
    }

    if (action === "setBudget") {
      if (!digits(body.customerId) || !body.budgetResourceName || body.dollars == null)
        return json({ ok: false, error: "customerId, budgetResourceName, dollars required" }, 400);
      const result = await setBudget(accessToken, body.customerId, body.budgetResourceName, body.dollars);
      return json({ ok: true, action, result });
    }

    if (action === "setStatus") {
      if (!digits(body.customerId) || !body.campaignResourceName || !body.status)
        return json({ ok: false, error: "customerId, campaignResourceName, status required" }, 400);
      const result = await setStatus(accessToken, body.customerId, body.campaignResourceName, body.status);
      return json({ ok: true, action, result });
    }

    if (action === "createCampaign") {
      const result = await createCampaign(accessToken, body);
      return json({ ok: true, action, ...result });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("google-ads failed:", err && err.stage, err && err.message, err && err.detail);
    return json({
      ok: false,
      stage: err.stage || "unknown",
      error: err.message || "Google Ads request failed",
      detail: err.detail,
    }, 502);
  }
};
