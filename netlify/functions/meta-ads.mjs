// Meta (Facebook/Instagram) Ads — Marketing API read / guarded-write / create.
//
// The Meta counterpart to google-ads.mjs. Same shape: secured by the owner's
// Supabase session, structured stage-tagged errors, and a no-input "test" action
// for a one-click Deploy-tab connectivity check.
//
// AGENCY MODEL (mirrors the Google MCC): ONE business System-User token operates
// across every CLIENT ad account the client has shared with BoldLine's business
// portfolio. BoldLine holds MANAGER access only — every campaign runs on the
// CLIENT's own ad account with the CLIENT's payment method. BoldLine never pays
// for or fronts ad spend (hard business constraint).
//
// POST body: { action, adAccountId?, ... }   (adAccountId = the client's numeric
//   ad-account id, stored per-client as metaAdAccountId; we prefix "act_".)
//   "test"           -> lists the ad accounts the token can see. Smoke test.
//   "campaigns"      -> { adAccountId } read campaigns + last-30-day insights.
//   "setBudget"      -> { adAccountId, campaignId, dailyBudgetDollars } guarded write.
//   "setStatus"      -> { adAccountId, campaignId, status } PAUSED|ACTIVE guarded write.
//   "createCampaign" -> { adAccountId, pageId, landingUrl, ... } builds a full
//                       lead-gen campaign (campaign→adset→creative→ad), ALL PAUSED
//
// Also exported for the scheduled ads-autopilot job (no HTTP, no owner session):
//   getAdsForCampaign  -> ads in a campaign with ad-level 30-day insights
//   addAdToAdset       -> one challenger ad into an EXISTING ad set (budget-neutral)
//   setAdStatus        -> pause/resume ONE ad, leaving the ad set and budget alone
//                       so nothing ever spends without an explicit activation.
//
// Required Netlify env vars:
//   META_SYSTEM_USER_TOKEN  (long-lived system-user token, ads_management scope)
//   META_APP_SECRET         (for appsecret_proof — server-call hardening)
//   SUPABASE_SERVICE_ROLE_KEY
//   (optional) META_APP_ID
//   (optional) META_GRAPH_VERSION — Meta ships a new version ~quarterly; if a call
//     returns "Unsupported get/post request" / version errors, bump this in Netlify
//     (no code change). Default tracks the current GA version.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

// Default to the current GA Graph/Marketing API version (v25.0, Feb 2026).
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const M = {
  token: process.env.META_SYSTEM_USER_TOKEN,
  appSecret: process.env.META_APP_SECRET,
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Ad-account ids are stored numeric; the API wants the act_ prefix.
const acct = (id) => {
  const d = String(id || "").replace(/[^0-9]/g, "");
  return d ? `act_${d}` : "";
};
const dollarsToCents = (d) => Math.round(Number(d) * 100); // Meta budgets are minor units
const centsToDollars = (c) => Number(c || 0) / 100;

// appsecret_proof = HMAC-SHA256(access_token) keyed by the app secret. Meta
// recommends it on every server-side call; harmless when the app doesn't require it.
const appProof = (tok) => {
  const t = tok || M.token;
  return M.appSecret ? crypto.createHmac("sha256", M.appSecret).update(t).digest("hex") : null;
};

// Meta nests the useful error under data.error. Surface its code/subcode/type so a
// vague message ("API access blocked") is actually diagnosable from the OS.
function metaErr(stage, status, data) {
  const e = data && data.error;
  const base = (e && (e.error_user_msg || e.message)) || `HTTP ${status}`;
  const bits = [];
  if (e && e.code != null) bits.push(`code ${e.code}`);
  if (e && e.error_subcode != null) bits.push(`subcode ${e.error_subcode}`);
  if (e && e.type) bits.push(e.type);
  const msg = bits.length ? `${base} (${bits.join(", ")})` : base;
  const err = new Error(`${stage}: ${msg}`);
  err.stage = stage;
  err.detail = e || data;
  return err;
}

// One Graph call. GET puts params in the query; POST in the form body. The token
// + appsecret_proof are always attached.
async function graph(stage, path, { method = "GET", params = {}, token } = {}) {
  const tok = token || M.token;
  const proof = appProof(tok);
  const auth = { access_token: tok, ...(proof ? { appsecret_proof: proof } : {}) };
  let url = `${BASE}/${path}`;
  const opts = { method };
  if (method === "GET" || method === "DELETE") {
    const qs = new URLSearchParams({ ...params, ...auth });
    url += `?${qs.toString()}`;
  } else {
    opts.headers = { "content-type": "application/x-www-form-urlencoded" };
    opts.body = new URLSearchParams({ ...params, ...auth }).toString();
  }
  const resp = await fetch(url, opts);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || (data && data.error)) throw metaErr(stage, resp.status, data);
  return data;
}

// ── Smoke test: which ad accounts can this token see? ─────────────────────────
async function listAdAccounts() {
  const data = await graph("test", "me/adaccounts", {
    params: { fields: "account_id,name,account_status,currency", limit: "100" },
  });
  return (data.data || []).map((a) => ({
    id: a.account_id,
    name: a.name,
    status: a.account_status, // 1 = active
    currency: a.currency,
  }));
}

// Read the businesses this token manages — a genuine business_management call
// (me/adaccounts above is ads-scoped and never exercises business_management).
// Best-effort: the smoke test still succeeds if this errors.
async function listBusinesses() {
  try {
    const data = await graph("test", "me/businesses", { params: { fields: "id,name", limit: "50" } });
    return (data.data || []).map((b) => ({ id: b.id, name: b.name }));
  } catch (e) {
    console.warn("meta test: me/businesses read failed:", e && e.message);
    return [];
  }
}

// ── Read a Page: list managed Pages + read one Page's engagement ──────────────
// Two calls, on purpose — they exercise two distinct permissions:
//   me/accounts                  -> pages_show_list  (which Pages can we manage?)
//   {page-id}?fields=…engagement -> pages_read_engagement (the Page's basics)
// This is a legitimate read for the agency model: BoldLine publishes each client's
// ads ON that client's Facebook Page, so reading the Page it's advertising is
// exactly what these permissions are for. Nothing is written.
// Which scopes does the DEPLOYED token actually carry? Used to diagnose
// permission errors — distinguishes "old token still deployed" from
// "correctly-scoped token blocked by Meta". Best effort, never throws.
async function tokenScopes() {
  const appId = process.env.META_APP_ID;
  try {
    if (appId && M.appSecret) {
      const r = await fetch(
        `${BASE}/debug_token?input_token=${encodeURIComponent(M.token)}&access_token=${encodeURIComponent(`${appId}|${M.appSecret}`)}`,
      );
      const d = await r.json().catch(() => ({}));
      const s = d && d.data && d.data.scopes;
      if (Array.isArray(s) && s.length) return s;
    }
  } catch {}
  try {
    const d = await graph("scopes", "me/permissions", { params: { limit: "100" } });
    const s = (d.data || []).filter((p) => p.status === "granted").map((p) => p.permission);
    if (s.length) return s;
  } catch {}
  return null;
}

async function readPage(pageId) {
  // pages_show_list — the Pages this token can manage. Ask for each Page's own
  // access_token too, so we can read Page-level fields with the PAGE token below.
  let acc;
  try {
    acc = await graph("page:list", "me/accounts", {
      params: { fields: "id,name,category,access_token,tasks", limit: "100" },
    });
  } catch (e) {
    const scopes = await tokenScopes();
    if (scopes) e.message += ` — deployed token scopes: [${scopes.join(", ")}]`;
    else e.message += " — (couldn't introspect the deployed token's scopes)";
    throw e;
  }
  const list = acc.data || [];
  const pages = list.map((p) => ({ id: p.id, name: p.name, category: p.category }));

  // pages_read_engagement — read the target Page's basics. fan_count + engagement
  // require pages_read_engagement, AND Meta blocks these fields on a user/system-user
  // token — they must be read with the PAGE's own access token (from me/accounts).
  let page = null;
  if (pageId) {
    const match = list.find((p) => String(p.id) === String(pageId));
    const pageToken = (match && match.access_token) || undefined; // fall back to caller token
    const p = await graph("page:read", `${pageId}`, {
      params: { fields: "name,fan_count,followers_count,engagement" },
      token: pageToken,
    });
    page = {
      id: pageId,
      name: p.name,
      fanCount: Number(p.fan_count || 0),
      followers: Number(p.followers_count || 0),
      engagement: (p.engagement && Number(p.engagement.count)) || 0,
    };
  }
  return { pages, page };
}

// ── Read: campaigns + last-30-day insights ────────────────────────────────────
// Meta keeps spend/results in a separate insights edge; we fetch both and merge
// by campaign id. "leads" is summed from the lead-type actions.
const LEAD_ACTIONS = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "leadgen.other",
]);
function leadsFromActions(actions) {
  if (!Array.isArray(actions)) return 0;
  return actions
    .filter((a) => LEAD_ACTIONS.has(a.action_type))
    .reduce((s, a) => s + Number(a.value || 0), 0);
}

// Exported so the scheduled ads-sync job can read performance without going back
// out over HTTP (and without needing an owner session). Same call, same shape.
export async function getCampaigns(adAccountId) {
  const a = acct(adAccountId);
  const camps = await graph("campaigns", `${a}/campaigns`, {
    params: {
      fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
      limit: "100",
    },
  });
  // One insights call for the whole account, keyed by campaign.
  let insightsById = {};
  try {
    const ins = await graph("campaigns", `${a}/insights`, {
      params: {
        level: "campaign",
        date_preset: "last_30d",
        fields: "campaign_id,spend,impressions,clicks,actions",
        limit: "500",
      },
    });
    (ins.data || []).forEach((r) => {
      insightsById[r.campaign_id] = r;
    });
  } catch (e) {
    // No insights (e.g. brand-new account with no delivery) is not fatal.
    insightsById = {};
  }
  return (camps.data || []).map((c) => {
    const i = insightsById[c.id] || {};
    const leads = leadsFromActions(i.actions);
    const spend = Number(i.spend || 0);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      effectiveStatus: c.effective_status,
      objective: c.objective,
      dailyBudget: centsToDollars(c.daily_budget), // campaign-level (CBO) budget
      impressions: Number(i.impressions || 0),
      clicks: Number(i.clicks || 0),
      spend,
      leads,
      cpl: leads > 0 ? Number((spend / leads).toFixed(2)) : 0,
    };
  });
}


// ── Read: the ADS inside a campaign, with ad-level insights ──────────────────
// Needed by autopilot's creative testing, which works one AD SET at a time: it can
// only judge a test if it can see each ad's own numbers, and it can only write a
// challenger if it can see what the champion already says (so it writes something
// genuinely different rather than a reworded twin).
//
// Two Graph calls, merged by ad id — the same shape as getCampaigns, for the same
// reason: Meta keeps delivery numbers on a separate insights edge.
export async function getAdsForCampaign(adAccountId, campaignId) {
  const a = acct(adAccountId);
  const ads = await graph("ads", `${campaignId}/ads`, {
    params: {
      fields: "id,name,status,effective_status,adset_id,created_time," +
        "creative{id,object_story_spec,effective_object_story_id}",
      limit: "100",
    },
  });

  let insightsById = {};
  try {
    const ins = await graph("ads", `${a}/insights`, {
      params: {
        level: "ad", date_preset: "last_30d",
        fields: "ad_id,spend,impressions,clicks,actions",
        limit: "500",
      },
    });
    (ins.data || []).forEach((r) => { insightsById[r.ad_id] = r; });
  } catch {
    insightsById = {};   // a brand-new ad with no delivery is not an error
  }

  return (ads.data || []).map((ad) => {
    const i = insightsById[ad.id] || {};
    // The copy lives several levels down and any level can be absent on an ad built
    // outside this system (in Ads Manager by hand, say). Read it defensively: a
    // missing headline must not throw, it just means autopilot cannot judge that ad.
    const spec = (ad.creative && ad.creative.object_story_spec) || {};
    const link = spec.link_data || {};
    return {
      id: ad.id,
      name: ad.name,
      adsetId: ad.adset_id,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      createdTime: ad.created_time,
      pageId: spec.page_id ? String(spec.page_id) : "",
      headline: String(link.name || ""),
      primaryText: String(link.message || ""),
      description: String(link.description || ""),
      linkUrl: String(link.link || ""),
      imageHash: String(link.image_hash || ""),
      ctaType: (link.call_to_action && link.call_to_action.type) || "",
      impressions: Number(i.impressions || 0),
      clicks: Number(i.clicks || 0),
      spend: Number(i.spend || 0),
      leads: leadsFromActions(i.actions),
    };
  });
}

// ── Guarded write: pause or resume ONE AD (not the campaign) ─────────────────
// Pausing a losing ad leaves the ad set and its budget untouched. The same money
// simply stops buying the worse creative.
export async function setAdStatus(adId, status) {
  const st = String(status || "").toUpperCase();
  if (!["ACTIVE", "PAUSED"].includes(st)) {
    throw Object.assign(new Error("setAdStatus: status must be ACTIVE or PAUSED"), { stage: "setAdStatus" });
  }
  await graph("setAdStatus", String(adId), { method: "POST", params: { status: st } });
  return { adId: String(adId), status: st };
}

// ── Guarded write: add ONE AD to an EXISTING ad set ──────────────────────────
// 🔴 THIS IS BUDGET-NEUTRAL, WHICH IS THE ONLY REASON AUTOPILOT MAY DO IT UNASKED.
// Budget lives on the campaign (CBO) or the ad set, never on the ad. A second ad
// inside an existing ad set changes WHICH CREATIVE the same money buys; it cannot
// raise the bill by a cent. It creates no campaign, no ad set, and enables nothing
// that was paused.
//
// The challenger reuses the champion's IMAGE by hash. That is deliberate: changing
// the copy and the picture at once means a win teaches you nothing about which
// change won.
export async function addAdToAdset(adAccountId, p) {
  const a = acct(adAccountId);
  if (!p.adsetId) throw Object.assign(new Error("addAdToAdset: adsetId required"), { stage: "addAdToAdset" });
  if (!p.pageId) throw Object.assign(new Error("addAdToAdset: pageId required"), { stage: "addAdToAdset" });
  if (!p.linkUrl) throw Object.assign(new Error("addAdToAdset: linkUrl required"), { stage: "addAdToAdset" });
  if (!p.headline) throw Object.assign(new Error("addAdToAdset: headline required"), { stage: "addAdToAdset" });

  const linkData = {
    message: String(p.primaryText || ""),
    link: p.linkUrl,
    name: String(p.headline),
    description: String(p.description || ""),
    call_to_action: { type: String(p.ctaType || "LEARN_MORE"), value: { link: p.linkUrl } },
  };
  // A link ad with no image is rejected by Meta, so an absent hash is a hard stop
  // rather than something to discover from a 400 three lines later.
  if (!p.imageHash) {
    throw Object.assign(new Error("addAdToAdset: imageHash required — a Meta link ad must have an image"), { stage: "addAdToAdset" });
  }
  linkData.image_hash = p.imageHash;

  const name = String(p.name || "Challenger");
  const creative = await graph("addAdToAdset", `${a}/adcreatives`, {
    method: "POST",
    params: {
      name: `${name} — Creative`,
      object_story_spec: JSON.stringify({ page_id: String(p.pageId), link_data: linkData }),
    },
  });
  const ad = await graph("addAdToAdset", `${a}/ads`, {
    method: "POST",
    params: {
      name: `${name} — Ad`,
      adset_id: String(p.adsetId),
      creative: JSON.stringify({ creative_id: creative.id }),
      // ACTIVE on purpose: a challenger that never runs is not a test. It sits inside
      // an ad set that is ALREADY live and already spending, so this enables nothing
      // that was off and raises no budget.
      status: String(p.status || "ACTIVE").toUpperCase(),
    },
  });
  return { creativeId: creative.id, adId: ad.id, adsetId: String(p.adsetId) };
}

// ── Guarded write: campaign daily budget (assumes campaign-level/CBO budget, ──
// which is how createCampaign builds them). ───────────────────────────────────
export async function setBudget(campaignId, dollars) {
  return graph("setBudget", `${campaignId}`, {
    method: "POST",
    params: { daily_budget: String(dollarsToCents(dollars)) },
  });
}

// ── Guarded write: pause / activate a campaign ────────────────────────────────
export async function setStatus(campaignId, status) {
  const s = String(status || "").toUpperCase();
  if (s !== "PAUSED" && s !== "ACTIVE") {
    const e = new Error("status must be PAUSED or ACTIVE");
    e.stage = "setStatus";
    throw e;
  }
  return graph("setStatus", `${campaignId}`, { method: "POST", params: { status: s } });
}

// ── Destructive: delete a campaign ───────────────────────────────────────────
// Meta's DELETE on a campaign node removes the campaign along with its ad sets
// and ads. IRREVERSIBLE — it cannot be un-deleted, only rebuilt. Historical
// spend stays on the ad account's billing record either way.
// A live campaign is PAUSED first, so spend stops even if the delete then fails
// for any reason (a half-finished delete must never leave ads running).
async function deleteCampaign(campaignId, { wasLive } = {}) {
  if (!campaignId) {
    const e = new Error("campaignId required"); e.stage = "deleteCampaign"; throw e;
  }
  if (wasLive) {
    try { await setStatus(campaignId, "PAUSED"); }
    catch (e) { console.warn("deleteCampaign: pre-pause failed, continuing to delete:", e && e.message); }
  }
  await graph("deleteCampaign", `${campaignId}`, { method: "DELETE" });
  return { deleted: true, campaignId: String(campaignId) };
}

// ── Upload an image to the ad account, return its hash (for the creative). ────
async function uploadImage(adAccountId, imageUrl) {
  const r = await fetch(imageUrl);
  if (!r.ok) {
    const e = new Error(`createCampaign: couldn't fetch the ad image (${r.status})`);
    e.stage = "createCampaign";
    throw e;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const data = await graph("createCampaign", `${acct(adAccountId)}/adimages`, {
    method: "POST",
    params: { bytes: buf.toString("base64") },
  });
  // Response: { images: { <filename>: { hash, url } } }
  const first = data.images && Object.values(data.images)[0];
  if (!first || !first.hash) {
    const e = new Error("createCampaign: image upload returned no hash");
    e.stage = "createCampaign";
    throw e;
  }
  return first.hash;
}

// ── Create a full lead-gen campaign, ALL PAUSED ───────────────────────────────
// Drives clicks to the client's landing page (BoldLine's model). Everything is
// created PAUSED — nothing spends until it's explicitly activated (setStatus
// ACTIVE via the approval queue / Ads Manager). Runs on the CLIENT's ad account
// + CLIENT's Facebook Page + CLIENT's payment method.
async function createCampaign(p) {
  const a = acct(p.adAccountId);
  if (!a) throw Object.assign(new Error("createCampaign: adAccountId required"), { stage: "createCampaign" });
  if (!p.pageId) throw Object.assign(new Error("createCampaign: the client's Facebook pageId is required"), { stage: "createCampaign" });
  if (!p.landingUrl) throw Object.assign(new Error("createCampaign: landingUrl required"), { stage: "createCampaign" });
  if (!(Number(p.dailyBudgetDollars) > 0)) throw Object.assign(new Error("createCampaign: dailyBudgetDollars must be > 0"), { stage: "createCampaign" });
  // Meta link ads must carry an image — fail fast (before creating any objects)
  // with a clear message instead of a cryptic creative-stage rejection.
  if (!p.imageUrl) throw Object.assign(new Error("createCampaign: an ad image is required — Meta link ads must have an image. Upload one to the client's media library, then retry."), { stage: "createCampaign" });

  const name = String(p.name || "BoldLine Lead Campaign");

  // 1) image (optional) -> hash
  let imageHash = null;
  if (p.imageUrl) imageHash = await uploadImage(p.adAccountId, p.imageUrl);

  // 2) campaign (CBO daily budget lives here so setBudget targets the campaign).
  // OUTCOME_TRAFFIC: BoldLine drives clicks to the CLIENT's landing page (the page
  // captures the lead), so traffic-to-website is the correct, pixel-free objective.
  // (OUTCOME_LEADS optimizing for link-clicks needs a pixel/promoted_object and
  // gets rejected; switch to OUTCOME_SALES/LEADS + a promoted_object later, once
  // the client's pixel + lead events exist.)
  const camp = await graph("createCampaign", `${a}/campaigns`, {
    method: "POST",
    params: {
      name,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: "[]",
      daily_budget: String(dollarsToCents(p.dailyBudgetDollars)),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    },
  });

  // 3) ad set — targeting + optimization. LINK_CLICKS keeps it working without a
  // pixel; swap to OFFSITE_CONVERSIONS once the client's pixel + events exist.
  const targeting = {
    geo_locations: p.geo && (p.geo.countries || p.geo.cities)
      ? p.geo
      : { countries: ["US"] },
    age_min: Number(p.ageMin) || 18,
    age_max: Number(p.ageMax) || 65,
  };
  if (p.genders) targeting.genders = p.genders; // [1]=male [2]=female; omit = all
  const adset = await graph("createCampaign", `${a}/adsets`, {
    method: "POST",
    params: {
      name: `${name} — Ad Set`,
      campaign_id: camp.id,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      // No bid_strategy here — it's set at the campaign level (CBO); Meta rejects
      // a duplicate/conflicting bid_strategy on the ad set when campaign budget is on.
      targeting: JSON.stringify(targeting),
      status: "PAUSED",
      start_time: new Date(Date.now() + 3600e3).toISOString(),
    },
  });

  // 4) creative — a link ad to the landing page, on the client's Page
  const linkData = {
    message: String(p.primaryText || ""),
    link: p.landingUrl,
    name: String(p.headline || ""),
    description: String(p.description || ""),
    call_to_action: { type: String(p.ctaType || "LEARN_MORE"), value: { link: p.landingUrl } },
  };
  if (imageHash) linkData.image_hash = imageHash;
  const creative = await graph("createCampaign", `${a}/adcreatives`, {
    method: "POST",
    params: {
      name: `${name} — Creative`,
      object_story_spec: JSON.stringify({ page_id: String(p.pageId), link_data: linkData }),
    },
  });

  // 5) ad
  const ad = await graph("createCampaign", `${a}/ads`, {
    method: "POST",
    params: {
      name: `${name} — Ad`,
      adset_id: adset.id,
      creative: JSON.stringify({ creative_id: creative.id }),
      status: "PAUSED",
    },
  });

  return {
    campaignId: camp.id,
    adsetId: adset.id,
    creativeId: creative.id,
    adId: ad.id,
    status: "PAUSED",
    note: "Created PAUSED — review it, then activate (approval queue / Ads Manager) to start spend.",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const missing = Object.entries({
    META_SYSTEM_USER_TOKEN: M.token,
    META_APP_SECRET: M.appSecret,
  }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) return json({ ok: false, error: `Missing env vars: ${missing.join(", ")}` }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // Auth: owner's Supabase session (same gate as google-ads / docusign-send).
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
    if (action === "test") {
      const accounts = await listAdAccounts();
      const businesses = await listBusinesses(); // exercises business_management
      return json({ ok: true, action, graphVersion: GRAPH_VERSION, accounts, count: accounts.length, businesses });
    }

    if (action === "campaigns") {
      if (!acct(body.adAccountId)) return json({ ok: false, error: "adAccountId required" }, 400);
      const campaigns = await getCampaigns(body.adAccountId);
      return json({ ok: true, action, adAccountId: acct(body.adAccountId), campaigns });
    }

    if (action === "page") {
      const result = await readPage(body.pageId);
      return json({ ok: true, action, ...result });
    }

    if (action === "setBudget") {
      if (!body.campaignId || body.dailyBudgetDollars == null)
        return json({ ok: false, error: "campaignId, dailyBudgetDollars required" }, 400);
      const result = await setBudget(body.campaignId, body.dailyBudgetDollars);
      return json({ ok: true, action, result });
    }

    if (action === "setStatus") {
      if (!body.campaignId || !body.status)
        return json({ ok: false, error: "campaignId, status required" }, 400);
      const result = await setStatus(body.campaignId, body.status);
      return json({ ok: true, action, result });
    }

    if (action === "deleteCampaign") {
      if (!body.campaignId) return json({ ok: false, error: "campaignId required" }, 400);
      const result = await deleteCampaign(body.campaignId, { wasLive: !!body.wasLive });
      return json({ ok: true, action, ...result });
    }

    if (action === "createCampaign") {
      const result = await createCampaign(body);
      // Notify the owner a campaign was created + is awaiting approval (covers
      // owner-launched AND future bot-launched). Best-effort; never blocks.
      try {
        const { dispatchAlert } = await import("../lib/alerts-shared.mjs");
        await dispatchAlert({
          title: "New Meta campaign awaiting approval",
          body: `A Meta campaign "${body.name || "(unnamed)"}"${body.clientName ? ` for ${body.clientName}` : ""} was just created and is PAUSED. Approve it in BoldLine OS → Alerts (or "Your Live Campaigns") to set it live. Nothing spends until you do.`,
          severity: "yellow",
          smsText: `BoldLine: new Meta campaign "${body.name || ""}" created (paused) — approve in the OS to launch.`,
        });
      } catch (e) { console.error("createCampaign owner alert failed:", e && e.message); }
      return json({ ok: true, action, ...result });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("meta-ads failed:", err && err.stage, err && err.message, err && err.detail);
    return json({
      ok: false,
      stage: err.stage || "unknown",
      error: err.message || "Meta Ads request failed",
      detail: err.detail,
    }, 502);
  }
};
