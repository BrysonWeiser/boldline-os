// Lead Scout — real-data providers.
//
// Bryson (2026-08-11): "lets wire one in. I want to be able to get all the real data
// that I can."
//
// Web research by an AI is a guess with citations. These are authoritative sources:
//   • GOOGLE PLACES  -> the business itself: verified name, address, the REAL phone
//                       number, website, rating, review count, open/closed status.
//                       Also makes area matching exact, since Places returns a real
//                       address rather than the model's opinion about one.
//   • APOLLO.IO      -> the human: owner/founder/president name, title, LinkedIn,
//                       work email, plus company headcount and revenue band.
//
// EVERY provider is OPTIONAL and fails soft. With no keys set, Lead Scout behaves
// exactly as it did before (AI research only). Add GOOGLE_PLACES_API_KEY and the
// business data becomes verified; add APOLLO_API_KEY and the contact data does too.
// Nothing throws, nothing blocks a run — a dead provider just contributes nothing.
//
// Every field carries its own `source`, so the UI can show Bryson which facts are
// verified and which are the model's research.

const env = (k) => (process.env[k] || "").trim();
export const providerStatus = () => ({
  places: !!env("GOOGLE_PLACES_API_KEY"),
  apollo: !!env("APOLLO_API_KEY"),
});

// Every outbound call is time-boxed; a slow provider must never eat the 15-minute
// background budget.
const fetchJSON = async (url, opts = {}, ms = 12000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!res.ok) return { ok: false, status: res.status, error: (body && (body.error && body.error.message)) || text.slice(0, 200) || `HTTP ${res.status}` };
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: String((e && e.name) === "AbortError" ? "timed out" : (e && e.message) || e) };
  } finally { clearTimeout(timer); }
};

const host = (u) => { try { return new URL(/^https?:\/\//.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch { return ""; } };

// ─── GOOGLE PLACES (New) ─────────────────────────────────────────────────────
// One Text Search call per (niche, area) returns everything we need — no per-place
// Details call, which keeps this at roughly 3 cents per area searched.
const PLACES_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.addressComponents",
  "places.nationalPhoneNumber", "places.internationalPhoneNumber", "places.websiteUri",
  "places.rating", "places.userRatingCount", "places.businessStatus",
  "places.primaryTypeDisplayName", "places.googleMapsUri", "places.regularOpeningHours.openNow",
].join(",");

const componentOf = (place, type) => {
  const c = (place.addressComponents || []).find((x) => (x.types || []).includes(type));
  return c ? (c.shortText || c.longText || "") : "";
};

// Returns normalized candidates, or [] when the provider is off/failing.
export const placesSearch = async ({ niche, area, maxResults = 20 }) => {
  const key = env("GOOGLE_PLACES_API_KEY");
  if (!key) return { ok: false, off: true, results: [] };

  const r = await fetchJSON("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": PLACES_FIELDS },
    body: JSON.stringify({
      textQuery: `${niche} in ${area}`,
      maxResultCount: Math.min(20, Math.max(1, maxResults)),
      languageCode: "en",
    }),
  }, 15000);

  if (!r.ok) return { ok: false, error: r.error, results: [] };
  const places = (r.body && r.body.places) || [];

  const results = places
    // Places marks permanently/temporarily closed businesses — never hand Bryson a dead number.
    .filter((p) => !p.businessStatus || p.businessStatus === "OPERATIONAL")
    .map((p) => ({
      placeId: p.id || "",
      name: (p.displayName && p.displayName.text) || "",
      address: p.formattedAddress || "",
      city: componentOf(p, "locality") || componentOf(p, "postal_town") || componentOf(p, "sublocality") || "",
      state: componentOf(p, "administrative_area_level_1") || "",
      postal: componentOf(p, "postal_code") || "",
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || "",
      website: p.websiteUri || "",
      rating: typeof p.rating === "number" ? String(p.rating) : "",
      reviewCount: Number(p.userRatingCount || 0),
      category: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || "",
      mapsUrl: p.googleMapsUri || "",
      source: "Google Places",
    }))
    .filter((p) => p.name);

  return { ok: true, results };
};

// ─── APOLLO.IO ───────────────────────────────────────────────────────────────
// Two calls per business: enrich the org (headcount, revenue, company phone), then
// find the decision-maker. Both are best-effort.
const OWNER_TITLES = ["owner", "founder", "co-founder", "president", "ceo", "chief executive officer", "managing partner", "managing director", "principal", "general manager", "partner"];

const apolloHeaders = () => ({
  "content-type": "application/json",
  accept: "application/json",
  "x-api-key": env("APOLLO_API_KEY"),
});

export const apolloOrganization = async (domain) => {
  const key = env("APOLLO_API_KEY");
  if (!key || !domain) return null;
  const r = await fetchJSON(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, { method: "GET", headers: apolloHeaders() });
  if (!r.ok) return null;
  const o = (r.body && (r.body.organization || r.body.account)) || null;
  if (!o) return null;
  return {
    name: o.name || "",
    phone: o.phone || o.primary_phone && o.primary_phone.number || "",
    employees: Number(o.estimated_num_employees || 0),
    revenue: Number(o.annual_revenue || 0),
    revenuePrinted: o.annual_revenue_printed || "",
    industry: o.industry || "",
    founded: o.founded_year ? String(o.founded_year) : "",
    linkedin: o.linkedin_url || "",
    website: o.website_url || "",
    city: o.city || "", state: o.state || "",
    source: "Apollo",
  };
};

// Apollo masks unpaid emails as "email_not_unlocked@domain.com" — treat those as absent
// rather than handing Bryson an address that bounces.
const realEmail = (e) => {
  const s = String(e || "").trim().toLowerCase();
  return s && !/not_unlocked|email_not_unlocked|^n\/a$/.test(s) && /@/.test(s) ? s : "";
};

export const apolloDecisionMaker = async ({ domain, companyName }) => {
  const key = env("APOLLO_API_KEY");
  if (!key || (!domain && !companyName)) return null;

  const body = { person_titles: OWNER_TITLES, page: 1, per_page: 5 };
  if (domain) body.q_organization_domains_list = [domain];
  else body.q_organization_name = companyName;

  const r = await fetchJSON("https://api.apollo.io/api/v1/mixed_people/search", { method: "POST", headers: apolloHeaders(), body: JSON.stringify(body) }, 15000);
  if (!r.ok) return null;

  const people = (r.body && (r.body.people || r.body.contacts)) || [];
  if (!people.length) return null;

  // Prefer the most senior title we asked for.
  const rank = (t) => { const i = OWNER_TITLES.findIndex((x) => String(t || "").toLowerCase().includes(x)); return i < 0 ? 99 : i; };
  const p = people.slice().sort((a, b) => rank(a.title) - rank(b.title))[0];

  const phones = [];
  const push = (num, kind) => { const s = String(num || "").trim(); if (s && !phones.some((x) => x.number === s)) phones.push({ number: s, kind }); };
  push(p.direct_dial || p.direct_phone, "direct");
  push(p.mobile_phone || p.sanitized_phone, "mobile");
  (p.phone_numbers || []).forEach((ph) => push(ph && (ph.sanitized_number || ph.raw_number), (ph && /mobile/i.test(ph.type_cd || ph.type || "")) ? "mobile" : "direct"));

  return {
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.name || "",
    title: p.title || "",
    email: realEmail(p.email),
    linkedin: p.linkedin_url || "",
    phones,
    source: "Apollo",
  };
};

// ─── Merge ───────────────────────────────────────────────────────────────────
// Runs whatever providers are configured for one candidate and returns a verified
// fact block. Never throws.
export const enrichFromProviders = async (cand) => {
  const out = { phones: [], emails: [], sources: [], verified: {} };
  const domain = host(cand.website || "");

  // Google Places already ran during discovery — carry its facts through.
  if (cand.placeId || cand.source === "Google Places") {
    if (cand.phone) out.phones.push({ number: cand.phone, kind: "main", whose: "business", source: "Google Places", confidence: "high" });
    out.verified.address = cand.address || "";
    out.verified.city = cand.city || "";
    out.verified.state = cand.state || "";
    out.verified.postal = cand.postal || "";
    out.verified.website = cand.website || "";
    out.verified.rating = cand.rating || "";
    out.verified.reviewCount = cand.reviewCount || 0;
    out.verified.mapsUrl = cand.mapsUrl || "";
    out.sources.push("Google Places");
  }

  const [org, person] = await Promise.all([
    apolloOrganization(domain).catch(() => null),
    apolloDecisionMaker({ domain, companyName: cand.name }).catch(() => null),
  ]);

  if (org) {
    out.sources.push("Apollo");
    if (org.phone) out.phones.push({ number: org.phone, kind: "main", whose: "business", source: "Apollo", confidence: "high" });
    if (org.employees) out.verified.employeesEstimate = org.employees;
    if (org.revenue) out.verified.revenueEstimate = org.revenuePrinted || `$${Math.round(org.revenue).toLocaleString()}/yr`;
    if (org.founded) out.verified.founded = org.founded;
    if (org.linkedin) out.verified.companyLinkedin = org.linkedin;
    if (!out.verified.website && org.website) out.verified.website = org.website;
  }
  if (person && person.name) {
    if (!out.sources.includes("Apollo")) out.sources.push("Apollo");
    out.verified.ownerName = person.name;
    out.verified.ownerTitle = person.title || "";
    if (person.linkedin) out.verified.ownerLinkedin = person.linkedin;
    if (person.email) out.emails.push({ address: person.email, whose: "owner", source: "Apollo", confidence: "high" });
    person.phones.forEach((ph) => out.phones.push({ number: ph.number, kind: ph.kind, whose: "owner", source: "Apollo", confidence: "high" }));
  }

  return out;
};
