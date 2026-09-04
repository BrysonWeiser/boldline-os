// Scheduled live ad-performance sync for BoldLine OS.
//
// Closes the gap flagged in alerts-watch.mjs: every "is this campaign
// overspending?" check until now used STORED proxies (cpl, lead counts) because
// nothing ever pulled live spend from the ad platforms on a schedule. The ad APIs
// were only ever touched when Bryson clicked something in the OS.
//
// What it does, every run, for EVERY client with a linked ad account (the
// internal "My Ads" house account very much included):
//   1. reads live campaigns + last-30-day metrics from Google Ads and/or Meta,
//   2. stores a snapshot on the client record at `data.adPerf` so the OS can show
//      real spend without making the user wait on a live API call,
//   3. compares projected + actual monthly spend against the client's set monthly
//      budget and fires a RED owner alert the first time it goes over,
//   4. fires a YELLOW alert the first time a linked account stops reading at all
//      (dead token, revoked access, API version sunset) — the failure mode that
//      previously stayed invisible until someone happened to open the tab.
//
// SECOND, DELIBERATE PURPOSE (2026-08-12): Meta rejected BoldLine's Marketing API
// Standard-tier request for "not a sufficient number of Ads API calls in the last
// 15 days". That was accurate — no scheduled job called Meta at all. This job is
// the honest fix: a real product feature (budget pacing needs current spend) that
// also produces the continuous, genuine API traffic the tier request requires.
// See KB meta-marketing-api.
//
// Reads only. It never creates, pauses, or re-budgets anything — every write in
// the OS still goes through the human approval path.
//
// Env: SUPABASE_SERVICE_ROLE_KEY, plus whichever platform's credentials exist.
// A platform with no credentials is skipped silently; a client with no linked
// account is skipped entirely (no read, no write).

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import { liveStats, PER_LEAD } from "../lib/report-shared.mjs";
import { getCampaigns as metaCampaigns } from "./meta-ads.mjs";
import { getAccessToken as gadsToken, getCampaigns as gadsCampaigns } from "./google-ads.mjs";
import { metaOn, metaDelivering, googleOn, googleDelivering } from "../lib/meta-status.mjs";

const DAYS_PER_MONTH = 30.4; // matches MyAdsInsights in index.html
const OVER_BUDGET_GRACE = 1.05; // 5% headroom before "over budget" trips

// Mirrors index.html's parse EXACTLY (`Number(String(adBudget).replace(/[^0-9.]/g,""))`).
// Deliberate: if this job read the budget differently from the screen, the alert
// and the dashboard would disagree about the same client.
const monthlyBudgetOf = (cl) => Number(String((cl && cl.adBudget) || "").replace(/[^0-9.]/g, "")) || 0;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

// 🔴 "SWITCHED ON" AND "SERVING RIGHT NOW" ARE TWO QUESTIONS, AND THIS FILE USED TO ANSWER
// ONLY THE SECOND ONE — under the name `live`. So a Meta campaign that was on, had been seen
// 786 times and had spent real money was stored as NOT live the moment Meta reported a
// transient `IN_PROCESS` (which is what it reports while applying a budget change made from
// the OS). My Ads then described it as "not running, so it has not been seen by anyone and has
// spent nothing". Both halves false, from one word meaning two things. Reasoning in
// `netlify/lib/meta-status.mjs`; both answers are now stored per campaign. (`metaOn`,
// `metaDelivering`, `googleOn` and `googleDelivering` are imported at the top of this file.)

// ─── WHEN IS "SPEND MORE" THE RIGHT ADVICE ───────────────────────────────────
// Bryson, 2026-08-24: "for my own ads when it thinks we should scale i want to get an
// alert prompting me to either scale or keep it as is".
//
// This is the one direction the autopilot is forbidden to move on its own — it may
// always spend LESS, and may NEVER spend more without asking. So this ASKS, through the
// same approval queue that already executes a guarded budget change on both platforms.
// No new execution path was written for it; the safest possible route to real money is
// the one a person already has to press.
//
// 🔴 THE CONDITION MOST ADVICE GETS WRONG IS THE BUDGET-LIMITED ONE. Raising a budget
// that is not being spent changes NOTHING. If an account is spending $120 of a $213
// budget, the constraint is targeting, creative or bid, and a bigger number just sits
// there unused while looking like action was taken. So this only fires when the money is
// actually running out, which is the only state where more of it buys more.
//
// Four things must all be true, and each is observable:
//   1. something is live,
//   2. there are enough leads for a cost per lead to mean anything (one lucky lead is
//      not evidence),
//   3. spend is pressed up against the budget, and
//   4. the cost per lead is at or under the target the rest of the OS already uses.
const SCALE_MIN_LEADS = 3;
// A step, not a leap. Doubling a budget usually restarts the platform's learning and
// makes performance worse for a fortnight, which is the opposite of scaling.
const SCALE_STEP = 1.25;

function scaleCheck(cl, adPerf, liveCampaigns) {
  const t = adPerf.totals || {}, b = adPerf.budget || {};
  const live = liveStats(cl);
  const target = PER_LEAD[cl.niche] || 75;
  // Deliberately NOT fired when already over budget. The red over-budget alert covers
  // that case, and two alerts saying opposite things about the same account is worse
  // than one. "warn" is the 85% to 105% band: pressed against the cap, not past it.
  const budgetLimited = b.state === "warn";
  const ready = Number(t.liveCampaigns || 0) > 0
    && live.leads30 >= SCALE_MIN_LEADS
    && live.cpl != null && live.cpl <= target
    && budgetLimited;
  if (!ready) return { ready: false };

  // Only offer a one-click change when there is exactly ONE live campaign to change.
  // With several, picking one for him would be a guess about his own strategy, so the
  // alert still goes out and he chooses where the money goes.
  const only = liveCampaigns.length === 1 ? liveCampaigns[0] : null;
  const curDaily = only ? Number(only.dailyBudget || 0) : 0;
  const newDaily = curDaily > 0 ? Math.max(curDaily + 1, Math.round(curDaily * SCALE_STEP)) : 0;
  return {
    ready: true, target, cpl: live.cpl, leads30: live.leads30,
    spend30: Number(t.spend30d || 0), pct: b.pct,
    campaign: only && newDaily > 0 ? { ...only, curDaily, newDaily } : null,
  };
}

// 🔴 EVERY CAMPAIGN, NOT ONLY THE LIVE ONES. Bryson, 2026-09-04: *"when I press my ads it
// only shows one ads statistics and I can't change it"*, right after asking why a campaign he
// had just built *"isn't doing anything"*.
//
// Both questions had the same root. The snapshot kept only `liveList`, so a campaign created
// PAUSED — which is EVERY campaign this OS builds, deliberately, because nothing may spend
// before he approves it — appeared **nowhere at all**. Not as paused, not as zero. Nowhere.
// So the newest campaign was invisible on the one screen he checks, and the card above it
// showed account-wide totals that had not moved, which reads exactly like a broken campaign
// rather than one waiting on a press.
//
// Trimmed to the fields a row needs and capped, because this is stored on the client record
// and an account with hundreds of old campaigns should not bloat every read of it.
const CAMPAIGN_LIST_CAP = 50;
const trimCampaign = (c, spendKey) => ({
  id: c.id,
  name: c.name,
  status: c.status,
  ...(c.effectiveStatus ? { effectiveStatus: c.effectiveStatus } : {}),
  ...(c.campaignResourceName ? { campaignResourceName: c.campaignResourceName } : {}),
  dailyBudget: Number(c.dailyBudget || 0),
  impressions: Number(c.impressions || 0),
  clicks: Number(c.clicks || 0),
  spend: round2(Number(c[spendKey] || 0)),
  conversions: round2(Number((spendKey === "cost" ? c.conversions : c.leads) || 0)),
});

// Roll a platform's campaign array into the numbers the pacing check needs.
//
// 🔴 `isLive` IS THE SWITCH AND `isDelivering` IS WHETHER IT IS SERVING. Both are stored per
// campaign, because collapsing them is what let a running campaign be described as never
// having run. `liveList` and the pacing maths deliberately use the SWITCH: a campaign that is
// on but held up in review still has that money committed to it, and will spend it the moment
// Meta lets it through.
function summarize(campaigns, isLive, isDelivering, spendKey) {
  const live = campaigns.filter(isLive);
  return {
    ok: true,
    // Kept so the scale check can name the one campaign a budget change would land on.
    liveList: live,
    // 🔴 Every campaign, live or paused, so the OS can show one row per campaign. Ordered
    // live first so a running campaign is never pushed below a paused one he built and
    // forgot about, then by spend, which is how the platforms themselves rank them.
    list: campaigns
      .slice()
      .sort((a, b) => (isLive(b) - isLive(a)) || (Number(b[spendKey] || 0) - Number(a[spendKey] || 0)))
      .slice(0, CAMPAIGN_LIST_CAP)
      .map((c) => ({ ...trimCampaign(c, spendKey), live: isLive(c), delivering: isDelivering(c) })),
    campaigns: campaigns.length,
    live: live.length,
    liveDailyBudget: round2(sum(live, (c) => c.dailyBudget)),
    spend30d: round2(sum(campaigns, (c) => c[spendKey])),
    impressions: sum(campaigns, (c) => c.impressions),
    clicks: sum(campaigns, (c) => c.clicks),
    conversions: round2(sum(campaigns, (c) => (spendKey === "cost" ? c.conversions : c.leads))),
  };
}

const EMPTY = { ok: true, campaigns: 0, live: 0, liveDailyBudget: 0, spend30d: 0, impressions: 0, clicks: 0, conversions: 0 };

export default withFailureAlert("ads-sync", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("ads-sync aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) {
    console.error("ads-sync: clients load failed:", error.message);
    return new Response("db error", { status: 200 });
  }

  // Platform availability. Missing credentials is not an error — it just means
  // that half of the sync is dormant until the integration is wired.
  const googleConfigured = !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN
    && process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID);
  const metaConfigured = !!process.env.META_SYSTEM_USER_TOKEN;

  // One OAuth exchange for every Google account in the run, not one per client.
  let accessToken = null;
  let googleAuthError = "";
  const linkedToGoogle = (rows || []).some((r) => r.data && r.data.googleAdsCustomerId);
  if (googleConfigured && linkedToGoogle) {
    try { accessToken = await gadsToken(); }
    catch (e) { googleAuthError = (e && e.message) || "Google Ads auth failed"; console.error("ads-sync:", googleAuthError); }
  }

  let synced = 0, googleOk = 0, metaOk = 0, failures = 0, alerts = 0;

  for (const row of rows || []) {
    const cl = row.data || {};
    const gid = cl.googleAdsCustomerId;
    const mid = cl.metaAdAccountId;
    if (!gid && !mid) continue; // nothing linked — nothing to read

    const google = { ...EMPTY, linked: !!gid };
    const meta = { ...EMPTY, linked: !!mid };

    if (gid) {
      if (!googleConfigured) { google.ok = false; google.error = "Google Ads credentials are not set in Netlify."; }
      else if (!accessToken) { google.ok = false; google.error = googleAuthError || "Google Ads auth unavailable."; }
      else {
        try { Object.assign(google, summarize(await gadsCampaigns(accessToken, gid), googleOn, googleDelivering, "cost")); google.linked = true; googleOk++; }
        catch (e) { google.ok = false; google.error = (e && e.message) || "Google Ads read failed"; }
      }
    }

    if (mid) {
      if (!metaConfigured) { meta.ok = false; meta.error = "META_SYSTEM_USER_TOKEN is not set in Netlify."; }
      else {
        try { Object.assign(meta, summarize(await metaCampaigns(mid), metaOn, metaDelivering, "spend")); meta.linked = true; metaOk++; }
        catch (e) { meta.ok = false; meta.error = (e && e.message) || "Meta read failed"; }
      }
    }

    // ── Pacing ────────────────────────────────────────────────────────────────
    // Two independent views of the same question, because either can miss on its
    // own: PROJECTED (what today's live daily budgets would spend over a month)
    // catches a budget set too high before the money is gone; ACTUAL (the real
    // trailing 30 days) catches lifetime-budget campaigns and anything the daily
    // figures don't model. Over-budget trips on whichever is higher.
    const liveDaily = round2(google.liveDailyBudget + meta.liveDailyBudget);
    const projectedMonthly = round2(liveDaily * DAYS_PER_MONTH);
    const spend30d = round2(google.spend30d + meta.spend30d);
    const monthly = monthlyBudgetOf(cl);
    const pacing = Math.max(projectedMonthly, spend30d);
    const over = monthly > 0 && pacing > monthly * OVER_BUDGET_GRACE;

    const adPerf = {
      syncedAt: new Date().toISOString(),
      google, meta,
      totals: {
        liveCampaigns: google.live + meta.live,
        liveDailyBudget: liveDaily,
        projectedMonthly,
        spend30d,
        impressions: google.impressions + meta.impressions,
        clicks: google.clicks + meta.clicks,
        conversions: round2(google.conversions + meta.conversions),
      },
      budget: {
        monthly,
        pacing,
        basis: projectedMonthly >= spend30d ? "projected" : "actual30d",
        pct: monthly > 0 ? Math.round((pacing / monthly) * 100) : null,
        state: monthly <= 0 ? "unset" : over ? "over" : pacing > monthly * 0.85 ? "warn" : "ok",
      },
    };

    // ── Alerts: transitions only, never a daily repeat ───────────────────────
    const prev = cl.adSyncState || {};
    const liveCampaigns = [
      ...((google.liveList || []).map((c) => ({ ...c, platform: "google" }))),
      ...((meta.liveList || []).map((c) => ({ ...c, platform: "meta" }))),
    ];
    const scale = scaleCheck(cl, adPerf, liveCampaigns);
    let nextPending = null;   // set only when a scale decision is added to the queue
    const cur = {
      over,
      googleFail: !!gid && !google.ok,
      metaFail: !!mid && !meta.ok,
      scaleReady: !!scale.ready,
    };
    const who = cl.internal ? "My Ads (BoldLine's own account)" : cl.name || "A client";
    const whose = cl.internal ? "your" : `${cl.name || "the client"}'s`;

    if (cur.over && !prev.over) {
      const basis = adPerf.budget.basis === "projected"
        ? `live daily budgets total $${liveDaily}/day, which projects to $${projectedMonthly}/mo`
        : `actual spend over the last 30 days is $${spend30d}`;
      await dispatchAlert({
        title: `${who} is over ad budget`,
        body: `${who} is pacing above its set monthly ad budget.\nBudget: $${monthly}/mo. Pacing at $${pacing} (${adPerf.budget.pct}%) — ${basis}.\nOpen the client in BoldLine OS to lower a daily budget or pause a campaign.`,
        severity: "red",
        smsText: `BoldLine ALERT — ${who} pacing $${pacing}/mo vs $${monthly} budget (${adPerf.budget.pct}%).`.slice(0, 300),
      });
      alerts++;
    }

    // ── The scale prompt ─────────────────────────────────────────────────────
    // Transition-only like the rest: it asks once when the picture forms, not every
    // hour. Deciding "keep as is" leaves the state true, so it stays quiet until the
    // conditions actually break and re-form.
    if (cur.scaleReady && !prev.scaleReady) {
      const c = scale.campaign;
      const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;
      const evidence = `${scale.leads30} lead${scale.leads30 === 1 ? "" : "s"} in the last 30 days at ${money(scale.cpl)} each, against a ${money(scale.target)} target, while spending ${money(scale.spend30)} of a ${money(monthly)} budget (${scale.pct}%).`;
      const theStep = c
        ? `\nSuggested step: raise "${c.name}" from ${money(c.curDaily)}/day to ${money(c.newDaily)}/day, about ${money(c.newDaily * DAYS_PER_MONTH)}/mo. That is a 25% step on purpose. Doubling a budget usually restarts the platform's learning and makes things worse for a fortnight.`
        : `\nThere is more than one campaign running, so pick which one gets the extra budget yourself rather than spreading it.`;

      await dispatchAlert({
        title: `${who}: worth scaling, or keep as is?`,
        body: `${who} is doing well AND running out of budget, which is the only time spending more actually buys more.\n\n${evidence}${theStep}\n\nEither is a fair call. Scaling buys more of what is working; keeping it as is holds your costs where they are. Nothing changes until you choose in BoldLine OS.`,
        severity: "blue",
        smsText: `BoldLine: ${whose} ads are budget-limited at ${money(scale.cpl)}/lead. Scale or hold? Decide in the OS.`.slice(0, 300),
      });
      alerts++;

      // A one-click decision in the approval queue, but ONLY when there is a single
      // live campaign to change. The queue already executes `set_daily_budget` on both
      // platforms through the human approval gate, so no new path to real money was
      // written for this.
      if (c) {
        const id = `scale-${c.platform}-${c.id}`;
        const already = (cl.pendingActions || []).some((a) => a && a.id === id);
        if (!already) {
          nextPending = [{
            id,
            title: `Scale "${c.name}" to ${money(c.newDaily)}/day?`,
            detail: `${evidence}\nApproving raises the daily budget by 25%. Dismissing keeps everything exactly as it is.`,
            cat: "launch", ts: Date.now(),
            exec: { platform: c.platform, campaignId: c.id, campaignName: c.name,
                    kind: "set_daily_budget", newDailyBudgetDollars: c.newDaily },
          }, ...(cl.pendingActions || [])];
        }
      }
    }

    for (const [key, platform, detail] of [["googleFail", "Google Ads", google.error], ["metaFail", "Meta Ads", meta.error]]) {
      if (cur[key] && !prev[key]) {
        failures++;
        await dispatchAlert({
          title: `${platform} stopped reporting for ${who}`,
          body: `The daily ad sync could not read ${platform} for ${who}:\n${detail}\nUntil this clears, spend and pacing for that account are stale — and no API calls are reaching ${platform}. Check the credentials in Netlify and the account link.`,
          severity: "yellow",
          smsText: `BoldLine: ${platform} read failing for ${who} — ${String(detail || "").slice(0, 120)}`,
        });
        alerts++;
      }
    }

    await supabase.from("clients")
      .update({
        data: { ...cl, adPerf, adSyncState: cur, ...(nextPending ? { pendingActions: nextPending } : {}) },
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    synced++;
  }

  // Detail goes to the (authenticated) Netlify function log; the HTTP response
  // stays counts-only, since this endpoint is reachable without a session.
  console.log(`ads-sync: synced ${synced} linked account-holder(s) — google ok ${googleOk}, meta ok ${metaOk}, ${failures} newly failing, ${alerts} alert(s) sent.`);
  return new Response(JSON.stringify({ ok: true, synced, googleOk, metaOk, failures, alerts, googleConfigured, metaConfigured }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
