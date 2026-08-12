// Shared helpers for the AI Lead Scout (prospect scraper that feeds Deal Prep).
//
// Everything here is pure logic — normalization, strict area matching, dedupe keys,
// the scoring tiers, the structured-output schema, and the prompt builders. The
// background function (lead-scout-background.mjs) and the read/write endpoint
// (lead-scout.mjs) both import from here so the rules stay in ONE place.
//
// Design notes that matter:
//  • DEDUPE is enforced three ways: a normalized name+city key with a UNIQUE index
//    in Postgres, a domain check in code, and an "already found — do not return
//    these" block in the discovery prompt so the AI spends its searches on NEW
//    businesses instead of rediscovering the same ones.
//  • AREA STRICTNESS is verified server-side. The AI is told to tag each prospect
//    with the exact requested area it belongs to, and then we independently check
//    the city/state/postal it reported against that request. Anything that doesn't
//    corroborate is dropped (and counted), so "strict to those areas" is a rule the
//    code enforces, not a rule the prompt asks for politely.

import { PACKAGES, getNicheLeadFee } from "./pricing-shared.mjs";

// ─── NORMALIZATION ───────────────────────────────────────────────────────────
const LEGAL_SUFFIXES = /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|company|ltd|limited|plc|pllc|pc|lp|llp|group|holdings|enterprises|services|service|and|the)\b/g;

// Business name -> a stable comparison key. "The Summit Roofing Co., LLC" -> "summit roofing"
export const normName = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();

// URL/host -> bare registrable-ish host. "https://WWW.Example.com/about" -> "example.com"
export const normDomain = (u) => {
  const raw = String(u || "").trim().toLowerCase();
  if (!raw || raw === "unknown" || raw === "none" || raw === "n/a") return "";
  const withScheme = /^https?:\/\//.test(raw) ? raw : "https://" + raw;
  try {
    const h = new URL(withScheme).hostname.replace(/^www\./, "");
    return /\./.test(h) ? h : "";
  } catch { return ""; }
};

// Free-text place -> comparable token string. "Phoenix, AZ." -> "phoenix az"
export const cleanArea = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// The UNIQUE key stored in Postgres. Name + city is the most stable pair for a
// local business (websites get rebuilt and phone numbers get ported, names don't).
export const dedupeKeyFor = (p) => {
  const n = normName(p && p.name);
  const c = cleanArea((p && p.city) || "");
  return n ? `${n}|${c}` : "";
};

// ─── STRICT AREA MATCHING ────────────────────────────────────────────────────
// Words that make a requested area a REGION rather than a single city. City-level
// corroboration can't be done for those, so we fall back to the AI's own tag + state.
const BROAD = /\b(county|metro|metroplex|region|greater|valley|area|corridor|suburbs|tri city|tri cities)\b/;

// Returns true only if the prospect genuinely sits inside one of the requested areas.
// An empty `areas` list means "no area filter" (used for e-commerce brands).
export const areaMatches = (p, areas) => {
  const list = (areas || []).map(cleanArea).filter(Boolean);
  if (!list.length) return true;

  const city = cleanArea(p && p.city);
  const state = cleanArea(p && p.state);
  const postal = String((p && p.postal) || "").replace(/\D/g, "");
  const tagged = cleanArea(p && p.area_match);

  return list.some((req) => {
    // A bare ZIP request is checked against the prospect's own ZIP.
    if (/^\d{5}$/.test(req)) return postal.startsWith(req);

    // Strip region words + a trailing state abbreviation to isolate the city part.
    const withoutRegionWords = req.replace(BROAD, " ").replace(/\s+/g, " ").trim();
    const leadCity = withoutRegionWords.replace(/\s+[a-z]{2}$/, "").trim();

    if (leadCity && city && (city === leadCity || city.includes(leadCity) || leadCity.includes(city))) return true;

    // Region-style request: accept only when the AI tagged this exact area AND the
    // state lines up (or it never reported a state).
    if (BROAD.test(req) && tagged === req && (!state || req.includes(state))) return true;

    // A request with no city part at all (e.g. "statewide az") can only be state-checked.
    if (!leadCity && state && req.includes(state)) return true;

    return false;
  });
};

// ─── SCORING TIERS ───────────────────────────────────────────────────────────
// The 0-100 fit score the AI assigns, bucketed into the call-list language Bryson
// actually uses. Colors are the OS palette so the front end can render straight
// from this table.
export const TIERS = [
  { id: "call_first", min: 80, label: "Call first",   color: "#22D3A0", blurb: "Strong fit — put them at the top of the list." },
  { id: "strong",     min: 62, label: "Strong lead",  color: "#C8A84B", blurb: "Worth a call once the top tier is worked." },
  { id: "maybe",      min: 42, label: "Maybe",        color: "#FBBF24", blurb: "Could work, but expect a harder sell." },
  { id: "low",        min: 22, label: "Low priority", color: "#8B91B8", blurb: "Only if you run out of better leads." },
  { id: "skip",       min: 0,  label: "Skip",         color: "#F87171", blurb: "Waste of time — bad fit or unreachable." },
];
export const tierFor = (score) => {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  return TIERS.find((t) => s >= t.min) || TIERS[TIERS.length - 1];
};

// ─── STRUCTURED OUTPUT SCHEMAS ───────────────────────────────────────────────
// Strict tool use guarantees the JSON validates, so no defensive parsing downstream.
// Strict mode requires every property listed in `required` and additionalProperties
// false — so there are no optional fields. Anything the AI couldn't confirm comes
// back as the literal string "unknown" (or 0 for the two integers), which is also
// what stops it quietly inventing an owner's cell number to fill a blank.
const str = (description) => ({ type: "string", description });
const strArr = (description) => ({ type: "array", items: { type: "string" }, description });
const objArr = (description, properties) => ({
  type: "array", description,
  items: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
});

// Every phone/email is carried as its own record with WHOSE it is and WHERE it came
// from, so the OS can show a real Contact block (main line, direct line, cell, alt)
// instead of one anonymous number — and so a verified provider number is visibly
// different from one the model read off a web page.
const PHONE_PROPS = {
  number:     str("The phone number, formatted normally."),
  kind:       { type: "string", enum: ["main", "direct", "mobile", "secondary", "toll_free", "unknown"], description: "main = the published business line. direct = a desk line that bypasses reception. mobile = a cell. secondary = another published line." },
  whose:      { type: "string", enum: ["business", "owner", "unknown"], description: "Whose phone this reaches." },
  label:      str('What this number is for, e.g. "main office", "sales", "owner cell". Short.'),
  source:     str("Where you found it — the specific page or listing."),
  confidence: { type: "string", enum: ["high", "medium", "low"], description: "How sure you are this number is current and correct." },
};
const EMAIL_PROPS = {
  address:    str("The email address."),
  whose:      { type: "string", enum: ["business", "owner", "unknown"], description: "Whose inbox this reaches." },
  source:     str("Where you found it."),
  confidence: { type: "string", enum: ["high", "medium", "low"], description: "How sure you are it is current and monitored." },
};
// The model scores five factors; `budget` is deliberately NOT in this list because
// BoldLine computes affordability itself in scout-scoring.mjs. Letting the model
// improvise arithmetic about whether someone can pay is exactly the wrong division
// of labour.
const FACTOR_PROPS = {
  factor: { type: "string", enum: ["demand", "gap", "reach", "momentum", "risk"], description: "Which scoring factor this is." },
  points: { type: "integer", description: "Points awarded. Maximums: demand 25, gap 25, reach 15, momentum 10. risk is NEGATIVE only (0 down to -40)." },
  why:    str("One specific sentence justifying these points, citing what you actually found. This is shown to Bryson as the reason for the score."),
};

const PROSPECT_PROPS = {
  name:              str('Legal/trading business name as it appears on their own site or listing.'),
  dba:               str('Any other name they trade under, or "unknown".'),
  city:              str("City the business is physically based in."),
  state:             str("State/province abbreviation, e.g. AZ."),
  postal:            str('ZIP/postal code, or "unknown".'),
  address:           str('Street address, or "unknown".'),
  area_match:        str("The EXACT requested search area string this business belongs to. Copy it verbatim from the list you were given."),
  website:           str('Their website, or "none" if they genuinely have no site, or "unknown" if you could not confirm.'),
  phones:            objArr("EVERY phone number you found for this business, each tagged. Always include the main published business line if one exists. Include an owner direct line or cell ONLY if it is genuinely published somewhere — never repeat the main line as the owner's. Empty array if you found none.", PHONE_PROPS),
  emails:            objArr("Every email address you found, each tagged. Empty array if none.", EMAIL_PROPS),
  owner_name:        str('Owner / founder / principal decision-maker full name, or "unknown". NEVER guess a name.'),
  owner_title:       str('Their title (Owner, President, Managing Partner...), or "unknown".'),
  owner_source:      str('Where the owner details came from (e.g. "About page", "state corporation filing", "LinkedIn"), or "unknown".'),
  contact_confidence: { type: "string", enum: ["high", "medium", "low", "none"], description: "How confident you are the contact details reach a real decision-maker." },
  employees:         str('Headcount as a range or number, e.g. "6-15", or "unknown".'),
  employees_estimate: { type: "integer", description: "Single best-guess headcount as a whole number for sorting. Use 0 when unknown." },
  years_in_business: str('e.g. "since 2011" or "~14 years", or "unknown".'),
  revenue_estimate:  str('Rough annual revenue band if a credible source states it, or "unknown".'),
  rating:            str('Google/Yelp star rating as a number string, e.g. "4.7", or "unknown".'),
  review_count:      { type: "integer", description: "Number of reviews behind that rating. Use 0 when unknown." },
  review_source:     str('Where the rating came from, e.g. "Google", or "unknown".'),
  google_ads:        { type: "string", enum: ["yes", "likely", "no", "unknown"], description: 'Are they advertising on Google? "yes" only if you SAW a paid result or a verified tag was reported to you; "likely" if the evidence is indirect; "unknown" if you could not check. Do not answer "no" unless you actively searched their main terms and saw no paid placement.' },
  meta_ads:          { type: "string", enum: ["yes", "likely", "no", "unknown"], description: 'Are they advertising on Meta? "yes" only if you saw actual live ads; "likely" if a Meta Pixel or similar indirect evidence exists; "unknown" otherwise. Never answer "no" from absence of evidence.' },
  ads_evidence:      str('What you actually saw that proves the ads answer, or "unknown".'),
  seo_note:          str("One line on how they show up organically / in the map pack."),
  website_quality:   { type: "string", enum: ["none", "poor", "dated", "decent", "strong", "unknown"], description: "Honest read on whether their site is built to convert." },
  services:          strArr("Their main services or product lines (up to 6)."),
  gaps:              strArr("The specific marketing gaps BoldLine could fix (up to 4)."),
  score_factors:     objArr("Score the four positive factors (demand, gap, reach, momentum) and the risk penalty. Return exactly these five, each with a specific reason. Do NOT score budget — BoldLine computes affordability itself.", FACTOR_PROPS),
  verdict:           str("One sentence: should Bryson call them, and why or why not."),
  why_contact:       strArr("Up to 4 concrete reasons this is a good prospect."),
  why_not:           strArr("Up to 3 honest reasons this could be a waste of time. Never leave this empty — there is always a risk."),
  best_hook:         str("One natural opening line Bryson can actually say on a cold call, grounded in something real you found."),
  recommended_package_id: str("The single best-fit BoldLine package id from the catalog."),
  data_notes:        str("Anything you could not confirm, or that looked stale/outdated. Be blunt."),
  sources:           strArr("URLs you actually used (up to 6)."),
};

export const PROSPECT_TOOL = {
  name: "emit_prospects",
  description: "Return the fully researched, scored prospect records. Call this exactly once, after your research is done.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      prospects: {
        type: "array",
        description: "One record per business you were asked to research, in the same order.",
        items: { type: "object", properties: PROSPECT_PROPS, required: Object.keys(PROSPECT_PROPS), additionalProperties: false },
      },
    },
    required: ["prospects"],
    additionalProperties: false,
  },
};

const CANDIDATE_PROPS = {
  name:       str("Business name."),
  city:       str("City it is physically based in."),
  state:      str("State abbreviation."),
  area_match: str("The EXACT requested area string it belongs to, copied verbatim."),
  website:    str('Website if you saw one, "none" if it clearly has none, else "unknown".'),
  phone:      str('Main phone if the listing showed one, else "unknown".'),
  evidence:   str("Where you found it and what confirms it is in that area and that industry."),
};

export const CANDIDATE_TOOL = {
  name: "emit_candidates",
  description: "Return the list of real, currently-operating businesses you found. Call this exactly once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: "The businesses found, best-first.",
        items: { type: "object", properties: CANDIDATE_PROPS, required: Object.keys(CANDIDATE_PROPS), additionalProperties: false },
      },
      coverage_note: str("One line on how well you were able to cover the requested areas, and anything that limited the search."),
    },
    required: ["candidates", "coverage_note"],
    additionalProperties: false,
  },
};

// ─── PROMPTS ─────────────────────────────────────────────────────────────────
const HONESTY = `ACCURACY RULES — these matter more than completeness. A list with 6 verified businesses beats a list with 20 where half the details are invented, because Bryson dials these numbers and speaks to these people by name.
- Use ONLY facts you actually saw via web search on this run. Never infer from what is "typical" for the industry.
- NEVER invent: business names, owner names, phone numbers, email addresses, employee counts, review counts, star ratings, years in business, or whether they run ads. If you did not find it, the value is exactly "unknown".
- An owner's direct phone or email is rarely public. "unknown" is the correct and expected answer most of the time. Do NOT copy the main business number into owner_phone to make the record look complete.
- Prefer recent sources. If the strongest thing you found looks stale (a dead-looking site, an old article), say so in data_notes rather than presenting it as current.
- Skip anything that is closed, a duplicate listing, a national franchise's corporate page, a directory/aggregator page, or a lead-gen site pretending to be a local business.`;

const areasBlock = (areas) =>
  (areas || []).length
    ? `SEARCH AREAS (strict — a business qualifies only if it is physically located in, or unambiguously headquartered in, one of these):\n${areas.map((a) => `- ${a}`).join("\n")}\nDo not drift into neighbouring towns that were not listed. Tag every result with the exact area string it belongs to.`
    : `SEARCH AREA: nationwide / online — this is an online brand, so physical location is not a filter. Still report where the brand is based if you can find it.`;

const excludeBlock = (names) =>
  (names || []).length
    ? `\nALREADY IN BRYSON'S LIST — do NOT return any of these, and do not waste searches on them. Find businesses that are not on this list:\n${names.slice(0, 140).map((n) => `- ${n}`).join("\n")}\n`
    : "";

export const discoverySystem = ({ niche, nicheGroup, kind, areas, count, exclude, filters }) => {
  const f = filters || {};
  const wants = [
    f.websiteState === "has" ? "- Only include businesses that DO have their own website." : null,
    f.websiteState === "none" ? "- Prioritise businesses with no website or only a social page — those are the easiest sells." : null,
    f.adsState === "running" ? "- Prioritise businesses that appear to already be advertising (they have proven budget)." : null,
    f.adsState === "not" ? "- Prioritise businesses that are NOT currently advertising (untapped)." : null,
    f.minEmployees > 0 ? `- Skip solo operators; aim for roughly ${f.minEmployees}+ employees.` : null,
  ].filter(Boolean);

  return `You are a B2B prospecting researcher for BoldLine Media, a digital marketing agency (managed Google/Meta ads + custom landing pages) run by Bryson Weiser. Your job on this run is DISCOVERY ONLY: find real businesses worth cold-calling. A later step does the deep research on each one.

TARGET INDUSTRY: ${niche}${nicheGroup ? ` (${nicheGroup})` : ""}${kind === "ecom" ? " — this is an ONLINE / e-commerce brand category, not a local storefront trade." : ""}

${areasBlock(areas)}
${excludeBlock(exclude)}
TARGET COUNT: find up to ${count} distinct businesses. Fewer real ones is better than padding the list.
${wants.length ? `\nPREFERENCES (soft — a great prospect that misses one of these is still worth returning):\n${wants.join("\n")}\n` : ""}
HOW TO SEARCH: run several different searches — the industry term plus each area, map/directory listings, "best <industry> in <area>", local association or chamber listings, and industry-specific directories. Vary the wording so you are not just re-reading one results page. Confirm each business is currently operating and actually in the requested area before returning it.

${HONESTY}

When you are done searching, call emit_candidates exactly once with everything you found. Do not write a prose summary.`;
};

export const enrichSystem = ({ niche, kind, leadFee, areas }) => `You are a B2B sales-intelligence analyst preparing a cold-call list for Bryson Weiser, owner of BoldLine Media — a digital marketing agency that runs managed Google Ads and Meta ads and builds custom landing pages. Pricing is a monthly management fee + one-time setup + a per-qualified-lead fee (about $${leadFee}/lead in this industry; e-commerce brands use a ROAS bonus instead). The CLIENT always owns and pays for their own ad account — BoldLine never fronts ad spend.

You will be given a small batch of businesses in the "${niche}" space${(areas || []).length ? ` around ${areas.join(", ")}` : ""}. For EACH one, research it on the web and fill in a complete record.

RESEARCH EACH BUSINESS FOR:
- Who owns/runs it. Check the About/Team page, state business registration filings, LinkedIn, local news, and review responses (owners often reply to reviews by name). If the owner is not publicly named, the answer is "unknown".
- EVERY phone number, into the phones array. Always include the main published business line if one exists — that is the number Bryson dials most often, so it must never be missing when the business has one. Also capture any secondary/branch/sales line, and a direct or cell line for the owner ONLY if it is genuinely published. Tag each with whose it is and where you found it.
- Every email address, into the emails array, tagged the same way.
- Size: headcount from their team page, LinkedIn company size, or a hiring page. Number of locations and trucks/chairs/bays counts as a size signal. This drives the affordability math, so a defensible estimate matters more here than anywhere else — say the number you can support and put 0 if you genuinely cannot tell.
- Website: does one exist, and is it actually built to convert (clear offer, phone above the fold, a form, mobile-friendly, not obviously a decade old)?
- Advertising: search their main commercial terms and see whether a paid result appears. Some businesses arrive with an AD TECH block listing tracking tags found on their own website — a Google Ads conversion tag or a Meta Pixel means they are set up to advertise on that platform, which is "likely", not "yes". Absence of a tag proves NOTHING (many sites inject tags via Tag Manager), so never answer "no" just because no tag was reported. Put the concrete evidence in ads_evidence.
- Reputation: star rating, review count, and what the reviews complain about or praise.
- Years in business, service area, and any growth signals (new location, hiring, recent press).

SCORING — you do NOT return an overall score. You return five factors in score_factors, and BoldLine adds them up. Every factor needs a specific reason, because Bryson is shown your reasons as the justification for the number:
- "demand" (0-25): does this business live or die on inbound customer flow? A roofer or injury lawyer with no leads has no business; a shop with a captive contract does not care.
- "gap" (0-25): how much is broken today that BoldLine can fix — no site, weak site, no ads running, invisible in the map pack, thin reviews. More broken = more upside = more points.
- "reach" (0-15): can Bryson actually get the decision-maker on the phone? A named owner with a direct line is the full 15; a generic info@ inbox and a reception line is 3.
- "momentum" (0-10): hiring, opening a location, recently invested, growing review velocity.
- "risk" (0 to -40, NEGATIVE ONLY): national franchise or corporate-owned (no local marketing decision), already running a big well-managed agency campaign, obviously dormant or closed, terrible reputation BoldLine cannot fix, or a vertical Google/Meta restrict (CBD, firearms, alcohol, adult, some supplements and financial offers). No risk found = 0, and say so.
Do NOT score "budget" — BoldLine calculates affordability from headcount and revenue itself, and a business that cannot cover the entry cost has its total capped automatically. Your job on the money is simply to report the size signals accurately.
Be willing to award low points. A list where everything scores 85 is useless to him.

BoldLine's packages (pick ONE id for recommended_package_id):
${PACKAGES.map((p) => `- ${p.id} — "${p.name}" (${p.platform}): $${p.price}/mo + $${p.setup} setup${p.leadFee ? ` + $${leadFee}/lead` : " (ecom ROAS bonus)"}. Client ad spend ${p.adSpend}.`).join("\n")}
${kind === "ecom" ? "This is an e-commerce brand, so recommend one of the e- packages." : "This is a lead-gen service business, so recommend a g-, m-, or c- package sized to what they can realistically spend."}

VERIFIED DATA: some businesses arrive with a "VERIFIED FACTS" block from Google Places or Apollo. That data is authoritative — treat it as GROUND TRUTH. Never contradict it, never replace a verified phone number or address with one you found on a web page, and do not restate verified values as if they were your own findings. Your job on those businesses is to add what the providers cannot: whether they are running ads, what their website is actually like, the gaps, the score factors, and the opener. If your research genuinely conflicts with a verified fact (e.g. the site lists a different phone), add BOTH — put yours in the array as a secondary number with lower confidence and note the conflict in data_notes.

${HONESTY}

best_hook must be something Bryson can say out loud in the first 10 seconds of a cold call, referencing a real detail you found — not a generic pitch.
why_not must never be empty. Every prospect has a reason it might not work; name it.

When your research is done, call emit_prospects exactly once with one record per business, in the order given. Do not write a prose summary.`;

// Re-exported so the background function has a single import for pricing too.
export { getNicheLeadFee, PACKAGES };
