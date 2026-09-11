// Daily health check against the LIVE, DEPLOYED site.
//
// Bryson, 2026-09-10, after every button in the client portal was dead for a day:
// *"is there a way we can set up a daily check on everything ... that way something like
// this doesn't happen again"*.
//
// 🔴 WHY THE TEST SUITE WAS NEVER GOING TO CATCH IT. Every suite in tests/ reads THIS REPO.
// The portal outage lived in the text Netlify actually served, and one suite was even
// reading the raw source and passing on it (KB `portal-script-parse`). A green repo and a
// broken site are not the same claim, and this project has now shipped that gap twice: once
// when seven builds failed the secret scanner while git said merged (KB
// `netlify-secret-scan-deploys`), and once this week.
//
// So this fetches what a client's browser fetches and checks THAT. `tests/run-all.mjs` plus
// the GitHub Action is the other half: the repo is checked on every push, the deployed site
// is checked every morning.
//
// 🔴 READ ONLY. This runs against production with a real client's token, so every request is
// a GET and nothing here writes to a client, sends to a person, or spends money. The one
// write it makes is its own result row.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";

const BASE = String(process.env.URL || "https://boldlinemedia.netlify.app").replace(/\/$/, "");

// ── The check that would have caught 2026-09-10 ──────────────────────────────
// A page whose script does not parse defines NOTHING, so every button on it is dead while
// the page itself looks perfectly normal. That is invisible to anything that only asks
// whether the page loaded.
export const scriptsParse = (html) => {
  const bad = [];
  let n = 0;
  for (const m of String(html || "").matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const code = m[1];
    if (!code.trim()) continue;
    // A module or JSX block is not plain script and cannot be parsed with new Function.
    if (/type=["'](module|text\/babel)["']/i.test(m[0])) continue;
    n++;
    try { new Function(code); } catch (e) { bad.push(String(e.message).slice(0, 120)); }
  }
  return { checked: n, bad };
};

// The OS page ships the portal PREVIEW as a template literal rather than as a script, so it
// is checked the way the suite checks it: evaluate the literal, parse what comes out.
export const previewScriptParses = (osHtml) => {
  const s = String(osHtml || "");
  const start = s.indexOf("`<script>var selUpgName");
  if (start < 0) return { found: false, ok: false, why: "the preview script is not in the served file at all" };
  let i = start + 1, end = -1;
  while (i < s.length) {
    if (s[i] === "\\") { i += 2; continue; }
    if (s[i] === "`") { end = i; break; }
    i++;
  }
  if (end < 0) return { found: true, ok: false, why: "the preview script literal is unterminated" };
  try {
    const cl = { portalToken: "tok" };
    // eslint-disable-next-line no-eval
    const html = eval(s.slice(start, end + 1));
    const code = html.replace(/^<script>/, "").replace(/<\/script>$/, "");
    new Function(code);
    return { found: true, ok: true, defines: /function show\(/.test(code) };
  } catch (e) {
    return { found: true, ok: false, why: String(e.message).slice(0, 140) };
  }
};

// How stale a stored reading may get before it means the job behind it stopped.
export const STALE_HOURS = { adPerf: 8, leads: 2 };
export const hoursSince = (iso) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? (Date.now() - t) / 3.6e6 : null;
};

// One place decides what counts as a failure, so the alert and the stored row agree.
export const summarize = (checks) => {
  const failed = checks.filter((c) => c.ok === false);
  const skipped = checks.filter((c) => c.ok === null);
  return {
    ok: failed.length === 0,
    failed, skipped,
    passed: checks.filter((c) => c.ok === true).length,
    total: checks.length,
    line: failed.length
      ? `${failed.length} of ${checks.length} checks failed`
      : `all ${checks.length} checks passed${skipped.length ? `, ${skipped.length} skipped` : ""}`,
  };
};

const get = async (url, ms = 15000) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "BoldLine daily-check" } });
    const body = await r.text();
    return { status: r.status, ok: r.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: "", error: String((e && e.message) || e) };
  } finally { clearTimeout(timer); }
};

export default async (req) => withFailureAlert("daily-check", async () => {
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail: detail || "" });

  // ── 1. The OS itself ───────────────────────────────────────────────────────
  const os = await get(BASE + "/");
  add("The OS page loads", os.ok, os.ok ? "" : `returned ${os.status} ${os.error || ""}`);
  if (os.ok) {
    const pv = previewScriptParses(os.body);
    add("🔴 The client portal PREVIEW script parses", pv.ok,
      pv.ok ? "" : `${pv.why}. Every button in the preview is dead until this is fixed.`);
    add("The OS page carries its app code", /function GoogleLaunchCard\(/.test(os.body),
      /function GoogleLaunchCard\(/.test(os.body) ? "" : "the served file is missing code it should have, which usually means a failed build serving an old copy");
  }

  // ── 2. A real client's portal, fetched the way the client fetches it ───────
  let client = null;
  try {
    const { data } = await supabase.from("clients").select("id,data").limit(50);
    const rows = (data || []).map((r) => ({ id: r.id, ...(r.data || {}) }));
    client = rows.find((c) => c && !c.internal && !c.demo && c.portalToken && c.contractStatus === "active")
          || rows.find((c) => c && !c.internal && c.portalToken) || null;
  } catch (e) { /* reported below */ }

  if (!client) {
    add("A client portal to check", null, "no client with a portal token yet, so the live portal was not checked");
  } else {
    const p = await get(`${BASE}/.netlify/functions/portal?token=${encodeURIComponent(client.portalToken)}`);
    add(`${client.name}'s portal loads`, p.ok, p.ok ? "" : `returned ${p.status} ${p.error || ""}`);
    if (p.ok) {
      const r = scriptsParse(p.body);
      add("🔴 The live client portal's script parses", r.bad.length === 0,
        r.bad.length ? `${r.bad[0]}. Every button in their portal is dead until this is fixed, including Approve.`
                     : `${r.checked} script block(s) checked`);
      add("The portal renders its tabs", /class="nb"/.test(p.body) && /id="t-account"/.test(p.body),
        "the Account panel or the tab bar is missing from the page");
    }

    // ── 3. Their landing page, which is where the ad money lands ─────────────
    const lp = (client.landingPage && client.landingPage.published) ? await get(`${BASE}/.netlify/functions/landing?c=${encodeURIComponent(client.id)}`) : null;
    if (!lp) add("A published landing page to check", null, "this client has no published page yet");
    else {
      add(`${client.name}'s landing page loads`, lp.ok, lp.ok ? "" : `returned ${lp.status} ${lp.error || ""}`);
      if (lp.ok) {
        add("The landing page still has its lead form", /<form/i.test(lp.body) && /name=["']phone["']/i.test(lp.body),
          "a landing page with no form collects nothing, and the ads keep spending");
        const r = scriptsParse(lp.body);
        add("The landing page's script parses", r.bad.length === 0, r.bad[0] || "");
      }
    }

    // ── 4. Are the background jobs actually still running? ───────────────────
    // A stopped job looks exactly like a quiet week (KB `ads-sync-stall`).
    const ageAd = hoursSince(client.adPerfSyncedAt || (client.adPerf && client.adPerf.syncedAt));
    if (ageAd == null) add("Ad figures have ever been read", null, "no ad sync has run for this client yet");
    else add("Ad figures are being refreshed", ageAd <= STALE_HOURS.adPerf,
      ageAd <= STALE_HOURS.adPerf ? `last read ${ageAd.toFixed(1)}h ago`
        : `last read ${ageAd.toFixed(1)}h ago, and it should be within ${STALE_HOURS.adPerf}h. The hourly sync has stopped.`);
  }

  // ── 5. The endpoints the OS leans on ──────────────────────────────────────
  // A GET with no arguments should be REFUSED, not crash. A 500 here means the function
  // fails to start, which is how a whole feature goes missing without anything saying so.
  for (const fn of ["portal", "landing", "lead-intake"]) {
    const r = await get(`${BASE}/.netlify/functions/${fn}`);
    add(`${fn} answers`, r.status > 0 && r.status !== 500 && r.status !== 502,
      r.status === 0 ? `no response: ${r.error}` : `returned ${r.status}, which means the function itself failed to start`);
  }

  const sum = summarize(checks);

  // ── 6. Say something, but only when it is worth saying ────────────────────
  // 🔴 A checker that only speaks when things break is indistinguishable from a checker that
  // has itself died. So a failure alerts immediately, and Monday morning gets an all-clear
  // whether or not anything was wrong.
  const monday = new Date().getUTCDay() === 1;
  if (!sum.ok) {
    await dispatchAlert({
      title: `🔴 Daily check: ${sum.line}`,
      body: sum.failed.map((c) => `${c.name}: ${c.detail}`).join("\n\n")
        + "\n\nThis ran against the live site, not the code, so these are things a visitor or a client would hit right now.",
      severity: "red",
    });
  } else if (monday) {
    await dispatchAlert({
      title: `✅ Daily check: ${sum.line}`,
      body: `Checked the live OS, ${client ? client.name + "'s portal and landing page" : "the OS"}, and the background jobs. Everything a client would touch is working. This all-clear goes out on Mondays so silence the rest of the week means the check is running, not that it died.`,
      severity: "blue",
    });
  }

  // Keep the result so a pattern is visible later. Its own failure never fails the check.
  try {
    await supabase.from("health_checks").insert({
      ran_at: new Date().toISOString(), ok: sum.ok,
      summary: sum.line, detail: checks,
    });
  } catch (e) { console.error("daily-check could not store its result:", (e && e.message) || e); }

  console.log(`daily-check: ${sum.line}`);
  for (const c of checks) console.log(`  ${c.ok === true ? "ok  " : c.ok === false ? "FAIL" : "skip"}  ${c.name}${c.detail ? " — " + c.detail : ""}`);
  return new Response(JSON.stringify({ ok: sum.ok, summary: sum.line, checks }), { headers: { "content-type": "application/json" } });
});
