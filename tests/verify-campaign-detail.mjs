// Opening a campaign shows that campaign, on both platforms.
//
// Bryson, 2026-09-03: *"i need a way to be able to open a specific campaign (internal ones
// included) and it opens up the details of that campaign not the campaign builder screen"*.
//
// Two separate gaps sat behind that one sentence:
//
//   1. 🔴 META RETURNED "unsupported" AND DREW NOTHING. The Campaigns screen could already
//      expand a GOOGLE campaign into its ad groups, ads and keywords. Meta fell through to
//      a branch that set a state nothing rendered, so the one campaign he actually had
//      running was the one campaign he could not look at.
//   2. From My Ads, where he actually looks, a campaign name led nowhere. The only thing
//      under it was the builder, which is what he was complaining about.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
const GOOG = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// Comments discuss all of this at length; a mention is not an implementation.
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const UI = code(S);

// ── The Meta reader ───────────────────────────────────────────────────────────
t("🔴 Meta can be asked for one campaign's detail at all", () => {
  assert.match(META, /export async function getCampaignDetail\(adAccountId, campaignId\)/,
    "Meta still has no way to read a single campaign, so the Campaigns screen has nothing to draw");
  assert.match(code(META), /action === "campaignDetail"/, "the reader exists but nothing can call it");
});

t("🔴 both platforms answer to the SAME action name and the SAME shape", () => {
  // This is what lets one component render either. Two different shapes would have meant
  // two panels, and two panels drift until one of them is quietly wrong.
  assert.match(code(GOOG), /action === "campaignDetail"/);
  assert.match(code(META), /adGroups: groups/, "Meta returns its ad sets under a different key, so the shared renderer sees nothing");
});

t("an ad set carries the things only it knows", () => {
  // Budget, optimisation goal and targeting live on the ad set and appear nowhere else in
  // the OS. Without them the panel answers "what is in this campaign" but not "who is it
  // even going to", which is the question he opens it to ask.
  for (const field of ["dailyBudget", "optimizationGoal", "targeting", "impressions", "clicks", "cost", "conversions", "ads"]) {
    assert.ok(new RegExp(`${field}:`).test(code(META)), `an ad set does not report ${field}`);
  }
  assert.match(code(META), /places:/, "targeting comes back as Meta's raw object, which is unreadable on screen");
});

t("🔴 an ad whose ad set is missing is still shown", () => {
  // Dropping it would render a campaign as having no ads while it is spending money, which
  // is the most misleading thing this panel could do.
  assert.match(code(META), /const placed = new Set/, "ads are matched to ad sets with no fallback");
  assert.match(META, /Ads with no ad set/, "an unmatched ad silently disappears");
});

t("insights are read once for the account, not once per ad set", () => {
  assert.match(code(META), /level: "adset", date_preset: "last_30d"/,
    "ad-set numbers are fetched per set, which is one HTTP round trip each for something Meta returns in one response");
});

t("a campaign with no delivery is not an error", () => {
  // A brand-new campaign has no insights at all. Failing the whole read would make "not
  // started yet" look identical to "broken".
  const i = code(META).indexOf('level: "adset"');
  assert.ok(/catch \{ bySet = \{\}; \}/.test(code(META).slice(i, i + 400)),
    "a campaign that has not delivered yet fails the whole detail read");
});

// ── The panel renders both ────────────────────────────────────────────────────
t("🔴 Meta no longer falls through to a dead branch", () => {
  assert.ok(!/if\(r\.platform!=="google"\)\{ setDetail\(d=>\(\{\.\.\.d,\[k\]:\{state:"unsupported"\}\}\)\); return; \}/.test(UI),
    "Meta campaigns are still marked unsupported, which renders nothing at all");
  // 🔴 The META assertion comes FIRST. With the ternary checked first, removing the Meta
  // call made this fail with "the panel no longer asks Google for detail", which is not
  // what happened and sends the next person looking in the wrong place. Same trap the
  // contract suite hit the day before: order the checks so the likeliest break reports
  // itself rather than its neighbour.
  assert.match(UI, /await metaCall\(\{action:"campaignDetail",adAccountId:r\.client\.metaAdAccountId/,
    "the panel never asks Meta for detail");
  assert.match(UI, /r\.platform==="google"\s*\?\s*await gadsCall\(\{action:"campaignDetail"/,
    "the panel no longer asks Google for detail");
});

t("🔴 an ad's copy is read the way its own platform stores it", () => {
  // Google returns MANY headlines it mixes at serve time; Meta has exactly one headline and
  // one body. Rendering Meta through the Google shape printed "(no headlines)" over an ad
  // with perfectly good copy, which reads as broken software rather than as a mismatch.
  assert.match(UI, /isG\s*\n?\s*\?\s*<div[^>]*>\{\(a\.headlines\|\|\[\]\)/,
    "both platforms are rendered through Google's many-headlines shape");
  assert.match(UI, /a\.headline\|\|a\.name\|\|"\(untitled ad\)"/, "a Meta ad's single headline is never shown");
});

t("live is recognised on both platforms", () => {
  // Google says ENABLED, Meta says ACTIVE. Checking only one marks every live Meta ad set
  // and ad as paused, on a campaign that is spending.
  assert.match(UI, /\["ENABLED","ACTIVE"\]\.includes\(String\(g\.status\|\|""\)\.toUpperCase\(\)\)/, "an ad set's live state is Google-only");
  assert.match(UI, /\["ENABLED","ACTIVE"\]\.includes\(String\(a\.status\|\|""\)\.toUpperCase\(\)\)/, "an ad's live state is Google-only");
});

t("🔴 the Google-only write buttons do not appear on a Meta campaign", () => {
  // Every one of them posts to google-ads with a Google resource name. Rendering them on a
  // Meta campaign gives him buttons that can only fail, on the platform he is actually
  // running, which is worse than not offering them.
  assert.match(UI, /\{isG&&<span style=\{\{display:"flex",gap:6,marginLeft:"auto"\}\}>/, "the ad-group pause and delete buttons are not gated to Google");
  assert.match(UI, /\{isG&&<button disabled=\{pieceBusy===a\.id\}/, "the per-ad buttons are not gated to Google");
  assert.match(UI, /\{isG&&<AddKeywordRow/, "the keyword adder is offered on Meta, which has no keywords");
  assert.match(S, /Read only\. Start and pause the whole campaign from the row above/,
    "nothing tells him why a Meta campaign has no buttons, so it reads as broken rather than as deliberate");
});

// ── Getting there from where he actually looks ───────────────────────────────
t("🔴 a live campaign row can be opened", () => {
  assert.match(UI, /onOpenCampaign&&<button onClick=\{\(\)=>onOpenCampaign\(platform==="google"\?c\.campaignResourceName:c\.id\)\}/,
    "there is still no way into a campaign from the card he actually looks at");
  assert.match(S, /Details ›/, "the button has no label");
});

t("the key it sends is the one the list opens on", () => {
  // 🔴 If these two ever disagree the deep link silently does nothing: the screen opens, the
  // campaign does not, and it looks like the button is broken.
  assert.match(UI, /const keyOf=\(r\)=>r\.platform==="google"\?r\.c\.campaignResourceName:r\.c\.id;/,
    "the list keys rows differently from the key the Details button sends");
});

t("the Campaigns screen opens the campaign it was handed", () => {
  assert.match(UI, /function CampaignManagerScreen\(\{clients,onBack,isDesktop,onSelectClient,onUpdate,focusKey\}\)/,
    "the screen cannot be told which campaign to open");
  assert.match(UI, /const hit=\(rows\|\|\[\]\)\.find\(r=>keyOf\(r\)===focusKey\);/, "the focused campaign is never looked up");
  assert.match(UI, /focusKey=\{focusCampaign\}/, "the app never passes the focus through");
});

t("🔴 it opens once, and does not drag him back", () => {
  // Without the openKey guard, every re-render re-opens the campaign he arrived on, so
  // closing it or opening a different one would snap straight back.
  assert.match(UI, /if\(!focusKey \|\| openKey \|\| state!=="ready"\) return;/,
    "the focused campaign re-opens on every render, so he cannot navigate away from it");
});

t("leaving the screen forgets the campaign", () => {
  // Otherwise the next visit from the sidebar jumps to a campaign he did not ask for.
  assert.match(UI, /onBack=\{\(\)=>\{setFocusCampaign\(null\);setScreen\("home"\);\}\}/,
    "the focus survives leaving the screen, so a later visit opens a campaign at random");
});

t("the house account gets there too", () => {
  // "internal ones included". The card renders for the internal client, so the button does
  // too; this pins that the card is not client-only.
  assert.match(UI, /\(client\.internal \|\| client\.googleAdsCustomerId \|\| client\.metaAdAccountId\) && <LiveCampaignsCard client=\{client\} onOpenCampaign=\{onOpenCampaign\}\/>/,
    "My Ads does not get the Details button, and My Ads is where he looks");
});

console.log(`✓ verify-campaign-detail: ${n} checks passed`);
