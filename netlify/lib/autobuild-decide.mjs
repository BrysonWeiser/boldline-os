// Who is ready to have their campaign built for them, and what to build next.
//
// Bryson, 2026-08-31: *"the whole point of the bots is for them to build the campaign
// landing page etc. without me having to do anything and then they send it to me for
// approval."* Until now nothing did that. Every builder existed and every one of them
// waited for a button. `intakeComplete` was read by the pipeline display and the health
// score and by nothing that acts.
//
// 🔴 THE SAFETY MODEL IS THE SAME ONE ADS-AUTOPILOT USES: this job may PREPARE anything and
// PUBLISH nothing. The landing page is generated as a draft, the campaign is created paused
// (which is what `createCampaign` already does), and both raise an approval for Bryson.
// The worst case of a bug here is work he throws away, never a client's card being charged
// or an ad nobody approved going live.
//
// Kept pure and separate from the job that runs it, for the same reason `docusign-status`
// is: the decisions are where the bugs live, and this way they can be tested without a
// network, a model call, or an ad account.

// How many times a client may fail before the job stops retrying them. Model calls and ad
// account writes both cost money, and a client with a permanently bad field would otherwise
// be retried every hour forever.
export const MAX_ATTEMPTS = 3;

const has = (v) => !!String(v == null ? "" : v).trim();

// 🔴 EVERY REASON IS RETURNED, NOT LOGGED. A client sitting untouched with no explanation is
// the complaint that produced the pipeline-honesty work: a screen that says nothing is
// happening, and no way to find out why. The job writes this onto the client so the OS can
// show it.
export function readiness(client) {
  const c = client || {};
  const cs = c.campaignSetup || {};
  const ab = c.autoBuild || {};

  if (c.internal) return { ready: false, why: "This is the house account." };
  if (ab.off) return { ready: false, why: "Auto build is switched off for this client." };
  if (!c.contractSigned) return { ready: false, why: "Waiting on the signed agreement." };
  if (Number(ab.attempts || 0) >= MAX_ATTEMPTS) {
    return { ready: false, why: `Stopped after ${MAX_ATTEMPTS} failed attempts. ${ab.error || ""}`.trim() };
  }
  // The brief. Without these there is nothing for the model to write FROM, and a page
  // invented out of nothing is worse than no page.
  if (!has(cs.mainOffer)) return { ready: false, why: "No main offer yet, so there is nothing to write from." };
  if (!has(cs.targetLocations)) return { ready: false, why: "No target location yet." };
  return { ready: true, why: "" };
}

// The next thing to build, or null. Deliberately ONE step per run: each is a model call or
// an ad-account write, and doing them one at a time means a failure in the second never
// leaves the first half-saved.
export function nextStep(client) {
  const c = client || {};
  const r = readiness(c);
  if (!r.ready) return { step: null, why: r.why };

  const lp = c.landingPage || {};
  const ab = c.autoBuild || {};
  const camps = Array.isArray(c.campaigns) ? c.campaigns : [];

  // 1. The page first. The campaign needs somewhere to point, and `createCampaign` refuses
  //    to run without a landingUrl, so this order is a requirement rather than a preference.
  if (!has(lp.headline) && !ab.landingAt) return { step: "landing", why: "" };

  // 2. Then the campaign, once there is a page AND an ad account to build it in.
  if (camps.length === 0 && !ab.campaignAt) {
    if (!has(lp.headline)) return { step: null, why: "Waiting on the landing page." };
    if (!has(c.googleAdsCustomerId)) {
      return { step: null, why: "Waiting on them to link their Google Ads account." };
    }
    return { step: "campaign", why: "" };
  }

  return { step: null, why: "Everything that can be built has been built." };
}

// What to write onto the client after a step succeeds. Timestamps are the idempotency keys:
// once `landingAt` is set this job never generates that page again, even if Bryson deletes
// the copy, because a bot quietly overwriting his edits is worse than doing nothing.
export function successPatch(step, client, at) {
  const ab = { ...((client || {}).autoBuild || {}) };
  ab[step === "landing" ? "landingAt" : "campaignAt"] = at;
  ab.attempts = 0;
  delete ab.error;
  return { autoBuild: ab };
}

// A failure counts against the attempt budget and records why, so the OS can show it and so
// the job stops rather than looping on a client it can never finish.
export function failurePatch(client, message, at) {
  const ab = { ...((client || {}).autoBuild || {}) };
  ab.attempts = Number(ab.attempts || 0) + 1;
  ab.error = String(message || "unknown error").slice(0, 300);
  ab.lastErrorAt = at;
  return { autoBuild: ab };
}
