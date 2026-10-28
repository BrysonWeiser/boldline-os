// The Google listing card: Google Business Profile reviews, posts and numbers (KB google-listing).
// Run: node tests/verify-google-listing.mjs
//
// Bryson, 2026-10-23, after Google approved the Business Profile API: "yes" to building the card that drafts a weekly
// post and a reply to every new review for him to approve, and shows the profile's numbers.
//
// The REAL functions run here, with fetch stubbed at the boundary (Supabase, Google, Anthropic).
// What has to stay true:
//  1. 🔴 Nothing is published unless Bryson presses Post, and what is published is exactly the words he saw (cleaned
//     of dashes and emojis, the same way the draft was). Drafting never touches Google.
//  2. The Google key is stored sealed in private storage, never on a business record; the round trip is signed.
//  3. Owner only. A profile belongs to one business. A post's button never points at BoldLine.
//  4. The daily job drafts, never publishes, and says when a low rating is waiting.
//  5. Public words: no em dashes, no emojis, never a word about Google or BoldLine in the prompts' output rules.
import { readFileSync } from "node:fs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-harness";
process.env.GBP_CLIENT_ID = "gbp-client-harness";
process.env.GBP_CLIENT_SECRET = "gbp-secret-harness";
process.env.ANTHROPIC_API_KEY = "anthropic-harness";

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const G = await import("../netlify/lib/gbp.mjs");

// ── The boundary ─────────────────────────────────────────────────────────────────────────────────────────────────────
const S = { rows: {}, stored: null, puts: [], posts: [], anthropicText: "Thanks so much, Sarah — we loved getting your truck back to showroom shine! 🚗 See you next time.", googleCalls: 0, user: true };
const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const REVIEWS = [
  { reviewId: "r1", name: "accounts/111/locations/222/reviews/r1", starRating: "FIVE", comment: "Sarah here. Great job on my truck.", reviewer: { displayName: "Sarah K" }, createTime: new Date(Date.now() - 2 * 864e5).toISOString() },
  { reviewId: "r2", name: "accounts/111/locations/222/reviews/r2", starRating: "TWO", comment: "Came late.", reviewer: { displayName: "Dan R" }, createTime: new Date(Date.now() - 864e5).toISOString() },
  { reviewId: "r3", name: "accounts/111/locations/222/reviews/r3", starRating: "FOUR", comment: "Good.", reviewer: { displayName: "Ana" }, createTime: new Date(Date.now() - 5 * 864e5).toISOString(), reviewReply: { comment: "Thanks Ana", updateTime: new Date().toISOString() } },
];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), method = (opts.method || "GET").toUpperCase();
  if (u.includes(".supabase.co/auth/v1/user")) return S.user ? J({ id: "owner", aud: "authenticated", email: "b@b.com" }) : J({ msg: "bad" }, 401);
  if (u.includes(".supabase.co/storage/v1/object/client-contracts/gbp/connection.json")) {
    if (method === "GET") return S.stored ? new Response(S.stored, { status: 200 }) : J({ error: "not found" }, 400);
    const b = opts.body;   // supabase-js sends a Blob inside a form; the stored object is the Blob's own text
    if (b instanceof FormData) { for (const [, v] of b.entries()) if (typeof v !== "string") S.stored = await v.text(); }
    else S.stored = typeof b === "string" ? b : await new Response(b).text();
    return J({ Key: "x" });
  }
  if (u.includes(".supabase.co/storage/v1/object/client-contracts") && method === "DELETE") { S.stored = null; return J([]); }
  if (u.includes(".supabase.co/rest/v1/clients")) {
    if (method === "PATCH") { const id = decodeURIComponent(u).match(/id=eq\.([^&]+)/)[1]; S.rows[id] = JSON.parse(opts.body).data; return new Response(null, { status: 204 }); }
    const q = decodeURIComponent(u); const single = /vnd\.pgrst\.object/.test(String((opts.headers && (opts.headers.Accept || opts.headers.accept || (opts.headers.get && opts.headers.get("accept")))) || ""));
    let rows = Object.entries(S.rows).map(([id, data]) => ({ id, data }));
    const idm = q.match(/[?&]id=eq\.([^&]+)/); if (idm) rows = rows.filter((r) => r.id === idm[1]);
    const lm = q.match(/data->gbp->>location=eq\.([^&]+)/); if (lm) rows = rows.filter((r) => r.data.gbp && r.data.gbp.location === lm[1]);
    return J(single ? (rows[0] || null) : rows);
  }
  if (u.startsWith("https://oauth2.googleapis.com/token")) {
    const p = new URLSearchParams(opts.body);
    if (p.get("grant_type") === "authorization_code") return J({ access_token: "at", refresh_token: "rt-new", scope: "https://www.googleapis.com/auth/business.manage openid email", id_token: "x." + Buffer.from(JSON.stringify({ email: "theboldlinemedia@gmail.com" })).toString("base64url") + ".y" });
    return J({ access_token: "at-fresh" });
  }
  if (u.startsWith("https://oauth2.googleapis.com/revoke")) return J({});
  if (u.includes("googleapis.com")) S.googleCalls++;
  if (u.startsWith("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")) return J({ accounts: [{ name: "accounts/111" }] });
  if (u.includes("mybusinessbusinessinformation.googleapis.com/v1/accounts/111/locations")) return J({ locations: [
    { name: "locations/222", title: "Desert Gloss Detailing", websiteUri: "https://desertgloss.com", storefrontAddress: { locality: "Mesa", administrativeArea: "AZ" }, metadata: { mapsUri: "https://maps.google.com/?cid=1" } },
    { name: "locations/333", title: "Other Co", metadata: {} }] });
  if (u.includes("/v4/accounts/111/locations/222/reviews") && method === "GET") return J({ reviews: REVIEWS, averageRating: 3.7, totalReviewCount: 3 });
  if (u.includes("/reply") && method === "PUT") { S.puts.push({ u, body: JSON.parse(opts.body) }); return J({ comment: "x" }); }
  if (u.includes("/localPosts") && method === "POST") { S.posts.push({ u, body: JSON.parse(opts.body) }); return J({ name: "p1" }); }
  if (u.includes("businessprofileperformance.googleapis.com")) return J({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [{ dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [] } }] }] });
  if (u.includes("api.anthropic.com")) return J({ id: "m", type: "message", role: "assistant", model: "x", content: [{ type: "text", text: S.anthropicText }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } });
  return J({}, 404);
};

const { default: fn } = await import("../netlify/functions/gbp.mjs");
const { default: done } = await import("../netlify/functions/gbp-connect-done.mjs");
const call = async (action, body = {}, auth = true) => { const r = await fn(new Request("https://os.test/.netlify/functions/gbp", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: "Bearer jwt" } : {}) }, body: JSON.stringify({ action, ...body }) })); return { status: r.status, d: await r.json() }; };
S.rows.c1 = { name: "Desert Gloss Detailing", niche: "Auto Detailing", internal: true, owned: true, contactName: "Bryson Weiser", campaignSetup: { serviceArea: "Mesa" }, commLog: [] };
S.rows.c2 = { name: "Another", internal: true, owned: true, commLog: [] };

// ── 1. Pure rules ────────────────────────────────────────────────────────────────────────────────────────────────────
{
  const c = G.cleanPublic("Thanks — we loved it! 🚗🔥 See you soon – really.", 500);
  ok("🔴 public words lose every em and en dash", !/[–—]/.test(c), c);
  ok("🔴 and every emoji", !G.EMOJI.test(c) && !/🚗|🔥/.test(c), c);
  ok("long text is trimmed back to a whole sentence", G.cleanPublic("One. ".repeat(400), 100).length <= 100 && G.cleanPublic("One. ".repeat(400), 100).endsWith("."));
  ok("stars read right", G.starsOf({ starRating: "FIVE" }) === 5 && G.starsOf({ starRating: "TWO" }) === 2 && G.starsOf({}) === 0);
  ok("the v4 path is built from the ids", G.v4Path("accounts/111", "locations/222") === "accounts/111/locations/222");
  const st = G.makeState();
  ok("🔴 the round trip to Google is signed", G.readState(st) === true && G.readState(st.slice(0, -2) + "xx") === false && G.readState(st, process.env, Date.now() + 31 * 60000) === false);
  const sealed = G.seal({ refresh: "secret-rt" });
  ok("🔴 the stored key is sealed (not readable as text)", !sealed.includes("secret-rt") && G.unseal(sealed).refresh === "secret-rt");
  ok("and a different secret cannot open it", G.unseal(sealed, { GBP_CLIENT_SECRET: "other", SUPABASE_SERVICE_ROLE_KEY: "x" }) === null);
  const end = new Date(Date.UTC(2026, 9, 20));
  const day = (n) => { const d = new Date(end.getTime() - n * 864e5); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; };
  const m = G.summarizeMetrics({ multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
    { dailyMetric: "CALL_CLICKS", timeSeries: { datedValues: [{ date: day(0), value: "3" }, { date: day(27), value: "2" }, { date: day(28), value: "4" }, { date: day(55), value: "1" }] } },
    { dailyMetric: "BUSINESS_IMPRESSIONS_MOBILE_MAPS", timeSeries: { datedValues: [{ date: day(1), value: "10" }] } },
    { dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", timeSeries: { datedValues: [{ date: day(2), value: "5" }] } }] }] }, end);
  ok("numbers: the last 28 days against the 28 before, exactly on the boundary", m.calls.now === 5 && m.calls.before === 5, JSON.stringify(m.calls));
  ok("all four kinds of views add up into one", m.views.now === 15);
  const pr = G.replyPrompt(S.rows.c1, { stars: 2, reviewer: "Dan", comment: "Came late." });
  ok("a low rating gets the calm, make-it-right brief", /Apologise/.test(pr.prompt) && /offline/.test(pr.prompt));
  ok("🔴 the writing rules ban dashes, emojis, and any mention of Google or BoldLine", /Never use a dash/.test(pr.system) && /No emojis/.test(pr.system) && /Never mention Google, BoldLine/.test(pr.system));
  ok("posts avoid repeating recent topics and invent nothing", /don't repeat/.test(G.postPrompt(S.rows.c1, ["Old post"]).prompt) && /no made-up offers/.test(G.postPrompt(S.rows.c1).prompt));
  ok("connect asks for lasting access to manage profiles", /business\.manage/.test(decodeURIComponent(G.authorizeUrl({ state: "s", redirectUri: "https://x/gbp-connect/done" }))) && /access_type=offline/.test(G.authorizeUrl({ state: "s", redirectUri: "r" })));
}

// ── 2. Owner only, and connecting ─────────────────────────────────────────────────────────────────────────────────────
{
  let r = await call("status", {}, false);
  ok("🔴 no OS session, no answer", r.status === 401);
  r = await call("status");
  ok("status before connecting: ready, not connected", r.d.ok && r.d.ready === true && r.d.connected === false);
  r = await call("start");
  ok("start hands back Google's sign-in address", r.d.ok && /^https:\/\/accounts\.google\.com\//.test(r.d.url));
  const state = new URL(r.d.url).searchParams.get("state");
  let res = await done(new Request("https://os.test/gbp-connect/done?code=abc&state=forged.sig"));
  ok("🔴 a forged return is turned away and nothing stored", res.status === 303 && /gbp=expired/.test(res.headers.get("location")) && !S.stored);
  res = await done(new Request(`https://os.test/gbp-connect/done?error=access_denied&state=${encodeURIComponent(state)}`));
  ok("cancelling at Google says so", /gbp=cancelled/.test(res.headers.get("location")));
  res = await done(new Request(`https://os.test/gbp-connect/done?code=abc&state=${encodeURIComponent(state)}`));
  ok("a real return connects and goes back to the OS", /gbp=connected/.test(res.headers.get("location")), res.headers.get("location"));
  ok("🔴 the key is stored sealed, never as plain text", S.stored && !S.stored.includes("rt-new") && G.unseal(S.stored).refresh === "rt-new");
  ok("🔴 and never on a business record", !JSON.stringify(S.rows).includes("rt-new"));
  r = await call("status");
  ok("status now shows connected, and as whom", r.d.connected === true && r.d.email === "theboldlinemedia@gmail.com");
}

// ── 3. Picking the profile, reading it ──────────────────────────────────────────────────────────────────────────────
{
  let r = await call("locations");
  ok("every profile the account manages is listed, with its town", r.d.ok && r.d.locations.length === 2 && r.d.locations[0].address === "Mesa, AZ");
  r = await call("link", { clientId: "c1", account: "accounts/111", location: "locations/999" });
  ok("a profile this account doesn't manage can't be linked", !r.d.ok);
  r = await call("link", { clientId: "c1", account: "accounts/111", location: "locations/222" });
  ok("the business's own profile links", r.d.ok && S.rows.c1.gbp && S.rows.c1.gbp.title === "Desert Gloss Detailing");
  r = await call("link", { clientId: "c2", account: "accounts/111", location: "locations/222" });
  ok("🔴 one profile belongs to one business", !r.d.ok && /already linked/.test(r.d.error));
  r = await call("overview", { clientId: "c1" });
  ok("overview: reviews, average and how many wait for a reply", r.d.ok && r.d.reviews.length === 3 && r.d.waiting === 2 && r.d.average === 3.7);
  ok("numbers come back", r.d.metrics && r.d.metrics.calls);
}

// ── 4. Drafting touches nothing public; publishing is exact ──────────────────────────────────────────────────────────
{
  const before = { puts: S.puts.length, posts: S.posts.length };
  let r = await call("draftReply", { clientId: "c1", reviewId: "r1" });
  ok("a reply is drafted", r.d.ok && r.d.text.length > 10);
  ok("🔴 the draft is cleaned: no dash, no emoji", !/[–—]/.test(r.d.text) && !/🚗/.test(r.d.text), r.d.text);
  ok("🔴 drafting published nothing", S.puts.length === before.puts && S.posts.length === before.posts);
  ok("the draft waits on the record", S.rows.c1.gbpDrafts.replies.r1.text === r.d.text);
  r = await call("reply", { clientId: "c1", reviewId: "r1", text: "Thanks Sarah — see you soon! 😊" });
  ok("🔴 posting a reply sends exactly the approved words, cleaned", r.d.ok && S.puts.length === 1 && S.puts[0].body.comment === "Thanks Sarah, see you soon!", JSON.stringify(S.puts[0] && S.puts[0].body));
  ok("to that review", /reviews\/r1\/reply$/.test(S.puts[0].u));
  ok("the draft is cleared and the reply logged", !S.rows.c1.gbpDrafts.replies.r1 && S.rows.c1.gbpLog[0].type === "reply" && /Replied to a Google review/.test(S.rows.c1.commLog[0].note));
  S.anthropicText = "Winter is hard on paint — book a wash this week.";
  r = await call("draftPost", { clientId: "c1", idea: "winter paint care" });
  ok("a weekly post is drafted, dash-free", r.d.ok && !/[–—]/.test(r.d.text) && S.rows.c1.gbpDrafts.post);
  ok("🔴 still nothing published", S.posts.length === 0);
  r = await call("post", { clientId: "c1", text: "Winter is hard on paint. Book a wash this week and keep it shining.", cta: "BOOK", url: "https://boldlinemedia.com/book" });
  ok("🔴 a post's button can never point at BoldLine", !r.d.ok && /BoldLine/.test(r.d.error) && S.posts.length === 0);
  r = await call("post", { clientId: "c1", text: "Winter is hard on paint. Book a wash this week and keep it shining.", cta: "BOOK" });
  ok("a post goes up with a Book button to the business's own site", r.d.ok && S.posts.length === 1 && S.posts[0].body.callToAction.actionType === "BOOK" && S.posts[0].body.callToAction.url === "https://desertgloss.com/");
  ok("as a standard update, the approved words", S.posts[0].body.topicType === "STANDARD" && S.posts[0].body.summary.startsWith("Winter is hard"));
  r = await call("post", { clientId: "c1", text: "Call us today about ceramic coating for your car this winter.", cta: "CALL" });
  ok("'Call now' needs no address", r.d.ok && S.posts[1].body.callToAction.actionType === "CALL" && !S.posts[1].body.callToAction.url);
  r = await call("post", { clientId: "c1", text: "short" });
  ok("an empty or tiny post is refused", !r.d.ok);
}

// ── 5. The daily job ─────────────────────────────────────────────────────────────────────────────────────────────────
{
  const W = await import("../netlify/functions/gbp-watch.mjs");
  const monday = Date.parse("2026-10-26T16:00:00Z"), tuesday = Date.parse("2026-10-27T16:00:00Z");
  const cl = { name: "X", gbp: { linkedAt: new Date(monday - 864e5).toISOString() }, gbpDrafts: { replies: { r2: { text: "x" } } }, gbpLog: [] };
  const revs = REVIEWS.map(G.tidyReview).map((r) => ({ ...r, at: new Date(monday - 864e5).toISOString() }));
  const p = W.plan(cl, revs, monday);
  ok("it drafts only reviews with no reply and no draft yet", p.replies.map((r) => r.id).join() === "r1");
  ok("and the week's post on a Monday (Phoenix)", p.post === true && W.plan(cl, revs, tuesday).post === false);
  ok("not when a post went up in the last few days", W.plan({ ...cl, gbpLog: [{ type: "post", at: new Date(monday - 2 * 864e5).toISOString() }] }, revs, monday).post === false);
  ok("old reviews from long before linking are left alone", W.plan({ ...cl, gbp: { linkedAt: new Date(monday).toISOString() } }, revs.map((r) => ({ ...r, at: "2025-01-01T00:00:00Z" })), monday).replies.length === 0);
  const rows = [{ id: "w1", data: { name: "Desert Gloss", gbp: { account: "accounts/111", location: "locations/222", linkedAt: new Date(Date.now() - 864e5).toISOString() }, gbpLog: [] } }];
  const writes = []; const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data: rows[0].data } }) }) }), update: (v) => ({ eq: async () => { writes.push(v.data); return {}; } }) }) };
  const alerts = []; S.anthropicText = "Sorry about the wait, Dan. Please call us so we can make it right.";
  const before = { puts: S.puts.length, posts: S.posts.length };
  const res = await W.runWatch(db, rows, { anthropic: { messages: { create: async () => ({ content: [{ type: "text", text: S.anthropicText }] }) } }, tok: "at", alert: async (a) => alerts.push(a), now: Date.now() });
  ok("🔴 the job drafted replies and published nothing", res.drafted >= 2 && S.puts.length === before.puts && S.posts.length === before.posts);
  ok("the drafts are saved for the card", writes.length === 1 && writes[0].gbpDrafts.replies.r1 && writes[0].gbpDrafts.replies.r2);
  ok("🔴 a low rating makes the message amber and says read it first", alerts.length === 1 && alerts[0].severity === "amber" && /low rating/.test(alerts[0].body));
}

// ── 6. The OS card and the wiring ────────────────────────────────────────────────────────────────────────────────────
{
  const UI = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const TOML = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  const a = UI.indexOf("function GoogleListingCard("); const card = UI.slice(a, UI.indexOf("\nconst bizEmailCall", a));
  ok("the card exists", a > 0 && card.length > 2000);
  // Switched on for clients too, 2026-10-27, once it went on the website at $130/mo (KB google-listing).
  ok("it sits on every business's Overview: BoldLine's own, owned businesses and clients", /\n\s*<GoogleListingCard client=\{client\}\/>\n/.test(UI));
  ok("website-only clients get it too", /isWebsiteOnly\(client\)&&<div style=\{\{marginTop:11\}\}><GoogleListingCard client=\{client\}\/>(<GbpCareBilling client=\{client\}\/>)?<\/div>\}/.test(UI));
  ok("🔴 the server-owned keys are never saved over by an OS screen", /const SERVER_OWNED_KEYS=\[[^\]]*"gbp","gbpDrafts","gbpLog"[^\]]*\]/.test(UI));
  ok("🔴 and the ad-access records from the portal neither", /const SERVER_OWNED_KEYS=\[[^\]]*"googleLinkRequest","metaAccess"[^\]]*\]/.test(UI));
  ok("🔴 posting a reply or a post always asks first, showing the words", /confirm\(`Post this reply on Google[^`]*\$\{text\}/.test(card) && /confirm\(`Post this on \$\{client\.name\}'s Google profile\?[^`]*\$\{text\}/.test(card));
  const eff = card.slice(card.indexOf("useEffect("), card.indexOf("},[client.id]);"));
  ok("🔴 opening the card only reads (no publish on load)", eff.length > 20 && !/"reply"|"post"/.test(eff));
  ok("Google's return address is wired", /from = "\/gbp-connect\/done"\s*\n\s*to = "\/\.netlify\/functions\/gbp-connect-done"/.test(TOML));
  ok("the daily job runs at 8:41am Phoenix (15:41 UTC, no daylight saving)", /\[functions\."gbp-watch"\]\s*\n\s*schedule = "41 15 \* \* \*"/.test(TOML));
  ok("no em dashes in the card's words", !/[–—]/.test(card.replace(/\/\/[^\n]*/g, "")));
}

globalThis.fetch = realFetch;
if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-google-listing: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
