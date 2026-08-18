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
const UA = "BoldLineOS/1.0 (ads; contact via boldlinemedia.com)";
const TIMEOUT_MS = 6000;

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

export const summariseAlerts = (alerts, cities = []) => {
  const byEvent = new Map();
  for (const a of alerts) {
    const key = `${a.state}|${a.event}`;
    const hits = cityHits(a.areaDesc, cities);
    const cur = byEvent.get(key) || { ...a, zones: 0, matchedCities: [] };
    cur.zones += 1;
    cur.matchedCities = [...new Set([...cur.matchedCities, ...hits])];
    byEvent.set(key, cur);
  }
  return [...byEvent.values()]
    .map((a) => ({ ...a, namesClientArea: a.matchedCities.length > 0 }))
    .sort((a, b) => (b.namesClientArea ? 1 : 0) - (a.namesClientArea ? 1 : 0) || b.zones - a.zones);
};

// The block that goes into the prompt. Facts only, clearly labelled, with the rule
// attached to them rather than buried elsewhere.
export const conditionsBlock = ({ locations, now = new Date(), alerts = [], cities = [], mode = "ads" }) => {
  const { month, season, date } = seasonContext(now);
  const L = [`Today's date: ${date} (${month}, ${season} in the northern hemisphere).`];
  if (locations && String(locations).trim()) L.push(`Service area: ${String(locations).trim()}`);

  const summary = summariseAlerts(alerts, cities);
  const usable = summary.filter((a) => isAdvertisable(a.event));
  const excluded = summary.filter((a) => !isAdvertisable(a.event));

  if (usable.length) {
    L.push("", "LIVE WEATHER IN THE SERVICE AREA (US National Weather Service, active right now):");
    for (const a of usable.slice(0, 6)) {
      L.push(`- ${a.event} (${a.severity || "unknown severity"}) in ${a.state}` +
        `${a.namesClientArea ? ` — covers ${a.matchedCities.join(", ")}, in this client's own service area` : " — elsewhere in the state, NOT this client's area"}` +
        `${a.zones > 1 ? `, ${a.zones} zones` : ""}`);
    }
  } else {
    L.push("", "LIVE WEATHER: no ordinary weather alerts active in the service area right now.");
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
    "- An alert marked as elsewhere in the state is CONTEXT, not a claim. Never imply the client's own customers are affected when they are not.",
    "- Write it as the customer's problem, never as the emergency. \"AC out in this heat?\" is fine. Referencing a disaster, damage to others, or danger to life is never fine, and both Google and Meta will reject it.",
    "- Invent nothing. If no alert is listed above, do not write weather copy. Seasonal wording from the date is still fair (a Phoenix August is hot whether or not a warning is posted).",
    "- Seasonal timing matters for e-commerce too: shipping cutoffs, gifting, back-to-school, end of season clearance. Use the date for that.",
  );
  return L.join("\n");
};

// One call for callers: parse the area, fetch what is happening, build the block.
export const getLocalConditions = async (
  { locations, now = new Date(), fetchImpl = fetch, mode = "ads" } = {}
) => {
  const { states, cities } = parseAreas(locations);
  let alerts = [];
  try { alerts = await fetchAlerts(states, { fetchImpl }); }
  catch { alerts = []; }
  const summary = summariseAlerts(alerts, cities);
  return {
    states, cities, alerts, summary,
    usable: summary.filter((a) => isAdvertisable(a.event)),
    block: conditionsBlock({ locations, now, alerts, cities, mode }),
  };
};

// A short signature of the current conditions, so autopilot can tell "nothing has
// changed" from "the monsoon started" without storing the whole payload.
export const conditionsFingerprint = (summary = []) =>
  summary.filter((a) => isAdvertisable(a.event))
    .map((a) => `${a.state}:${a.event}${a.namesClientArea ? "*" : ""}`)
    .sort().join("|") || "none";
