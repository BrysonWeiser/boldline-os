// Local conditions feeding the ad writers. Run: node tests/verify-local-conditions.mjs
//
// Two things are being protected here, and the second matters more than the feature.
//
// 1. FACTUAL ACCURACY. "This alert covers your area" ends up as a claim inside a live ad
//    with money behind it. Loose matching would put a Bend, Oregon client under an alert
//    for "Gila Bend", so the matching is exact-place, not substring.
// 2. NOT ADVERTISING ON EMERGENCIES. Heat, cold, wind and ordinary storms drive real
//    demand for real trades. Evacuations, wildfires, tornadoes and civil emergencies are
//    never an angle, however much business they would bring in. Google and Meta both
//    reject it, and it is the wrong thing to do regardless.
//
// No network: alerts are stubbed, so this runs anywhere and cannot flake on the weather.

import { readFileSync } from "node:fs";
import {
  parseAreas, seasonContext, summariseAlerts, isAdvertisable,
  conditionsBlock, getLocalConditions, conditionsFingerprint, fetchAlerts,
  fetchRecent, summariseRecent, countyZones, resolveCounties,
} from "../netlify/lib/local-conditions.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const alert = (event, areaDesc, severity = "Severe", state = "AZ") =>
  ({ state, event, severity, areaDesc, headline: "" });

// ── Reading the service area ─────────────────────────────────────────────────
{
  const a = parseAreas("Tempe, AZ; Mesa, AZ; Chandler, AZ");
  eq("finds the state once", a.states.join(","), "AZ");
  eq("finds every city", a.cities.join(","), "Tempe,Mesa,Chandler");
}
eq("understands a spelled-out state", parseAreas("Phoenix Arizona").states.join(","), "AZ");
eq("handles several states", parseAreas("Phoenix, AZ; Las Vegas, NV").states.sort().join(","), "AZ,NV");
eq("empty area is not a crash", parseAreas("").states.length, 0);
eq("no US state means no weather lookup", parseAreas("London, UK").states.length, 0);

// ── 🔴 Emergencies are never an advertising angle ────────────────────────────
const NEVER = ["Tornado Warning", "Hurricane Warning", "Tropical Storm Warning", "Tsunami Warning",
  "Evacuation Immediate", "Fire Warning", "Red Flag Warning", "Civil Emergency Message",
  "Earthquake Warning", "Hazardous Materials Warning", "Child Abduction Emergency",
  "Shelter In Place Warning", "Local Area Emergency", "Flash Flood Warning",
  "Extreme Wind Warning", "Blizzard Warning", "Volcano Warning", "Ashfall Warning"];
for (const e of NEVER) ok(`never advertises on "${e}"`, !isAdvertisable(e));

const USABLE = ["Extreme Heat Warning", "Heat Advisory", "Excessive Heat Watch",
  "Freeze Warning", "Frost Advisory", "Cold Weather Advisory", "Winter Weather Advisory",
  "Wind Advisory", "High Wind Warning", "Dust Storm Warning", "Blowing Dust Advisory",
  "Air Quality Alert", "Severe Thunderstorm Warning", "Flood Advisory", "Dense Fog Advisory"];
for (const e of USABLE) ok(`can use "${e}" as demand context`, isAdvertisable(e));

ok("an unnamed event is not advertisable", !isAdvertisable(""));

// The block must actively tell the writer which events are off limits.
{
  const b = conditionsBlock({
    locations: "Phoenix, AZ",
    alerts: [alert("Extreme Heat Warning", "Central Phoenix"), alert("Fire Warning", "Tonto Basin")],
    cities: ["Phoenix"],
  });
  ok("usable alert is offered", /Extreme Heat Warning/.test(b));
  ok("emergency is named as NOT available", /NOT AVAILABLE AS AN ANGLE[\s\S]*Fire Warning/.test(b));
  ok("and is explicitly forbidden", /Do not reference them/.test(b));
  ok("the block forbids inventing weather", /Invent nothing/.test(b));
  ok("the block warns against forcing an irrelevant angle", /gimmicky|ONLY where it genuinely/.test(b));
  ok("the block covers e-commerce seasonality", /e-commerce/i.test(b));
}

// ── 🔴 Matching is exact-place, so the claim is true ─────────────────────────
const matched = (city, areaDesc) =>
  summariseAlerts([alert("Extreme Heat Warning", areaDesc)], [city])[0].matchedCities;

ok("Bend does NOT match Gila Bend", matched("Bend", "Gila Bend; Tonopah Desert").length === 0);
ok("Hills does NOT match Fountain Hills", matched("Hills", "Fountain Hills/East Mesa").length === 0);
ok("a 2-letter fragment never matches", matched("Me", "East Mesa").length === 0);
ok("Mesa matches East Mesa", matched("Mesa", "Fountain Hills/East Mesa").includes("Mesa"));
ok("Phoenix matches Central Phoenix", matched("Phoenix", "Central Phoenix; Deer Valley").includes("Phoenix"));
ok("Avondale matches a slashed zone", matched("Avondale", "Buckeye/Avondale").includes("Avondale"));
ok("a two-word city matches", matched("Apache Junction", "Apache Junction/Gold Canyon").includes("Apache Junction"));
ok("Gila Bend matches itself", matched("Gila Bend", "Gila Bend; Tonopah Desert").includes("Gila Bend"));

// An alert in the same state but a different town is context, not a claim about them.
{
  const b = conditionsBlock({
    locations: "Tempe, AZ",
    alerts: [alert("Extreme Heat Warning", "Yuma; Parker Valley")],
    cities: ["Tempe"],
  });
  ok("out-of-area alert is flagged as NOT their area", /NOT this client's area/.test(b));
  ok("and is not claimed as covering them", !/in this client's own service area/.test(b));
}
{
  const b = conditionsBlock({
    locations: "Tempe, AZ",
    alerts: [alert("Extreme Heat Warning", "Tempe; South Mountain")],
    cities: ["Tempe"],
  });
  ok("in-area alert names the matched city", /covers Tempe, in this client's own service area/.test(b));
}

// ── Many zone-level alerts collapse to one line ──────────────────────────────
{
  const many = ["Central Phoenix", "North Phoenix", "Deer Valley", "Buckeye/Avondale"]
    .map((z) => alert("Extreme Heat Warning", z));
  const sum = summariseAlerts(many, ["Phoenix"]);
  eq("four zones become one event", sum.length, 1);
  eq("but the zone count is kept", sum[0].zones, 4);
}
// Alerts covering the client's own area sort first.
{
  const sum = summariseAlerts(
    [alert("Wind Advisory", "Yuma"), alert("Heat Advisory", "Tempe")], ["Tempe"]);
  eq("their own area leads", sum[0].event, "Heat Advisory");
}

// ── Date and season ──────────────────────────────────────────────────────────
{
  const s = seasonContext(new Date("2026-08-17T00:00:00Z"));
  eq("month is named", s.month, "August");
  eq("season is right", s.season, "summer");
  eq("date is plain", s.date, "2026-08-17");
}
eq("January is winter", seasonContext(new Date("2026-01-10T00:00:00Z")).season, "winter");
eq("October is autumn", seasonContext(new Date("2026-10-10T00:00:00Z")).season, "autumn");
ok("the date always reaches the writer", /Today's date: 2026-08-17/.test(
  conditionsBlock({ locations: "Phoenix, AZ", now: new Date("2026-08-17T00:00:00Z") })));

// ── 🔴 A weather outage must never stop an ad being written ──────────────────
{
  const boom = async () => { throw new Error("network down"); };
  const r = await getLocalConditions({ locations: "Phoenix, AZ", fetchImpl: boom });
  ok("a failed lookup still returns a usable block", typeof r.block === "string" && r.block.length > 50);
  eq("with no alerts claimed", r.alerts.length, 0);
  ok("and says so plainly", /no ordinary weather alerts active/.test(r.block));
}
{
  const notOk = async () => ({ ok: false, status: 503, json: async () => ({}) });
  eq("an HTTP error yields no alerts", (await fetchAlerts(["AZ"], { fetchImpl: notOk })).length, 0);
}
{
  const junk = async () => ({ ok: true, json: async () => ({ nonsense: true }) });
  eq("an unexpected shape yields no alerts", (await fetchAlerts(["AZ"], { fetchImpl: junk })).length, 0);
}
eq("no state means no lookup at all", (await fetchAlerts([], { fetchImpl: async () => { throw new Error("should not be called"); } })).length, 0);

// A stubbed success proves the happy path really reads the NWS shape.
{
  const stub = async () => ({
    ok: true,
    json: async () => ({ features: [
      { properties: { event: "Extreme Heat Warning", severity: "Severe", areaDesc: "Central Phoenix", headline: "hot" } },
      { properties: { event: "Fire Warning", severity: "Severe", areaDesc: "Tonto Basin", headline: "fire" } },
    ] }),
  });
  const r = await getLocalConditions({ locations: "Phoenix, AZ", fetchImpl: stub });
  eq("both alerts are read", r.alerts.length, 2);
  eq("only the usable one is offered", r.usable.length, 1);
  eq("and it is the heat warning", r.usable[0].event, "Extreme Heat Warning");
}

// ── Fingerprint: tells "nothing changed" from "the season turned" ────────────
{
  const a = summariseAlerts([alert("Extreme Heat Warning", "Tempe")], ["Tempe"]);
  const b = summariseAlerts([alert("Extreme Heat Warning", "Tempe")], ["Tempe"]);
  const c = summariseAlerts([alert("Winter Weather Advisory", "Tempe")], ["Tempe"]);
  eq("same conditions, same fingerprint", conditionsFingerprint(a), conditionsFingerprint(b));
  ok("changed conditions, changed fingerprint", conditionsFingerprint(a) !== conditionsFingerprint(c));
  eq("quiet weather has a fingerprint too", conditionsFingerprint([]), "none");
  ok("emergencies are left out of the fingerprint",
    conditionsFingerprint(summariseAlerts([alert("Fire Warning", "Tempe")], ["Tempe"])) === "none");
}

// ── Every ad writer actually receives it ─────────────────────────────────────
for (const [file, label] of [
  ["netlify/functions/ad-generator-background.mjs", "Google + Meta campaign writer"],
  ["netlify/functions/ad-generator.mjs", "creative angle writer"],
  ["netlify/functions/ads-autopilot.mjs", "always-on challenger writer"],
]) {
  const src = readFileSync(file, "utf8");
  ok(`${label} imports the conditions`, /from "\.\.\/lib\/local-conditions\.mjs"/.test(src));
  ok(`${label} calls getLocalConditions`, /getLocalConditions\(/.test(src));
  ok(`${label} puts them in the prompt`, /WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW/.test(src));
}
{
  // Autopilot must fetch per client, not once for everyone — two clients can be in
  // different states, and a Phoenix heat warning is not a Seattle selling point.
  const src = readFileSync("netlify/functions/ads-autopilot.mjs", "utf8");
  const perClient = src.indexOf("let localCond = null;");
  const loopStart = src.indexOf("for (const row of rows || []) {");
  // Asserted STRUCTURALLY, not by character distance. The original version required the
  // declaration within 400 characters of the loop opening, which is not the invariant —
  // adding an unrelated guard and a comment at the top of the loop broke it while the
  // scoping stayed perfectly correct. What actually matters is that `localCond` is
  // declared INSIDE the loop and nowhere above it, so one client's weather can never be
  // read by the next.
  ok("autopilot declares conditions inside the client loop", perClient > loopStart, "declared before the loop");
  eq("autopilot declares localCond exactly once", (src.match(/let localCond\b/g) || []).length, 1);
  ok("autopilot never declares localCond at module scope",
    src.slice(0, loopStart).indexOf("localCond") < 0,
    "a shared binding would leak one client's weather into the next");
  ok("autopilot uses the client's own target locations", /campaignSetup && cl\.campaignSetup\.targetLocations/.test(src));
  // Both windows, or the trigger is half blind. Passing only `summary` still compiles and
  // still returns a fingerprint, it just silently ignores everything the area has been
  // through — which is the half that matters for storm-driven trades.
  ok("autopilot computes the fingerprint once per client",
    /const condFp = conditionsFingerprint\(localCond\.summary, localCond\.recentSummary\)/.test(src));
  ok("no fingerprint call anywhere forgets the recent window",
    !/conditionsFingerprint\(\s*localCond\.summary\s*\)/.test(src),
    "a one-argument call drops the recent window out of the change trigger");
  ok("autopilot records the conditions on the action", /conditions: condFp/.test(src));
}

// ── Landing pages get DURABLE framing, not today's alert ────────────────────
// A page sits at the same URL for months. "Storm damage today" is wrong by Thursday.
{
  const a = [alert("Extreme Heat Warning", "Central Phoenix")];
  const ads = conditionsBlock({ locations: "Phoenix, AZ", alerts: a, cities: ["Phoenix"] });
  const page = conditionsBlock({ locations: "Phoenix, AZ", alerts: a, cities: ["Phoenix"], mode: "landing" });
  ok("landing mode gives different guidance", ads !== page);
  ok("landing mode says the page outlives the weather", /stays up for months/.test(page));
  ok("landing mode steers to the season, not today", /never for today's specific alert/i.test(page));
  ok("landing mode tells it to match the ads", /Match the page to the ads/.test(page));
  ok("landing mode still forbids inventing", /Invent nothing/.test(page));
  ok("landing mode still forbids disasters", /never reference a disaster/i.test(page));
  ok("ad mode still allows the specific alert", /AC out in this heat/.test(ads));
  ok("both modes still list the live alert", /Extreme Heat Warning/.test(page));
}
{
  const src = readFileSync("netlify/functions/generate-landing.mjs", "utf8");
  ok("landing writer imports the conditions", /from "\.\.\/lib\/local-conditions\.mjs"/.test(src));
  ok("landing writer asks for landing mode", /mode:\s*"landing"/.test(src));
  ok("landing writer uses the client's service area", /targetLocations \|\| cs\.serviceArea/.test(src));
  ok("landing writer puts it in the prompt", /WHAT IS HAPPENING IN THE SERVICE AREA RIGHT NOW/.test(src));
}

// ── 🔴 The conditions-change trigger must not churn live ads ────────────────
// Replays the trigger day by day using the REAL constants out of the file, so the
// brakes are tested rather than described.
{
  const src = readFileSync("netlify/functions/ads-autopilot.mjs", "utf8");
  const DWELL = Number((src.match(/CONDITIONS_DWELL_HOURS = (\d+)/) || [])[1]);
  const COOL = Number((src.match(/CONDITIONS_COOLDOWN_HOURS = (\d+)/) || [])[1]);
  ok("a dwell period exists and is at least a day", DWELL >= 24, String(DWELL));
  ok("a cooldown exists and is at least a week", COOL >= 168, String(COOL));

  const H = 3600e3;
  const replay = (days, impressions = 0) => {
    let ap = {}, recent = [], fired = [];
    days.forEach((condFp, d) => {
      const now = Date.parse("2026-08-01T12:00:00Z") + d * 24 * H;
      const prev = (ap.conditionsWatch && ap.conditionsWatch.fp === condFp) ? ap.conditionsWatch : null;
      const watch = { fp: condFp, since: prev ? prev.since : new Date(now).toISOString() };
      const settled = (now - Date.parse(watch.since)) >= DWELL * H;
      const last = recent.filter((a) => a.conditions).sort((x, y) => Date.parse(y.at) - Date.parse(x.at))[0];
      const changed = settled && condFp !== "none"
        && (!last || last.conditions !== condFp)
        && (!last || (now - Date.parse(last.at)) >= COOL * H);
      if (impressions >= 500 || changed) {
        recent = [{ at: new Date(now).toISOString(), conditions: condFp }, ...recent];
        fired.push(d);
      }
      ap = { ...ap, conditionsWatch: watch };   // saved every run, quiet or not
    });
    return fired;
  };
  const heat = "AZ:Extreme Heat Warning*", wind = "AZ:High Wind Warning*";

  eq("an advisory flapping daily never rewrites an ad",
    replay(["none", heat, "none", heat, "none", heat, "none", heat]).length, 0);
  eq("quiet weather never rewrites an ad", replay(Array(30).fill("none")).length, 0);
  eq("weather that settles rewrites exactly once",
    replay(["none", ...Array(9).fill(heat)]).length, 1);
  ok("and only after the dwell has passed",
    replay(["none", ...Array(9).fill(heat)])[0] >= 1 + DWELL / 24, "fired too early");
  eq("two real season changes rewrite twice",
    replay([...Array(20).fill(heat), ...Array(20).fill(wind)]).length, 2);
  ok("and they are a cooldown apart", (() => {
    const f = replay([...Array(20).fill(heat), ...Array(20).fill(wind)]);
    return (f[1] - f[0]) * 24 >= COOL;
  })());
  eq("a season change straight back and forth still respects cooldown",
    replay([...Array(5).fill(heat), ...Array(5).fill(wind), ...Array(5).fill(heat)]).length, 1);

  // The wiring these depend on.
  ok("the trigger ignores the impressions floor on a real change", /!enoughTraffic && !condChanged/.test(src));
  ok("the trigger requires settled conditions", /condSettled/.test(src));
  ok("the trigger skips quiet weather", /condFp !== "none"/.test(src));
  ok("the action records which trigger fired", /trigger: condChanged && !enoughTraffic/.test(src));
  // 🔴 The bug that made the whole feature dead: the watch was saved only when autopilot
  // acted, so on quiet days `since` reset and dwell never accumulated.
  ok("the watch is saved even on a run with no actions", /actions\.length \|\| watchChanged/.test(src));
  ok("and lastRun is still only stamped when it acted", /actions\.length \? \{ lastRun/.test(src));
}


// ══════════════════════════════════════════════════════════════════════════════
// WHAT THE AREA HAS BEEN THROUGH — the trailing window (2026-08-20)
// ══════════════════════════════════════════════════════════════════════════════
// Bryson: "make sure that also looks at whats going on in the area. Like right now for
// metro arizona there has been lots of storms recently."
//
// Active alerts alone MISS THIS ENTIRELY. Measured on the day he asked, Arizona had 11
// active alerts and not one was a storm, while the previous 14 days carried 146 Severe
// Thunderstorm Warnings. Storm trades sell into the aftermath, so the aftermath has to be
// visible to the writer.
const past = (event, areaDesc, at, state = "AZ") => ({ state, event, areaDesc, severity: "Severe", headline: "", at });
const days = (n) => new Date(Date.UTC(2026, 7, 20 - n)).toISOString();

{
  const rows = [
    past("Severe Thunderstorm Warning", "Maricopa, AZ", days(1)),
    past("Severe Thunderstorm Warning", "Maricopa, AZ", days(1)),   // same day, more zones
    past("Severe Thunderstorm Warning", "Maricopa, AZ", days(4)),
    past("Severe Thunderstorm Warning", "Pinal, AZ",    days(9)),
  ];
  const [s1] = summariseRecent(rows, [], new Set(["maricopa"]));
  eq("recent counts DAYS, not rows", s1.days, 3);
  eq("recent keeps the raw row count too", s1.rows, 4);
  ok("recent matches the client's county", s1.namesClientArea);
  eq("and counts how many of those days were in-area", s1.inAreaDays, 2);

  // One stray advisory is not a pattern and must never become an ad angle.
  const stray = summariseRecent([past("Dust Advisory", "Maricopa, AZ", days(11))], [], new Set(["maricopa"]));
  eq("a single stray event is not reported as a pattern", stray.length, 0);

  // Emergencies stay out of the recent window exactly as they stay out of the live one.
  const fire = summariseRecent([1,2,3].map(n => past("Red Flag Warning", "Maricopa, AZ", days(n))), [], new Set(["maricopa"]));
  ok("an emergency still summarises", fire.length === 1);
  ok("but is never advertisable", !isAdvertisable(fire[0].event));
}

// ── 🔴 THE COUNTY BUG: the NWS uses two zone schemes ────────────────────────
// Heat warnings name towns ("Central Phoenix"); storms name COUNTIES ("Maricopa, AZ").
// The city matcher only understood the first, so every storm in Bryson's own metro was
// reported as "elsewhere in the state, NOT this client's area" — the exact angle he asked
// for, suppressed by a false negative.
{
  eq("a county zone is recognised", countyZones("Maricopa, AZ; Pinal, AZ").length, 2);
  eq("and named correctly", countyZones("Maricopa, AZ")[0].county, "Maricopa");
  eq("a public zone is NOT mistaken for a county", countyZones("Central Phoenix; East Mesa").length, 0);
  eq("nor is a hyphenated public zone", countyZones("Lake Mead - AZ side").length, 0);

  const storm = [alert("Severe Thunderstorm Warning", "Maricopa, AZ; Pinal, AZ")];
  const withCounty = summariseAlerts(storm, ["Gilbert", "Mesa"], new Set(["maricopa"]));
  ok("a county alert now matches a client in that county", withCounty[0].namesClientArea);
  ok("and it is not flagged unconfirmed", !withCounty[0].unconfirmed);

  // The regression guard: this is precisely what used to happen.
  const cityOnly = summariseAlerts(storm, ["Gilbert", "Mesa"], new Set());
  ok("without a resolved county it is NOT claimed as their area", !cityOnly[0].namesClientArea);
  ok("but it is marked UNCONFIRMED rather than denied", cityOnly[0].unconfirmed,
    "denying it is the false statement this fix exists to remove");

  // A county that resolves and genuinely does not match is a real negative, not unknown.
  const elsewhere = summariseAlerts(storm, ["Bend"], new Set(["deschutes"]));
  ok("a resolved county that does not match is a firm no", !elsewhere[0].namesClientArea);
  ok("and is not softened to unconfirmed", !elsewhere[0].unconfirmed);

  // The old city path must still work, and still be strict.
  const heat = summariseAlerts([alert("Extreme Heat Warning", "Central Phoenix; East Mesa")], ["Mesa"], new Set());
  ok("city matching still works after the county change", heat[0].namesClientArea);
  const gila = summariseAlerts([alert("Flood Advisory", "Gila Bend")], ["Bend"], new Set());
  ok("and Gila Bend still never matches a Bend client", !gila[0].namesClientArea);
}

// ── The wording never states more than it knows ─────────────────────────────
{
  const storm = [alert("Severe Thunderstorm Warning", "Maricopa, AZ")];
  const known = conditionsBlock({ locations: "Gilbert, AZ", alerts: storm, cities: ["Gilbert"], counties: new Set(["maricopa"]) });
  ok("a matched county reads as their own area", /in this client's own service area/.test(known));

  const unknown = conditionsBlock({ locations: "Gilbert, AZ", alerts: storm, cities: ["Gilbert"] });
  ok("an unresolved county says so plainly", /NOT confirmed whether this client's towns are inside it/.test(unknown));
  ok("and forbids claiming their customers are affected", /never say their customers are affected/.test(unknown));
  // Scoped to the ALERT LIST, not the whole block: the guidance further down legitimately
  // contains the phrase "elsewhere in the state" while explaining what it means.
  const alertLines = unknown.slice(unknown.indexOf("LIVE WEATHER"), unknown.indexOf("HOW TO USE THIS"));
  ok("an unresolved county is never called elsewhere", !/elsewhere in the state/.test(alertLines),
    "that was the false statement");
}

// ── The recent window reaches the prompt, with the right framing ────────────
{
  const rows = [1,2,3,4,5,6].map(n => past("Severe Thunderstorm Warning", "Maricopa, AZ", days(n)));
  const b = conditionsBlock({ locations: "Gilbert, AZ", alerts: [], recent: rows, cities: ["Gilbert"], counties: new Set(["maricopa"]) });
  ok("the block reports what the area has been through", /WHAT THE AREA HAS BEEN THROUGH/.test(b));
  ok("naming the event and the day count", /Severe Thunderstorm Warning in AZ on 6 of the last 14 days/.test(b));
  ok("the aftermath is framed as the stronger angle", /ALREADY HAPPENED IS OFTEN THE STRONGER ANGLE/.test(b));
  ok("it names the trades that sell into the aftermath", /roofing, restoration, tree work/i.test(b));
  ok("and forbids manufacturing urgency from it", /Do not manufacture urgency/.test(b));

  const page = conditionsBlock({ locations: "Gilbert, AZ", recent: rows, cities: ["Gilbert"], counties: new Set(["maricopa"]), mode: "landing" });
  ok("a landing page treats a run of events as the SEASONAL pattern", /evidence of the SEASONAL PATTERN/.test(page));
  ok("and still refuses last-night framing", /does not justify/.test(page));
}

// ── The change trigger sees the pattern, but is not shaken by noise ─────────
// This signature drives live-ad rewrites. A raw count would move on almost every run as
// the 14-day window slides, so it is bucketed.
{
  const live = [];
  const mk = (n) => summariseRecent(Array.from({length: n}, (_, i) => past("Severe Thunderstorm Warning", "Maricopa, AZ", days(i + 1))), [], new Set(["maricopa"]));
  eq("a quiet area fingerprints as none", conditionsFingerprint([], []), "none");
  eq("one or two days does not move the signature", conditionsFingerprint(live, mk(2)), "none");
  ok("a real run does", conditionsFingerprint(live, mk(4)) !== "none");
  eq("and neighbouring counts inside a bucket are identical",
    conditionsFingerprint(live, mk(4)), conditionsFingerprint(live, mk(5)));
  ok("while a genuine escalation changes it",
    conditionsFingerprint(live, mk(4)) !== conditionsFingerprint(live, mk(8)));
  ok("live conditions still drive it on their own",
    conditionsFingerprint(summariseAlerts([alert("Extreme Heat Warning", "Central Phoenix")], ["Phoenix"]), []) !== "none");
}

// ── Never blocks an ad, in either window ───────────────────────────────────
{
  const dead = async () => { throw new Error("nws down"); };
  const c = await getLocalConditions({ locations: "Gilbert, AZ", fetchImpl: dead });
  ok("a total outage still returns a usable block", typeof c.block === "string" && c.block.length > 0);
  eq("with no invented alerts", c.usable.length, 0);
  eq("and no invented history", c.recentUsable.length, 0);

  const archiveOnly = async (url) => String(url).includes("alerts/active")
    ? { ok: true, json: async () => ({ features: [] }) }
    : { ok: false };
  const c2 = await getLocalConditions({ locations: "Gilbert, AZ", fetchImpl: archiveOnly });
  ok("the archive failing alone does not break the block", typeof c2.block === "string" && c2.block.length > 0);

  eq("recent can be skipped entirely", (await getLocalConditions({
    locations: "Gilbert, AZ", includeRecent: false,
    fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }),
  })).recent.length, 0);

  eq("a non-US area makes no lookup at all", (await fetchRecent([], {})).length, 0);
}

// ── 🔴 META WAS NEVER SENDING ITS SERVICE AREA (2026-08-20) ────────────────
// The server reads the weather from `locations`. The Meta launch card never sent it, so
// every Meta variant since the conditions feature shipped was written with season-only
// context while the Google ones got live data. The Meta card has no locations box of its
// own, so it derives one from the client.
{
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const meta = src.slice(src.indexOf("function MetaLaunchCard"));
  const body = meta.slice(0, meta.indexOf("\nfunction "));
  ok("the Meta generator sends a service area", /action:"meta"[\s\S]{0,900}?locations: metaLocations/.test(body),
    "without this Meta ads get no local conditions at all");
  ok("and it is derived from the client's own targeting", /targetLocations \|\| cs\.serviceArea/.test(body));

  // Both launch cards show the same facts to whoever is typing.
  ok("the Google card shows conditions", /<AreaConditionsCard locations=\{f\.locationsText\}\/>/.test(src));
  ok("the Meta card shows conditions", /<AreaConditionsCard locations=\{metaLocations\}\/>/.test(src));
  ok("the card reads from the shared endpoint", /area-conditions/.test(src));

  const card = src.slice(src.indexOf("function AreaConditionsCard"));
  const cardBody = card.slice(0, card.indexOf("\nfunction "));
  ok("the card only shows in-area conditions", /\.filter\(a=>a\.inArea\)/.test(cardBody),
    "showing an out-of-area alert next to an ad form reads like a suggestion");
  ok("and stays silent when there is nothing to say", /if\(!now\.length&&!past\.length\) return null/.test(cardBody));
  ok("a lookup failure is silent, not an error banner", /if\(state!=="done"\|\|!data\) return null/.test(cardBody));

  // The endpoint must never hand an emergency to a UI sitting beside a copy field.
  const ep = readFileSync(new URL("../netlify/functions/area-conditions.mjs", import.meta.url), "utf8");
  ok("the endpoint sends only advertisable conditions", /cond\.usable\.map/.test(ep) && /cond\.recentUsable\.map/.test(ep));
  ok("and never the raw summary", !/summary: cond\.summary/.test(ep));
  ok("the endpoint requires an owner session", /Invalid session/.test(ep) && /Not authenticated/.test(ep));
  ok("and writes nothing", !/\.update\(|\.insert\(|\.upsert\(/.test(ep));
}


console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-local-conditions: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
