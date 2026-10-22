// A client typed their ad account numbers into their portal: what happens next (KB ad-account-link).
//
// Bryson, 2026-10-21: "double check that if a client puts their Google ad account number or meta into their client
// dashboard that it saves and automatically sends the request". It saved, but nothing was sent and nobody was told,
// while the portal promised "We'll send a manager link request".
//
// GOOGLE: the portal now sends the manager link request itself the moment a NEW Customer ID is saved. The reason it
// was manual (google-ads.mjs, 2026-09-08) still stands: a request is seen by whoever owns the number typed in, so one
// wrong digit asks a stranger to hand us their account. Here the OWNER types it, from their own screen, TWICE, and the
// two must match before anything is saved or sent. Bryson's OS edit sheet stays manual (he types it on a call).
//
// META: there is nothing for us to send. The client adds BoldLine as a partner in their Business settings. What we can
// do is look: after they save, we try to read the ad account, and tell them (and Bryson) whether we can see it yet.

export const digitsOnly = (v) => String(v == null ? "" : v).replace(/[^0-9]/g, "");
export const prettyCid = (v) => { const d = digitsOnly(v); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d; };

// What to do with the Google Customer ID on this save. `next` is undefined when the save did not include the box.
// `rec` is the client's googleLinkRequest. The confirm box is NEVER prefilled, so a match always means they typed it.
//   changed number   must be 10 digits and match the confirm box, or the save is refused (nothing saved, nothing sent)
//   same number      sends only when no request is live for it AND they typed it again on purpose (a resend after a
//                    refusal, an expiry, or a number Bryson entered on a call). Re-saving the tab for anything else
//                    leaves the confirm box empty and sends nothing.
const LIVE = new Set(["active", "sent", "pending"]);
export function planGoogleLink(prevId, nextId, confirmId, rec) {
  if (nextId === undefined) return { send: false };
  const prev = digitsOnly(prevId), next = digitsOnly(nextId), confirm = digitsOnly(confirmId);
  if (!next) return { send: false };                                   // emptied: nothing to ask for
  if (next === prev) {
    const live = rec && digitsOnly(rec.id) === next && LIVE.has(rec.status);
    return !live && next.length === 10 && confirm === next ? { send: true, id: next } : { send: false };
  }
  if (next.length !== 10) return { send: false, error: "A Google Ads Customer ID is 10 digits, like 123-456-7890. Check it and try again." };
  if (confirm !== next) return { send: false, error: "The two Customer IDs don't match. Type the number again in both boxes." };
  return { send: true, id: next };
}

// Did this save bring in Meta numbers we have not seen before?
export function metaChanged(prev, fields) {
  const keys = ["metaAdAccountId", "metaPageId", "metaPixelId"];
  return keys.some((k) => fields && Object.prototype.hasOwnProperty.call(fields, k) && digitsOnly(fields[k]) && digitsOnly(fields[k]) !== digitsOnly(prev && prev[k]));
}

// The words the client sees under each box after saving. Plain, no emojis or dashes (client-facing).
export const GOOGLE_NOTE = {
  sent: "Saved. We've sent you a manager request. Approve it in Google Ads under Admin, then Access and security, then Managers.",
  pending: "Saved. Our manager request is waiting for you in Google Ads under Admin, then Access and security, then Managers.",
  already: "Saved. We already manage this account, so you're all set.",
  failed: "Saved. We couldn't send the manager request automatically, so we've let your account manager know and they'll send it shortly.",
};
export const META_NOTE = {
  connected: "Saved. We can see your ad account, so you're connected.",
  waiting: "Saved. Last step: add BoldLine as a partner in your Business settings (the step above) so we can manage it.",
};

// One line for Bryson, in the log and the alert.
export function googleAlertText(name, id, status, why) {
  const who = name || "A client", n = prettyCid(id);
  if (status === "sent") return { severity: "green", title: `${who} connected Google Ads`, body: `${who} entered their Google Ads Customer ID (${n}) in their portal and the manager request went out automatically. Once they approve it, the account shows as managed. Nothing for you to do.` };
  if (status === "pending") return { severity: "blue", title: `${who} entered their Google Ads ID`, body: `${who} entered ${n} in their portal. A manager request for it was already waiting, so no new one was sent.` };
  if (status === "already") return { severity: "blue", title: `${who} entered their Google Ads ID`, body: `${who} entered ${n} in their portal. We already manage that account.` };
  return { severity: "amber", title: `Send ${who}'s Google manager request`, body: `${who} entered their Google Ads Customer ID (${n}) in their portal, but the request could not be sent automatically${why ? `: ${why}` : ""}. Open their Campaign tab and press Send manager link request.` };
}
export function metaAlertText(name, access) {
  const who = name || "A client";
  return access === "connected"
    ? { severity: "green", title: `${who} connected Meta`, body: `${who} saved their Meta account details in their portal and we can already see their ad account.` }
    : { severity: "blue", title: `${who} saved their Meta details`, body: `${who} saved their Meta account details in their portal, but we can't see the ad account yet. They still need to add BoldLine as a partner; the portal has told them how.` };
}

// ─── Looking again on each portal visit (refreshAccess in portal.mjs) ────────────────────────────────────────────────
// 🔴 OBSERVED, NEVER TRUSTED FOREVER (same rule as KB manager-link-status). A client can remove our access from their own
// account at any time without telling us, so "Connected" is re-checked once a day, and anything still waiting on them is
// re-checked on every visit. A visit that finds a change records it, tells Bryson, and the portal redraws to match.
const DAY = 864e5;
const fresh = (r, now) => Date.parse((r && (r.checkedAt || r.activeAt || r.connectedAt || r.at)) || "") > now - DAY;

export function googleNeedsCheck(cl, now = Date.now()) {
  const id = digitsOnly(cl && cl.googleAdsCustomerId); if (id.length !== 10) return false;
  const r = cl.googleLinkRequest;
  if (!r || digitsOnly(r.id) !== id) return true;                      // never looked at this number (or entered in the OS)
  return r.status === "active" ? !fresh(r, now) : true;                 // sent / pending / failed / none: look every visit
}
// `live` is Google's answer for the link (ACTIVE / PENDING / REFUSED / CANCELLED / INACTIVE / NONE).
export function googleAfterCheck(r, idRaw, live, at, name) {
  const id = digitsOnly(idRaw), who = name || "A client", n = prettyCid(id);
  const prev = r && digitsOnly(r.id) === id ? r.status : null;
  const status = live === "ACTIVE" ? "active" : live === "PENDING" ? "pending" : prev === "failed" ? "failed" : "none";
  const rec = { ...(prev ? r : {}), id, status, checkedAt: at, ...(status === "active" && prev !== "active" ? { activeAt: at } : {}) };
  let alert = null;
  if (status === "active" && (prev === "sent" || prev === "pending" || prev === "failed")) alert = { severity: "green", title: `${who} accepted Google access`, body: `${who} accepted our manager request for Google Ads account ${n}. We can run their ads now.` };
  else if (prev === "active" && status !== "active") alert = { severity: "amber", title: `${who} removed Google access`, body: `${who}'s Google Ads account ${n} no longer shows BoldLine as its manager. Their portal now asks them to connect it again.` };
  else if ((prev === "sent" || prev === "pending") && status === "none") alert = { severity: "amber", title: `${who}'s Google request was declined`, body: `Our manager request for ${who}'s Google Ads account ${n} was declined or expired. Their portal now asks them to send it again.` };
  return { rec, alert };
}

export function metaNeedsCheck(cl, now = Date.now()) {
  const id = digitsOnly(cl && cl.metaAdAccountId); if (!id) return false;
  const m = cl.metaAccess;
  if (!m || digitsOnly(m.adAccountId) !== id) return true;
  return m.status === "connected" ? !fresh(m, now) : true;
}
// Only a PERMISSION answer means "we can't see it". A timeout, an outage or a rate limit says nothing about the client,
// and treating it as "not shared" would tell a connected client they still have a step to do. Meta's codes: 200 and 10
// are permission errors, 803 is an id we can't resolve, 100/33 is "does not exist or missing permissions".
export function metaNoAccess(err) {
  const d = (err && err.detail) || {}, code = Number(d.code), sub = Number(d.error_subcode);
  return code === 200 || code === 10 || code === 803 || (code === 100 && sub === 33);
}
// `readable`: true (we read the account), false (a permission refusal), null (could not tell; change nothing).
export function metaAfterCheck(m, adIdRaw, readable, at, name) {
  if (readable == null) return null;
  const id = digitsOnly(adIdRaw), who = name || "A client";
  const prev = m && digitsOnly(m.adAccountId) === id ? m.status : null;
  const status = readable ? "connected" : "waiting";
  const rec = { ...(prev ? m : {}), adAccountId: id, status, checkedAt: at, ...(status === "connected" && prev !== "connected" ? { connectedAt: at } : {}) };
  let alert = null;
  if (status === "connected" && prev === "waiting") alert = { severity: "green", title: `${who} shared their Meta ad account`, body: `${who} added BoldLine as a partner and we can now see their Meta ad account.` };
  else if (prev === "connected" && status === "waiting") alert = { severity: "amber", title: `${who} removed Meta access`, body: `We can no longer see ${who}'s Meta ad account. Their portal now asks them to add BoldLine as a partner again.` };
  return { rec, alert };
}

// One look at both platforms for one client. Pure apart from the two `api` calls, which only READ:
//   api.googleStatus(id)  resolves Google's link status string
//   api.metaRead(id)      resolves if we can read the ad account, rejects with Meta's error if not
// Returns the client with the observed records swapped in, the alerts a change deserves, and `dirty` (worth saving).
// 🔴 THE PORTAL'S PAGE LOAD USES THIS AND MUST NEVER SAVE OR ALERT (the OS preview loads that page every time Bryson
// opens a client, KB preview-safety). Only the ad-access-watch job writes what it finds and tells Bryson.
const withCap = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms))]);
export async function observeAccess(cl, api, { timeoutMs = 3500, now = Date.now() } = {}) {
  const at = new Date(now).toISOString();
  const doG = googleNeedsCheck(cl, now), doM = metaNeedsCheck(cl, now);
  if (!doG && !doM) return { cl, alerts: [], dirty: false };
  const [g, m] = await Promise.all([
    doG ? withCap(Promise.resolve().then(() => api.googleStatus(cl.googleAdsCustomerId)), timeoutMs)
      .then((st) => googleAfterCheck(cl.googleLinkRequest, cl.googleAdsCustomerId, st, at, cl.name), () => null) : null,
    doM ? withCap(Promise.resolve().then(() => api.metaRead(cl.metaAdAccountId)), timeoutMs)
      .then(() => true, (e) => (metaNoAccess(e) ? false : null))
      .then((readable) => metaAfterCheck(cl.metaAccess, cl.metaAdAccountId, readable, at, cl.name)) : null,
  ]);
  const same = (prev, rec, idKey) => prev && digitsOnly(prev[idKey]) === digitsOnly(rec[idKey]) && prev.status === rec.status;
  // A first look, a status change, or a once-a-day re-check of a connected account (to move its checkedAt on) is worth
  // saving. "Still waiting on them" is not, or every run would rewrite every waiting client.
  const dirty = !!((g && (!same(cl.googleLinkRequest, g.rec, "id") || g.rec.status === "active"))
    || (m && (!same(cl.metaAccess, m.rec, "adAccountId") || m.rec.status === "connected")));
  const next = { ...cl, ...(g ? { googleLinkRequest: g.rec } : {}), ...(m ? { metaAccess: m.rec } : {}) };
  return { cl: next, alerts: [g && g.alert, m && m.alert].filter(Boolean), dirty, google: g ? g.rec : null, meta: m ? m.rec : null };
}

// The real platforms, loaded only when used so this file stays importable anywhere.
export const liveAccessApi = () => ({
  googleStatus: async (id) => { const g = await import("../functions/google-ads.mjs"); const tok = await g.getAccessToken(); return (await g.getClientLinkStatus(tok, id)).status; },
  metaRead: async (id) => { const m = await import("../functions/meta-ads.mjs"); return m.getAccountHealth(id); },
});
