// Reading a target location the way a person writes one, anywhere in the world.
//
// Bryson, 2026-08-20: "for the target location for my own ads and even clients that we can
// be located in one state or area and be able to target anywhere in the world we want."
//
// WHY THIS IS SHARED. Google and Meta both need the same answer to the same question —
// "which country is this place in?" — and both had it hardcoded to the US in different
// ways. Two separate country parsers would drift, and a drift here means advertising in
// the wrong country, which nobody notices until the money is gone.
//
// WHY THE COUNTRY HAS TO BE INFERRED AT ALL. Neither platform can look a place up
// worldwide in one shot without ambiguity. Both take a country code to disambiguate, and
// both restrict their search to it. So "London, United Kingdom" and "Gilbert, Arizona"
// have to be routed to different lookups, from the same box, with no extra field for the
// operator to remember. The country is therefore read off the END of the entry.
//
// WHAT THIS DELIBERATELY DOES NOT DO: guess. An entry whose country cannot be determined
// falls back to the account's home country, and the caller is told which entries fell
// back, so an unrecognised place fails loudly rather than silently targeting the default.

// ISO 3166-1 alpha-2 for the countries a small agency plausibly advertises into, plus the
// spellings people actually type. Not exhaustive on purpose: an unlisted country is
// reported as unknown rather than guessed, and adding one is a single line.
const COUNTRIES = {
  "united states": "US", "usa": "US", "us": "US", "u.s.": "US", "u.s.a.": "US", "america": "US",
  "canada": "CA", "ca": "CA",
  "united kingdom": "GB", "uk": "GB", "u.k.": "GB", "great britain": "GB", "britain": "GB",
  "england": "GB", "scotland": "GB", "wales": "GB", "northern ireland": "GB",
  "ireland": "IE", "australia": "AU", "new zealand": "NZ", "nz": "NZ",
  "mexico": "MX", "brazil": "BR", "argentina": "AR", "chile": "CL", "colombia": "CO", "peru": "PE",
  "germany": "DE", "france": "FR", "spain": "ES", "italy": "IT", "portugal": "PT",
  "netherlands": "NL", "holland": "NL", "belgium": "BE", "switzerland": "CH", "austria": "AT",
  "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI", "iceland": "IS",
  "poland": "PL", "czech republic": "CZ", "czechia": "CZ", "greece": "GR", "hungary": "HU",
  "romania": "RO", "croatia": "HR", "bulgaria": "BG", "slovakia": "SK", "slovenia": "SI",
  "japan": "JP", "south korea": "KR", "korea": "KR", "china": "CN", "hong kong": "HK",
  "taiwan": "TW", "singapore": "SG", "malaysia": "MY", "thailand": "TH", "vietnam": "VN",
  "philippines": "PH", "indonesia": "ID", "india": "IN", "pakistan": "PK", "bangladesh": "BD",
  "united arab emirates": "AE", "uae": "AE", "saudi arabia": "SA", "qatar": "QA", "kuwait": "KW",
  "israel": "IL", "turkey": "TR", "egypt": "EG", "morocco": "MA",
  "south africa": "ZA", "nigeria": "NG", "kenya": "KE", "ghana": "GH",
};

// US states and Canadian provinces, so "Gilbert, Arizona" and "Toronto, Ontario" are
// recognised as belonging to their country without the country being typed.
const US_STATES = {
  al: "AL", ak: "AK", az: "AZ", ar: "AR", ca: "CA", co: "CO", ct: "CT", de: "DE", fl: "FL",
  ga: "GA", hi: "HI", id: "ID", il: "IL", in: "IN", ia: "IA", ks: "KS", ky: "KY", la: "LA",
  me: "ME", md: "MD", ma: "MA", mi: "MI", mn: "MN", ms: "MS", mo: "MO", mt: "MT", ne: "NE",
  nv: "NV", nh: "NH", nj: "NJ", nm: "NM", ny: "NY", nc: "NC", nd: "ND", oh: "OH", ok: "OK",
  or: "OR", pa: "PA", ri: "RI", sc: "SC", sd: "SD", tn: "TN", tx: "TX", ut: "UT", vt: "VT",
  va: "VA", wa: "WA", wv: "WV", wi: "WI", wy: "WY", dc: "DC",
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const CA_PROVINCES = {
  on: "ON", qc: "QC", bc: "BC", ab: "AB", mb: "MB", sk: "SK", ns: "NS", nb: "NB",
  nl: "NL", pe: "PE", yt: "YT", nt: "NT", nu: "NU",
  ontario: "ON", quebec: "QC", "british columbia": "BC", alberta: "AB", manitoba: "MB",
  saskatchewan: "SK", "nova scotia": "NS", "new brunswick": "NB",
  "newfoundland and labrador": "NL", "prince edward island": "PE",
};

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export const countryCodeFor = (name) => COUNTRIES[norm(name)] || null;

// Is this whole entry just a country? "Canada" targets a country, not a city in one.
export const isCountryOnly = (entry) => {
  const parts = String(entry || "").split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length === 1 && !!countryCodeFor(parts[0]);
};

// One location entry -> what to search for, and where.
//
//   "Gilbert, Arizona"          -> { query: "Gilbert, Arizona", country: "US", inferred: "state" }
//   "London, United Kingdom"    -> { query: "London",           country: "GB", inferred: "country" }
//   "Toronto, Ontario"          -> { query: "Toronto, Ontario", country: "CA", inferred: "state" }
//   "Canada"                    -> { query: "Canada",           country: "CA", countryOnly: true }
//   "Paris"                     -> { query: "Paris",            country: <default>, inferred: null }
//
// The trailing country is STRIPPED from the query because both platforms search within a
// country and repeating it in the term only hurts the match. A trailing state is KEPT,
// because it is what tells Phoenix, Arizona apart from Phoenix, Oregon.
export const parseLocation = (entry, defaultCountry = "US") => {
  const raw = String(entry || "").trim();
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;

  if (parts.length === 1) {
    const c = countryCodeFor(parts[0]);
    if (c) return { raw, query: parts[0], country: c, countryOnly: true, inferred: "country" };
    return { raw, query: parts[0], country: defaultCountry, countryOnly: false, inferred: null };
  }

  const last = parts[parts.length - 1];
  const country = countryCodeFor(last);
  if (country) {
    const rest = parts.slice(0, -1);
    // "London, United Kingdom" -> query "London". "Toronto, Ontario, Canada" keeps the
    // province, because that is the part that disambiguates.
    return { raw, query: rest.join(", "), country, countryOnly: false, inferred: "country" };
  }

  const lastNorm = norm(last);
  if (US_STATES[lastNorm]) return { raw, query: raw, country: "US", countryOnly: false, inferred: "state" };
  if (CA_PROVINCES[lastNorm]) return { raw, query: raw, country: "CA", countryOnly: false, inferred: "state" };

  // Something like "Shibuya, Tokyo" — a real place we cannot place in a country. Use the
  // default and SAY SO, so the caller can warn rather than quietly search the wrong place.
  return { raw, query: raw, country: defaultCountry, countryOnly: false, inferred: null };
};

// Parse a whole box of locations and group them by country, because both platforms take
// one country per lookup call.
export const parseLocations = (text, defaultCountry = "US") => {
  const lines = (Array.isArray(text) ? text : String(text || "").split(/[\n;]/))
    .map((s) => String(s || "").trim()).filter(Boolean).slice(0, 40);
  const items = lines.map((l) => parseLocation(l, defaultCountry)).filter(Boolean);
  const byCountry = new Map();
  for (const it of items) {
    if (!byCountry.has(it.country)) byCountry.set(it.country, []);
    byCountry.get(it.country).push(it);
  }
  return {
    items,
    byCountry,
    // Entries where the country had to be assumed. Not an error — "Phoenix" on a US
    // account is perfectly normal — but the caller surfaces it so an entry that landed in
    // the wrong country is visible before the money is spent.
    assumed: items.filter((i) => !i.inferred).map((i) => i.raw),
    countries: [...byCountry.keys()],
  };
};
