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
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import { getCampaigns as metaCampaigns, setStatus as metaSetStatus, setBudget as metaSetBudget } from "./meta-ads.mjs";
import {
  getAccessToken as gadsToken, getCampaigns as gadsCampaigns,
  setStatus as gadsSetStatus, setBudget as gadsSetBudget,
} from "./google-ads.mjs";

const DAYS_PER_MONTH = 30.4;

// ── The dials. Deliberately conservative; every one can only reduce spend. ────
const TRIP_MARGIN = 1.30;      // pause only once pacing is 30% over budget
const TARGET_AFTER_PAUSE = 1.0;// pause down to roughly the budget line, not below
const DEAD_MIN_SPEND = 150;    // $ over 30d with zero conversions before we act…
const DEAD_MIN_SHARE = 0.25;   // …or 25% of the monthly budget, whichever is higher
const COOLDOWN_HOURS = 24;     // never touch the same campaign twice in a day
const REBALANCE_MAX_SHIFT = 0.15; // ±15% of a campaign's daily budget, per run
const MAX_ACTIONS_PER_CLIENT = 4;  // a blast radius cap, whatever the maths says

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

  for (const row of rows || []) {
    const cl = row.data || {};
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
    const deadFloor = Math.max(DEAD_MIN_SPEND, monthly * DEAD_MIN_SHARE);
    for (const t of live) {
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

    // ── persist + tell the owner ──
    if (actions.length) {
      const log = actions.concat(recent).slice(0, 60);
      await supabase.from("clients")
        .update({ data: { ...cl, autopilot: { ...ap, log, lastRun: new Date().toISOString() } }, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      const lines = actions.map((a) => `${a.action === "pause" ? "PAUSED" : "REBALANCED"} — ${a.name} (${a.platform === "google" ? "Google" : "Meta"})\n  ${a.reason}`);
      await dispatchAlert({
        title: `Autopilot acted on ${who}`,
        body: `Autopilot made ${actions.length} change${actions.length > 1 ? "s" : ""} to protect the budget:\n\n${lines.join("\n\n")}\n\nNothing was started and no budget was increased. Review it in BoldLine OS → Campaigns.`,
        severity: actions.some((a) => a.action === "pause") ? "red" : "yellow",
        smsText: `BoldLine Autopilot: ${actions.length} change(s) on ${who} — ${actions[0].action === "pause" ? "paused " + actions[0].name : "rebalanced budget"}.`.slice(0, 300),
      });
    }
  }

  console.log(`ads-autopilot: checked ${clientsChecked} account(s) — ${paused} paused, ${rebalanced} rebalanced, ${skipped} skipped, ${failures} failed.`);
  return new Response(JSON.stringify({ ok: true, clientsChecked, paused, rebalanced, skipped, failures }), {
    status: 200, headers: { "content-type": "application/json" },
  });
});
