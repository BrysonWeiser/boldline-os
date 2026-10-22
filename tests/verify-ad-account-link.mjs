// A client types their ad account numbers into their portal: it saves, the request goes out, and they are told,
// unmissably, that they still have to ACCEPT it (KB ad-account-link).
// Run: node tests/verify-ad-account-link.mjs
//
// Bryson, 2026-10-21: "double check that if a client puts their Google ad account number or meta into their client
// dashboard that it saves and automatically sends the request", then "make sure that it's very clear that the client
// has to accept the request after they put their number in. Right now it's there but it's not super obvious".
// What was true before: it saved, nothing was sent, nobody was told, and the portal promised "We'll send a manager
// link request". The accept step was one line in a numbered list.
//
// The REAL portal handler runs here. `fetch` is stubbed at the boundary (Supabase, Google, Meta, the alert email), so
// what is checked is what the client and Bryson would actually get.
//
// What has to stay true:
//  1. A NEW Google Customer ID must be typed twice and match, or nothing is saved and nothing is sent (the request is
//     seen by whoever owns the number, so a typo asks a stranger). A match saves AND sends, checking Google first so
//     an account we already manage, or a request already waiting, is not asked twice.
//  2. A failed send is never silent: the client is told someone will send it, Bryson is told to.
//  3. Meta has nothing to send, so we look: can we read the ad account yet? The client is told the partner step.
//  4. The "accept it" step is its own highlighted box under each Save, turns to "Waiting for you" (pulsing) once
//     they've saved, the Status tab says "One step left" at the top, and it all turns to "Connected" by itself.
//  5. 🔴 Opening the portal only LOOKS. The OS preview loads it every time Bryson opens a client, so the page load
//     must never save or alert. The ad-access-watch job is the one that records changes and tells Bryson.
//  6. Client-facing words: no emojis, no em dashes.

import { readFileSync } from "node:fs";
import { emittedPortalScript } from "./helpers/portal-script.mjs";

process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-harness";
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-harness";
process.env.GOOGLE_ADS_CLIENT_ID = "cid-harness";
process.env.GOOGLE_ADS_CLIENT_SECRET = "secret-harness";
process.env.GOOGLE_ADS_REFRESH_TOKEN = "refresh-harness";
process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID = "9990001111";
process.env.META_SYSTEM_USER_TOKEN = "meta-harness";
process.env.RESEND_API_KEY = "resend-harness";
process.env.REPORTS_FROM_EMAIL = "from@harness.test";
process.env.OWNER_EMAIL = "owner@harness.test";

let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

// ── The boundary stub ────────────────────────────────────────────────────────
const S = { row: null, writes: [], gAuthFail: false, gLink: "NONE", gMutates: [], gSearches: 0, meta: "ok", metaReads: 0, mails: [] };
const reset = (data) => Object.assign(S, { row: { id: "c1", data: JSON.parse(JSON.stringify(data)) }, writes: [], gAuthFail: false, gLink: "NONE", gMutates: [], gSearches: 0, meta: "ok", metaReads: 0, mails: [] });
const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), method = (opts.method || "GET").toUpperCase();
  const hdr = (k) => { const h = opts.headers || {}; return typeof h.get === "function" ? h.get(k) : (h[k] || h[k.toLowerCase()] || ""); };
  if (u.includes(".supabase.co/rest/v1/")) {
    if (/\/rest\/v1\/clients/.test(u)) {
      if (method === "PATCH") { const b = JSON.parse(opts.body || "{}"); S.writes.push(b.data); S.row = { ...S.row, data: b.data }; return new Response(null, { status: 204 }); }
      const single = /vnd\.pgrst\.object/.test(String(hdr("Accept") || hdr("accept")));
      return J(single ? S.row : [S.row]);
    }
    return J([]);
  }
  if (u.startsWith("https://oauth2.googleapis.com/token")) return S.gAuthFail ? J({ error: "invalid_grant" }, 400) : J({ access_token: "at-harness" });
  if (u.includes("googleads.googleapis.com")) {
    if (u.endsWith("googleAds:search")) { S.gSearches++; return J({ results: S.gLink === "NONE" ? [] : [{ customerClientLink: { status: S.gLink } }] }); }
    if (u.includes("customerClientLinks:mutate")) { S.gMutates.push(JSON.parse(opts.body)); return J({ result: { resourceName: "x" } }); }
    return J({}, 404);
  }
  if (u.includes("graph.facebook.com")) {
    S.metaReads++;
    if (S.meta === "ok") return J({ account_status: 1, currency: "USD", amount_spent: "0" });
    if (S.meta === "denied") return J({ error: { message: "Unsupported get request", code: 100, error_subcode: 33 } }, 400);
    return J({ error: { message: "An unexpected error has occurred", code: 2 } }, 500);
  }
  if (u.startsWith("https://api.resend.com/emails")) { S.mails.push(JSON.parse(opts.body || "{}")); return J({ id: "m1" }); }
  return J({}, 404);
};

const AL = await import("../netlify/lib/ad-link.mjs");
const { default: portal, _internal } = await import("../netlify/functions/portal.mjs");
const post = async (fields) => { const r = await portal(new Request("https://os.test/.netlify/functions/portal?token=tok", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }) })); return { status: r.status, d: await r.json().catch(() => ({})) }; };
const get = async () => { const r = await portal(new Request("https://os.test/.netlify/functions/portal?token=tok")); return { status: r.status, html: await r.text() }; };
const G = { name: "Summit Roofing", packageId: "g-growth", portalToken: "tok", contractStatus: "active", contractSigned: true, commLog: [] };
const M = { ...G, packageId: "m-growth" };
const last = () => S.writes[S.writes.length - 1] || {};
const subjects = () => S.mails.map((m) => m.subject || "").join(" | ");

// ── 1. The decision rules (pure) ─────────────────────────────────────────────
{
  const P = AL.planGoogleLink;
  ok("a save without the Google box sends nothing", P("", undefined, undefined).send === false);
  ok("🔴 a new number that does not match the confirm box is refused", /don't match/.test(P("", "123-456-7890", "123-456-7891").error || ""));
  ok("🔴 a new number with no confirm at all is refused", !!P("", "1234567890", "").error);
  ok("a new number that is not 10 digits is refused, in words", /10 digits/.test(P("", "12345", "12345").error || ""));
  ok("a new number typed twice sends, dashes or not", P("", "123-456-7890", "1234567890").send === true && P("", "123-456-7890", "1234567890").id === "1234567890");
  ok("emptying the box sends nothing and is not an error", P("1234567890", "", "").send === false && !P("1234567890", "", "").error);
  ok("🔴 re-saving the tab with the same number and an empty confirm box sends nothing", P("1234567890", "1234567890", "", null).send === false);
  ok("same number, a request already live: nothing new, even if retyped", P("1234567890", "1234567890", "1234567890", { id: "1234567890", status: "pending" }).send === false);
  ok("same number, the old request was declined, retyped on purpose: sends again", P("1234567890", "1234567890", "1234567890", { id: "1234567890", status: "none" }).send === true);
  ok("same number Bryson entered on a call, confirmed by the client: sends", P("1234567890", "1234567890", "123-456-7890", null).send === true);

  ok("a new Meta ad account id counts as new", AL.metaChanged({}, { metaAdAccountId: "act_123" }) === true);
  ok("the same Meta numbers re-saved do not", AL.metaChanged({ metaAdAccountId: "123", metaPageId: "9" }, { metaAdAccountId: "123", metaPageId: "9" }) === false);

  const now = Date.parse("2026-10-21T18:00:00Z"), hr = 36e5;
  ok("a Google number nobody has looked at gets looked at", AL.googleNeedsCheck({ googleAdsCustomerId: "1234567890" }, now));
  ok("a waiting request is looked at every time", AL.googleNeedsCheck({ googleAdsCustomerId: "1234567890", googleLinkRequest: { id: "1234567890", status: "sent", at: new Date(now).toISOString() } }, now));
  ok("a connected account checked an hour ago is left alone", !AL.googleNeedsCheck({ googleAdsCustomerId: "1234567890", googleLinkRequest: { id: "1234567890", status: "active", checkedAt: new Date(now - hr).toISOString() } }, now));
  ok("🔴 and re-checked after a day, because a client can remove us without saying", AL.googleNeedsCheck({ googleAdsCustomerId: "1234567890", googleLinkRequest: { id: "1234567890", status: "active", checkedAt: new Date(now - 25 * hr).toISOString() } }, now));
  ok("half a number is not looked at", !AL.googleNeedsCheck({ googleAdsCustomerId: "12345" }, now));

  const at = new Date(now).toISOString();
  const acc = AL.googleAfterCheck({ id: "1234567890", status: "sent" }, "1234567890", "ACTIVE", at, "Summit");
  ok("🔴 sent then ACTIVE: connected, and Bryson gets a green 'accepted'", acc.rec.status === "active" && acc.alert && acc.alert.severity === "green" && /accepted/.test(acc.alert.title));
  const gone = AL.googleAfterCheck({ id: "1234567890", status: "active" }, "1234567890", "NONE", at, "Summit");
  ok("🔴 active then gone: amber 'removed Google access'", gone.rec.status === "none" && gone.alert && gone.alert.severity === "amber" && /removed/.test(gone.alert.title));
  const dec = AL.googleAfterCheck({ id: "1234567890", status: "pending" }, "1234567890", "REFUSED", at, "Summit");
  ok("pending then refused: amber 'declined'", dec.rec.status === "none" && /declined/.test((dec.alert || {}).title || ""));
  const first = AL.googleAfterCheck(null, "1234567890", "ACTIVE", at, "Summit");
  ok("a first look at an account we already manage records it quietly", first.rec.status === "active" && first.alert === null);
  const still = AL.googleAfterCheck({ id: "1234567890", status: "failed" }, "1234567890", "NONE", at, "Summit");
  ok("a failed send stays 'failed' until Bryson sends it, then flips to pending", still.rec.status === "failed" && AL.googleAfterCheck({ id: "1234567890", status: "failed" }, "1234567890", "PENDING", at).rec.status === "pending");

  ok("🔴 only a PERMISSION answer from Meta means 'not shared'", AL.metaNoAccess({ detail: { code: 200 } }) && AL.metaNoAccess({ detail: { code: 100, error_subcode: 33 } }) && !AL.metaNoAccess({ detail: { code: 2 } }) && !AL.metaNoAccess(new Error("timed out")));
  ok("an outage changes nothing (a connected client is not told they have a step to do)", AL.metaAfterCheck({ adAccountId: "1", status: "connected" }, "1", null, at) === null);
  const mOn = AL.metaAfterCheck({ adAccountId: "123", status: "waiting" }, "act_123", true, at, "Summit");
  ok("waiting then readable: connected, green alert", mOn.rec.status === "connected" && mOn.alert && mOn.alert.severity === "green");
  const mOff = AL.metaAfterCheck({ adAccountId: "123", status: "connected" }, "123", false, at, "Summit");
  ok("connected then refused: amber 'removed Meta access'", mOff.rec.status === "waiting" && /removed/.test((mOff.alert || {}).title || ""));
}

// ── 2. Saving a Google number in the portal ──────────────────────────────────
{
  reset(G);
  let r = await post({ googleAdsCustomerId: "123-456-7890", googleAdsCustomerIdConfirm: "123-456-7891" });
  ok("🔴 mismatched numbers: refused with a reason the client can act on", r.status === 400 && /don't match/.test(r.d.error || ""), JSON.stringify(r));
  ok("🔴 and NOTHING was saved or sent", S.writes.length === 0 && S.gMutates.length === 0 && S.gSearches === 0);

  reset(G);
  r = await post({ googleAdsCustomerId: "123-456-7890", googleAdsCustomerIdConfirm: "1234567890", contactName: "Marcus" });
  ok("🔴 a matching number saves", r.status === 200 && r.d.ok === true && S.writes.length >= 1 && S.writes[0].googleAdsCustomerId === "123-456-7890", JSON.stringify(r.d));
  ok("the confirm box itself is never stored", !("googleAdsCustomerIdConfirm" in last()));
  ok("🔴 Google is asked first whether a link already exists", S.gSearches === 1);
  ok("🔴 and the manager request goes out automatically, for exactly that account", S.gMutates.length === 1 && /customers\/1234567890/.test(JSON.stringify(S.gMutates[0])), JSON.stringify(S.gMutates));
  ok("the client is told to accept it, and where", r.d.googleLink === "sent" && /Approve it in Google Ads/.test(r.d.googleNote || ""));
  ok("the record says it was sent", last().googleLinkRequest && last().googleLinkRequest.status === "sent" && last().googleLinkRequest.id === "1234567890");
  ok("🔴 Bryson is told, and told there is nothing for him to do", /connected Google Ads/.test(subjects()) && S.mails.some((m) => /Nothing for you to do/.test(m.text || "")));
  ok("and it is in the client's log", (last().commLog || []).some((c) => /manager request went out automatically/.test(c.note)));

  // Re-saving the tab later (testimonials, say) with the same number and an empty confirm box
  const sent = JSON.parse(JSON.stringify(S.row.data)); reset(sent);
  r = await post({ googleAdsCustomerId: "123-456-7890", googleAdsCustomerIdConfirm: "", reviews: "Great work" });
  ok("🔴 re-saving the tab does not send a second request", r.d.ok === true && S.gMutates.length === 0 && S.gSearches === 0 && !r.d.googleLink);

  reset(G); S.gLink = "ACTIVE";
  r = await post({ googleAdsCustomerId: "1234567890", googleAdsCustomerIdConfirm: "1234567890" });
  ok("an account we already manage is not asked again, and the client hears they're set", S.gMutates.length === 0 && r.d.googleLink === "already" && /all set/.test(r.d.googleNote || ""));
  ok("and it is recorded as connected", last().googleLinkRequest && last().googleLinkRequest.status === "active");

  reset(G); S.gLink = "PENDING";
  r = await post({ googleAdsCustomerId: "1234567890", googleAdsCustomerIdConfirm: "1234567890" });
  ok("a request already waiting is not sent twice; the client is pointed at it", S.gMutates.length === 0 && r.d.googleLink === "pending" && /waiting for you/.test(r.d.googleNote || ""));

  reset(G); S.gAuthFail = true;
  r = await post({ googleAdsCustomerId: "1234567890", googleAdsCustomerIdConfirm: "1234567890" });
  ok("🔴 if the send fails the number is STILL saved", r.status === 200 && r.d.ok === true && S.writes[0].googleAdsCustomerId === "1234567890");
  ok("🔴 and it is never silent: the client is told someone will send it", r.d.googleLink === "failed" && /let your account manager know/.test(r.d.googleNote || ""));
  ok("🔴 and Bryson gets an amber 'send it' with where to press", /Send Summit Roofing's Google manager request/.test(subjects()) && S.mails.some((m) => /Send manager link request/.test(m.text || "")));
}

// ── 3. Saving Meta numbers ───────────────────────────────────────────────────
{
  reset(M); S.meta = "denied";
  let r = await post({ metaAdAccountId: "1234567", metaPageId: "555", metaPixelId: "777" });
  ok("Meta numbers save", r.d.ok === true && S.writes[0].metaAdAccountId === "1234567");
  ok("🔴 not shared yet: the client is told the partner step", r.d.metaAccess === "waiting" && /add BoldLine as a partner/.test(r.d.metaNote || ""));
  ok("recorded as waiting for that account", last().metaAccess && last().metaAccess.status === "waiting" && last().metaAccess.adAccountId === "1234567");
  ok("Bryson hears they still need to share it", /saved their Meta details/.test(subjects()));

  reset(M); S.meta = "ok";
  r = await post({ metaAdAccountId: "1234567" });
  ok("already shared: the client hears they're connected, Bryson gets green", r.d.metaAccess === "connected" && /connected/.test(r.d.metaNote || "") && /connected Meta/.test(subjects()));
}

// ── 4. 🔴 Opening the portal: only looks, and shows the truth ─────────────────
{
  const waiting = { ...G, googleAdsCustomerId: "1234567890", googleLinkRequest: { id: "1234567890", status: "sent", at: "2026-10-21T18:00:00Z" } };
  reset(waiting); S.gLink = "PENDING";
  let { html } = await get();
  ok("🔴 waiting on the client: the Status tab opens with 'One step left'", /One step left before your ads can run/.test(html));
  ok("the banner sits at the top of the Status tab", (() => { const t = html.indexOf('id="t-status"'), b = html.indexOf("One step left"); return t > 0 && b > t && b - t < 6000; })());
  ok("🔴 and the Google card shows 'Waiting for you: accept our request', pulsing", /Waiting for you: accept our request/.test(html) && /class="acc-pulse"/.test(html));
  ok("with the exact clicks", /Access and security/.test(html) && /Managers/.test(html) && /Accept/.test(html));
  ok("🔴 opening it saved nothing and told nobody", S.writes.length === 0 && S.mails.length === 0);

  reset(waiting); S.gLink = "ACTIVE";
  ({ html } = await get());
  ok("🔴 once they accept, the page says Connected by itself", /Connected\. We manage your Google Ads account \(123-456-7890\)/.test(html) && !/One step left/.test(html));
  ok("🔴 still nothing saved, nothing sent (the watch job does that)", S.writes.length === 0 && S.mails.length === 0);

  reset({ ...G, googleAdsCustomerId: "1234567890", googleLinkRequest: { id: "1234567890", status: "active", checkedAt: new Date().toISOString() } });
  ({ html } = await get());
  ok("a connected account checked today is not asked about again", S.gSearches === 0 && /Connected\./.test(html));

  // A Meta number Bryson typed in the OS that nobody has looked at yet, and we CAN see it
  reset({ ...M, metaAdAccountId: "1234567" }); S.meta = "ok";
  ({ html } = await get());
  ok("🔴 a connected Meta client entered from the OS is NOT told they have a step left", !/One step left/.test(html) && /Connected\. We can see your Meta ad account/.test(html));
  reset({ ...M, metaAdAccountId: "1234567" }); S.meta = "outage";
  ({ html } = await get());
  ok("🔴 nor during a Meta outage", !/One step left/.test(html) && !/Waiting for you/.test(html));
  reset({ ...M, metaAdAccountId: "1234567" }); S.meta = "denied";
  ({ html } = await get());
  ok("but when Meta refuses us, they are told: partner step, pulsing, plus the banner", /Waiting for you: add BoldLine as a partner/.test(html) && /One step left/.test(html));
  ok("and still nothing was written", S.writes.length === 0 && S.mails.length === 0);
}

// ── 5. The watch job: records what changed and tells Bryson ──────────────────
{
  const { runAccessWatch } = await import("../netlify/functions/ad-access-watch.mjs");
  const db = (rows) => { const w = []; return { w, from: () => ({
    select: () => ({ eq: (_c, id) => ({ maybeSingle: async () => ({ data: { data: rows.find((r) => r.id === id).data } }) }) }),
    update: (v) => ({ eq: async (_c, id) => { w.push({ id, data: v.data }); return {}; } }),
  }) }; };
  const now = Date.parse("2026-10-21T18:00:00Z");
  const rows = [
    { id: "a", data: { name: "Acme", googleAdsCustomerId: "1112223333", googleLinkRequest: { id: "1112223333", status: "sent", at: "2026-10-21T17:00:00Z" } } },
    { id: "b", data: { name: "Bolt", googleAdsCustomerId: "4445556666", googleLinkRequest: { id: "4445556666", status: "pending", at: "2026-10-21T17:00:00Z" } } },
    { id: "c", data: { name: "Crest", metaAdAccountId: "777", metaAccess: { adAccountId: "777", status: "connected", checkedAt: "2026-10-21T17:30:00Z" } } },
    { id: "h", data: { name: "BoldLine", internal: true, googleAdsCustomerId: "9998887777" } },
  ];
  const told = []; const d = db(rows);
  const api = { googleStatus: async (id) => (id === "1112223333" ? "ACTIVE" : "PENDING"), metaRead: async () => { throw new Error("should not be asked"); } };
  const res = await runAccessWatch(d, rows, api, { now, alert: async (a) => { told.push(a); } });
  ok("🔴 an accepted request is saved as connected", d.w.some((x) => x.id === "a" && x.data.googleLinkRequest.status === "active"));
  ok("🔴 and Bryson gets the green 'accepted'", told.length === 1 && /Acme accepted Google access/.test(told[0].title));
  ok("still waiting: nothing rewritten, nobody told", !d.w.some((x) => x.id === "b"));
  ok("a connected account checked half an hour ago is not asked", !d.w.some((x) => x.id === "c"));
  ok("BoldLine's own house account is skipped", res.looked === 2);
  ok("the change is in the client's log", d.w.find((x) => x.id === "a").data.commLog.some((c) => /accepted our manager request/.test(c.note)));
}

// ── 6. The page itself ───────────────────────────────────────────────────────
{
  const SRC = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
  const pkg = _internal.findPkg("g-growth");
  const html = _internal.makePortalHTML({ ...G, googleAdsCustomerId: "1234567890" }, pkg);
  const conf = (html.match(/<input[^>]*data-key="googleAdsCustomerIdConfirm"[^>]*>/) || [""])[0];
  ok("🔴 there is a second Customer ID box", !!conf);
  ok("🔴 and it is NEVER prefilled, so a match always means the client typed it", /value=""/.test(conf), conf);
  ok("the steps say to enter it twice, and that accepting is its own step", /twice so a typo can't slip through/.test(html) && /Accept our request/.test(html));
  ok("before saving, the accept step is already a box of its own under Save", /After you save: accept our request|Next: confirm your number, then accept our request/.test(html));
  ok("the pulse has its animation, and stops for 'reduce motion'", /\.acc-pulse\{animation:accPulse/.test(SRC) && /prefers-reduced-motion:reduce\)\{\.acc-pulse\{animation:none\}/.test(SRC));

  const S2 = emittedPortalScript("netlify/functions/portal.mjs");
  const code = S2 ? S2.code : "";
  ok("🔴 Save shows the server's reason when it refuses, instead of a vague failure", /errEl\.textContent=d\.error\|\|/.test(code));
  ok("Save shows what happened next under each card", /blNote\('gads-note',d\.googleNote/.test(code) && /blNote\('meta-note',d\.metaNote/.test(code));
  ok("'Show me how' opens the Account tab at the connect card", /function goConnect\(\)/.test(code) && /getElementById\('conn-card'\)/.test(code));

  const words = [...Object.values(AL.GOOGLE_NOTE), ...Object.values(AL.META_NOTE),
    ...(html.match(/One step left[^]*?Show me how/) || []), ...(html.match(/(After you save|Next: confirm)[^]*?<\/ol>/) || [])].join(" ");
  ok("🔴 no em or en dashes in anything new the client reads", !/[–—]/.test(words), (words.match(/.{20}[–—].{20}/) || [""])[0]);
  ok("🔴 no emojis either", !/\p{Extended_Pictographic}/u.test(words.replace(/[✓★]/g, "")));
  const wb = _internal.makePortalHTML({ ...M, metaAdAccountId: "1", metaAccess: { adAccountId: "1", status: "waiting" } }, _internal.findPkg("m-growth"));
  const metaWords = (wb.match(/One step left[^]*?Show me how/) || [""])[0] + (wb.match(/Waiting for you: add BoldLine[^]*?<\/ol>/) || [""])[0];
  ok("the Meta banner and step are dash- and emoji-free too", metaWords.length > 100 && !/[–—]/.test(metaWords) && !/\p{Extended_Pictographic}/u.test(metaWords.replace(/[✓★]/g, "")));
}

globalThis.fetch = realFetch;
if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-ad-account-link: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
