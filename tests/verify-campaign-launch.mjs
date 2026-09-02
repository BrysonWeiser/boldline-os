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
  ok("an unmatched name is reported, never guessed", /unresolved\.push\(it\.raw\)/.test(body));
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
  // The refusal lives in the builder, not in the help text, so assert the builder.
  ok("Google still refuses to build without locations",
    /at least 1 target location required/.test(google));
  ok("and both cards still mark the field required",
    (os.match(/Target locations — one per line \(required\)/g) || []).length === 2);
}


// ══════════════════════════════════════════════════════════════════════════════
// 3. ANYWHERE IN THE WORLD (2026-08-20)
// ══════════════════════════════════════════════════════════════════════════════
// Bryson: "we can be located in one state or area and be able to target anywhere in the
// world we want." Both platforms search for a place WITHIN one country, and both had that
// country hardcoded to US, so a client could only ever advertise inside America.
{
  const { parseLocation, parseLocations, countryCodeFor, isCountryOnly } =
    await import("../netlify/lib/geo-parse.mjs");

  const p = (t, d) => parseLocation(t, d);
  eq("a US city keeps its state in the query", p("Gilbert, Arizona").query, "Gilbert, Arizona");
  eq("and is routed to the US", p("Gilbert, Arizona").country, "US");
  eq("a foreign city drops the country from the query", p("London, United Kingdom").query, "London");
  eq("and is routed to that country", p("London, United Kingdom").country, "GB");
  eq("a Canadian province is recognised without the country", p("Toronto, Ontario").country, "CA");
  eq("a three-part entry keeps the province", p("Toronto, Ontario, Canada").query, "Toronto, Ontario");
  eq("a country on its own targets the country", p("Canada").countryOnly, true);
  eq("common abbreviations work", p("Dubai, UAE").country, "AE");
  eq("so do informal ones", countryCodeFor("uk"), "GB");

  // 🔴 The honesty rule: an entry we cannot place must be REPORTED, not silently
  // searched in the default country and passed off as resolved.
  eq("an unplaceable entry falls back", p("Shibuya, Tokyo").country, "US");
  eq("but is marked as assumed", p("Shibuya, Tokyo").inferred, null);
  eq("the batch reports which entries were assumed",
    parseLocations("Gilbert, Arizona\nParis").assumed.join(","), "Paris");
  eq("and groups by country for the lookups",
    parseLocations("Gilbert, Arizona\nLondon, United Kingdom\nToronto, Ontario").countries.join(","), "US,GB,CA");
  ok("a country-only entry is detected", isCountryOnly("Canada") && !isCountryOnly("Toronto, Ontario"));
  eq("empty input is not a crash", parseLocations("").items.length, 0);
}

// Both platforms must USE the parser, not their own idea of a country.
{
  ok("Meta resolves per entry, not per box", /parseLocations\(names, defaultCountry\)/.test(meta));
  ok("Meta targets a whole country without a lookup", /it\.countryOnly[\s\S]{0,120}countries\.push/.test(meta));
  ok("Meta searches within the entry's own country", /country_code: it\.country/.test(meta));
  ok("Meta no longer hardcodes a country in the search", !/country_code: countryCode/.test(meta));
  ok("Meta passes country targets through to the ad set", /geo\.countries = r\.countries/.test(meta));

  ok("Google groups its lookups by country", /for \(const \[country, group\] of byCountry\)/.test(google));
  ok("and sends that country to the suggest call", /countryCode: country/.test(google));
  ok("Google no longer hardcodes the country in the lookup", !/countryCode,\s*locationNames/.test(google));
  ok("an unresolved Google location stops the build", /geo\.unresolved && geo\.unresolved\.length[\s\S]{0,200}throw err/.test(google));
  ok("and reports it as the operator typed it", /backToRaw\.get/.test(google),
    "naming a rewritten query the operator never wrote is not a usable error");
}

// 🔴 LANGUAGE WAS HARDCODED TO ENGLISH, which is silently wrong outside English markets.
{
  ok("Google resolves languages instead of pinning one", /async function resolveLanguages/.test(google));
  ok("it looks them up rather than guessing an id", /FROM language_constant/.test(google),
    "a wrong language id targets the wrong audience just as quietly as a wrong geo id");
  ok("English stays the default", /return \{ resourceNames: \[ENGLISH_LANGUAGE_CONSTANT\]/.test(google));
  ok("\"all\" removes language targeting", /\^all\$[\s\S]{0,80}resourceNames: \[\]/.test(google));
  ok("an unknown language stops the build", /does not recognise the language/.test(google));
  ok("the campaign attaches every resolved language", /lang\.resourceNames\.map/.test(google));
  ok("and no longer pins the constant inline", !/language: \{ languageConstant: ENGLISH_LANGUAGE_CONSTANT \}/.test(google));
}

// The UI has to tell the truth about what the box accepts.
{
  eq("both cards say anywhere in the world", (os.match(/Anywhere in the world/g) || []).length, 2);
  ok("and show a foreign example", /London, United Kingdom/.test(os));
  ok("and a country-only example", /or a country on its own \(Canada\)/.test(os));
  ok("the Meta country box is now only a fallback", /If unclear<\/label>/.test(os));
  ok("and says so", /only a fallback/.test(os));
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PARITY: what the house account can do, a client can do (2026-08-20)
// ══════════════════════════════════════════════════════════════════════════════
// Bryson: "make sure everything we are doing for my own ads is updated and added for
// clients ads for the stuff that is applicable."
{
  // The house account could always aim a campaign at one niche and rebuild. A client had
  // no equivalent, and needs one for the same reason: one ad group holding "roof repair"
  // and "roof replacement" can never match either search well.
  ok("the focus box is no longer house-account only",
    !/\{client\.internal&&\(\s*<div style=\{\{marginBottom:12,padding:"11px 12px",borderRadius:10,backgroundColor:C\.goldDim/.test(os),
    "this gate hid per-service campaigns from every client");
  eq("both cards ask a client which service the campaign is for",
    (os.match(/Which service is this campaign for\?/g) || []).length, 2);
  ok("Google seeds a client campaign from that service", /const clientSeed = \(service\)/.test(os));
  ok("Meta does too", /const metaClientSeed = \(service\)/.test(os));
  ok("Google's fill honours which account it is", /client\.internal \? agencySeed\(audience\) : clientSeed\(audience\)/.test(os));
  ok("Meta's fill honours which account it is", /client\.internal \? metaAgencySeed\(audience\) : metaClientSeed\(audience\)/.test(os));

  // The AI brief has to agree with the campaign name and the seeds, or the ad is written
  // for the whole trade while everything around it says one service.
  eq("both generators send the chosen service as the niche",
    (os.match(/\(audience \|\| client\.niche \|\| ""\)/g) || []).length, 2);
  ok("Google's brief uses it as the offer too", /offer: client\.internal \? "Google and Meta ad management plus the landing pages behind them" : \(audience \|\| cs\.mainOffer \|\| ""\)/.test(os));

  // Things that are house-only ON PURPOSE stay that way. Meta's split testing is blocked
  // by Meta's own Development tier, not by a choice, and removing that gate would have
  // Meta rejecting writes on a schedule.
  const ap = read("../netlify/functions/ads-autopilot.mjs");
  ok("Meta split testing is still tier-gated", /ap\.splitTest !== false && mid && cl\.internal &&/.test(ap),
    "Development tier only permits writes to owned accounts");
  ok("and the gate is still labelled for the day it can go", /META-TIER-GATE/.test(ap));
  // Google has no such restriction, so clients already get creative testing there.
  ok("Google split testing is NOT house-only",
    !/splitTest !== false && gid && accessToken && cl\.internal/.test(ap),
    "nothing blocks Google creative testing on a client account");

  // Everything built in the last few days must reach clients too.
  ok("the conditions card renders on both cards regardless of account",
    (os.match(/<AreaConditionsCard locations=/g) || []).length === 2);
  ok("the creative strategy switch is not house-only", !/internal&&<CreativeStrategyCard/.test(os));
}



// ── Meta optimises for arrivals, not taps (2026-08-20) ─────────────────────
// A "link click" counts the tap; a "landing page view" counts the tap AND the page
// loading. The difference is mis-taps and people who swiped away before it rendered, and
// on LINK_CLICKS you pay for all of them because Meta optimised to produce taps.
// LINK_CLICKS was originally chosen because the alternative needed a pixel and there was
// none; Meta now serves it without one, and BoldLine's pixel is live.
{
  const create = meta.slice(meta.indexOf("async function createCampaign"), meta.indexOf("// ── Handler"));
  const code = create.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  // 🔴 THE GOAL IS NOW A BRANCH, AND THE PIXEL IS WHAT PICKS IT. Bryson, 2026-09-02, on the
  // house campaign: 6,997 views, 171 clicks, $87, ZERO leads. Nothing was broken — the
  // campaign was asking Meta for the cheapest landing page views and getting them. A high
  // CTR at a low CPC with no conversions is the signature of a traffic objective.
  //
  // Both branches are asserted, because either alone lets a real failure through. Lose the
  // no-pixel branch and every client without one has their campaign REJECTED at creation.
  // Lose the pixel branch and the fix silently reverts to buying clicks.
  ok("without a pixel it still buys landing page views, so a client with none is unaffected",
    /optimization_goal: chaseLeads \? "OFFSITE_CONVERSIONS" : "LANDING_PAGE_VIEWS"/.test(code));
  ok("with a pixel it buys conversions instead",
    /objective: chaseLeads \? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC"/.test(code));
  ok("and names the pixel and the LEAD event so Meta knows what to chase",
    /custom_event_type: "LEAD"/.test(code) && /pixel_id: pixelId/.test(code));
  // 🔴 Without this Meta may serve an on-Facebook instant form instead, which bypasses the
  // landing page, the lead pipeline and the CRM forward completely.
  ok("and sends people to the website rather than an instant form",
    /destination_type: "WEBSITE"/.test(code));
  // 🔴 The switch is a pasted pixel id, never something detected. Optimising for a LEAD
  // event on a pixel that never fires one makes Meta under-deliver and buy nothing, which
  // is quieter and worse than the campaign being rejected outright.
  ok("the switch is the pixel id being supplied, not guessed at",
    /const chaseLeads = !!pixelId/.test(code) && /const pixelId = String\(p\.pixelId/.test(code));
  ok("and no longer for raw link clicks", !/optimization_goal: "LINK_CLICKS"/.test(code),
    "paying for taps that never became a page view");
  // The billing event is what Meta CHARGES on and is deliberately unchanged.
  ok("billing stays on impressions", /billing_event: "IMPRESSIONS"/.test(code));
  // The one-hour delay is a safety buffer, not a bug: it is why a freshly published
  // campaign reads "Scheduled" rather than "Active", which looks broken and is not.
  ok("a new ad set still starts an hour out", /start_time: new Date\(Date\.now\(\) \+ 3600e3\)/.test(code),
    "the buffer is what stops a campaign spending the second it is created");
}



// ══════════════════════════════════════════════════════════════════════════════
// SWAPPING A LIVE AD'S IMAGE WITHOUT STOPPING THE CAMPAIGN (2026-08-20)
// ══════════════════════════════════════════════════════════════════════════════
// Bryson, after the story creative turned out to hide its URL under Instagram's button:
// "Is there a way to just have you regenerate all the images ... so I don't have to fully
// delete and restart the ad?"
//
// Replacing the file in storage does nothing: Meta copies the image into its own system at
// ad-creation time, and refuses to edit a published ad's creative at all. So the only route
// is a NEW AD. The question is what gets destroyed to get one, and deleting the campaign
// throws away targeting, budget and every hour of delivery learning.
{
  const fn = meta.slice(meta.indexOf("export async function replaceCreative"));
  const body = fn.slice(0, fn.indexOf("// ── Guarded write: campaign daily budget"));
  const code = body.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  ok("the swap exists", /export async function replaceCreative\(adAccountId, p\)/.test(meta));
  ok("it adds the new ad to the EXISTING ad set", /adsetId: source\.adsetId/.test(code),
    "a new ad set would have its own budget and its own learning to redo");

  // 🔴 ORDER IS THE WHOLE SAFETY ARGUMENT. Pausing first risks an ad set with no active ad,
  // which stops delivery; creating first means a failure leaves the old ad still running.
  const iCreate = code.indexOf("addAdToAdset");
  const iPause = code.indexOf('setAdStatus(source.id, "PAUSED")');
  ok("it creates before it pauses", iCreate > 0 && iPause > iCreate,
    "pausing first can leave an ad set with nothing running");
  ok("a failed pause does not throw away the new ad", /catch \(e\)[\s\S]{0,220}retired = true|retired = true[\s\S]{0,220}catch/.test(code) || /console\.error\("replaceCreative/.test(code));
  ok("and the caller is told the old one survived", /retired,/.test(code));

  // The copy must be CLONED, never retyped, or an image swap silently rewrites the ad.
  for (const field of ["headline", "primaryText", "description", "linkUrl", "pageId"]) {
    ok(`it carries the existing ${field} across`, new RegExp(`${field}: source\\.${field}`).test(code),
      "retyping copy during an image swap is how a headline changes by accident");
  }

  // 🔴 THE SPEND INVARIANT. Same argument as the creative-testing challenger: budget lives
  // on the campaign and the ad set, never on an ad.
  ok("the swap never touches a budget", !/daily_budget|setBudget|dailyBudget/.test(code),
    "adding an ad must not be able to raise the bill");
  ok("it never creates a campaign or an ad set", !/\/campaigns`|\/adsets`/.test(code));
  ok("it never activates the campaign", !/activateCampaign|status: "ACTIVE" \}/.test(code));

  // Swapping the creative on a PAUSED campaign must not start delivery.
  ok("the new ad matches the status of the one it replaces",
    /source\.status[\s\S]{0,80}"ACTIVE" \? "ACTIVE" : "PAUSED"/.test(code),
    "otherwise the swap is a back door to starting a paused campaign");

  // An ad built by hand in Ads Manager may not expose its copy; publishing an emptier
  // replacement is worse than refusing.
  ok("it refuses when the existing copy cannot be read", /could not read the existing ad's copy/.test(body));
  ok("it refuses when there is no ad to replace", /has no ads to replace/.test(body));
  ok("it requires a new image", /a new image is required/.test(body));
}

// The OS side.
{
  ok("the swap is reachable over HTTP", /action === "replaceCreative"/.test(meta));
  ok("and it validates its inputs", /adAccountId, campaignId, imageUrl required/.test(meta));

  const cm = os.slice(os.indexOf("function CampaignManagerScreen"));
  const body = cm.slice(0, cm.indexOf("\nfunction ", 10));
  ok("the OS calls it", /action:"replaceCreative"/.test(body));
  ok("the button is Meta only", /r\.platform==="meta"&&\([\s\S]{0,300}openSwap\(r\)/.test(body),
    "Google creatives are edited per ad group, not swapped wholesale");
  ok("videos are never offered as an ad image", /String\(m\.category\|\|""\)!=="video"/.test(body));
  ok("Studio creatives are offered first", /m\.category==="ad-creative"/.test(body));
  ok("it says the campaign keeps running", /campaign keeps running/i.test(body));
  ok("a half-done swap is surfaced, not swallowed", /could not be paused/.test(body),
    "two ads sharing one budget is untidy and the owner has to know");
}


console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-campaign-launch: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
