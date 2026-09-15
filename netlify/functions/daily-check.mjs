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
import { STALE_HOURS, hoursSince } from "../lib/heartbeats.mjs";

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
// 🔴 ONE DEFINITION, shared with alerts-watch (../lib/heartbeats.mjs). These used to live
// here alone, and `leads` sat unused for two days while nothing server-side watched the lead
// mirror at all. Re-exported so this file's own callers keep working.
export { STALE_HOURS, hoursSince } from "../lib/heartbeats.mjs";

// ── Is the site actually running the code we think it is? ───────────────────
// 🔴 THE ONE FAILURE THIS JOB COULD NOT SEE ON ITS OWN. In August seven builds in a row were
// rejected by Netlify's secret scanner while git reported every merge as fine, and the OS
// quietly served day-old code for days (KB `netlify-secret-scan-deploys`). This function
// runs FROM that deploy, so it cannot notice its own staleness by looking inward. The only
// way to see it is to ask GitHub what the branch head is and compare.
//
// A difference is not automatically a fault: a build takes a few minutes, so a commit pushed
// moments ago is expected to be ahead. Only a head that has been sitting there past the
// grace period means a build failed or never started.
export const deployBehind = ({ deployed, head, headAt, now = Date.now(), graceMinutes = 25 }) => {
  if (!deployed) return { ok: null, why: "this deploy does not know which commit it was built from" };
  if (!head) return { ok: null, why: "could not read the branch head from GitHub" };
  const short = (c) => String(c).slice(0, 7);
  if (String(deployed) === String(head)) return { ok: true, why: `live on ${short(head)}` };
  const mins = headAt ? (now - new Date(headAt).getTime()) / 6e4 : null;
  if (mins != null && mins < graceMinutes) {
    return { ok: true, why: `${short(head)} was pushed ${Math.round(mins)} min ago and is probably still building` };
  }
  return { ok: false,
    why: `the live site is running ${short(deployed)} but main is ${short(head)}`
       + (mins != null ? `, pushed ${Math.round(mins / 60)}h ago` : "")
       + ". A build has failed or never ran, so every change since then is NOT live. Check the Netlify deploy log." };
};

// 🔴 WHERE A CLIENT'S LANDING PAGE ACTUALLY LIVES.
//
// Bryson, 2026-09-13: the check emailed him *"Stencil & Thread's landing page loads: returned
// 404"*, he opened the page himself, and it was fine. It was fine every day. This check had
// been fetching `/.netlify/functions/landing?c=<id>`, and **`landing.mjs` has no `c`
// parameter**. It resolves a client by `/lp/<slug>` or by the host header, and nothing else.
// So the URL could not have worked for any client, ever: a check whose only possible outcome
// is failure, reporting a fault that does not exist.
//
// He is right that this is worse than no check. An alarm that cries wolf on day one is an
// alarm nobody reads on the day it is telling the truth, and it costs him a morning each time.
// So the address is now derived from the same two fields the router actually reads.
//
// The client's OWN domain is preferred when they have one, because that is the address the
// ads point at and the only one a visitor ever types. `/lp/<slug>` is our own route and is
// the fallback. No slug and no domain means there is nothing to check, which is a SKIP.
// Every image the page actually asks the browser for, as absolute URLs, deduped and capped.
// The cap keeps a client with a thirty-photo gallery from turning a health check into a crawl.
export const PAGE_IMAGE_LIMIT = 8;
export const pageImages = (html, limit = PAGE_IMAGE_LIMIT) => {
  const out = [];
  for (const m of String(html || "").matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)) {
    // `&amp;` is correct in an attribute and the browser undoes it. Fetching it verbatim
    // would send a literal "amp;" and 400 on every resized image, which is a false alarm of
    // precisely the kind this file is being fixed for.
    const src = m[1].replace(/&amp;/g, "&").trim();
    if (!src || /^data:/i.test(src)) continue;
    if (!/^https?:\/\//i.test(src)) continue;   // relative srcs need a base we may not have
    if (!out.includes(src)) out.push(src);
    if (out.length >= limit) break;
  }
  return out;
};

export const landingUrlFor = (client, base) => {
  const cl = client || {};
  const domain = String((cl.campaignSetup && cl.campaignSetup.landingDomain) || "")
    .trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (domain) return { url: `https://${domain}/`, why: "their own domain, which is what the ads point at" };
  const slug = String(cl.landingSlug || "").trim();
  if (slug) return { url: `${base}/lp/${encodeURIComponent(slug)}`, why: "our own address for it" };
  return null;
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

const get = async (url, ms = 15000, headers = {}) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "BoldLine daily-check", ...headers } });
    const body = await r.text();
    return { status: r.status, ok: r.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: "", error: String((e && e.message) || e) };
  } finally { clearTimeout(timer); }
};

export default withFailureAlert("daily-check", async () => {
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
    const target = (client.landingPage && client.landingPage.published) ? landingUrlFor(client, BASE) : null;
    const lp = target ? await get(target.url) : null;
    if (!lp) add("A published landing page to check", null,
      client.landingPage && client.landingPage.published
        ? "their page is published but has no address set yet, so there is nothing to fetch"
        : "this client has no published page yet");
    else {
      add(`${client.name}'s landing page loads`, lp.ok,
        lp.ok ? "" : `${target.url} returned ${lp.status} ${lp.error || ""} (checked ${target.why})`);
      if (lp.ok) {
        // 🔴 THE RENDERER EMITS TWO DIFFERENT FORMS AND THIS ONLY KNEW ONE OF THEM.
        // `landing.mjs` branches on hand-off mode: a hand-off page posts natively to Netlify
        // Forms and names its fields (`name="phone"`), while an ordinary page posts through
        // our own script and identifies them by id (`id="lf-phone"`) with no name attribute
        // at all. This asserted the hand-off shape only, so it failed every single morning on
        // a page whose form was present and working, which is precisely the cry-wolf check
        // Bryson called out on 2026-09-13. Accept either shape; the test renders both.
        const hasForm = /<form/i.test(lp.body);
        const hasPhone = /name=["']phone["']/i.test(lp.body) || /id=["']lf-phone["']/i.test(lp.body);
        add("The landing page still has its lead form", hasForm && hasPhone,
          !hasForm ? "there is no form on the page at all"
            : "the form has no phone field, so a lead arrives with no way to call them back");
        const r = scriptsParse(lp.body);
        add("The landing page's script parses", r.bad.length === 0, r.bad[0] || "");

        // 🔴 THE CHECK NEVER LOOKED AT THE PHOTOS, WHICH IS THE ONE THING HE WAS LOOKING AT.
        // Bryson, 2026-09-13, reported photos missing from this exact page. Everything here
        // asked whether the HTML arrived; nothing asked whether the pictures in it did. A
        // page that returns 200 with dead images is a page the ads are still paying for.
        const imgs = pageImages(lp.body);
        if (!imgs.length) add("The landing page's photos load", null, "this page has no images on it");
        else {
          const bad = [];
          for (const src of imgs) {
            const r2 = await get(src, 12000);
            if (!r2.ok) bad.push(`${src.split("/").pop().split("?")[0]} returned ${r2.status || r2.error}`);
          }
          add("The landing page's photos load", bad.length === 0,
            bad.length ? `${bad.length} of ${imgs.length} did not: ${bad.slice(0, 3).join("; ")}` : `${imgs.length} checked`);
        }
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

  // ── 5. Is the deploy current? ─────────────────────────────────────────────
  // Needs GITHUB_READ_TOKEN in Netlify (a read-only token; the repo is private). Without it
  // this skips rather than failing, so the rest of the check still runs.
  {
    const deployed = process.env.COMMIT_REF || "";
    const tok = process.env.GITHUB_READ_TOKEN || "";
    if (!tok) {
      add("The deploy is current", null, "GITHUB_READ_TOKEN is not set in Netlify, so the live commit cannot be compared with main");
    } else {
      const r = await get("https://api.github.com/repos/BrysonWeiser/boldline-os/commits/main", 15000,
        { authorization: "Bearer " + tok, accept: "application/vnd.github+json" });
      let head = null, headAt = null;
      try {
        const j = JSON.parse(r.body || "{}");
        head = j.sha || null;
        headAt = (j.commit && j.commit.committer && j.commit.committer.date) || null;
      } catch (e) { /* falls through to the null head below */ }
      const v = deployBehind({ deployed, head, headAt });
      add("🔴 The deploy is current", v.ok, v.why);
    }
  }

  // ── 6. The endpoints the OS leans on ──────────────────────────────────────
  // A GET with no arguments should be REFUSED, not crash. A 500 here means the function
  // fails to start, which is how a whole feature goes missing without anything saying so.
  for (const fn of ["portal", "landing", "lead-intake"]) {
    const r = await get(`${BASE}/.netlify/functions/${fn}`);
    add(`${fn} answers`, r.status > 0 && r.status !== 500 && r.status !== 502,
      r.status === 0 ? `no response: ${r.error}` : `returned ${r.status}, which means the function itself failed to start`);
  }

  const sum = summarize(checks);

  // ── 7. Say something, but only when it is worth saying ────────────────────
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
