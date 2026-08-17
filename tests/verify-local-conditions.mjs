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
  ok("autopilot scopes conditions inside the client loop", perClient > loopStart && perClient - loopStart < 400);
  ok("autopilot uses the client's own target locations", /campaignSetup && cl\.campaignSetup\.targetLocations/.test(src));
  ok("autopilot records what the conditions were", /conditions: conditionsFingerprint/.test(src));
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-local-conditions: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
