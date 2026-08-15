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

// Google Ads nests the useful message a few levels down, and the message ALONE is
// often useless: "The required field was not present" does not say which field, on
// which operation. The field path and error code do, so they are pulled up too —
// without them a build failure costs a guessing round-trip.
function apiErrMsg(stage, status, data) {
  const failure = data && data.error && data.error.details && data.error.details[0];
  const ge = failure && failure.errors && failure.errors[0];
  const msg = (ge && ge.message) || (data && data.error && data.error.message) || `HTTP ${status}`;
  if (!ge) return `${stage}: ${msg}`;

  // "operations[7].ad_group_ad_operation.create.ad.final_urls" — the exact spot.
  const path = ((ge.location && ge.location.fieldPathElements) || [])
    .map((f) => (f.index !== undefined && f.index !== null ? `${f.fieldName}[${f.index}]` : f.fieldName))
    .filter(Boolean).join(".");
  // errorCode is a one-key object like { fieldError: "REQUIRED" }.
  const codeObj = ge.errorCode || {};
  const codeKey = Object.keys(codeObj)[0];
  const code = codeKey ? `${codeKey}=${codeObj[codeKey]}` : "";

  const extra = [path && `field: ${path}`, code, ge.trigger && ge.trigger.stringValue && `trigger: ${ge.trigger.stringValue}`]
    .filter(Boolean).join(" | ");
  // More than one thing can be wrong at once; say so rather than fixing one and
  // hitting the next on the following attempt.
  const more = failure.errors && failure.errors.length > 1 ? ` (+${failure.errors.length - 1} more error${failure.errors.length > 2 ? "s" : ""})` : "";
  return `${stage}: ${msg}${extra ? ` [${extra}]` : ""}${more}`;
}

// ── OAuth: refresh token -> access token ──────────────────────────────────────
export async function getAccessToken() {
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
// Exported (with getAccessToken above) so the scheduled ads-sync job can read
// performance directly instead of re-entering this function over HTTP.
export async function getCampaigns(accessToken, customerId) {
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
export async function setBudget(accessToken, customerId, budgetResourceName, dollars) {
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
export async function setStatus(accessToken, customerId, campaignResourceName, status) {
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

// ── Destructive: remove a campaign ───────────────────────────────────────────
// Google has no hard delete — "remove" sets the campaign to REMOVED, which is
// PERMANENT: a removed campaign can never be re-enabled, only rebuilt. It stops
// serving immediately and drops out of the OS list. Its historical stats stay in
// the Google Ads account for reporting.
// A live campaign is PAUSED first so serving stops even if the remove then fails.
async function removeCampaign(accessToken, customerId, campaignResourceName, { wasLive } = {}) {
  const cid = digits(customerId);
  if (!cid || !campaignResourceName) {
    const e = new Error("customerId and campaignResourceName required"); e.stage = "removeCampaign"; throw e;
  }
  if (wasLive) {
    try { await setStatus(accessToken, cid, campaignResourceName, "PAUSED"); }
    catch (e) { console.warn("removeCampaign: pre-pause failed, continuing to remove:", e && e.message); }
  }
  const resp = await fetch(`${ADS_BASE}/customers/${cid}/campaigns:mutate`, {
    method: "POST",
    headers: baseHeaders(accessToken),
    body: JSON.stringify({ operations: [{ remove: campaignResourceName }] }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("removeCampaign", resp.status, data));
    e.stage = "removeCampaign"; e.detail = data; throw e;
  }
  return { deleted: true, campaignResourceName };
}

// ── Resolve plain location names -> geo target constants ─────────────────────
// "Gilbert, Arizona" -> geoTargetConstants/1015226. Google's suggest endpoint is
// the only sane way to do this; hard-coding IDs rots and silently targets the
// wrong city (there is a Phoenix in Arizona and one in New York).
// Not customer-scoped, so no login-customer-id — same as listAccessibleCustomers.
const ENGLISH_LANGUAGE_CONSTANT = "languageConstants/1000";

async function resolveGeoTargets(accessToken, names, countryCode = "US") {
  const wanted = (Array.isArray(names) ? names : []).map((n) => String(n || "").trim()).filter(Boolean).slice(0, 20);
  if (!wanted.length) return [];
  const resp = await fetch(`${ADS_BASE}/geoTargetConstants:suggest`, {
    method: "POST",
    headers: baseHeaders(accessToken, false),
    body: JSON.stringify({ locale: "en", countryCode, locationNames: { names: wanted } }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg("resolveGeoTargets", resp.status, data));
    e.stage = "resolveGeoTargets"; e.detail = data; throw e;
  }
  const suggestions = data.geoTargetConstantSuggestions || [];
  const resolved = [];
  const unresolved = [];
  for (const name of wanted) {
    // Match this suggestion back to the term the caller asked for — the endpoint
    // returns every suggestion in one flat list, not grouped per input.
    const hit = suggestions.find((s) =>
      s && s.geoTargetConstant &&
      String(s.geoTargetConstant.status || "ENABLED").toUpperCase() === "ENABLED" &&
      String(s.searchTerm || "").toLowerCase() === name.toLowerCase());
    if (hit) {
      resolved.push({
        resourceName: hit.geoTargetConstant.resourceName,
        canonicalName: hit.geoTargetConstant.canonicalName || hit.geoTargetConstant.name || name,
        requested: name,
      });
    } else {
      unresolved.push(name);
    }
  }
  // Dedupe — "Phoenix" and "Phoenix, Arizona" resolve to the same constant, and
  // Google rejects a campaign that targets the same location twice.
  const seen = new Set();
  const unique = resolved.filter((r) => (seen.has(r.resourceName) ? false : (seen.add(r.resourceName), true)));
  return Object.assign(unique, { unresolved });
}

// ── Create a full Search campaign, ALL PAUSED ─────────────────────────────────
// One atomic googleAds:mutate using temp (negative) resource names so budget →
// campaign → location + language + negative criteria → ad group → responsive
// search ad → keywords all reference each other in a single all-or-nothing request. Manual CPC (no conversion tracking needed),
// Search network only. Everything PAUSED — nothing spends until it's enabled.
// Runs on the CLIENT's own linked account (their customerId + their billing).
// ⚠ NOT yet verified against a live linked account — the Google Ads API is strict;
// expect first-run tweaks (bidding-strategy rules, RSA asset minimums, budget-name
// uniqueness). Dry-run against a real linked client before relying on it.
export async function createCampaign(accessToken, p) {
  const cid = digits(p.customerId);
  const err = (m) => Object.assign(new Error(`createCampaign: ${m}`), { stage: "createCampaign" });
  if (!cid) throw err("customerId required");
  if (!p.landingUrl) throw err("landingUrl required");
  if (!/^https?:\/\//i.test(String(p.landingUrl))) throw err("landingUrl must start with http:// or https://");
  if (!(Number(p.dailyBudgetDollars) > 0)) throw err("dailyBudgetDollars must be > 0");
  // TWO INPUT SHAPES. `adGroups[]` is the real one: several tightly themed groups,
  // each with its own keywords and its own ad, so the ad can actually match the
  // search. The flat headlines/descriptions/keywords shape is the original
  // single-group call, kept working because the OS and any older caller still use
  // it — it is normalised into a one-element adGroups array immediately.
  const dfltMt = ["BROAD", "PHRASE", "EXACT"].includes(String(p.matchType || "").toUpperCase())
    ? String(p.matchType).toUpperCase() : "PHRASE";
  const norm = (g) => ({
    name: String(g.name || "Ad Group").trim().slice(0, 120),
    headlines: (Array.isArray(g.headlines) ? g.headlines : []).map((h) => String(h || "").trim()).filter(Boolean).slice(0, 15),
    descriptions: (Array.isArray(g.descriptions) ? g.descriptions : []).map((d) => String(d || "").trim()).filter(Boolean).slice(0, 4),
    // Keywords arrive either as plain strings (legacy) or {text, matchType} (generated).
    keywords: (Array.isArray(g.keywords) ? g.keywords : []).map((k) => {
      const text = String((k && k.text !== undefined ? k.text : k) || "").trim();
      const mt = String((k && k.matchType) || dfltMt).toUpperCase();
      return text ? { text, matchType: ["BROAD", "PHRASE", "EXACT"].includes(mt) ? mt : dfltMt } : null;
    }).filter(Boolean).slice(0, 100),
  });

  const adGroups = (Array.isArray(p.adGroups) && p.adGroups.length
    ? p.adGroups
    : [{ name: `${String(p.name || "Search")} — Ad Group`, headlines: p.headlines, descriptions: p.descriptions, keywords: p.keywords }]
  ).map(norm);

  if (!adGroups.length) throw err("at least 1 ad group required");
  for (const g of adGroups) {
    if (g.headlines.length < 3) throw err(`ad group "${g.name}": at least 3 headlines required (Google requires 3+ for a responsive search ad; each ≤30 chars)`);
    if (g.descriptions.length < 2) throw err(`ad group "${g.name}": at least 2 descriptions required (each ≤90 chars)`);
    if (!g.keywords.length) throw err(`ad group "${g.name}": at least 1 keyword required`);
    const bh = g.headlines.find((h) => h.length > 30);
    if (bh) throw err(`ad group "${g.name}": headline over 30 characters: "${bh}"`);
    const bd = g.descriptions.find((d) => d.length > 90);
    if (bd) throw err(`ad group "${g.name}": description over 90 characters: "${bd}"`);
  }
  // The same keyword in two ad groups makes them bid against each other and splits
  // the data, so this is a hard error rather than a silent dedupe.
  const kwSeen = new Map();
  for (const g of adGroups) for (const k of g.keywords) {
    const key = `${k.text}|${k.matchType}`;
    if (kwSeen.has(key)) throw err(`keyword "${k.text}" (${k.matchType}) appears in both "${kwSeen.get(key)}" and "${g.name}" — each keyword belongs to exactly one ad group`);
    kwSeen.set(key, g.name);
  }
  // A Search campaign created with NO location criteria targets ALL COUNTRIES AND
  // TERRITORIES. On a small daily budget that is the single fastest way to burn a
  // month of spend on clicks that could never become customers, and it looks like
  // the ads failed rather than like a targeting hole. So: locations are REQUIRED.
  const locationNames = (Array.isArray(p.locations) ? p.locations : [])
    .map((l) => String(l || "").trim()).filter(Boolean).slice(0, 20);
  if (!locationNames.length) throw err("at least 1 target location required (e.g. \"Gilbert, Arizona\") — without one Google targets every country on earth");
  const negativeKeywords = (Array.isArray(p.negativeKeywords) ? p.negativeKeywords : [])
    .map((k) => String(k || "").trim()).filter(Boolean).slice(0, 50);
  const name = String(p.name || "BoldLine Search Campaign").slice(0, 120);
  const budgetRN = `customers/${cid}/campaignBudgets/-1`;
  const campaignRN = `customers/${cid}/campaigns/-2`;
  const cpcMicros = String(dollarsToMicros(Number(p.cpcBidDollars) > 0 ? p.cpcBidDollars : 2));

  const geo = await resolveGeoTargets(accessToken, locationNames, p.countryCode || "US");
  if (!geo.length) {
    throw err(`could not resolve any of these locations: ${locationNames.join(", ")}. Use a form Google recognises, e.g. "Gilbert, Arizona" or "Phoenix, Arizona".`);
  }

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
      // PRESENCE, not the PRESENCE_OR_INTEREST default: only show to people who
      // are actually IN the targeted area. The default also serves anyone merely
      // "interested in" it — someone in another state reading about Phoenix —
      // which is useless for a local service business paying per click.
      geoTargetTypeSetting: {
        positiveGeoTargetType: "PRESENCE",
        negativeGeoTargetType: "PRESENCE",
      },
      // REQUIRED by Google on every campaign create (the EU Transparency and
      // Targeting of Political Advertising regulation). Omitting it fails the whole
      // build with a bare "The required field was not present" — that is what broke
      // the first real Build attempt, 2026-08-14. BoldLine and its clients run
      // commercial lead-gen, never political advertising, so this is always the
      // negative declaration. If a genuinely political advertiser is ever onboarded
      // this must become a per-client field, and that client needs EU verification.
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    } } },
    // Location + language targeting. Without these the campaign is worldwide and
    // all-languages; both are campaign-level criteria, so they attach to the temp
    // campaign resource name inside this same atomic mutate.
    ...geo.map((g) => ({ campaignCriterionOperation: { create: {
      campaign: campaignRN,
      location: { geoTargetConstant: g.resourceName },
    } } })),
    { campaignCriterionOperation: { create: {
      campaign: campaignRN,
      language: { languageConstant: ENGLISH_LANGUAGE_CONSTANT },
    } } },
    // Campaign-level negatives: block the whole class of searchers who will never
    // buy (job hunters, students, freebie seekers) before they cost a click.
    ...negativeKeywords.map((k) => ({ campaignCriterionOperation: { create: {
      campaign: campaignRN,
      negative: true,
      keyword: { text: k, matchType: "BROAD" },
    } } })),
    // One ad group + its own ad + its own keywords, per theme. Temp resource names
    // count down from -3 so every group is distinct inside this single atomic mutate.
    ...adGroups.flatMap((g, i) => {
      const agRN = `customers/${cid}/adGroups/${-(3 + i)}`;
      return [
        { adGroupOperation: { create: {
          resourceName: agRN,
          name: g.name.slice(0, 120),
          campaign: campaignRN,
          status: "PAUSED",
          type: "SEARCH_STANDARD",
          cpcBidMicros: cpcMicros,
        } } },
        { adGroupAdOperation: { create: {
          adGroup: agRN,
          status: "PAUSED",
          ad: {
            finalUrls: [String(p.landingUrl)],
            responsiveSearchAd: {
              headlines: g.headlines.map((t) => ({ text: t })),
              descriptions: g.descriptions.map((t) => ({ text: t })),
            },
          },
        } } },
        ...g.keywords.map((k) => ({ adGroupCriterionOperation: { create: {
          adGroup: agRN,
          status: "ENABLED", // keywords enabled is fine — the campaign itself is PAUSED, so $0
          keyword: { text: k.text, matchType: k.matchType },
        } } })),
      ];
    }),
  ];

  const resp = await fetch(`${ADS_BASE}/customers/${cid}/googleAds:mutate`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify({ mutateOperations }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // Full failure to the function log: a campaign build that fails on the tenth
    // operation is very hard to reason about from one surfaced line.
    try { console.error("createCampaign rejected:", JSON.stringify(data && data.error ? data.error : data).slice(0, 4000)); } catch (_) {}
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
    adGroupsCreated: results.filter((x) => x && x.adGroupResult).length,
    adGroupNames: adGroups.map((g) => g.name),
    keywordsCreated: results.filter((x) => x && x.adGroupCriterionResult).length,
    locationsTargeted: geo.map((g) => g.canonicalName),
    locationsUnresolved: geo.unresolved || [],
    negativeKeywordsCreated: negativeKeywords.length,
    status: "PAUSED",
    note: "Created PAUSED — review it in Google Ads, then enable to start spend. Nothing spends until you do.",
  };
}

// ── Campaign detail: ad groups, their ads, and their keywords ────────────────
// Structure and metrics are fetched SEPARATELY on purpose. A metrics query carries
// a date range, and a brand-new or long-paused ad group has no rows inside it — so
// asking for both at once silently hides exactly the ad groups you most want to see
// after a build. Structure first, metrics merged on top where they exist.
async function gaql(accessToken, customerId, query, stage) {
  const resp = await fetch(`${ADS_BASE}/customers/${digits(customerId)}/googleAds:search`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify({ query, pageSize: 1000 }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(apiErrMsg(stage, resp.status, data));
    e.stage = stage; e.detail = data; throw e;
  }
  return data.results || [];
}

const perf = (r) => ({
  impressions: Number((r.metrics && r.metrics.impressions) || 0),
  clicks: Number((r.metrics && r.metrics.clicks) || 0),
  cost: microsToDollars(r.metrics && r.metrics.costMicros),
  conversions: Number((r.metrics && r.metrics.conversions) || 0),
});

export async function getCampaignDetail(accessToken, customerId, campaignId) {
  const cid = digits(campaignId);
  if (!cid) { const e = new Error("campaignDetail: campaignId required"); e.stage = "campaignDetail"; throw e; }

  const [groups, groupPerf, ads, adPerf, kws, kwPerf] = await Promise.all([
    gaql(accessToken, customerId, `SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.resource_name, ad_group.cpc_bid_micros FROM ad_group WHERE campaign.id = ${cid}`, "campaignDetail"),
    gaql(accessToken, customerId, `SELECT ad_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group WHERE campaign.id = ${cid} AND segments.date DURING LAST_30_DAYS`, "campaignDetail"),
    gaql(accessToken, customerId, `SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls FROM ad_group_ad WHERE campaign.id = ${cid} AND ad_group_ad.status != 'REMOVED'`, "campaignDetail"),
    gaql(accessToken, customerId, `SELECT ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group_ad WHERE campaign.id = ${cid} AND segments.date DURING LAST_30_DAYS`, "campaignDetail"),
    gaql(accessToken, customerId, `SELECT ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.resource_name, ad_group_criterion.status, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.negative FROM ad_group_criterion WHERE campaign.id = ${cid} AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`, "campaignDetail"),
    gaql(accessToken, customerId, `SELECT ad_group_criterion.criterion_id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM keyword_view WHERE campaign.id = ${cid} AND segments.date DURING LAST_30_DAYS`, "campaignDetail"),
  ]);

  const byGroup = new Map(groupPerf.map((r) => [String(r.adGroup && r.adGroup.id), perf(r)]));
  const byAd = new Map(adPerf.map((r) => [String(r.adGroupAd && r.adGroupAd.ad && r.adGroupAd.ad.id), perf(r)]));
  const byKw = new Map(kwPerf.map((r) => [String(r.adGroupCriterion && r.adGroupCriterion.criterionId), perf(r)]));
  const zero = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };

  const adsFor = (gid) => ads.filter((r) => String(r.adGroup && r.adGroup.id) === gid).map((r) => {
    const a = (r.adGroupAd && r.adGroupAd.ad) || {};
    const rsa = a.responsiveSearchAd || {};
    return {
      id: String(a.id || ""),
      resourceName: r.adGroupAd && r.adGroupAd.resourceName,
      status: r.adGroupAd && r.adGroupAd.status,
      headlines: (rsa.headlines || []).map((h) => h.text).filter(Boolean),
      descriptions: (rsa.descriptions || []).map((d) => d.text).filter(Boolean),
      finalUrls: a.finalUrls || [],
      ...(byAd.get(String(a.id)) || zero),
    };
  });

  const kwFor = (gid) => kws.filter((r) => String(r.adGroup && r.adGroup.id) === gid).map((r) => {
    const c = r.adGroupCriterion || {};
    return {
      id: String(c.criterionId || ""),
      resourceName: c.resourceName,
      status: c.status,
      negative: !!c.negative,
      text: (c.keyword && c.keyword.text) || "",
      matchType: (c.keyword && c.keyword.matchType) || "",
      ...(byKw.get(String(c.criterionId)) || zero),
    };
  });

  return {
    adGroups: groups.map((r) => {
      const g = r.adGroup || {};
      const gid = String(g.id || "");
      return {
        id: gid,
        resourceName: g.resourceName,
        name: g.name,
        status: g.status,
        cpcBid: microsToDollars(g.cpcBidMicros),
        ...(byGroup.get(gid) || zero),
        ads: adsFor(gid),
        keywords: kwFor(gid).filter((k) => !k.negative),
        negatives: kwFor(gid).filter((k) => k.negative),
      };
    }),
  };
}

// ── Guarded writes on the pieces inside a campaign ───────────────────────────
// REMOVED is permanent in Google Ads; PAUSED is not. Every delete path here is
// explicit about which one it is doing.
const mutate = async (accessToken, customerId, endpoint, operations, stage) => {
  const resp = await fetch(`${ADS_BASE}/customers/${digits(customerId)}/${endpoint}:mutate`, {
    method: "POST", headers: baseHeaders(accessToken), body: JSON.stringify({ operations }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    try { console.error(`${stage} rejected:`, JSON.stringify(data && data.error ? data.error : data).slice(0, 3000)); } catch (_) {}
    const e = new Error(apiErrMsg(stage, resp.status, data));
    e.stage = stage; e.detail = data; throw e;
  }
  return data;
};

export async function setAdGroupStatus(accessToken, customerId, adGroupResourceName, status) {
  const s = String(status || "").toUpperCase();
  if (!["ENABLED", "PAUSED", "REMOVED"].includes(s)) {
    const e = new Error("status must be ENABLED, PAUSED or REMOVED"); e.stage = "setAdGroupStatus"; throw e;
  }
  return mutate(accessToken, customerId, "adGroups",
    [{ update: { resourceName: adGroupResourceName, status: s }, updateMask: "status" }], "setAdGroupStatus");
}

export async function setAdStatus(accessToken, customerId, adResourceName, status) {
  const s = String(status || "").toUpperCase();
  if (!["ENABLED", "PAUSED", "REMOVED"].includes(s)) {
    const e = new Error("status must be ENABLED, PAUSED or REMOVED"); e.stage = "setAdStatus"; throw e;
  }
  // An ad is removed by its own operation shape, not a status update.
  if (s === "REMOVED") return mutate(accessToken, customerId, "adGroupAds", [{ remove: adResourceName }], "setAdStatus");
  return mutate(accessToken, customerId, "adGroupAds",
    [{ update: { resourceName: adResourceName, status: s }, updateMask: "status" }], "setAdStatus");
}

export async function removeKeywords(accessToken, customerId, resourceNames) {
  const list = (Array.isArray(resourceNames) ? resourceNames : [resourceNames]).filter(Boolean);
  if (!list.length) { const e = new Error("removeKeywords: nothing to remove"); e.stage = "removeKeywords"; throw e; }
  return mutate(accessToken, customerId, "adGroupCriteria", list.map((rn) => ({ remove: rn })), "removeKeywords");
}

export async function addKeywords(accessToken, customerId, adGroupResourceName, keywords) {
  const ops = (Array.isArray(keywords) ? keywords : []).map((k) => {
    const text = String((k && k.text !== undefined ? k.text : k) || "").trim().toLowerCase();
    const mt = String((k && k.matchType) || "PHRASE").toUpperCase();
    if (!text) return null;
    return { create: { adGroup: adGroupResourceName, status: "ENABLED",
      keyword: { text, matchType: ["EXACT", "PHRASE", "BROAD"].includes(mt) ? mt : "PHRASE" } } };
  }).filter(Boolean);
  if (!ops.length) { const e = new Error("addKeywords: no valid keywords"); e.stage = "addKeywords"; throw e; }
  return mutate(accessToken, customerId, "adGroupCriteria", ops, "addKeywords");
}

// Adds a SECOND responsive search ad to an existing ad group. This is the split
// test: budget lives on the campaign, so another ad inside the same group cannot
// increase spend — it only changes which creative that spend buys.
export async function addResponsiveSearchAd(accessToken, customerId, adGroupResourceName, { headlines, descriptions, finalUrl, status = "ENABLED" }) {
  const h = (Array.isArray(headlines) ? headlines : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 15);
  const d = (Array.isArray(descriptions) ? descriptions : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4);
  const err = (m) => Object.assign(new Error(`addResponsiveSearchAd: ${m}`), { stage: "addResponsiveSearchAd" });
  if (h.length < 3) throw err("at least 3 headlines required (each ≤30 chars)");
  if (d.length < 2) throw err("at least 2 descriptions required (each ≤90 chars)");
  const bh = h.find((x) => x.length > 30); if (bh) throw err(`headline over 30 characters: "${bh}"`);
  const bd = d.find((x) => x.length > 90); if (bd) throw err(`description over 90 characters: "${bd}"`);
  if (!finalUrl) throw err("finalUrl required");
  return mutate(accessToken, customerId, "adGroupAds", [{ create: {
    adGroup: adGroupResourceName, status: String(status).toUpperCase() === "PAUSED" ? "PAUSED" : "ENABLED",
    ad: { finalUrls: [String(finalUrl)], responsiveSearchAd: { headlines: h.map((t) => ({ text: t })), descriptions: d.map((t) => ({ text: t })) } },
  } }], "addResponsiveSearchAd");
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

    if (action === "removeCampaign") {
      if (!digits(body.customerId) || !body.campaignResourceName)
        return json({ ok: false, error: "customerId, campaignResourceName required" }, 400);
      const result = await removeCampaign(accessToken, body.customerId, body.campaignResourceName, { wasLive: !!body.wasLive });
      return json({ ok: true, action, ...result });
    }

    if (action === "campaignDetail") {
      return json({ ok: true, ...(await getCampaignDetail(accessToken, body.customerId, body.campaignId)) });
    }

    if (action === "setAdGroupStatus") {
      await setAdGroupStatus(accessToken, body.customerId, body.adGroupResourceName, body.status);
      return json({ ok: true, adGroupResourceName: body.adGroupResourceName, status: String(body.status).toUpperCase() });
    }

    if (action === "setAdStatus") {
      await setAdStatus(accessToken, body.customerId, body.adResourceName, body.status);
      return json({ ok: true, adResourceName: body.adResourceName, status: String(body.status).toUpperCase() });
    }

    if (action === "removeKeywords") {
      const r = await removeKeywords(accessToken, body.customerId, body.resourceNames);
      return json({ ok: true, removed: (r.results || []).length });
    }

    if (action === "addKeywords") {
      const r = await addKeywords(accessToken, body.customerId, body.adGroupResourceName, body.keywords);
      return json({ ok: true, added: (r.results || []).length });
    }

    if (action === "addAd") {
      const r = await addResponsiveSearchAd(accessToken, body.customerId, body.adGroupResourceName, body);
      return json({ ok: true, adResourceName: (r.results && r.results[0] && r.results[0].resourceName) || null });
    }

    if (action === "createCampaign") {
      const result = await createCampaign(accessToken, body);
      // Notify the owner a campaign was created + is awaiting approval (covers
      // owner-launched AND future bot-launched). Best-effort; never blocks.
      try {
        const { dispatchAlert } = await import("../lib/alerts-shared.mjs");
        await dispatchAlert({
          title: "New Google Ads campaign awaiting approval",
          body: `A Google Ads campaign "${body.name || "(unnamed)"}"${body.clientName ? ` for ${body.clientName}` : ""} was just created and is PAUSED. Approve it in BoldLine OS → Alerts (or "Your Live Campaigns") to set it live. Nothing spends until you do.`,
          severity: "yellow",
          smsText: `BoldLine: new Google campaign "${body.name || ""}" created (paused) — approve in the OS to launch.`,
        });
      } catch (e) { console.error("createCampaign owner alert failed:", e && e.message); }
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
