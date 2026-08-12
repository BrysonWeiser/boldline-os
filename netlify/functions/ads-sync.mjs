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
import { getCampaigns as metaCampaigns } from "./meta-ads.mjs";
import { getAccessToken as gadsToken, getCampaigns as gadsCampaigns } from "./google-ads.mjs";

const DAYS_PER_MONTH = 30.4; // matches MyAdsInsights in index.html
const OVER_BUDGET_GRACE = 1.05; // 5% headroom before "over budget" trips

// Mirrors index.html's parse EXACTLY (`Number(String(adBudget).replace(/[^0-9.]/g,""))`).
// Deliberate: if this job read the budget differently from the screen, the alert
// and the dashboard would disagree about the same client.
const monthlyBudgetOf = (cl) => Number(String((cl && cl.adBudget) || "").replace(/[^0-9.]/g, "")) || 0;

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

// A campaign is "live" (i.e. able to spend) on Google when ENABLED; on Meta when
// its EFFECTIVE status is ACTIVE — a campaign can read ACTIVE while its ad set is
// paused, and effective_status is the one that tells the truth about delivery.
const googleLive = (c) => String(c.status || "").toUpperCase() === "ENABLED";
const metaLive = (c) => String(c.effectiveStatus || c.status || "").toUpperCase() === "ACTIVE";

// Roll a platform's campaign array into the numbers the pacing check needs.
function summarize(campaigns, isLive, spendKey) {
  const live = campaigns.filter(isLive);
  return {
    ok: true,
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
        try { Object.assign(google, summarize(await gadsCampaigns(accessToken, gid), googleLive, "cost")); google.linked = true; googleOk++; }
        catch (e) { google.ok = false; google.error = (e && e.message) || "Google Ads read failed"; }
      }
    }

    if (mid) {
      if (!metaConfigured) { meta.ok = false; meta.error = "META_SYSTEM_USER_TOKEN is not set in Netlify."; }
      else {
        try { Object.assign(meta, summarize(await metaCampaigns(mid), metaLive, "spend")); meta.linked = true; metaOk++; }
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
    const cur = {
      over,
      googleFail: !!gid && !google.ok,
      metaFail: !!mid && !meta.ok,
    };
    const who = cl.internal ? "My Ads (BoldLine's own account)" : cl.name || "A client";

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
      .update({ data: { ...cl, adPerf, adSyncState: cur }, updated_at: new Date().toISOString() })
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
