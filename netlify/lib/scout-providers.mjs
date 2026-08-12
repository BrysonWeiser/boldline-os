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

// Apollo failures used to return a bare null, so a wrong key or an empty credit
// balance looked identical to "this company isn't in their database". Every path now
// reports a reason, which the run surfaces.
export const apolloOrganization = async (domain, notes = []) => {
  const key = env("APOLLO_API_KEY");
  if (!key) return null;
  if (!domain) { notes.push("Apollo org: skipped (no website to match on)"); return null; }
  const r = await fetchJSON(`https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`, { method: "GET", headers: apolloHeaders() });
  if (!r.ok) { notes.push(`Apollo org lookup failed (${r.status || ""} ${r.error}`.trim() + ")"); return null; }
  const o = (r.body && (r.body.organization || r.body.account)) || null;
  if (!o) { notes.push(`Apollo has no company record for ${domain}`); return null; }
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

export const apolloDecisionMaker = async ({ domain, companyName }, notes = []) => {
  const key = env("APOLLO_API_KEY");
  if (!key || (!domain && !companyName)) return null;

  const body = { person_titles: OWNER_TITLES, page: 1, per_page: 5 };
  if (domain) body.q_organization_domains_list = [domain];
  else body.q_organization_name = companyName;

  const r = await fetchJSON("https://api.apollo.io/api/v1/mixed_people/search", { method: "POST", headers: apolloHeaders(), body: JSON.stringify(body) }, 15000);
  if (!r.ok) { notes.push(`Apollo people search failed (${r.status || ""} ${r.error}`.trim() + ")"); return null; }

  const people = (r.body && (r.body.people || r.body.contacts)) || [];
  if (!people.length) { notes.push(`Apollo has no owner/founder listed for ${domain || companyName}`); return null; }

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

// ─── AD-TECH DETECTION (is this business actually advertising?) ──────────────
// Bryson asked for the Meta Ad Library. It can't answer this: `ads_archive` only
// covers political/social-issue ads in the US, so a Gilbert HVAC company's commercial
// ads are visible in the Ad Library WEB UI but never through the API. Wiring it up
// literally would return "no ads" for nearly everyone — a false negative, which is
// strictly worse than the honest "unknown" it replaces.
//
// What DOES work is reading their own homepage for the tracking tags that advertising
// requires. A Google Ads conversion tag or a Meta Pixel is real, checkable evidence
// that they are set up to advertise on that platform.
//
// IMPORTANT ASYMMETRY: finding a tag is strong evidence ("likely"). NOT finding one
// proves nothing — plenty of sites inject their tags through Tag Manager, so the raw
// HTML won't contain them. This therefore never reports "no", only "likely" or
// "unknown". Overclaiming here would put Bryson on a call saying "I noticed you're not
// running Google Ads" to someone who is.
const SIGNALS = [
  { platform: "google", re: /AW-\d{6,}/,                          note: "Google Ads conversion tag (AW-) in the page source" },
  { platform: "google", re: /googleadservices\.com\/pagead\/conversion/i, note: "Google Ads conversion script" },
  { platform: "google", re: /googleads\.g\.doubleclick\.net/i,    note: "Google Ads remarketing tag" },
  { platform: "meta",   re: /connect\.facebook\.net\/[^"']*\/fbevents\.js/i, note: "Meta Pixel (fbevents.js)" },
  { platform: "meta",   re: /fbq\s*\(\s*['"]init['"]/i,           note: "Meta Pixel init call" },
  { platform: "meta",   re: /facebook\.com\/tr\?id=/i,            note: "Meta Pixel noscript beacon" },
];
const OTHER = [
  { re: /googletagmanager\.com\/gtm\.js/i, note: "Google Tag Manager (tags may be injected at runtime, so platform tags can be hidden)" },
  { re: /gtag\/js\?id=G-/i,               note: "GA4 analytics" },
  { re: /snap\.licdn\.com/i,              note: "LinkedIn Insight tag" },
  { re: /analytics\.tiktok\.com/i,        note: "TikTok pixel" },
];

export const inspectAdTech = async (website) => {
  const raw = String(website || "").trim();
  if (!raw || /^(none|unknown)$/i.test(raw)) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;

  // A custom bot user-agent gets refused by Cloudflare and most small-business WAFs,
  // which silently turned every ad-tech read into "unknown". Present as a real
  // browser — we are only reading a public homepage, exactly as a visitor would.
  const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
  const get = async (target) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(target, {
        redirect: "follow", signal: ctrl.signal,
        headers: {
          "user-agent": BROWSER_UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) return { ok: false, note: `HTTP ${res.status}` };
      return { ok: true, html: (await res.text()).slice(0, 500000) };
    } catch (e) {
      return { ok: false, note: String((e && e.name) === "AbortError" ? "timed out" : (e && e.message) || "unreachable") };
    } finally { clearTimeout(timer); }
  };

  let r = await get(url);
  // Some hosts only answer on the www host (or only on the bare one).
  if (!r.ok) {
    const alt = /^https:\/\/www\./i.test(url) ? url.replace(/^https:\/\/www\./i, "https://") : url.replace(/^https:\/\//i, "https://www.");
    if (alt !== url) { const r2 = await get(alt); if (r2.ok) r = r2; }
  }
  if (!r.ok) return { reachable: false, note: `couldn't read their site (${r.note})`, googleAds: "unknown", metaAds: "unknown", evidence: [] };
  const html = r.html;

  const hits = SIGNALS.filter((s) => s.re.test(html));
  const google = hits.filter((h) => h.platform === "google").map((h) => h.note);
  const meta = hits.filter((h) => h.platform === "meta").map((h) => h.note);
  const other = OTHER.filter((o) => o.re.test(html)).map((o) => o.note);

  const gtmOnly = !google.length && !meta.length && other.some((o) => /Tag Manager/.test(o));
  return {
    reachable: true,
    // "likely", never "yes" — a tag proves the plumbing, not a live campaign today.
    googleAds: google.length ? "likely" : "unknown",
    metaAds: meta.length ? "likely" : "unknown",
    evidence: [...google, ...meta, ...other],
    gtmOnly,
    // Always say what the check concluded, so an "unknown" is explained rather than
    // just absent — the third time in this feature that a silent nothing wasted an hour.
    note: hits.length
      ? `Read their homepage: ${[...google, ...meta].join("; ")}`
      : gtmOnly
        ? "Read their homepage: only Google Tag Manager, which hides whatever it loads — ad tags can't be confirmed either way from the source."
        : "Read their homepage: no advertising tags in the page source (they may still advertise — tags are often injected at runtime).",
  };
};

// A deep link into the Ad Library web UI, which DOES show commercial ads — one click
// gives a definitive answer the API cannot.
export const adLibraryUrl = (name, country = "US") =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${encodeURIComponent(country)}&q=${encodeURIComponent(String(name || "").trim())}&search_type=keyword_unordered`;

// ─── Merge ───────────────────────────────────────────────────────────────────
// Runs whatever providers are configured for one candidate and returns a verified
// fact block. Never throws.
export const enrichFromProviders = async (cand) => {
  const out = { phones: [], emails: [], sources: [], verified: {}, notes: [] };
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

  // Ad-tech detection needs no API key — it is just their public homepage — so it
  // runs on every prospect regardless of which providers are configured.
  const [org, person, adTech] = await Promise.all([
    apolloOrganization(domain, out.notes).catch((e) => { out.notes.push(`Apollo org threw: ${e && e.message}`); return null; }),
    apolloDecisionMaker({ domain, companyName: cand.name }, out.notes).catch((e) => { out.notes.push(`Apollo people threw: ${e && e.message}`); return null; }),
    inspectAdTech(cand.website).catch(() => null),
  ]);
  if (adTech) {
    out.verified.adTech = adTech;
    if (adTech.reachable && adTech.evidence.length) out.sources.push("site tags");
  }
  out.verified.adLibraryUrl = adLibraryUrl(cand.name);

  if (org) {
    out.sources.push("Apollo");
    if (org.phone) out.phones.push({ number: org.phone, kind: "main", whose: "business", source: "Apollo", confidence: "high" });
    if (org.employees) out.verified.employeesEstimate = org.employees;
    if (org.revenue) out.verified.revenueEstimate = org.revenuePrinted || `$${Math.round(org.revenue).toLocaleString()}/yr`;
    if (org.founded) out.verified.founded = org.founded;
    if (org.linkedin) out.verified.companyLinkedin = org.linkedin;
    if (!out.verified.website && org.website) out.verified.website = org.website;
  }
  if (person && person.name && !person.email && !person.phones.length) {
    out.notes.push(`Apollo found ${person.name} (${person.title || "no title"}) but revealed no email or phone — that usually needs Apollo credits or a paid plan.`);
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
