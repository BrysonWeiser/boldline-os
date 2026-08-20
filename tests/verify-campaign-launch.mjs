// The launch path: what happens between "Build Campaign" and money being spent.
// Run: node tests/verify-campaign-launch.mjs
//
// Written 2026-08-20 after Bryson asked for a bug sweep before approving his first
// campaign. Two real bugs came out of it, and both were SILENT — every surface reported
// success while the thing the operator wanted did not happen.
//
// 1. APPROVING A CAMPAIGN NEVER MADE IT DELIVER. Both platforms build the campaign, the
//    ad group / ad set, and the ad all PAUSED, which is correct. But approval only ever
//    set the CAMPAIGN live, and both platforms require every level to be active before a
//    single impression is served. The OS said "activated", the campaign list showed it
//    live, and a campaign's own status does not reflect a paused child, so autopilot
//    agreed. The only symptom was zero spend, which reads as "my ads don't work".
//
// 2. EVERY META CAMPAIGN TARGETED THE ENTIRE UNITED STATES. The launch card sent a
//    two-letter country and nothing else, so `geo_locations` was `{countries:["US"]}`.
//    On a small budget aimed at one metro, that is the whole budget spent on the wrong
//    people, and it would have looked like the ads simply failed.
//
// No network: both API modules are read as source, and the pure helpers are exercised
// directly. Nothing here can spend money or touch a live account.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const meta = read("../netlify/functions/meta-ads.mjs");
const google = read("../netlify/functions/google-ads.mjs");
const os = read("../index.html");

// ══════════════════════════════════════════════════════════════════════════════
// 1. STARTING A CAMPAIGN STARTS THE WHOLE DELIVERY CHAIN
// ══════════════════════════════════════════════════════════════════════════════

// The build must still create everything paused. That part was never wrong, and if it
// ever changes, a campaign starts spending the moment it is built.
{
  const create = meta.slice(meta.indexOf("async function createCampaign"), meta.indexOf("// ── Handler"));
  eq("Meta still builds every level PAUSED", (create.match(/status: "PAUSED"/g) || []).length >= 3, true);
  ok("Meta never builds anything ACTIVE", !/status: "ACTIVE"/.test(create),
    "a campaign that is live the moment it is built cannot be reviewed first");

  const gcreate = google.slice(google.indexOf("export async function createCampaign"), google.indexOf("async function gaql"));
  ok("Google builds the campaign paused", /status: "PAUSED"/.test(gcreate));
  ok("Google builds ad groups paused", /adGroupOperation[\s\S]{0,200}status: "PAUSED"/.test(gcreate));
  ok("Google builds ads paused", /adGroupAdOperation[\s\S]{0,200}status: "PAUSED"/.test(gcreate));
}

// Meta: the whole chain.
{
  ok("Meta exports activateCampaign", /export async function activateCampaign\(campaignId\)/.test(meta));
  const fn = meta.slice(meta.indexOf("export async function activateCampaign"));
  const body = fn.slice(0, fn.indexOf("\n// ── Guarded write: pause"));
  ok("it activates the campaign", /params: \{ status: "ACTIVE" \}/.test(body));
  ok("it walks the ad sets", /\/adsets/.test(body), "a paused ad set means zero delivery");
  ok("it walks the ads under each ad set", /\/ads`/.test(body), "a paused ad means zero delivery");
  ok("it reports what it started", /adSets: adsetIds\.length, ads: adsStarted/.test(body),
    "a bare success cannot tell you the campaign had no ads in it");
}

// Google: the whole chain, atomically.
{
  ok("Google exports activateCampaign", /export async function activateCampaign\(accessToken, customerId/.test(google));
  const fn = google.slice(google.indexOf("export async function activateCampaign"));
  const body = fn.slice(0, fn.indexOf("export async function setAdGroupStatus"));
  ok("it enables the campaign", /setStatus\(accessToken, customerId, campaignResourceName, "ENABLED"\)/.test(body));
  ok("it enables the ad groups", /adGroupOperation[\s\S]{0,160}status: "ENABLED"/.test(body));
  ok("it enables the ads", /adGroupAdOperation[\s\S]{0,160}status: "ENABLED"/.test(body));
  // Ad groups and ads are different resource types, so a per-resource endpoint would 404.
  ok("it uses the mixed-operation endpoint", /googleAds:mutate/.test(body),
    "ad groups and ads in one call require googleAds:mutate");
  ok("and sends them as one atomic mutate", /mutateOperations: ops/.test(body),
    "a half-started campaign is worse than one that failed outright");
  ok("it skips anything already enabled", /!== "ENABLED"/.test(body));
}

// 🔴 THE GUARD THAT MATTERS MOST: the meaning of "go live" lives in ONE place.
// Three separate call sites ask for this (the approval queue, the Live Campaigns toggle,
// the Campaign Manager toggle). Fixing them individually would leave the next caller free
// to reintroduce the bug, so the handler routes it.
{
  const h = meta.slice(meta.indexOf('if (action === "setStatus")'));
  const block = h.slice(0, h.indexOf('if (action === "deleteCampaign")'));
  ok("Meta setStatus routes ACTIVE through the full chain", /=== "ACTIVE"[\s\S]{0,400}activateCampaign\(body\.campaignId\)/.test(block));
  ok("and still pauses at campaign level only", /await setStatus\(body\.campaignId, body\.status\)/.test(block),
    "pausing the parent stops everything, which is the safe direction");

  const gh = google.slice(google.indexOf('if (action === "setStatus")'));
  const gblock = gh.slice(0, gh.indexOf('if (action === "removeCampaign")'));
  ok("Google setStatus routes ENABLED through the full chain", /=== "ENABLED"[\s\S]{0,500}activateCampaign\(/.test(gblock));
  ok("and derives the campaign id so no caller has to change", /campaignResourceName\)\.split\("\/"\)\.pop\(\)/.test(gblock));
}

// The OS asks for "live" from three places. Each must go through setStatus, because that
// is where the fix lives — a direct call to a lower-level primitive would bypass it.
{
  const live = [...os.matchAll(/action:"setStatus",campaignId:[^}]*status:on\?"PAUSED":"ACTIVE"/g)];
  ok("both Meta toggles ask via setStatus", live.length >= 2);
  const approve = os.slice(os.indexOf("const decideAction="));
  ok("the approval queue activates via setStatus too", /action:"setStatus",campaignId:camp\.id,status:st/.test(approve));
  ok("and asks for ACTIVE, not something lower level", /ex\.kind==="pause_campaign"\?"PAUSED":"ACTIVE"/.test(approve));
}

// Autopilot may never start anything. This is the founding invariant.
{
  const ap = read("../netlify/functions/ads-autopilot.mjs");
  ok("autopilot never asks for ACTIVE", !/SetStatus\([^)]*"ACTIVE"/.test(ap));
  ok("autopilot never asks for ENABLED", !/SetStatus\([^)]*"ENABLED"/.test(ap));
  ok("autopilot never calls activateCampaign", !/activateCampaign/.test(ap),
    "may always spend LESS, may NEVER spend more without asking");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. NO CAMPAIGN MAY EVER QUIETLY TARGET THE WHOLE COUNTRY
// ══════════════════════════════════════════════════════════════════════════════
{
  const create = meta.slice(meta.indexOf("async function createCampaign"), meta.indexOf("// ── Handler"));

  // The regression guard: this exact default is what spent the budget nationwide.
  // Comments are stripped first — the comment explaining the bug names the old code, and
  // matching that would make this assertion pass or fail on prose rather than behaviour.
  const code = create.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("the nationwide fallback is gone", !/\{ countries: \["US"\] \}/.test(code),
    "this default meant a typo bought all 340 million people");

  ok("locations are resolved to Meta geo keys", /resolveGeoTargets\(p\.locations/.test(create));
  ok("an unrecognised location STOPS the build", /unresolved\.length[\s\S]{0,400}throw/.test(create));
  ok("and the error names which one failed", /r\.unresolved\.map/.test(create));
  ok("and says nothing was created", /Nothing was created/.test(create));
  ok("no locations at all also stops the build", /target locations are required/.test(create));
  ok("the refusal explains the cost in plain terms", /budget is gone before it reaches anyone nearby/.test(create));
}

// The resolver has to pick the right town. "Gilbert" exists in more than one state, and
// advertising the wrong one is the same class of error as the Gila Bend problem.
{
  const fn = meta.slice(meta.indexOf("export async function resolveGeoTargets"));
  const body = fn.slice(0, fn.indexOf("// ── Guarded write: ACTUALLY START"));
  ok("it searches Meta's ad-geolocation index", /type: "adgeolocation"/.test(body));
  ok("it prefers a hit in the state that was typed", /String\(h\.region \|\| ""\)\.toLowerCase\(\) === wanted/.test(body));
  ok("an unmatched name is reported, never guessed", /unresolved\.push\(raw\)/.test(body));
  ok("cities get a radius", /radius: 25/.test(body));
  ok("a lookup failure does not throw mid-build", /catch \(e\)[\s\S]{0,120}console\.warn/.test(body));
}

// The OS side: the field exists, is required, and is sent.
{
  const m = os.slice(os.indexOf("function MetaLaunchCard"));
  const body = m.slice(0, m.indexOf("\nfunction ", 10));
  ok("the Meta card has a locations field", /locationsText/.test(body));
  ok("it is seeded from the client's own service area", /toLocationLines\(metaLocations\)/.test(body));
  ok("it is sent to the builder", /locations:f\.locationsText/.test(body));
  ok("the old country-only payload is gone", !/geo:\{countries:\[f\.country/.test(body),
    "this is what targeted the whole country");
  ok("the UI says what happens if it is empty", /the build is refused/.test(body));
}

// ── The seeder must never invent a town ─────────────────────────────────────
// The first version paired every other comma-separated chunk, which turns
// "Phoenix, Mesa, Tempe" into "Phoenix, Mesa" — a place that is not where anyone meant.
{
  const i = os.indexOf("const US_STATE ="), j = os.indexOf("\n\nfunction AreaConditionsCard");
  ok("the location seeder is present", i > 0 && j > i);
  const { toLocationLines } = new Function(os.slice(i, j) + "\nreturn { toLocationLines };")();

  eq("comma-separated city/state pairs split correctly",
    toLocationLines("Gilbert, Arizona, Chandler, Arizona, Mesa, Arizona"),
    "Gilbert, Arizona\nChandler, Arizona\nMesa, Arizona");
  eq("semicolons are trusted as written", toLocationLines("Phoenix, AZ; Mesa, AZ"), "Phoenix, AZ\nMesa, AZ");
  eq("newlines are left alone", toLocationLines("Gilbert, Arizona\nPhoenix, Arizona"), "Gilbert, Arizona\nPhoenix, Arizona");
  eq("a single city survives", toLocationLines("Phoenix"), "Phoenix");
  eq("bare cities are NOT paired into a fake place", toLocationLines("Phoenix, Mesa, Tempe"), "Phoenix\nMesa\nTempe");
  eq("empty stays empty", toLocationLines(""), "");
  eq("a trailing city with no state is kept whole",
    toLocationLines("Gilbert, Arizona, Sedona"), "Gilbert, Arizona\nSedona");
}

// ── Google already refused a location-less build; keep it that way ─────────
{
  ok("Google still requires locations", /locations are required|Leave this empty and Google targets/.test(google + os));
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-campaign-launch: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
