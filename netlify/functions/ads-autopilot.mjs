// Ads Autopilot — the first job allowed to CHANGE a live ad account on its own.
//
// Everything else in the OS reads ad accounts automatically and writes to them
// never; every campaign change goes through Bryson's approval. This job is the
// deliberate, narrow exception, built to one rule:
//
//     THE BOT MAY ALWAYS SPEND LESS WITHOUT ASKING.
//     THE BOT MAY NEVER SPEND MORE WITHOUT ASKING.
//
// That inversion is the whole safety model. Every action below either pauses a
// campaign or moves budget between campaigns without raising the account total,
// so the worst case of a bug is an ad that stopped running — recoverable in one
// click — rather than a client's card being drained at 3am.
//
// It runs on Netlify's servers on a schedule. Nothing needs to be open anywhere.
//
// WHAT IT DOES (per client, per run):
//   1. OVERSPEND TRIP — pacing above the monthly budget by the trip margin?
//      Pause the biggest live spenders until projected pacing is back under.
//   2. DEAD-SPEND TRIP — a live campaign that has burned real money over 30 days
//      with zero conversions? Pause it.
//   3. REBALANCE (opt-in per client, default OFF) — shift daily budget from the
//      worst cost-per-conversion campaign to the best, capped per run, never
//      raising the account's total daily budget by a cent.
//
// WHAT IT NEVER DOES: create a campaign, enable a paused one, raise an account's
// total budget, or change targeting. Those stay human decisions.
//
// Env: SUPABASE_SERVICE_ROLE_KEY + the platform credentials.
//      ADS_AUTOPILOT=off  -> global kill switch, checked first, every run.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, handoffIsFinished } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import {
  getCampaigns as metaCampaigns, setStatus as metaSetStatus, setBudget as metaSetBudget,
  getAdsForCampaign as metaAds, addAdToAdset as metaAddAd, setAdStatus as metaSetAdStatus,
} from "./meta-ads.mjs";
import {
  getAccessToken as gadsToken, getCampaigns as gadsCampaigns,
  setStatus as gadsSetStatus, setBudget as gadsSetBudget,
  getCampaignDetail as gadsDetail, addResponsiveSearchAd as gadsAddAd, setAdStatus as gadsSetAdStatus,
} from "./google-ads.mjs";
import { runTool, TOOL_FOR, MAX_TOKENS_FOR, systemFor, cleanGoogle, cleanMeta } from "../lib/ad-gen-shared.mjs";
import { getLocalConditions, conditionsFingerprint } from "../lib/local-conditions.mjs";
import { metaDelivering, googleDelivering } from "../lib/meta-status.mjs";

const DAYS_PER_MONTH = 30.4;

// ── The dials. Deliberately conservative; every one can only reduce spend. ────
const TRIP_MARGIN = 1.30;      // pause only once pacing is 30% over budget
const TARGET_AFTER_PAUSE = 1.0;// pause down to roughly the budget line, not below
const DEAD_MIN_SPEND = 150;    // $ over 30d with zero conversions before we act…
const DEAD_MIN_SHARE = 0.25;   // …or 25% of the monthly budget, whichever is higher
const COOLDOWN_HOURS = 24;     // never touch the same campaign twice in a day
const REBALANCE_MAX_SHIFT = 0.15; // ±15% of a campaign's daily budget, per run
const MAX_ACTIONS_PER_CLIENT = 4;  // a blast radius cap, whatever the maths says

// ── SPLIT TESTING ───────────────────────────────────────────────────────────
// This is the ONE thing autopilot creates rather than pauses, and it stays inside
// the founding invariant — "may always spend LESS, may NEVER spend more without
// asking" — because BUDGET LIVES ON THE CAMPAIGN. A second ad inside an existing
// ad group changes which creative the same money buys; it cannot raise the bill.
// It never creates a campaign, never creates an ad group, never enables anything
// that was paused, and never touches budget.
const SPLIT_MIN_IMPRESSIONS = 500;   // per ad group before a challenger is worth writing
const SPLIT_MIN_CLICKS_EACH = 30;    // per ad before a winner may be declared
const SPLIT_MIN_DAYS = 7;            // and it must have had a week to run
const SPLIT_MIN_LIFT = 0.25;         // the winner must beat the loser by 25%+, or it is noise
const SPLIT_COOLDOWN_HOURS = 168;    // one split action per ad group per week

// ── META CREATIVE TESTING ───────────────────────────────────────────────────
// Bryson, 2026-08-19: "I want it to automatically improve the meta ad."
//
// The same idea as the Google path above, one level down: Google tests ADS inside an
// AD GROUP, Meta tests ADS inside an AD SET. The invariant survives for exactly the
// same reason — budget lives on the campaign or the ad set, never on the ad, so a
// second creative inside a live ad set changes what the money buys and cannot raise
// the bill.
//
// 🔴 WHY IT IS RESTRICTED TO OWNED ACCOUNTS FOR NOW. Meta has BoldLine on Development
// tier, which permits API writes to ad accounts BoldLine itself owns and refuses them
// everywhere else. Running this against a client account today would not just fail, it
// would fail repeatedly on a schedule and generate a failure alert every two hours. So
// it is gated to the house account until standard access lands. AT APPROVAL: delete the
// `cl.internal` condition on the line marked META-TIER-GATE and it covers every client,
// with no other change. See KB meta-parked-work.
//
// Two differences from Google, both forced by the platform rather than chosen:
//  1. META NEEDS LONGER TO JUDGE. Its delivery system deliberately front-loads whichever
//     ad it thinks will win, so early numbers reflect Meta's guess as much as the copy.
//     A higher click floor and a longer minimum run stop autopilot pausing a good ad
//     because Meta had not got round to showing it yet.
//  2. THE IMAGE IS HELD CONSTANT. The challenger reuses the champion's image hash. If
//     the copy AND the picture change together, a win teaches nothing about which one won.
const META_SPLIT_MIN_IMPRESSIONS = 1000;  // per ad set before a challenger is worth writing
const META_SPLIT_MIN_CLICKS_EACH = 50;    // per ad before a winner may be declared
const META_SPLIT_MIN_LIFT = 0.30;         // beat the loser by 30%+, or it is Meta's delivery talking
const META_SPLIT_COOLDOWN_HOURS = 168;    // one action per ad set per week

// ── CREATIVE STRATEGY: TEST vs MULTI-ANGLE ──────────────────────────────────
// Bryson, 2026-08-19, after Brez Scales (Bergen Resnik): "if your running multiple ads
// with different images/angles/keywords that one might have high or whatever but itll be
// ok because thats what builds awareness and then the second ads builds it even more and
// then the third ad that they see will land them as a lead."
//
// He is describing multi-touch, and it is real: cold paid social rarely converts on first
// exposure, and three angles beat the same ad three times.
//
// 🔴 IT ALSO EXPOSES A GENUINE FLAW IN TEST MODE, WHICH IS WHY THIS SETTING EXISTS.
// Both platforms credit the LAST ad clicked. So if ad A warms someone over a week and ad
// B catches the form fill, B takes the credit and A looks like a failure. `judgeSplit`
// then pauses A — and B can get WORSE afterwards, because A was feeding it. Test mode
// silently assumes every ad is a self-contained attempt to convert. That assumption is
// wrong the moment the strategy is multi-touch.
//
//   test   converge on ONE winner. Two ads, prune the loser. Right while you are still
//          finding out which MESSAGE works, and right on a small budget where three
//          under-fed creatives all fail to learn.
//   multi  keep several angles alive on purpose. Never prunes for "worse than its
//          sibling" — only for genuinely DEAD, which means real spend and zero clicks.
//          An assisting ad still gets clicked; it just does not get the credit.
//
// Default is `test`, so existing behaviour is unchanged unless someone opts in.
// Most valuable on Meta. Google search is intent-driven and multi-touch matters far less
// there, but the setting is honoured on both so a combined client cannot behave two ways.
const MULTI_DEAD_MIN_SPEND = 25;   // $ over 30d with ZERO clicks before multi mode kills it
const MULTI_MIN_ADS = 2, MULTI_MAX_ADS = 5;
export const CREATIVE_MODES = {
  test:  { maxAds: 2, pruneLosers: true },
  multi: { maxAds: 3, pruneLosers: false },
};
// Reads the per-client setting into the numbers the blocks below use. `multiTarget` lets
// the owner ask for 2-5 angles; anything outside that is clamped rather than obeyed,
// because "keep 40 creatives alive" is a typo, not an instruction.
// What the challenger was written against, in one line for the owner alert. Names the
// RECENT window separately from live conditions: "written for the storms of the last two
// weeks" and "written for today's heat warning" are different decisions, and an alert that
// blurs them leaves the owner unable to judge whether the bot was right.
const condSummary = (lc) => {
  if (!lc) return "";
  const live = (lc.usable || []).map((a) => a.event);
  const past = (lc.recentUsable || []).filter((a) => a.days >= 3).map((a) => `${a.event} on ${a.days} of the last ${a.window} days`);
  const parts = [];
  if (live.length) parts.push(`current conditions: ${live.join(", ")}`);
  if (past.length) parts.push(`what the area has been through: ${past.slice(0, 3).join("; ")}`);
  return parts.length ? ` Written against ${parts.join(", and ")}.` : "";
};

export const creativeStrategy = (ap = {}) => {
  const mode = CREATIVE_MODES[ap.creativeMode] ? ap.creativeMode : "test";
  const base = CREATIVE_MODES[mode];
  const wanted = Math.round(Number(ap.multiTarget));
  const maxAds = mode === "multi" && Number.isFinite(wanted)
    ? Math.min(MULTI_MAX_ADS, Math.max(MULTI_MIN_ADS, wanted))
    : base.maxAds;
  return { mode, maxAds, pruneLosers: base.pruneLosers };
};

// ── CONDITIONS-TRIGGERED REWRITES ───────────────────────────────────────────
// When the weather in the client's area genuinely turns — monsoon starts, the first
// hard freeze — the ad running is about the wrong thing, and waiting for the normal
// impressions floor wastes the season. So a settled change may write a challenger on
// its own. Two brakes stop that churning live ads:
//   DWELL     the new conditions must HOLD for this long first. An advisory that posts
//             at noon and expires at dusk must never rewrite anything.
//   COOLDOWN  at most one conditions-triggered rewrite per ad group per fortnight.
//             Seasons turn a handful of times a year, not weekly.
// Emergencies are already excluded from the fingerprint, so a wildfire can never be
// the thing that triggers a rewrite.
const CONDITIONS_DWELL_HOURS = 48;
const CONDITIONS_COOLDOWN_HOURS = 336;

// ── The judging maths, extracted so it can be tested directly ───────────────
// Google and Meta run the same test and differ only in which field carries a
// conversion (`conversions` vs `leads`). Pulling it out of both blocks means the
// rule is defined once, and a test exercises the REAL function rather than a copy
// that can drift away from it.
//
// Returns null whenever no decision may be made, and the caller pauses nothing.
// Every one of those exits is a deliberate refusal, not a missing case:
//   - fewer than two ads with enough clicks   -> not enough evidence yet
//   - the lift is inside the noise threshold  -> too close to call
//   - the winner and loser are the same ad    -> nothing to pause
export const judgeSplit = (ads, { minClicks, minLift, convKey = "conversions" }) => {
  const judged = (ads || []).filter((a) => Number(a.clicks || 0) >= minClicks);
  if (judged.length < 2) return null;
  // Conversion rate decides when there are conversions to divide by; click-through
  // only when there are none. Judging on clicks while conversions exist optimises
  // for traffic, which is how you win a test and lose the money.
  const anyConv = judged.some((a) => Number(a[convKey] || 0) > 0);
  const score = (a) => {
    const clicks = Number(a.clicks || 0), imps = Number(a.impressions || 0);
    return anyConv ? (clicks > 0 ? Number(a[convKey] || 0) / clicks : 0)
                   : (imps > 0 ? clicks / imps : 0);
  };
  const ranked = judged.slice().sort((a, b) => score(b) - score(a));
  const win = ranked[0], lose = ranked[ranked.length - 1];
  if (!win || !lose || win.id === lose.id) return null;
  const ws = score(win), ls = score(lose);
  if (!(ls >= 0 && ws > ls * (1 + minLift))) return null;   // inside the noise
  return { win, lose, ws, ls, anyConv, clicks: Number(win.clicks || 0) + Number(lose.clicks || 0) };
};

const monthlyBudgetOf = (cl) => Number(String((cl && cl.adBudget) || "").replace(/[^0-9.]/g, "")) || 0;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
// 🔴 THIS JOB WANTS "SERVING", NOT "SWITCHED ON", AND THAT IS DELIBERATE. It moves money
// between campaigns based on how they are performing, so a campaign that is on but held up in
// review or blocked underneath has no performance to judge and must not be shifted into. The
// snapshot job (`ads-sync`) asks the OTHER question — see `netlify/lib/meta-status.mjs` for
// why one word could not honestly answer both.
const googleLive = googleDelivering;
const metaLive = metaDelivering;

export default withFailureAlert("ads-autopilot", async () => {
  if (String(process.env.ADS_AUTOPILOT || "").toLowerCase() === "off") {
    console.log("ads-autopilot: disabled by ADS_AUTOPILOT=off — no accounts touched.");
    return new Response(JSON.stringify({ ok: true, disabled: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("ads-autopilot aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) {
    console.error("ads-autopilot: clients load failed:", error.message);
    return new Response("db error", { status: 200 });
  }

  const googleConfigured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN
    && process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID);
  const metaConfigured = !!process.env.META_SYSTEM_USER_TOKEN;

  let accessToken = null;
  if (googleConfigured && (rows || []).some((r) => r.data && r.data.googleAdsCustomerId)) {
    try { accessToken = await gadsToken(); }
    catch (e) { console.error("ads-autopilot: Google auth failed:", e && e.message); }
  }

  const now = Date.now();
  let clientsChecked = 0, paused = 0, rebalanced = 0, skipped = 0, failures = 0;
  let splitChallengers = 0, splitWinners = 0;

  for (const row of rows || []) {
    const cl = row.data || {};
    // A Launch & Hand Off client owns their account outright once settle-in is over.
    // Autopilot changing bids or writing challenger ads in it after that is unpaid work
    // inside somebody else's account, which is both a promise BoldLine did not make and
    // one it should not be making silently.
    if (handoffIsFinished(cl)) continue;
    // Live local conditions for this client, fetched at most once per run and only if a
    // challenger ad actually gets written. Declared here so it is per-client, never shared
    // between two clients in different states.
    let localCond = null;
    // Remembered between runs so "these conditions have held for 48h" can actually be
    // known. Without persistence every run would look like a fresh change and nothing
    // would ever settle.
    let conditionsWatch = null;
    const ap = cl.autopilot || {};
    if (ap.enabled === false) { skipped++; continue; }   // per-client opt-out
    const gid = cl.googleAdsCustomerId, mid = cl.metaAdAccountId;
    if (!gid && !mid) continue;

    const monthly = monthlyBudgetOf(cl);
    // No budget on file means no line to pace against. Refusing to act is the
    // right call: guessing a budget is how a bot pauses a healthy campaign.
    if (monthly <= 0) { skipped++; continue; }

    clientsChecked++;
    const who = cl.internal ? "My Ads (BoldLine's own account)" : (cl.name || "A client");
    const recent = Array.isArray(ap.log) ? ap.log : [];
    const onCooldown = (key) => recent.some((a) => a.key === key && (now - new Date(a.at).getTime()) < COOLDOWN_HOURS * 3600e3);
    // Test vs multi-angle, resolved once and honoured identically by both platforms so a
    // combined client cannot behave one way on Google and another on Meta.
    const strat = creativeStrategy(ap);
    // In multi-angle mode an ad is only killed when it is doing NOTHING. An ad that is
    // merely losing may be the one warming people up for the ad that gets the credit.
    const deadCreatives = (ads) => ads.filter((a) =>
      Number(a.spend || 0) >= MULTI_DEAD_MIN_SPEND && Number(a.clicks || 0) === 0);

    // ── gather live campaigns from both platforms ──
    const live = [];
    let readFailed = false;
    if (gid && accessToken) {
      try {
        (await gadsCampaigns(accessToken, gid)).forEach((c) => {
          if (googleLive(c)) live.push({ p: "google", c, key: `g:${c.id}`, spend: Number(c.cost || 0),
            conv: Number(c.conversions || 0), daily: Number(c.dailyBudget || 0) });
        });
      } catch (e) { readFailed = true; console.error(`ads-autopilot: google read failed for ${who}:`, e && e.message); }
    }
    if (mid && metaConfigured) {
      try {
        (await metaCampaigns(mid)).forEach((c) => {
          if (metaLive(c)) live.push({ p: "meta", c, key: `m:${c.id}`, spend: Number(c.spend || 0),
            conv: Number(c.leads || 0), daily: Number(c.dailyBudget || 0) });
        });
      } catch (e) { readFailed = true; console.error(`ads-autopilot: meta read failed for ${who}:`, e && e.message); }
    }
    // A partial read could make a healthy account look like it's overspending on
    // the half we CAN see. Never act on incomplete data.
    if (readFailed) { skipped++; continue; }
    if (!live.length) continue;

    const actions = [];
    const doPause = async (t, reason) => {
      if (t.p === "google") await gadsSetStatus(accessToken, gid, t.c.campaignResourceName, "PAUSED");
      else await metaSetStatus(t.c.id, "PAUSED");
      actions.push({ key: t.key, at: new Date().toISOString(), action: "pause", name: t.c.name, platform: t.p, reason });
    };

    // ── 1. DEAD SPEND: real money, zero conversions, still running ──
    // GATE: if the ENTIRE account has never recorded a single conversion in the
    // window, we cannot tell "the ads aren't working" from "conversion tracking
    // was never set up" — and those need opposite responses. Pausing on the
    // second one would kill a campaign that is actually producing booked calls.
    // So: no proof of tracking, no dead-spend pausing. Tell him instead, once.
    const trackingProven = live.some((t) => t.conv > 0);
    const spentReal = sum(live, (t) => t.spend) >= Math.max(DEAD_MIN_SPEND, monthly * DEAD_MIN_SHARE);
    if (!trackingProven && spentReal && !onCooldown("tracking-warning")) {
      await dispatchAlert({
        title: `No conversions are being tracked for ${who}`,
        body: `${who} has spent $${round2(sum(live, (t) => t.spend))} over 30 days and the ad platform has recorded ZERO conversions across every campaign.\n\nThat usually means conversion tracking was never wired up, not that the ads failed — a booked call or a form fill that the platform never hears about looks identical to no leads at all.\n\nAutopilot will NOT pause anything for zero conversions until at least one is recorded, because it cannot tell the two apart. Check the conversion setup, then this rule protects you properly.`,
        severity: "yellow",
        smsText: `BoldLine: ${who} has spend but ZERO tracked conversions — conversion tracking is probably not set up. Autopilot is holding off on dead-spend pauses.`,
      });
      actions.push({ key: "tracking-warning", at: new Date().toISOString(), action: "notice",
        name: "Conversion tracking", platform: "n/a", reason: "spend recorded with zero conversions account-wide — tracking looks unconfigured" });
    }

    const deadFloor = Math.max(DEAD_MIN_SPEND, monthly * DEAD_MIN_SHARE);
    for (const t of (trackingProven ? live : [])) {
      if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
      if (t.conv > 0 || t.spend < deadFloor || onCooldown(t.key)) continue;
      try {
        await doPause(t, `spent $${round2(t.spend)} over 30 days with zero conversions (floor $${round2(deadFloor)})`);
        paused++;
      } catch (e) { failures++; console.error(`ads-autopilot: pause failed (${t.c.name}):`, e && e.message); }
    }

    // ── 2. OVERSPEND: pacing above budget by the trip margin ──
    const stillLive = () => live.filter((t) => !actions.some((a) => a.key === t.key));
    let projected = round2(sum(stillLive(), (t) => t.daily) * DAYS_PER_MONTH);
    const actual30 = round2(sum(live, (t) => t.spend));
    const pacing = Math.max(projected, actual30);

    if (monthly > 0 && pacing > monthly * TRIP_MARGIN) {
      // Pause the biggest spenders first — the fastest way back under the line
      // with the fewest campaigns stopped.
      const order = stillLive().slice().sort((a, b) => (b.daily || b.spend) - (a.daily || a.spend));
      for (const t of order) {
        if (projected <= monthly * TARGET_AFTER_PAUSE) break;
        if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
        if (onCooldown(t.key)) continue;
        try {
          await doPause(t, `account pacing $${round2(pacing)}/mo against a $${monthly} budget`);
          paused++;
          projected = round2(sum(stillLive(), (x) => x.daily) * DAYS_PER_MONTH);
        } catch (e) { failures++; console.error(`ads-autopilot: pause failed (${t.c.name}):`, e && e.message); }
      }
    }

    // ── 3. REBALANCE (opt-in; OFF unless explicitly turned on per client) ──
    // Deliberately default-off: with no conversion history the "best" and "worst"
    // campaigns are noise, and moving budget on noise is worse than doing nothing.
    if (ap.rebalance === true && actions.length < MAX_ACTIONS_PER_CLIENT) {
      const scored = stillLive().filter((t) => t.daily > 0 && t.spend > 0);
      const withConv = scored.filter((t) => t.conv > 0);
      if (withConv.length >= 1 && scored.length >= 2) {
        const cpa = (t) => (t.conv > 0 ? t.spend / t.conv : Infinity);
        const best = withConv.slice().sort((a, b) => cpa(a) - cpa(b))[0];
        const worst = scored.slice().sort((a, b) => cpa(b) - cpa(a))[0];
        if (best && worst && best.key !== worst.key && !onCooldown(worst.key) && !onCooldown(best.key)) {
          const shift = round2(worst.daily * REBALANCE_MAX_SHIFT);
          const newWorst = round2(worst.daily - shift), newBest = round2(best.daily + shift);
          // Belt and braces: the account total must not rise, even by a rounding cent.
          if (shift > 0 && newWorst > 0 && round2(newWorst + newBest) <= round2(worst.daily + best.daily)) {
            try {
              if (worst.p === "google") await gadsSetBudget(accessToken, gid, worst.c.budgetResourceName, newWorst);
              else await metaSetBudget(worst.c.id, newWorst);
              if (best.p === "google") await gadsSetBudget(accessToken, gid, best.c.budgetResourceName, newBest);
              else await metaSetBudget(best.c.id, newBest);
              actions.push({ key: worst.key, at: new Date().toISOString(), action: "rebalance", name: worst.c.name,
                platform: worst.p, reason: `moved $${shift}/day to "${best.c.name}" (better cost per conversion); account total unchanged` });
              rebalanced++;
            } catch (e) { failures++; console.error("ads-autopilot: rebalance failed:", e && e.message); }
          }
        }
      }
    }

    // ── SPLIT TESTING ────────────────────────────────────────────────────────
    // Two halves, both bounded: write a CHALLENGER into an ad group that only has
    // one ad and enough traffic to judge, and PAUSE THE LOSER once two ads have
    // each had a fair run. Budget is never touched, so the invariant holds.
    // Opt-out per client with autopilot.splitTest === false.
    if (ap.splitTest !== false && gid && accessToken && actions.length < MAX_ACTIONS_PER_CLIENT) {
      const liveGoogle = stillLive().filter((t) => t.p === "google");
      // Read the conditions once for this client, then decide whether they have SETTLED.
      // `since` is when this exact fingerprint was first seen; it only resets when the
      // fingerprint actually changes, so a flapping advisory never accumulates dwell.
      if (!localCond) {
        localCond = await getLocalConditions({
          locations: (cl.campaignSetup && cl.campaignSetup.targetLocations) || "",
        });
      }
      const condFp = conditionsFingerprint(localCond.summary, localCond.recentSummary);
      const watchPrev = (ap.conditionsWatch && ap.conditionsWatch.fp === condFp) ? ap.conditionsWatch : null;
      conditionsWatch = { fp: condFp, since: watchPrev ? watchPrev.since : new Date().toISOString() };
      const condSettled = (now - new Date(conditionsWatch.since).getTime()) >= CONDITIONS_DWELL_HOURS * 3600e3;

      for (const t of liveGoogle) {
        if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
        let detail;
        try { detail = await gadsDetail(accessToken, gid, t.c.id); }
        catch (e) { failures++; console.error("ads-autopilot: split read failed:", e && e.message); continue; }

        for (const g of (detail.adGroups || [])) {
          if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
          if (String(g.status || "").toUpperCase() !== "ENABLED") continue;
          const splitKey = `split:${g.id}`;
          if (recent.some((a) => a.key === splitKey && (now - new Date(a.at).getTime()) < SPLIT_COOLDOWN_HOURS * 3600e3)) continue;
          const runningAds = (g.ads || []).filter((a) => String(a.status || "").toUpperCase() === "ENABLED");

          // ── Multi-angle: kill only what is genuinely dead ───────────────────
          if (!strat.pruneLosers && runningAds.length >= 2) {
            const dead = deadCreatives(runningAds)[0];
            if (dead) {
              try {
                await gadsSetAdStatus(accessToken, gid, dead.resourceName, "PAUSED");
                actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-dead",
                  name: `${t.c.name} / ${g.name}`, platform: "google",
                  reason: `paused an ad that spent $${round2(dead.spend)} and got zero clicks. Multi-angle mode keeps losing ads running on purpose, because a losing ad may be the one warming people up, but an ad nobody clicks at all is not warming anyone. Budget unchanged.` });
                splitWinners++;
              } catch (e) { failures++; console.error("ads-autopilot: pause dead ad failed:", e && e.message); }
              continue;
            }
          }

          // ── Declare a winner (TEST MODE ONLY) ───────────────────────────────
          if (strat.pruneLosers && runningAds.length >= 2) {
            const verdict = judgeSplit(runningAds, {
              minClicks: SPLIT_MIN_CLICKS_EACH, minLift: SPLIT_MIN_LIFT, convKey: "conversions" });
            if (!verdict) continue;
            const { win, lose, ws, ls, anyConv } = verdict;
            try {
              await gadsSetAdStatus(accessToken, gid, lose.resourceName, "PAUSED");
              actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-winner",
                name: `${t.c.name} / ${g.name}`, platform: "google",
                reason: `paused the losing ad variant. Winner ${anyConv ? `converted at ${(ws * 100).toFixed(1)}%` : `had a ${(ws * 100).toFixed(2)}% CTR`} vs ${anyConv ? `${(ls * 100).toFixed(1)}%` : `${(ls * 100).toFixed(2)}%`} over ${verdict.clicks} clicks. Budget unchanged.` });
              splitWinners++;
            } catch (e) { failures++; console.error("ads-autopilot: pause loser failed:", e && e.message); }
            continue;
          }

          // ── Write a challenger ──────────────────────────────────────────────
          // Needs a champion to write AGAINST, and a free slot. In multi-angle mode
          // there are several slots, filled one per cooldown rather than all at once.
          if (runningAds.length < 1 || runningAds.length >= strat.maxAds) continue;

          // Two independent reasons to write a challenger.
          //  1. ENOUGH TRAFFIC — the normal case: the group has earned a real test.
          //  2. CONDITIONS TURNED — the season changed under a still-running ad. This
          //     one deliberately IGNORES the impressions floor, because relevance is
          //     not a question of sample size: if it is 115F and the ad talks about
          //     spring tune-ups, that ad is wrong whether or not anyone has seen it.
          const enoughTraffic = g.impressions >= SPLIT_MIN_IMPRESSIONS;
          const lastCondAction = recent
            .filter((a) => a.key === splitKey && a.conditions)
            .sort((x, y) => new Date(y.at) - new Date(x.at))[0];
          const condChanged = condSettled
            && condFp !== "none"
            && (!lastCondAction || lastCondAction.conditions !== condFp)
            && (!lastCondAction || (now - new Date(lastCondAction.at).getTime()) >= CONDITIONS_COOLDOWN_HOURS * 3600e3);
          if (!enoughTraffic && !condChanged) continue;

          const champion = runningAds[0];
          const finalUrl = (champion.finalUrls || [])[0];
          if (!finalUrl) continue;
          try {
            const { data } = await runTool({
              tool: TOOL_FOR.google, maxTokens: MAX_TOKENS_FOR.google, system: systemFor(!!cl.internal),
              prompt: `Write ONE challenger responsive search ad to split test against the ad currently running.

THE AD GROUP: "${g.name}" in campaign "${t.c.name}".
Its keywords: ${(g.keywords || []).slice(0, 12).map((k) => k.text).join(", ") || "unknown"}.

THE AD RUNNING NOW (this is what you must BEAT, so do not rewrite it):
Headlines: ${(champion.headlines || []).join(" | ")}
Descriptions: ${(champion.descriptions || []).join(" | ")}

Take a genuinely DIFFERENT angle. If the current ad leads on speed, try trust or price clarity. If it leads on the service, try the problem. A reworded version of the same idea teaches nothing and wastes the test.

WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW:
${localCond.block}

If the conditions above genuinely drive demand for this business, that is a strong angle for the challenger, and one the ad running now is probably missing. If they do not, ignore them and win on something else.

Return exactly ONE ad group named "${g.name}" carrying exactly 15 headlines at 30 characters or fewer and 4 descriptions at 90 characters or fewer. Reuse the same keywords, they are not being changed.`,
            });
            const cleaned = cleanGoogle(data);
            const cand = (cleaned.adGroups || [])[0];
            if (!cand || cand.headlines.length < 3 || cand.descriptions.length < 2) continue;
            await gadsAddAd(accessToken, gid, g.resourceName, {
              headlines: cand.headlines, descriptions: cand.descriptions, finalUrl, status: "ENABLED",
            });
            const condNote = condSummary(localCond);
            const why = condChanged && !enoughTraffic
              ? `local conditions changed and held for ${CONDITIONS_DWELL_HOURS}h, so the ad running was written for different weather`
              : `added a second ad to split test against the one running (${g.impressions} impressions so far)`;
            actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-challenger",
              name: `${t.c.name} / ${g.name}`, platform: "google",
              conditions: condFp, trigger: condChanged && !enoughTraffic ? "conditions" : "traffic",
              reason: `${why}. Same budget, different creative.${condNote}` });
            splitChallengers++;
          } catch (e) { failures++; console.error("ads-autopilot: challenger failed:", e && e.message); }
        }
      }
    }

    // ── 5. META CREATIVE TESTING ────────────────────────────────────────────
    // Same shape as the Google block above, one level down: ads inside an AD SET.
    // Budget is never touched, so the invariant holds.
    // META-TIER-GATE: `cl.internal` is the Development-tier restriction. Delete it at
    // standard access and this covers every client unchanged.
    if (ap.splitTest !== false && mid && cl.internal && actions.length < MAX_ACTIONS_PER_CLIENT) {
      const liveMeta = stillLive().filter((t) => t.p === "meta");
      for (const t of liveMeta) {
        if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
        let ads;
        try { ads = await metaAds(mid, t.c.id); }
        catch (e) { failures++; console.error("ads-autopilot: meta ad read failed:", e && e.message); continue; }

        // Group by ad set: a test is between ads competing for the SAME money.
        const bySet = new Map();
        for (const ad of ads) {
          if (!ad.adsetId) continue;
          if (!bySet.has(ad.adsetId)) bySet.set(ad.adsetId, []);
          bySet.get(ad.adsetId).push(ad);
        }

        for (const [adsetId, setAds] of bySet) {
          if (actions.length >= MAX_ACTIONS_PER_CLIENT) break;
          const splitKey = `msplit:${adsetId}`;
          if (recent.some((a) => a.key === splitKey && (now - new Date(a.at).getTime()) < META_SPLIT_COOLDOWN_HOURS * 3600e3)) continue;
          const runningAds = setAds.filter((a) => String(a.effectiveStatus || a.status || "").toUpperCase() === "ACTIVE");

          // ── Multi-angle: kill only what is genuinely dead ───────────────────
          if (!strat.pruneLosers && runningAds.length >= 2) {
            const dead = deadCreatives(runningAds)[0];
            if (dead) {
              try {
                await metaSetAdStatus(dead.id, "PAUSED");
                actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-dead",
                  name: `${t.c.name} / ad set ${adsetId}`, platform: "meta",
                  reason: `paused a creative that spent $${round2(dead.spend)} and got zero clicks. Multi-angle mode keeps losing creatives running on purpose, because a losing creative may be the one building awareness, but one nobody clicks at all is not building anything. Budget unchanged.` });
                splitWinners++;
              } catch (e) { failures++; console.error("ads-autopilot: meta pause dead ad failed:", e && e.message); }
              continue;
            }
          }

          // ── Declare a winner (TEST MODE ONLY) ───────────────────────────────
          if (strat.pruneLosers && runningAds.length >= 2) {
            const verdict = judgeSplit(runningAds, {
              minClicks: META_SPLIT_MIN_CLICKS_EACH, minLift: META_SPLIT_MIN_LIFT, convKey: "leads" });
            if (!verdict) continue;
            const { win, lose, ws, ls, anyConv: anyLead } = verdict;
            try {
              await metaSetAdStatus(lose.id, "PAUSED");
              actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-winner",
                name: `${t.c.name} / ad set ${adsetId}`, platform: "meta",
                reason: `paused the losing Meta creative. Winner ${anyLead ? `converted at ${(ws * 100).toFixed(1)}%` : `had a ${(ws * 100).toFixed(2)}% click rate`} vs ${anyLead ? `${(ls * 100).toFixed(1)}%` : `${(ls * 100).toFixed(2)}%`} over ${verdict.clicks} clicks. Budget unchanged.` });
              splitWinners++;
            } catch (e) { failures++; console.error("ads-autopilot: meta pause loser failed:", e && e.message); }
            continue;
          }

          // ── Write a challenger ──────────────────────────────────────────────
          if (runningAds.length < 1 || runningAds.length >= strat.maxAds) continue;
          // Write against the NEWEST running creative: in multi-angle mode the set already
          // holds several angles, and beating the oldest one teaches least.
          const champion = runningAds[runningAds.length - 1];
          const setImpressions = sum(setAds, (a) => a.impressions);
          if (setImpressions < META_SPLIT_MIN_IMPRESSIONS) continue;
          // An ad built by hand in Ads Manager may carry none of what a challenger needs.
          // Skipping is the honest outcome: inventing a page id or a link would post an
          // ad pointing somewhere nobody chose.
          if (!champion.pageId || !champion.linkUrl || !champion.imageHash) continue;

          if (!localCond) {
            localCond = await getLocalConditions({
              locations: (cl.campaignSetup && cl.campaignSetup.targetLocations) || "",
            });
          }
          try {
            const { data } = await runTool({
              tool: TOOL_FOR.meta, maxTokens: MAX_TOKENS_FOR.meta, system: systemFor(!!cl.internal),
              prompt: `Write ONE challenger Meta ad to split test against the ad currently running.

THE CAMPAIGN: "${t.c.name}".

THE AD RUNNING NOW (this is what you must BEAT, so do not rewrite it):
Headline: ${champion.headline}
Primary text: ${champion.primaryText}
Description: ${champion.description}

Take a genuinely DIFFERENT angle and a different awareness stage. If the current ad speaks to someone who already knows they need this, speak to someone who has not realised it yet. If it leads on the offer, lead on the problem. A reworded version of the same idea teaches nothing and wastes the test.

The picture is NOT changing, only the words, so the copy has to carry the difference on its own.

WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW:
${localCond.block}

If the conditions above genuinely drive demand for this business, that is a strong angle, and one the ad running now is probably missing. If they do not, ignore them and win on something else.

Return exactly ONE variant.`,
            });
            const cand = cleanMeta(data)[0];
            if (!cand || !cand.headline || !cand.primaryText) continue;
            await metaAddAd(mid, {
              adsetId,
              pageId: champion.pageId,
              linkUrl: champion.linkUrl,
              imageHash: champion.imageHash,          // held constant on purpose
              ctaType: champion.ctaType || "LEARN_MORE",
              // cleanMeta already ran stripDashes over all three, which is the em-dash
              // rule (KB ad-copy-voice) enforced in code rather than trusted to a prompt.
              headline: cand.headline,
              primaryText: cand.primaryText,
              description: cand.description,
              name: `Challenger ${new Date().toISOString().slice(0, 10)}`,
              status: "ACTIVE",
            });
            const condNote = condSummary(localCond);
            actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-challenger",
              name: `${t.c.name} / ad set ${adsetId}`, platform: "meta",
              conditions: conditionsFingerprint(localCond.summary, localCond.recentSummary), trigger: "traffic",
              reason: `added a second Meta creative to split test against the one running (${setImpressions} impressions so far). Same picture, different words, same budget.${condNote}` });
            splitChallengers++;
          } catch (e) { failures++; console.error("ads-autopilot: meta challenger failed:", e && e.message); }
        }
      }
    }

    // ── persist + tell the owner ──
    // 🔴 THE WATCH MUST BE SAVED EVEN ON A QUIET RUN. It was originally written inside
    // `if (actions.length)`, which meant that on any day autopilot did nothing — most
    // days — the fingerprint's `since` reset to now on the next run, dwell never
    // accumulated past a single day, and the conditions trigger could never fire.
    const watchChanged = !!conditionsWatch && (!ap.conditionsWatch
      || ap.conditionsWatch.fp !== conditionsWatch.fp
      || ap.conditionsWatch.since !== conditionsWatch.since);

    if (actions.length || watchChanged) {
      const log = actions.length ? actions.concat(recent).slice(0, 60) : recent;
      // Persist BEFORE the early-continue below, so a notice records its cooldown.
      await supabase.from("clients")
        .update({ data: { ...cl, autopilot: { ...ap, log,
          ...(actions.length ? { lastRun: new Date().toISOString() } : {}),
          ...(conditionsWatch ? { conditionsWatch } : {}) } }, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    if (actions.length) {
      const changed = actions.filter((a) => a.action !== "notice");
      if (!changed.length) {
        // Notice-only run: the alert already went out above; just persist and move on.
        console.log(`ads-autopilot: ${who} — notice only, no campaign changed.`);
        continue;
      }
      const VERB = { pause: "PAUSED", rebalance: "REBALANCED", "split-challenger": "SPLIT TEST STARTED", "split-winner": "SPLIT TEST DECIDED" };
      const lines = changed.map((a) => `${VERB[a.action] || a.action.toUpperCase()} — ${a.name} (${a.platform === "google" ? "Google" : "Meta"})\n  ${a.reason}`);
      await dispatchAlert({
        title: `Autopilot acted on ${who}`,
        body: `Autopilot made ${changed.length} change${changed.length > 1 ? "s" : ""}:\n\n${lines.join("\n\n")}\n\nNo budget was increased and no campaign was started. Split tests only change which creative the existing spend buys. Review it in BoldLine OS → Campaigns.`,
        severity: changed.some((a) => a.action === "pause") ? "red" : changed.every((a) => String(a.action).startsWith("split")) ? "blue" : "yellow",
        smsText: `BoldLine Autopilot: ${changed.length} change(s) on ${who} — ${changed[0].action === "pause" ? "paused " + changed[0].name : changed[0].action === "split-challenger" ? "started a split test on " + changed[0].name : changed[0].action === "split-winner" ? "picked a split-test winner on " + changed[0].name : "rebalanced budget"}.`.slice(0, 300),
      });
    }
  }

  console.log(`ads-autopilot: checked ${clientsChecked} account(s) — ${paused} paused, ${rebalanced} rebalanced, ${splitChallengers} split test(s) started, ${splitWinners} decided, ${skipped} skipped, ${failures} failed.`);
  return new Response(JSON.stringify({ ok: true, clientsChecked, paused, rebalanced, splitChallengers, splitWinners, skipped, failures }), {
    status: 200, headers: { "content-type": "application/json" },
  });
});
