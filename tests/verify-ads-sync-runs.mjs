// The hourly ad-numbers job, actually executed.
//
// Bryson, 2026-09-04 evening: *"Make sure that the analytics for my ads are updating. They
// haven't updated in a few hours now"*.
//
// 🔴 THE FIRST SUSPECT WAS MY OWN CHANGE, AND NOTHING PROVED IT INNOCENT. Earlier the same
// day `summarize` gained a fourth argument and both call sites were rewritten to pass a
// second predicate. Every suite that touches this file reads it as TEXT. Not one of them ever
// CALLED it. So a change that made it throw at runtime would have left every check green
// while the numbers on his screen quietly stopped moving, and the only symptom would be the
// exact one he reported.
//
// 🔴 AND THE FAILURE WOULD HAVE BEEN INVISIBLE. Each platform's read sits inside its own
// try/catch, so a throw becomes `ok: false` on that platform and the run still "succeeds".
// The job would report success to Netlify, hourly, forever.
//
// So this file runs the real thing.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const { metaOn, metaDelivering, googleOn, googleDelivering } = await import("../netlify/lib/meta-status.mjs");

// ── Lift the real functions out and run them ─────────────────────────────────
// 🔴 Extracted rather than reimplemented. A copy of the arithmetic in this file would agree
// with itself forever and say nothing about the job that actually runs.
const grab = (start, end) => {
  const i = SRC.indexOf(start);
  assert.ok(i > 0, `${start} is gone, so this suite is checking nothing`);
  const j = SRC.indexOf(end, i);
  assert.ok(j > i, `the end anchor after ${start} moved`);
  return SRC.slice(i, j);
};
const body = grab("const round2 =", "const EMPTY =");
const MOD = new Function(`${body}\nreturn { summarize, trimCampaign, CAMPAIGN_LIST_CAP };`)();

// Real shapes, as google-ads.mjs and meta-ads.mjs actually return them.
const g = (o) => ({ id: "g1", name: "Search", status: "ENABLED", campaignResourceName: "customers/1/campaigns/g1",
  budgetResourceName: "customers/1/campaignBudgets/1", dailyBudget: 7, impressions: 4360, clicks: 101,
  cost: 58.2, conversions: 0, ...o });
const m = (o) => ({ id: "m1", name: "Leads", status: "ACTIVE", effectiveStatus: "ACTIVE", dailyBudget: 14,
  impressions: 786, clicks: 13, spend: 9.05, leads: 0, ...o });

// ── 1. 🔴 IT RUNS AT ALL ─────────────────────────────────────────────────────
t("🔴 the Google half runs and returns numbers", () => {
  const r = MOD.summarize([g({}), g({ id: "g2", status: "PAUSED", cost: 0, impressions: 0 })], googleOn, googleDelivering, "cost");
  assert.equal(r.ok, true);
  assert.equal(r.campaigns, 2);
  assert.equal(r.live, 1, "a paused campaign is counted as live, or a live one is not");
  assert.equal(r.spend30d, 58.2);
  assert.equal(r.impressions, 4360);
  assert.equal(r.liveDailyBudget, 7, "the paused campaign's budget is being counted as committed");
});

t("🔴 the Meta half runs and returns numbers", () => {
  const r = MOD.summarize([m({}), m({ id: "m2", status: "PAUSED", effectiveStatus: "PAUSED", spend: 0, impressions: 0 })],
    metaOn, metaDelivering, "spend");
  assert.equal(r.ok, true);
  assert.equal(r.live, 1);
  assert.equal(r.spend30d, 9.05);
  assert.equal(r.conversions, 0, "Meta's leads are not being read into conversions");
});

t("🔴 EVERY ROW CARRIES BOTH ANSWERS, which is the change that could have broken this", () => {
  const r = MOD.summarize([m({ effectiveStatus: "IN_PROCESS" })], metaOn, metaDelivering, "spend");
  const row = r.list[0];
  assert.equal(row.live, true, "the campaign Bryson was looking at reads as paused again");
  assert.equal(row.delivering, false, "the serving answer is missing, so nothing can explain the state");
  assert.equal(row.spend, 9.05, "the numbers did not survive the trim");
  assert.equal(row.dailyBudget, 14);
});

t("a campaign with nothing set does not throw or invent numbers", () => {
  const r = MOD.summarize([{ id: "x" }], googleOn, googleDelivering, "cost");
  assert.equal(r.ok, true);
  assert.equal(r.list[0].spend, 0);
  assert.equal(r.list[0].live, false);
  assert.equal(r.spend30d, 0);
});

t("an empty account is a normal answer, not a crash", () => {
  const r = MOD.summarize([], metaOn, metaDelivering, "spend");
  assert.equal(r.campaigns, 0);
  assert.equal(r.live, 0);
  assert.deepEqual(r.list, []);
});

// ── 2. 🔴 A MISSING ARGUMENT MUST FAIL LOUDLY, NOT SILENTLY ──────────────────
t("🔴 calling it the OLD way throws, which is what a stale call site would do", () => {
  // The exact regression this suite exists for: three arguments instead of four means
  // `isDelivering` is the spend key, a string, and calling it throws. Confirming it THROWS is
  // the point, because a throw inside the job's try/catch turns into a silently stale screen.
  assert.throws(() => MOD.summarize([g({})], googleOn, "cost"),
    /is not a function/,
    "a stale three-argument call site would quietly produce rows with no delivering flag "
    + "instead of failing, and nobody would find out");
});

t("🔴 and both real call sites pass four", () => {
  assert.match(SRC, /summarize\(await gadsCampaigns\(accessToken, gid\), googleOn, googleDelivering, "cost"\)/,
    "the Google call site does not match the function it calls");
  assert.match(SRC, /summarize\(await metaCampaigns\(mid\), metaOn, metaDelivering, "spend"\)/,
    "the Meta call site does not match the function it calls");
  assert.match(SRC, /function summarize\(campaigns, isLive, isDelivering, spendKey\)/,
    "the signature moved and the call sites above are now a fiction");
});

// ── 3. Ordering and the cap, which decide what he actually sees ──────────────
t("live campaigns sort above paused ones, then by spend", () => {
  const rows = MOD.summarize([
    g({ id: "a", status: "PAUSED", cost: 0 }),
    g({ id: "b", cost: 10 }),
    g({ id: "c", cost: 90 }),
  ], googleOn, googleDelivering, "cost").list;
  assert.deepEqual(rows.map((r) => r.id), ["c", "b", "a"],
    "a running campaign is pushed below a paused one he built and forgot about");
});

t("🔴 a huge account is capped, but the cap keeps the ones that matter", () => {
  const many = Array.from({ length: 120 }, (_, i) => g({ id: `g${i}`, cost: i, status: i === 119 ? "ENABLED" : "PAUSED" }));
  const r = MOD.summarize(many, googleOn, googleDelivering, "cost");
  assert.equal(r.list.length, MOD.CAMPAIGN_LIST_CAP, "the stored row list is unbounded and bloats every read");
  assert.equal(r.list[0].id, "g119", "the cap threw away the only live campaign");
  assert.equal(r.campaigns, 120, "the total count was capped too, so the screen would lie about how many exist");
});

t("the whole account's totals ignore the cap", () => {
  const many = Array.from({ length: 120 }, (_, i) => g({ id: `g${i}`, cost: 1, impressions: 1 }));
  const r = MOD.summarize(many, googleOn, googleDelivering, "cost");
  assert.equal(r.spend30d, 120, "spend is summed from the capped list, so a big account under-reports");
  assert.equal(r.impressions, 120);
});

// ── 4. The job still says when it last ran ───────────────────────────────────
t("🔴 the snapshot stamps a time, or 'not updating' can never be told from 'nothing changed'", () => {
  assert.match(SRC, /syncedAt: new Date\(\)\.toISOString\(\)/,
    "nothing records when the numbers were last refreshed, which is the only way to notice a stall");
});

// ── 5. 🔴 HE CAN SEE A STALL, AND FORCE A CHECK ──────────────────────────────
//
// The three reasons the numbers stop moving used to look identical on screen: the job ran and
// nothing changed, the job ran and the platform refused, or the job never ran. That last one
// is not hypothetical, Netlify's schedules are best effort and a two and a half hour gap with
// no error has happened on this account before.
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const NOW_FN = readFileSync(join(ROOT, "netlify/functions/ads-sync-now.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UIC = code(UI);

t("🔴 the card says when the figures have gone stale", () => {
  assert.match(UIC, /adSyncStale: !!\(perf\.syncedAt && \(Date\.now\(\) - new Date\(perf\.syncedAt\)\.getTime\(\)\) > 2\.5 \* 3600e3\)/,
    "nothing works out whether the numbers are older than they should be");
  assert.match(UI, /They normally refresh every hour, so something skipped/,
    "a stalled sync still looks exactly like a quiet hour");
  assert.match(UIC, /\{st\.adSyncStale&&<div/, "the warning is worked out and never shown");
});

t("🔴 and he can force a check instead of waiting an hour", () => {
  assert.match(UIC, /const r = await fetch\("\/\.netlify\/functions\/ads-sync-now",\{method:"POST"/,
    "there is no way to pull the numbers on demand");
  assert.match(UIC, /\{pulling\?"Checking…":"Check now"\}/, "the button is not on screen");
  assert.match(UIC, /if\(!r\.ok \|\| !d\.ok\) throw new Error/,
    "a refused refresh reports success, which is the failure this whole card is about");
});

t("🔴 the on-demand path RUNS THE SCHEDULED JOB, not a copy of it", () => {
  // Two versions of the arithmetic that decides what he is looking at, and the copy nobody
  // runs hourly would be the one that drifts.
  assert.match(NOW_FN, /import runAdsSync from "\.\/ads-sync\.mjs";/,
    "the on-demand refresh has its own implementation and will drift from the hourly one");
  assert.match(NOW_FN, /const res = await runAdsSync\(req\);/, "it imports the job and never calls it");
});

t("🔴 and it is owner only, because it hits both ad platforms on demand", () => {
  assert.match(NOW_FN, /if \(!jwt\) return json\(\{ ok: false, error: "Not authenticated" \}, 401\);/,
    "a stranger can burn our ad-platform rate limit by holding down a button");
  assert.match(NOW_FN, /supabase\.auth\.getUser\(jwt\)/, "the token is taken on trust and never checked");
  assert.match(NOW_FN, /if \(req\.method !== "POST"\)/, "a plain page visit would trigger a real sync");
});

// ── 6. 🔴 "IT WORKED BUT NOTHING UPDATED" ────────────────────────────────────
//
// Bryson, minutes after the button shipped. He was right, and it was the button. The job
// writes to the database; the open screen was still holding the copy it loaded when he opened
// it, so a PERFECT refresh looked identical to a broken one. The first version's success
// message told him to reopen the screen, which is an instruction standing in for a missing
// feature. A button that says it checked must show what it found.
t("🔴 the press re-reads the record and puts it on screen", () => {
  assert.match(UIC, /const \{ data \} = await supabaseClient\.from\("clients"\)\.select\("data"\)\.eq\("id",client\.id\)\.maybeSingle\(\);/,
    "the button syncs the database and never looks at the result, so the screen cannot change");
  assert.match(UIC, /if\(fresh && onUpdate\) onUpdate\(\{\.\.\.fresh, id:client\.id/,
    "the fresh record is fetched and thrown away");
  assert.match(UIC, /function LiveAdPerformanceCard\(\{client,onUpdate\}\)/,
    "the card has no way to hand a refreshed client back up");
  assert.match(UIC, /<LiveAdPerformanceCard client=\{client\} onUpdate=\{onUpdate\}\/>/,
    "the card is rendered without the handler, so the refresh silently does nothing");
  assert.ok(!/Reopen this screen to see the newest figures/.test(UI),
    "🔴 it still tells him to go and reload the page himself, which is the bug wearing a fix");
});

t("🔴 and it says WHICH of the three things happened", () => {
  // "Nothing happened" was all three at once: a platform refused, nothing is linked, or the
  // numbers are genuinely unchanged. Each now has its own sentence.
  assert.match(UI, /The platforms report exactly the same figures as before/,
    "unchanged numbers still look like a broken button");
  assert.match(UI, /no ad account is linked to this record, so there was nothing to read/,
    "an unlinked account reports a successful check of nothing");
  assert.match(UI, /the figures above have been updated/, "a real update is not confirmed");
  assert.match(UIC, /if\(errs\.length\) setPullMsg\(errs\.join\(" · "\)\);/,
    "a platform that refused is swallowed and reported as a success");
});

t("the before-and-after comparison is of the real totals, not of nothing", () => {
  assert.match(UIC, /const before = JSON\.stringify\(\(\(client\.adPerf\|\|\{\}\)\.totals\)\|\|\{\}\);/,
    "there is nothing to compare against, so it can never tell changed from unchanged");
  assert.match(UIC, /before===JSON\.stringify\(\(perf\.totals\)\|\|\{\}\)/,
    "the comparison reads a different field than the one it captured");
});

console.log(`✓ verify-ads-sync-runs: ${n} checks passed`);
