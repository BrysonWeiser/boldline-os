// Pausing and restoring a client's service over a late payment (Agreement 3.4, terms v6+).
// The rules live in late-payment.mjs; this file is the part that touches the ad platforms.
//
// 🔴 PAUSE, NEVER REMOVE. Only `PAUSED` / `ENABLED` / `ACTIVE` are ever sent from here. REMOVED is
// permanent in Google Ads and the ad accounts belong to the client, so deleting anything over a
// bill would destroy their property AND throw away the one lever that gets the bill paid.
//
// 🔴 RESUME ONLY WHAT WE PAUSED. The pause records exactly which campaigns it switched off, and a
// resume switches back on that list and nothing else. A campaign Bryson had deliberately left
// paused must still be paused after the client pays.

import { getAccessToken as gadsToken, getCampaigns as gadsCampaigns, setStatus as gadsSetStatus } from "../functions/google-ads.mjs";
import { getCampaigns as metaCampaigns, setStatus as metaSetStatus } from "../functions/meta-ads.mjs";
import { pausableGoogle, pausableMeta } from "./late-payment.mjs";

const googleConfigured = () => !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN
  && process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID);
const metaConfigured = () => !!process.env.META_SYSTEM_USER_TOKEN;
const msg = (e) => (e && e.message) || String(e);

// Returns { paused:[...], failed:[...] }. `failed` is never swallowed: the owner alert names
// every campaign that could not be paused, so a pause that half-worked is never reported as done.
export async function pauseClientAds(cl, deps = {}) {
  const g = { token: deps.gadsToken || gadsToken, list: deps.gadsCampaigns || gadsCampaigns, set: deps.gadsSetStatus || gadsSetStatus };
  const m = { list: deps.metaCampaigns || metaCampaigns, set: deps.metaSetStatus || metaSetStatus };
  const paused = [], failed = [];
  const gid = cl && cl.googleAdsCustomerId, mid = cl && cl.metaAdAccountId;
  if (gid) {
    if (!(deps.googleConfigured ? deps.googleConfigured() : googleConfigured())) failed.push({ p: "google", error: "Google Ads is not connected on the server" });
    else {
      try {
        const tok = await g.token();
        for (const c of pausableGoogle(await g.list(tok, gid))) {
          try { await g.set(tok, gid, c.campaignResourceName, "PAUSED"); paused.push({ p: "google", id: c.id, rn: c.campaignResourceName, name: c.name || "" }); }
          catch (e) { failed.push({ p: "google", name: c.name || "", error: msg(e) }); }
        }
      } catch (e) { failed.push({ p: "google", error: msg(e) }); }
    }
  }
  if (mid) {
    if (!(deps.metaConfigured ? deps.metaConfigured() : metaConfigured())) failed.push({ p: "meta", error: "Meta is not connected on the server" });
    else {
      try {
        for (const c of pausableMeta(await m.list(mid))) {
          try { await m.set(c.id, "PAUSED"); paused.push({ p: "meta", id: c.id, name: c.name || "" }); }
          catch (e) { failed.push({ p: "meta", name: c.name || "", error: msg(e) }); }
        }
      } catch (e) { failed.push({ p: "meta", error: msg(e) }); }
    }
  }
  return { paused, failed };
}

export async function resumeClientAds(cl, pause, deps = {}) {
  const g = { token: deps.gadsToken || gadsToken, set: deps.gadsSetStatus || gadsSetStatus };
  const m = { set: deps.metaSetStatus || metaSetStatus };
  const list = (pause && Array.isArray(pause.paused)) ? pause.paused : [];
  const resumed = [], failed = [];
  let tok = null;
  for (const c of list) {
    try {
      if (c.p === "google") {
        if (!tok) tok = await g.token();
        await g.set(tok, cl.googleAdsCustomerId, c.rn, "ENABLED");
      } else if (c.p === "meta") {
        await m.set(c.id, "ACTIVE");
      } else continue;
      resumed.push(c);
    } catch (e) { failed.push({ ...c, error: msg(e) }); }
  }
  return { resumed, failed };
}
