// One row per campaign on My Ads, PAUSED ones included.
//
// Bryson, 2026-09-04, two questions one after the other:
//   *"Why is the new campaign that I made not doing anything?"*
//   *"when I press my ads it only shows one ads statistics and I can't change it"*
//
// 🔴 THEY WERE THE SAME BUG, AND IT WAS A BUG OF OMISSION, WHICH IS WHY NOTHING CAUGHT IT.
//
// The Live Ad Performance card shows ACCOUNT-WIDE TOTALS. With one campaign that is
// indistinguishable from that campaign's own numbers, so nobody noticed. Build a second and
// the figures silently become a blend of the two with nothing on screen saying so and no way
// to look at either.
//
// Worse: the snapshot kept only `liveList`, so a campaign created PAUSED appeared NOWHERE.
// Not as paused, not as zeros. Nowhere. And every campaign this OS builds starts paused on
// purpose, because nothing may spend before he approves it. So the newest campaign was
// invisible on the one screen he checks while the totals above it had not moved, which reads
// exactly like a broken campaign rather than one waiting on a press.
//
// 🔴 THE TRANSFERABLE LESSON: a screen that is correct with one of something, and wrong with
// two, will ship. There was nothing to see until the day there were two.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const SYNC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S), SY = code(SYNC);
let n = 0;
const t = (name, fn) => { fn(); n++; };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── The snapshot has to CARRY every campaign ─────────────────────────────────
t("🔴 the sync keeps every campaign, not only the live ones", () => {
  assert(/list: campaigns/.test(SY),
    "a campaign created paused appears nowhere at all, which is every campaign this OS builds");
  assert(/liveList: live/.test(SY),
    "the scale check names the one campaign a budget change lands on, and still needs this");
});

t("🔴 and each carries whether it is live, not just its raw status", () => {
  // Google says ENABLED, Meta says ACTIVE. Making the screen re-derive that from two
  // different vocabularies is how one platform ends up permanently mislabelled, which has
  // already happened once on the campaign detail panel.
  assert(/live: isLive\(c\)/.test(SY),
    "the screen would have to know that live is ENABLED on one platform and ACTIVE on the other");
});

t("live campaigns sort above paused ones", () => {
  assert(/isLive\(b\) - isLive\(a\)/.test(SY),
    "a running campaign must never be pushed below a paused one he built and forgot about");
});

t("🔴 the stored list is capped", () => {
  // It lives on the client record, which is read on every screen. An account with hundreds
  // of old campaigns must not make every read of that client heavier.
  assert(/CAMPAIGN_LIST_CAP = \d+/.test(SY) && /slice\(0, CAMPAIGN_LIST_CAP\)/.test(SY),
    "an old account with hundreds of campaigns bloats every read of that client");
});

t("🔴 it stores the numbers a row needs and not the whole API object", () => {
  const i = SY.indexOf("const trimCampaign");
  assert(i > 0, "the trim is gone, so raw platform payloads are being stored");
  const body = SY.slice(i, SY.indexOf("});", i));
  for (const f of ["name", "status", "dailyBudget", "impressions", "clicks", "spend", "conversions"]) {
    assert(new RegExp(`\\b${f}:`).test(body), `a campaign row cannot show ${f}`);
  }
});

t("🔴 the two platforms' different words for spend and leads are reconciled once", () => {
  // Google reports `cost` and `conversions`; Meta reports `spend` and `leads`. Both become
  // `spend` and `conversions` here, so the row template is one template rather than two.
  assert(/spend: round2\(Number\(c\[spendKey\] \|\| 0\)\)/.test(SY));
  assert(/spendKey === "cost" \? c\.conversions : c\.leads/.test(SY),
    "Meta has no `conversions` field, so a Google-shaped read shows every Meta campaign as zero");
});

// ── The screen has to SHOW them ──────────────────────────────────────────────
t("🔴 the OS reads both platforms' lists into one", () => {
  const i = UI.indexOf("campaigns: [");
  assert(i > 0, "adPerfStats no longer exposes a per-campaign list");
  const body = UI.slice(i, UI.indexOf("].sort(", i));
  assert(/g\.list/.test(body) && /m\.list/.test(body), "one platform's campaigns are missing entirely");
  assert(/platform:"google"/.test(body) && /platform:"meta"/.test(body),
    "without the platform on the row, two campaigns of the same name are indistinguishable");
});

t("the rows render, and say which campaign is which", () => {
  assert(/By campaign/.test(S), "there is no per-campaign section at all");
  assert(/st\.campaigns\.map\(c=>/.test(UI), "the list is computed and never drawn");
  assert(/\{c\.name\|\|"Untitled campaign"\}/.test(UI), "a campaign with no name renders blank");
});

t("🔴 the totals above are labelled as totals", () => {
  // This is the whole misunderstanding: with one campaign the summary looked like that
  // campaign, so with two he reasonably read the blend as one of them.
  assert(/The figures above are every campaign added together/.test(S),
    "nothing says the numbers at the top are a sum, which is exactly how this was misread");
});

t("🔴 a paused campaign says WHY its numbers are zero", () => {
  // Zeros on a paused campaign are not a fault, they are the consequence, and saying so is
  // the difference between "it is broken" and "press approve".
  assert(/Not running, so it has not been seen by anyone and has spent nothing/.test(S),
    "a paused campaign shows zeros with no explanation, which reads as broken");
  assert(/Approve it on the Campaigns screen to set it live/.test(S),
    "it says what is wrong without saying what to press");
});

t("running and paused are visibly different, not just differently worded", () => {
  assert(/\{c\.live\?"Running":"Paused"\}/.test(UI), "there is no status pill on the row");
  assert(/c\.live\?C\.green:C\.amber/.test(UI), "both states look identical at a glance");
});

t("a live row shows its own figures, all four of them", () => {
  const i = UI.indexOf("st.campaigns.map(c=>");
  const body = UI.slice(i, UI.indexOf("</div>\n                            </div>", i));
  for (const [f, label] of [["c.impressions", "views"], ["c.clicks", "clicks"], ["c.spend", "spend"], ["c.conversions", "conversions"]]) {
    assert(body.includes(f), `a campaign row does not show its own ${label}`);
  }
  assert(/c\.platform==="meta"\?"leads":"conversions"/.test(body),
    "Meta reports leads and Google reports conversions, and calling both the same thing on "
    + "screen makes one of them a lie");
});

t("🔴 an empty account reads as empty, not as broken", () => {
  assert(/No campaigns in the ad account yet/.test(S),
    "no campaigns and a failed sync look identical, and one of them is fine");
  assert(/st\.campaigns\.length===0&&st\.errors\.length===0/.test(UI),
    "the empty message shows even when the account failed to read, which hides a real fault");
});

t("the row survives a snapshot written before this existed", () => {
  // Every client record in production predates this field. `(g.list||[])` is the whole
  // reason the screen does not throw on all of them.
  assert(/\(g\.list\|\|\[\]\)/.test(UI) && /\(m\.list\|\|\[\]\)/.test(UI),
    "every existing client record has no list yet, so the screen would crash for all of them");
});

console.log(`✓ verify-campaign-breakdown: ${n} checks passed`);
