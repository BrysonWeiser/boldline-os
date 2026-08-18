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
import { getCampaigns as metaCampaigns, setStatus as metaSetStatus, setBudget as metaSetBudget } from "./meta-ads.mjs";
import {
  getAccessToken as gadsToken, getCampaigns as gadsCampaigns,
  setStatus as gadsSetStatus, setBudget as gadsSetBudget,
  getCampaignDetail as gadsDetail, addResponsiveSearchAd as gadsAddAd, setAdStatus as gadsSetAdStatus,
} from "./google-ads.mjs";
import { runTool, TOOL_FOR, MAX_TOKENS_FOR, systemFor, cleanGoogle } from "../lib/ad-gen-shared.mjs";
import { getLocalConditions, conditionsFingerprint } from "../lib/local-conditions.mjs";

const DAYS_PER_MONTH = 30.4;

// ── The dials. Deliberately conservative; every one can only reduce spend. ────
const TRIP_MARGIN = 1.30;      // pause only once pacing is 30% over budget
const TARGET_AFTER_PAUSE = 1.0;// pause down to roughly the budget line, not below
const DEAD_MIN_SPEND = 150;    // $ over 30d with zero conversions before we act…
const DEAD_MIN_SHARE = 0.25;   // …or 25% of the monthly budget, whichever is higher
const COOLDOWN_HOURS = 24;     // never touch the same campaign twice in a day
const REBALANCE_MAX_SHIFT = 0.15; // ±15% of a campaign's daily budget, per run
const MAX_ACTIONS_PER_CLIENT = 4;  // a blast radius cap, whatever the maths says

// ── SPLIT TESTING (Google only; Meta creative testing is a separate job) ─────
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
const SPLIT_MAX_ADS_PER_GROUP = 2;   // one challenger at a time, never a pile
const SPLIT_COOLDOWN_HOURS = 168;    // one split action per ad group per week

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

const monthlyBudgetOf = (cl) => Number(String((cl && cl.adBudget) || "").replace(/[^0-9.]/g, "")) || 0;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const googleLive = (c) => String(c.status || "").toUpperCase() === "ENABLED";
const metaLive = (c) => String(c.effectiveStatus || c.status || "").toUpperCase() === "ACTIVE";

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
      const condFp = conditionsFingerprint(localCond.summary);
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

          // ── Declare a winner ────────────────────────────────────────────────
          if (runningAds.length >= 2) {
            const judged = runningAds.filter((a) => a.clicks >= SPLIT_MIN_CLICKS_EACH);
            if (judged.length < 2) continue;
            // Conversion rate decides when there are conversions to divide by;
            // CTR only when there are none. Judging on CTR while conversions exist
            // optimises for clicks, which is how you win a test and lose the money.
            const anyConv = judged.some((a) => a.conversions > 0);
            const score = (a) => (anyConv ? (a.clicks > 0 ? a.conversions / a.clicks : 0)
                                          : (a.impressions > 0 ? a.clicks / a.impressions : 0));
            const ranked = judged.slice().sort((a, b) => score(b) - score(a));
            const win = ranked[0], lose = ranked[ranked.length - 1];
            if (!win || !lose || win.id === lose.id) continue;
            const ls = score(lose), ws = score(win);
            if (!(ls >= 0 && ws > ls * (1 + SPLIT_MIN_LIFT))) continue;  // too close to call
            try {
              await gadsSetAdStatus(accessToken, gid, lose.resourceName, "PAUSED");
              actions.push({ key: splitKey, at: new Date().toISOString(), action: "split-winner",
                name: `${t.c.name} / ${g.name}`, platform: "google",
                reason: `paused the losing ad variant. Winner ${anyConv ? `converted at ${(ws * 100).toFixed(1)}%` : `had a ${(ws * 100).toFixed(2)}% CTR`} vs ${anyConv ? `${(ls * 100).toFixed(1)}%` : `${(ls * 100).toFixed(2)}%`} over ${win.clicks + lose.clicks} clicks. Budget unchanged.` });
              splitWinners++;
            } catch (e) { failures++; console.error("ads-autopilot: pause loser failed:", e && e.message); }
            continue;
          }

          // ── Write a challenger ──────────────────────────────────────────────
          if (runningAds.length !== 1) continue;
          if (runningAds.length >= SPLIT_MAX_ADS_PER_GROUP) continue;

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
            const condNote = localCond.usable.length
              ? ` Written against current conditions: ${localCond.usable.map((a) => a.event).join(", ")}.`
              : "";
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
