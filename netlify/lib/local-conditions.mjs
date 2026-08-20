// What is actually happening in the client's service area right now, as FACTS the ad
// writer can use — not as something the model guesses at.
//
// Bryson, 2026-08-17: "for any ads my own or for clients I want to make sure that the
// bots also look at whats going on in the targeted areas (ex. arizona having lots of
// storms right now so for roofers the ads should be about storms and them being the
// company people call to fix their roof. Another example would be hvac for ac repairs
// during the hot arizona days)".
//
// WHY THIS FILE EXISTS AT ALL: the model that writes the ads has a training cutoff and
// no live data in that call. Asked "is Arizona stormy right now" it can only guess, and
// a guessed weather claim in a live ad is a lie with money behind it. So the facts are
// fetched here and handed over, and the prompt is told to use them only when they are
// genuinely relevant.
//
// SOURCE: the US National Weather Service public API (api.weather.gov). Free, no key,
// no account, no rate-limit paperwork. It requires a User-Agent header. Non-US areas get
// season-only context, which is still useful.
//
// NEVER BREAKS AD GENERATION. Every failure path returns season-only context, because an
// ad that ships without a weather angle is fine and an ad that never ships is not.

const NWS = "https://api.weather.gov/alerts/active";
// 🔴 THE PAST MATTERS AS MUCH AS THE PRESENT, AND FOR SOME TRADES MORE.
// Bryson, 2026-08-20: "make sure that also looks at whats going on in the area. Like right
// now for metro arizona there has been lots of storms recently".
//
// Active alerts alone MISS HIS EXAMPLE ENTIRELY. Measured on the day he asked: Arizona had
// 11 active alerts, all heat and one flood advisory, and NOT ONE storm. The previous 14
// days carried 146 Severe Thunderstorm Warnings and 11 Dust Storm Warnings. So a roofer's
// ad written that morning would have said nothing about storms, on the exact day the whole
// metro was full of damaged roofs.
//
// That is not an edge case, it is the normal shape of storm-driven trades. The demand
// arrives AFTER the weather leaves. A homeowner does not call a roofer during the storm,
// they call once they see the ceiling stain. Roofing, restoration, tree work, glass, auto
// hail repair, fencing and landscaping all sell into the aftermath, and the aftermath is
// invisible to an "active alerts" query.
const NWS_ARCHIVE = "https://api.weather.gov/alerts";
const RECENT_DAYS = 14;   // long enough to cover a monsoon run, short enough to still be "recently"
const UA = "BoldLineOS/1.0 (ads; contact via boldlinemedia.com)";
const TIMEOUT_MS = 6000;
const RECENT_TIMEOUT_MS = 9000;  // a 14-day window is a much bigger payload than "active"

const STATE_CODES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const STATE_NAMES = {
  alabama:"AL", alaska:"AK", arizona:"AZ", arkansas:"AR", california:"CA", colorado:"CO",
  connecticut:"CT", delaware:"DE", florida:"FL", georgia:"GA", hawaii:"HI", idaho:"ID",
  illinois:"IL", indiana:"IN", iowa:"IA", kansas:"KS", kentucky:"KY", louisiana:"LA",
  maine:"ME", maryland:"MD", massachusetts:"MA", michigan:"MI", minnesota:"MN",
  mississippi:"MS", missouri:"MO", montana:"MT", nebraska:"NE", nevada:"NV",
  "new hampshire":"NH", "new jersey":"NJ", "new mexico":"NM", "new york":"NY",
  "north carolina":"NC", "north dakota":"ND", ohio:"OH", oklahoma:"OK", oregon:"OR",
  pennsylvania:"PA", "rhode island":"RI", "south carolina":"SC", "south dakota":"SD",
  tennessee:"TN", texas:"TX", utah:"UT", vermont:"VT", virginia:"VA", washington:"WA",
  "west virginia":"WV", wisconsin:"WI", wyoming:"WY", "washington dc":"DC",
};

// 🔴 THE POLICY LINE, AND IT MATTERS MORE THAN THE FEATURE.
// Google and Meta both restrict ads that exploit a tragedy or an active emergency, and
// beyond the policy it is simply the wrong thing to do. The test is not "is this weather"
// but "is this a normal seasonal reason someone needs this trade, or is it an event where
// people are in danger right now".
//
// Heat, cold, wind, dust and ordinary storms drive real demand for real trades and are
// fair to reference as the CUSTOMER'S problem. Evacuations, wildfires, tornadoes,
// hurricanes and civil emergencies are never an advertising angle, no matter how much
// business they would bring in.
const NEVER_ADVERTISE = [
  /tornado/i, /hurricane/i, /tropical/i, /typhoon/i, /tsunami/i, /evacuat/i,
  /\bfire\b/i, /wildfire/i,
  /red flag/i, /volcan/i, /ashfall/i, /earthquake/i,
  /civil/i, /hazardous materials/i, /radiolog/i, /nuclear/i, /law enforcement/i,
  /abduction/i, /shelter in place/i, /local area emergency/i, /911/i,
  /flash flood warning/i, /flash flood emergency/i, /extreme wind/i, /blizzard/i,
];
export const isAdvertisable = (event) => {
  const e = String(event || "");
  if (!e) return false;
  return !NEVER_ADVERTISE.some((re) => re.test(e));
};

// Pull 2-letter state codes and city names out of the free-text service area.
// "Tempe, AZ; Mesa, AZ" and "Phoenix Arizona" both work.
export const parseAreas = (locationsText) => {
  const raw = String(locationsText || "");
  const states = new Set();
  for (const m of raw.matchAll(/\b([A-Z]{2})\b/g)) {
    if (STATE_CODES.includes(m[1])) states.add(m[1]);
  }
  const lower = raw.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (lower.includes(name)) states.add(code);
  }
  // City = a comma/semicolon/newline separated chunk with the state stripped off.
  const cities = raw.split(/[;,\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^[A-Z]{2}$/.test(s) && !STATE_NAMES[s.toLowerCase()])
    .map((s) => s.replace(/\s+\d{5}(-\d{4})?$/, "").trim())
    .filter((s) => s.length > 2 && s.length < 40);
  return { states: [...states], cities: [...new Set(cities)] };
};

// Month and season, so a campaign written in August is not pitched for spring. Kept
// deliberately dumb: the model knows what a Phoenix August means, it just needs the date.
export const seasonContext = (now = new Date()) => {
  const month = now.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const m = now.getUTCMonth();
  const season = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
  return { month, season, date: now.toISOString().slice(0, 10) };
};

// Live alerts for the given states. Best-effort by design.
export const fetchAlerts = async (states, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) => {
  if (!states || !states.length) return [];
  const out = [];
  for (const st of states.slice(0, 4)) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${NWS}?area=${encodeURIComponent(st)}`, {
        headers: { "User-Agent": UA, accept: "application/geo+json" },
        signal: ctl.signal,
      });
      if (!res.ok) continue;
      const body = await res.json();
      for (const f of (body && body.features) || []) {
        const p = (f && f.properties) || {};
        out.push({
          state: st,
          event: String(p.event || "").trim(),
          severity: String(p.severity || "").trim(),
          areaDesc: String(p.areaDesc || "").trim(),
          headline: String(p.headline || "").trim(),
        });
      }
    } catch {
      // Network trouble, a slow NWS, a shape change: none of it may stop an ad being written.
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
};

// What the area has actually BEEN THROUGH, over a trailing window. Same source, same
// shape, different question: not "is it storming" but "has it been storming".
//
// NOTE ON VOLUME. The NWS issues one alert per zone per event, so a single storm night
// across the Valley is dozens of rows. That is why the summary below counts DAYS as well
// as rows: "146 warnings" sounds like the apocalypse, "storms on 9 of the last 14 days" is
// the fact a person would actually recognise.
export const fetchRecent = async (
  states, { fetchImpl = fetch, timeoutMs = RECENT_TIMEOUT_MS, days = RECENT_DAYS, now = new Date() } = {}
) => {
  if (!states || !states.length) return [];
  const start = new Date(now.getTime() - days * 86400e3).toISOString();
  const end = new Date(now.getTime()).toISOString();
  const out = [];
  for (const st of states.slice(0, 4)) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const url = `${NWS_ARCHIVE}?area=${encodeURIComponent(st)}` +
        `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=500`;
      const res = await fetchImpl(url, {
        headers: { "User-Agent": UA, accept: "application/geo+json" },
        signal: ctl.signal,
      });
      if (!res.ok) continue;
      const body = await res.json();
      for (const f of (body && body.features) || []) {
        const p = (f && f.properties) || {};
        out.push({
          state: st,
          event: String(p.event || "").trim(),
          severity: String(p.severity || "").trim(),
          areaDesc: String(p.areaDesc || "").trim(),
          headline: String(p.headline || "").trim(),
          at: String(p.effective || p.sent || p.onset || "").trim(),
        });
      }
    } catch {
      // Same rule as the live fetch: history is a bonus, never a blocker.
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
};

// Collapse many zone-level alerts into one line per event type, and mark the ones that
// actually name one of the client's cities — a heat warning in Yuma is not a selling point
// for a Tempe plumber.
// MATCHING IS DELIBERATELY STRICT, because "this alert covers your area" becomes a
// factual claim inside a live ad. Bare `includes` claims a Bend, Oregon client is covered
// by an alert for "Gila Bend". Word boundaries do not fix that either, since "Bend" is a
// whole word inside "Gila Bend".
//
// The NWS writes zones as semicolon-separated names, sometimes joined with a slash and
// sometimes carrying a direction: "Central Phoenix", "Fountain Hills/East Mesa",
// "Buckeye/Avondale", "Gila Bend". So: split the zone into its individual place names,
// strip a leading direction word, and require the remainder to EQUAL the client's city.
//   "East Mesa"    -> strip "East" -> "Mesa"      matches a Mesa client      ✓
//   "Gila Bend"    -> "Gila" is not a direction   never matches a Bend client ✓
const DIRECTIONS = /^(north|south|east|west|central|northwest|northeast|southwest|southeast|upper|lower|greater|metro|n|s|e|w|nw|ne|sw|se)\s+/i;
const zonePlaces = (areaDesc) =>
  String(areaDesc || "")
    .split(/[;,]/)
    .flatMap((seg) => seg.split("/"))
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap((name) => {
      const bare = name.replace(DIRECTIONS, "").trim();
      return bare && bare.toLowerCase() !== name.toLowerCase() ? [name, bare] : [name];
    });

const cityHits = (areaDesc, cities) => {
  const places = zonePlaces(areaDesc).map((p) => p.toLowerCase());
  return cities.filter((c) => {
    const name = String(c || "").trim().toLowerCase();
    if (name.length < 3) return false;
    return places.includes(name);
  });
};

// 🔴 THE NWS USES TWO DIFFERENT ZONE SCHEMES, AND MISSING THAT MADE THIS FEATURE LIE.
// Found 2026-08-20 while checking Bryson's own market:
//
//   Extreme Heat Warning  ->  "Central Phoenix; Fountain Hills/East Mesa; ..."   (public zones)
//   Severe Thunderstorm   ->  "Maricopa, AZ; Pinal, AZ"                          (COUNTY zones)
//
// The city matcher only understood the first. So every heat alert matched his towns and
// every STORM alert was reported as "elsewhere in the state, NOT this client's area" —
// even though Gilbert, Chandler, Mesa, Tempe, Phoenix and Scottsdale are all in Maricopa
// County. The ad writer was being told his own storms belonged to someone else, which is
// precisely the angle he asked for. Watches, warnings and most severe weather are issued
// by county, so this was not a rare miss: it was most of the severe weather.
//
// A county segment is exactly "Name, ST". A public-zone segment never carries the state.
const COUNTY_SEG = /^(.+?),\s*([A-Z]{2})$/;
export const countyZones = (areaDesc) =>
  String(areaDesc || "").split(";").map((s) => s.trim()).filter(Boolean)
    .map((seg) => { const m = seg.match(COUNTY_SEG); return m ? { county: m[1].trim(), state: m[2] } : null; })
    .filter(Boolean);

const normCounty = (s) => String(s || "").trim().toLowerCase().replace(/\s+county$/, "");

const countyHits = (areaDesc, counties) => {
  if (!counties || !counties.size) return [];
  return countyZones(areaDesc)
    .filter((z) => counties.has(normCounty(z.county)))
    .map((z) => z.county);
};

// Which county each of the client's towns sits in. Resolved from OpenStreetMap's Nominatim,
// which is free and needs no key, and cached for the life of the process so a run with six
// towns makes six lookups once and none afterwards.
//
// FAIL-SOFT IN A SPECIFIC DIRECTION. If this cannot resolve, we do NOT fall back to
// claiming the alert is elsewhere, because that is the false statement we are fixing. An
// unresolved county alert is reported as county-level and UNCONFIRMED, so the model gets
// context it may not turn into a claim. Uncertain and honest beats confident and wrong.
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const countyCache = new Map();
export const resolveCounties = async (
  cities = [], states = [], { fetchImpl = fetch, timeoutMs = 5000, max = 8 } = {}
) => {
  const out = new Set();
  const state = states[0] || "";
  for (const city of cities.slice(0, max)) {
    const key = `${String(city).toLowerCase()}|${state}`;
    if (countyCache.has(key)) {
      const hit = countyCache.get(key);
      if (hit) out.add(hit);
      continue;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const url = `${NOMINATIM}?city=${encodeURIComponent(city)}` +
        `${state ? `&state=${encodeURIComponent(state)}` : ""}` +
        `&country=USA&format=json&addressdetails=1&limit=1`;
      const res = await fetchImpl(url, { headers: { "User-Agent": UA }, signal: ctl.signal });
      if (!res.ok) { countyCache.set(key, null); continue; }
      const body = await res.json();
      const county = normCounty((body && body[0] && body[0].address && body[0].address.county) || "");
      countyCache.set(key, county || null);
      if (county) out.add(county);
    } catch {
      // No cache write on a thrown error: a timeout is not evidence the town has no county,
      // and caching the failure would keep this client wrong for the life of the process.
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
};

export const summariseAlerts = (alerts, cities = [], counties = new Set()) => {
  const byEvent = new Map();
  for (const a of alerts) {
    const key = `${a.state}|${a.event}`;
    const hits = [...cityHits(a.areaDesc, cities), ...countyHits(a.areaDesc, counties)];
    const cur = byEvent.get(key) || { ...a, zones: 0, matchedCities: [], countyOnly: false };
    cur.zones += 1;
    cur.matchedCities = [...new Set([...cur.matchedCities, ...hits])];
    // Remember that this alert was issued by county, so an unresolved one can be described
    // as unconfirmed rather than denied.
    if (countyZones(a.areaDesc).length) cur.countyOnly = true;
    byEvent.set(key, cur);
  }
  return [...byEvent.values()]
    .map((a) => ({
      ...a,
      namesClientArea: a.matchedCities.length > 0,
      unconfirmed: a.matchedCities.length === 0 && a.countyOnly && counties.size === 0,
    }))
    .sort((a, b) => (b.namesClientArea ? 1 : 0) - (a.namesClientArea ? 1 : 0) || b.zones - a.zones);
};

// Summarise the trailing window. Counts DAYS, not rows, because rows are a function of how
// many zones the NWS split the storm into and days are a function of what actually happened.
// A client's own city naming the alert still matters most, for the same reason as live
// alerts: it is the difference between context and a claim.
//
// MIN_RECENT_ROWS filters out the single stray advisory. "There was one dust advisory
// eleven days ago" is not a pattern and must not become an ad angle.
const MIN_RECENT_ROWS = 3;
export const summariseRecent = (alerts = [], cities = [], counties = new Set(), { days = RECENT_DAYS } = {}) => {
  const byEvent = new Map();
  for (const a of alerts) {
    const key = `${a.state}|${a.event}`;
    const cur = byEvent.get(key) ||
      { state: a.state, event: a.event, rows: 0, dayset: new Set(), inAreaDays: new Set(), matchedCities: [], countyOnly: false, lastAt: "" };
    cur.rows += 1;
    const day = String(a.at || "").slice(0, 10);
    if (day) cur.dayset.add(day);
    if (a.at && a.at > cur.lastAt) cur.lastAt = a.at;
    const hits = [...cityHits(a.areaDesc, cities), ...countyHits(a.areaDesc, counties)];
    if (hits.length && day) cur.inAreaDays.add(day);
    cur.matchedCities = [...new Set([...cur.matchedCities, ...hits])];
    if (countyZones(a.areaDesc).length) cur.countyOnly = true;
    byEvent.set(key, cur);
  }
  return [...byEvent.values()]
    .filter((a) => a.rows >= MIN_RECENT_ROWS)
    .map(({ dayset, inAreaDays, ...a }) => ({
      ...a, days: dayset.size, inAreaDays: inAreaDays.size, window: days,
      namesClientArea: a.matchedCities.length > 0,
      unconfirmed: a.matchedCities.length === 0 && a.countyOnly && counties.size === 0,
    }))
    .sort((a, b) => (b.namesClientArea ? 1 : 0) - (a.namesClientArea ? 1 : 0) || b.days - a.days || b.rows - a.rows);
};

// The block that goes into the prompt. Facts only, clearly labelled, with the rule
// attached to them rather than buried elsewhere.
// One place decides how an alert's relationship to the client is described, so the live
// and recent lists can never word it differently.
const whereLine = (a) =>
  a.namesClientArea ? `covers ${a.matchedCities.join(", ")}, in this client's own service area`
  : a.unconfirmed ? "issued by county, and it is NOT confirmed whether this client's towns are inside it. Treat as background only and never say their customers are affected"
  : "elsewhere in the state, NOT this client's area";

export const conditionsBlock = ({ locations, now = new Date(), alerts = [], recent = [], cities = [], counties = new Set(), mode = "ads" }) => {
  const { month, season, date } = seasonContext(now);
  const L = [`Today's date: ${date} (${month}, ${season} in the northern hemisphere).`];
  if (locations && String(locations).trim()) L.push(`Service area: ${String(locations).trim()}`);

  const summary = summariseAlerts(alerts, cities, counties);
  const usable = summary.filter((a) => isAdvertisable(a.event));
  const excluded = summary.filter((a) => !isAdvertisable(a.event));

  const recentSummary = summariseRecent(recent, cities, counties);
  const recentUsable = recentSummary.filter((a) => isAdvertisable(a.event));

  if (usable.length) {
    L.push("", "LIVE WEATHER IN THE SERVICE AREA (US National Weather Service, active right now):");
    for (const a of usable.slice(0, 6)) {
      L.push(`- ${a.event} (${a.severity || "unknown severity"}) in ${a.state} — ${whereLine(a)}` +
        `${a.zones > 1 ? `, ${a.zones} zones` : ""}`);
    }
  } else {
    L.push("", "LIVE WEATHER: no ordinary weather alerts active in the service area right now.");
  }

  if (recentUsable.length) {
    L.push("", `WHAT THE AREA HAS BEEN THROUGH (last ${RECENT_DAYS} days, same source):`);
    for (const a of recentUsable.slice(0, 6)) {
      L.push(`- ${a.event} in ${a.state} on ${a.days} of the last ${a.window} days` +
        `${a.namesClientArea && a.inAreaDays ? `, ${a.inAreaDays} of those days covering ${a.matchedCities.join(", ")}, in this client's own service area` : `, ${whereLine(a)}`}`);
    }
  }

  if (excluded.length) {
    L.push("", `NOT AVAILABLE AS AN ANGLE: ${excluded.map((a) => a.event).join(", ")}. ` +
      "These are active emergencies. Do not reference them, hint at them, or build urgency from them.");
  }

  // A LANDING PAGE OUTLIVES THE WEATHER. An ad can be swapped tomorrow; a page sits at the
  // same URL for months. "Storm damage today" is stale by Thursday and makes the business
  // look asleep, so pages get the durable framing (the season, the recurring pattern) while
  // ads may use the specific alert running right now.
  if (mode === "landing") {
    L.push("",
      "HOW TO USE THIS ON A LANDING PAGE:",
      "- This page stays up for months. Write for the SEASON and the recurring local pattern, never for today's specific alert. \"Monsoon season roof repair\" ages well. \"Storm damage today\" is wrong by Thursday and makes the business look asleep.",
      "- A run of recent events is evidence of the SEASONAL PATTERN, which is durable, so use it that way. Storms on many of the last fourteen days justifies \"monsoon storm damage repair\" as a standing theme. It does not justify \"after last night's storm\", which is stale within a week.",
      "- Match the page to the ads pointing at it. If the ads lead on heat, the page must too, or the click is wasted.",
      "- Use it ONLY where it genuinely drives demand for THIS business. Forcing it in reads as gimmicky.",
      "- Invent nothing, and never reference a disaster, damage to others, or danger to life.",
      "- Seasonal timing matters for e-commerce too: shipping cutoffs, gifting, back-to-school, end of season clearance.",
    );
    return L.join("\n");
  }

  L.push("",
    "HOW TO USE THIS:",
    "- Use it ONLY where it genuinely drives demand for THIS business. A heat warning matters to an HVAC company and means nothing to a bookkeeper. Forcing it in reads as gimmicky and wastes a headline.",
    // 🔴 THE TWO WINDOWS SELL DIFFERENT THINGS, AND MIXING THEM UP WASTES THE BUDGET.
    // Live weather is about to happen to the customer: it sells prevention and urgency.
    // Recent weather has already happened to them: it sells repair, and repair is where
    // the money is for storm trades. Nobody calls a roofer mid-storm, they call when they
    // spot the stain on the ceiling a week later.
    "- WHAT HAS ALREADY HAPPENED IS OFTEN THE STRONGER ANGLE. Live weather sells prevention and urgency, because it is about to affect them. Recent weather sells REPAIR and INSPECTION, because it already did. For roofing, restoration, tree work, glass, auto hail repair, fencing and landscaping, the demand arrives days AFTER the weather leaves, so a run of recent storms is usually a better angle than today's forecast. Write to the damage they can see now, not to the storm.",
    "- Do not manufacture urgency out of the recent window. \"Storm damage from the last couple of weeks\" is honest. \"Act now before it is too late\" is not, and it reads like every other ad.",
    "- An alert marked as elsewhere in the state is CONTEXT, not a claim. Never imply the client's own customers are affected when they are not.",
    "- Write it as the customer's problem, never as the emergency. \"AC out in this heat?\" is fine. Referencing a disaster, damage to others, or danger to life is never fine, and both Google and Meta will reject it.",
    "- Invent nothing. If no alert is listed above, do not write weather copy. Seasonal wording from the date is still fair (a Phoenix August is hot whether or not a warning is posted).",
    "- Seasonal timing matters for e-commerce too: shipping cutoffs, gifting, back-to-school, end of season clearance. Use the date for that.",
  );
  return L.join("\n");
};

// One call for callers: parse the area, fetch what is happening, build the block.
export const getLocalConditions = async (
  { locations, now = new Date(), fetchImpl = fetch, mode = "ads", includeRecent = true } = {}
) => {
  const { states, cities } = parseAreas(locations);
  let alerts = [], recent = [];
  try { alerts = await fetchAlerts(states, { fetchImpl }); }
  catch { alerts = []; }
  // The trailing window is a SECOND call, so it is opt-outable and independently
  // fail-soft. If the archive is slow or down we still ship an ad with live conditions.
  if (includeRecent) {
    try { recent = await fetchRecent(states, { fetchImpl, now }); }
    catch { recent = []; }
  }
  // Only pay for county resolution if a county-issued alert actually turned up. Most runs
  // in a quiet area skip it entirely.
  let counties = new Set();
  const needsCounties = [...alerts, ...recent].some((a) => countyZones(a.areaDesc).length);
  if (needsCounties && cities.length) {
    try { counties = await resolveCounties(cities, states, { fetchImpl }); }
    catch { counties = new Set(); }
  }
  const summary = summariseAlerts(alerts, cities, counties);
  const recentSummary = summariseRecent(recent, cities, counties);
  return {
    states, cities, counties: [...counties], alerts, summary, recent, recentSummary,
    usable: summary.filter((a) => isAdvertisable(a.event)),
    recentUsable: recentSummary.filter((a) => isAdvertisable(a.event)),
    block: conditionsBlock({ locations, now, alerts, recent, cities, counties, mode }),
  };
};

// A short signature of the current conditions, so autopilot can tell "nothing has
// changed" from "the monsoon started" without storing the whole payload.
//
// 🔴 THE RECENT WINDOW IS BUCKETED, NOT COUNTED, AND THAT IS DELIBERATE. This signature
// drives the conditions-change rewrite trigger. A raw count would differ almost every run
// as the 14-day window slides, so every run would look like "the weather changed" and
// autopilot would churn live ads forever. Bucketing to none/some/many means the signature
// only moves when the PATTERN moves, which is the thing worth rewriting an ad for.
// The dwell and cooldown brakes in ads-autopilot still apply on top of this.
const recentBucket = (days) => (days >= 6 ? "many" : days >= 3 ? "some" : "few");
export const conditionsFingerprint = (summary = [], recentSummary = []) => {
  const live = summary.filter((a) => isAdvertisable(a.event))
    .map((a) => `${a.state}:${a.event}${a.namesClientArea ? "*" : ""}`);
  const past = recentSummary.filter((a) => isAdvertisable(a.event))
    // "few" is below the threshold of a real pattern, so it is not allowed to move the
    // signature at all. Otherwise one stray advisory would read as a change in conditions.
    .filter((a) => recentBucket(a.days) !== "few")
    .map((a) => `~${a.state}:${a.event}:${recentBucket(a.days)}${a.namesClientArea ? "*" : ""}`);
  return [...live, ...past].sort().join("|") || "none";
};
