// Google Business Profile: the "Google listing" card (KB google-listing).
//
// Bryson, 2026-10-23, after Google approved the Business Profile API: build the card that writes a weekly post and a
// reply to every new review for him to approve, and shows the profile's numbers. BoldLine's own profile and his own
// businesses first, then clients as the Google profile add-on.
//
// ONE CONNECTION FOR ALL OF BOLDLINE. The Google account that connects is the one that is Owner or Manager on each
// profile (BoldLine's business Gmail; a client adds it as a Manager). Its key is kept encrypted in private storage,
// never on a business record (the OS screen reads those). Each business record only says WHICH profile is its own
// (`gbp`), plus the drafts waiting for Bryson (`gbpDrafts`) and what was published (`gbpLog`). All three are written
// by the server only (SERVER_OWNED_KEYS in index.html).
//
// 🔴 A DIFFERENT GOOGLE CLOUD PROJECT FROM THE ADS. The approval is on project "BoldLine OS" (69639870912), not the
// Ads project, so this uses its own OAuth client: GBP_CLIENT_ID and GBP_CLIENT_SECRET in Netlify, made in that project.
//
// 🔴 NOTHING IS EVER PUBLISHED WITHOUT BRYSON PRESSING A BUTTON. Replies and posts are public, under the business's
// name. The server drafts; publishing is a separate action that only the OS card sends, with the exact words shown.
// And per Google's approval email: nothing we publish may suggest Google partners with, sponsors or endorses BoldLine.
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { humanize } from "./humanize.mjs";

export const SCOPES = "https://www.googleapis.com/auth/business.manage openid email";
export const CONN_PATH = "gbp/connection.json";
export const SECRET_BUCKET = "client-contracts";        // private; where the Square keys and signed contracts live too
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth", TOKEN = "https://oauth2.googleapis.com/token";
const ACCT = "https://mybusinessaccountmanagement.googleapis.com/v1", INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4 = "https://mybusiness.googleapis.com/v4", PERF = "https://businessprofileperformance.googleapis.com/v1";

export const gbpReady = (env = process.env) => !!(env.GBP_CLIENT_ID && env.GBP_CLIENT_SECRET);
const fail = (msg, detail) => { const e = new Error(msg); e.detail = detail; return e; };

// ── Signed state for the round trip to Google, and the sealed key ───────────────────────────────────────────────────
const stateKey = (env = process.env) => env.GBP_CLIENT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
const sig = (key, s) => createHmac("sha256", key).update(s).digest("base64url");
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && timingSafeEqual(x, y); };
export function makeState(env = process.env, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ t: now + 30 * 60000, n: randomBytes(6).toString("hex") })).toString("base64url");
  return `${body}.${sig(stateKey(env), `gbp|${body}`)}`;
}
export function readState(state, env = process.env, now = Date.now()) {
  const [body, s] = String(state || "").split("."); const key = stateKey(env);
  if (!body || !key || !same(sig(key, `gbp|${body}`), s)) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")).t > now; } catch (e) { return false; }
}
const kdf = (env = process.env) => createHash("sha256").update(`gbp-token|${env.GBP_CLIENT_SECRET || ""}|${env.SUPABASE_SERVICE_ROLE_KEY || ""}`).digest();
export function seal(obj, env = process.env) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", kdf(env), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function unseal(text, env = process.env) {
  try { const [iv, tag, enc] = String(text || "").trim().split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", kdf(env), iv); d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")); } catch (e) { return null; }
}

// ── Connecting ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const authorizeUrl = ({ state, redirectUri }, env = process.env) => `${AUTH}?${new URLSearchParams({
  client_id: env.GBP_CLIENT_ID || "", redirect_uri: redirectUri, response_type: "code", scope: SCOPES,
  access_type: "offline", prompt: "consent", include_granted_scopes: "true", state })}`;
async function token(params, env = process.env) {
  const r = await fetch(TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GBP_CLIENT_ID || "", client_secret: env.GBP_CLIENT_SECRET || "", ...params }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw fail(`Google sign-in failed${d.error ? `: ${d.error}` : ""}`, d);
  return d;
}
const emailOf = (idToken) => { try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")).email || ""; } catch (e) { return ""; } };
export async function exchangeCode(code, redirectUri, env = process.env) {
  const d = await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri }, env);
  if (!d.refresh_token) throw fail("Google did not hand over a lasting key. Remove BoldLine OS from your Google account's connected apps and connect again.");
  if (!String(d.scope || "").includes("business.manage")) throw fail("The box to manage your Business Profiles was not ticked. Connect again and tick it.");
  return { refresh: d.refresh_token, email: emailOf(d.id_token), connectedAt: new Date().toISOString() };
}
export async function loadConn(db, env = process.env) {
  const { data, error } = await db.storage.from(SECRET_BUCKET).download(CONN_PATH);
  if (error || !data) return null;
  return unseal(await data.text(), env);
}
export async function saveConn(db, conn, env = process.env) {
  const { error } = await db.storage.from(SECRET_BUCKET).upload(CONN_PATH, new Blob([seal(conn, env)], { type: "text/plain" }), { upsert: true, contentType: "text/plain" });
  if (error) throw fail("Could not store the Google connection.", error);
}
export const dropConn = (db) => db.storage.from(SECRET_BUCKET).remove([CONN_PATH]).catch(() => {});
export async function revoke(conn) { try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh)}`, { method: "POST" }); } catch (e) {} }
export async function accessToken(db, env = process.env) {
  const conn = await loadConn(db, env);
  if (!conn || !conn.refresh) throw fail("Google Business Profile isn't connected yet.");
  return (await token({ grant_type: "refresh_token", refresh_token: conn.refresh }, env)).access_token;
}

// ── Calls ───────────────────────────────────────────────────────────────────────────────────────────────────────────
async function call(tok, url, { method = "GET", body } = {}) {
  const r = await fetch(url, { method, headers: { authorization: `Bearer ${tok}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (d.error && d.error.message) || `HTTP ${r.status}`;
    throw fail(r.status === 403 || r.status === 429 ? `Google refused: ${m}. Check the Business Profile APIs are switched on in the BoldLine OS Cloud project.` : `Google said: ${m}`, d);
  }
  return d;
}
const digits = (s) => String(s || "").replace(/\D/g, "");
export const v4Path = (account, location) => `accounts/${digits(account)}/locations/${digits(location)}`;

// Every profile the connected Google account can manage, across all its accounts and groups.
export async function listLocations(tok) {
  const accts = []; let page = "";
  do { const d = await call(tok, `${ACCT}/accounts?pageSize=20${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`); accts.push(...(d.accounts || [])); page = d.nextPageToken || ""; } while (page && accts.length < 200);
  const out = [];
  for (const a of accts) {
    let p = "";
    do {
      const d = await call(tok, `${INFO}/${a.name}/locations?pageSize=100&readMask=name,title,storefrontAddress,websiteUri,metadata${p ? `&pageToken=${encodeURIComponent(p)}` : ""}`);
      for (const l of d.locations || []) {
        const ad = l.storefrontAddress || {};
        out.push({ account: a.name, location: l.name, title: l.title || "", website: l.websiteUri || "",
          address: [...(ad.addressLines || []), ad.locality, ad.administrativeArea].filter(Boolean).join(", "),
          mapsUri: (l.metadata && l.metadata.mapsUri) || "", placeId: (l.metadata && l.metadata.placeId) || "" });
      }
      p = d.nextPageToken || "";
    } while (p && out.length < 500);
  }
  return out;
}

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export const starsOf = (r) => STARS[r && r.starRating] || 0;
export const tidyReview = (r) => ({ id: r.reviewId, name: r.name, stars: starsOf(r), reviewer: (r.reviewer && r.reviewer.displayName) || "A customer",
  comment: String(r.comment || "").replace(/\(Translated by Google\)[\s\S]*$/, "").trim(), at: r.createTime || r.updateTime || "",
  reply: r.reviewReply ? String(r.reviewReply.comment || "") : "", repliedAt: r.reviewReply ? r.reviewReply.updateTime || "" : "" });
export async function listReviews(tok, link, n = 50) {
  const d = await call(tok, `${V4}/${v4Path(link.account, link.location)}/reviews?pageSize=${n}&orderBy=${encodeURIComponent("updateTime desc")}`);
  return { reviews: (d.reviews || []).map(tidyReview), average: d.averageRating || 0, total: d.totalReviewCount || 0 };
}
export const replyReview = (tok, link, reviewId, text) =>
  call(tok, `${V4}/${v4Path(link.account, link.location)}/reviews/${encodeURIComponent(reviewId)}/reply`, { method: "PUT", body: { comment: text } });

// A post's button. "Call now" needs no address; the others go to the business's own website.
export const CTAS = { BOOK: "Book", LEARN_MORE: "Learn more", CALL: "Call now", ORDER: "Order online", SHOP: "Shop" };
export const createPost = (tok, link, { text, cta, url }) => call(tok, `${V4}/${v4Path(link.account, link.location)}/localPosts`, { method: "POST", body: {
  languageCode: "en-US", topicType: "STANDARD", summary: text,
  ...(cta && CTAS[cta] ? { callToAction: cta === "CALL" ? { actionType: "CALL" } : url ? { actionType: cta, url } : undefined } : {}) } });

// The profile's numbers: this 28 days against the 28 before.
export const METRICS = { CALL_CLICKS: "Calls", WEBSITE_CLICKS: "Website clicks", BUSINESS_DIRECTION_REQUESTS: "Direction requests",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "views", BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "views", BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "views", BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "views" };
const ymd = (d, pre) => ({ [`${pre}.year`]: d.getUTCFullYear(), [`${pre}.month`]: d.getUTCMonth() + 1, [`${pre}.day`]: d.getUTCDate() });
export async function fetchMetrics(tok, link, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));   // Google's numbers trail by a few days
  const start = new Date(end.getTime() - 55 * 864e5);
  const q = new URLSearchParams(); Object.keys(METRICS).forEach((m) => q.append("dailyMetrics", m));
  Object.entries({ ...ymd(start, "dailyRange.startDate"), ...ymd(end, "dailyRange.endDate") }).forEach(([k, v]) => q.append(k, String(v)));
  const d = await call(tok, `${PERF}/locations/${digits(link.location)}:fetchMultiDailyMetricsTimeSeries?${q}`);
  return summarizeMetrics(d, end);
}
export function summarizeMetrics(d, end) {
  const cut = end.getTime() - 27 * 864e5;                              // the last 28 days, end included
  const sums = { calls: [0, 0], website: [0, 0], directions: [0, 0], views: [0, 0] };
  const key = { CALL_CLICKS: "calls", WEBSITE_CLICKS: "website", BUSINESS_DIRECTION_REQUESTS: "directions" };
  for (const grp of (d && d.multiDailyMetricTimeSeries) || []) for (const s of grp.dailyMetricTimeSeries || []) {
    const k = key[s.dailyMetric] || (String(s.dailyMetric).startsWith("BUSINESS_IMPRESSIONS") ? "views" : null); if (!k) continue;
    for (const v of (s.timeSeries && s.timeSeries.datedValues) || []) {
      const t = Date.UTC(v.date.year, v.date.month - 1, v.date.day); const n = Number(v.value || 0);
      sums[k][t >= cut ? 0 : 1] += n;
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, [now, before]]) => [k, { now, before }]));
}

// ── Words that go public ────────────────────────────────────────────────────────────────────────────────────────────
// No dashes, no emojis, nothing that reads as machine-written (standing rules), and never a word about Google.
export const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
export function cleanPublic(s, max) {
  let t = humanize(String(s || "").replace(EMOJI, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(), { join: ", " });
  t = t.replace(/[–—]/g, ",");
  if (t.length > max) { t = t.slice(0, max); const cut = Math.max(t.lastIndexOf(". "), t.lastIndexOf("! "), t.lastIndexOf("? ")); if (cut > max * 0.5) t = t.slice(0, cut + 1); }
  return t.trim();
}
export const REPLY_MAX = 1500, POST_MAX = 1400;

export function businessFacts(cl) {
  const cs = cl.campaignSetup || {}, bv = cl.brandVoice || {};
  return [`Business: ${cl.name}`, cl.niche && `Trade: ${cl.niche}`, cs.serviceArea && `Area served: ${cs.serviceArea}`,
    cs.mainOffer && `Main offer: ${cs.mainOffer}`, bv.tone && `Tone: ${bv.tone}`, bv.differentiator && `What sets them apart: ${bv.differentiator}`,
    cl.contactName && `Owner's first name: ${String(cl.contactName).split(" ")[0]}`].filter(Boolean).join("\n");
}
const VOICE = "Write like the owner talking, plain and warm, with contractions. No emojis. No hashtags. No exclamation marks in a row. "
  + "Never use a dash to join a sentence (no em dash, no en dash, no spaced hyphen); write two sentences or use a comma. "
  + "Avoid: unlock, elevate, leverage, seamless, robust, game-changer, \"in today's world\", \"it's not just X, it's Y\". "
  + "Never mention Google, BoldLine, marketing, AI or automation.";
export function replyPrompt(cl, rv) {
  const tone = rv.stars >= 4 ? "Thank them by first name if a name is given, mention one specific thing they said, and invite them back. 2 to 3 short sentences."
    : rv.stars === 3 ? "Thank them, take the criticism seriously in one sentence, and say what you'll do better. 2 to 4 sentences."
    : "Stay calm and kind, never argue or blame. Apologise for their experience, don't repeat private details, and offer to make it right offline by asking them to call or message the business. 2 to 4 sentences.";
  return { system: `You reply to Google reviews for a small business, as the business. ${VOICE}`,
    prompt: `${businessFacts(cl)}\n\nReview (${rv.stars} stars) from ${rv.reviewer}:\n"${rv.comment || "(no written comment, just a rating)"}"\n\n${tone}\nReturn only the reply text.` };
}
export function postPrompt(cl, recent = [], idea = "") {
  return { system: `You write the weekly update a small business posts on its Google Business Profile. ${VOICE}`,
    prompt: `${businessFacts(cl)}\n\n${idea ? `Bryson's idea for this one: ${idea}\n\n` : ""}Write one post of 60 to 110 words that gives a nearby customer a reason to call or book this week: a service worth knowing about, a seasonal tip, a common question answered, or what a job involves. Concrete, no fluff, no prices unless given above, no made-up offers, awards or numbers. End with a plain next step.\n${recent.length ? `\nRecent posts, so don't repeat their topic:\n${recent.map((t) => `- ${t.slice(0, 160)}`).join("\n")}\n` : ""}\nReturn only the post text.` };
}
export async function draft(anthropic, { system, prompt }, models = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-4-8"]) {
  let last;
  for (const model of models) {
    try {
      const msg = await anthropic.messages.create({ model, max_tokens: 600, system, messages: [{ role: "user", content: prompt }] });
      return (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim().replace(/^"|"$/g, "");
    } catch (e) { last = e; if (!/model|not_found|404|does not exist|unsupported/i.test(String((e && e.message) || e))) throw e; }
  }
  throw last;
}

// What still needs Bryson: reviews with no reply yet, newest first. Drafts the card shows come from `gbpDrafts`.
export const waiting = (reviews) => (reviews || []).filter((r) => !r.reply).sort((a, b) => String(b.at).localeCompare(String(a.at)));
