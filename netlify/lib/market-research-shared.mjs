// The pure half of Market Research: what to search for, what counts as a competitor,
// the model's output contract, and the rules that clean its answer.
//
// Bryson, 2026-08-22: "Can you automate that so that way the bots research my own
// competitors (same thing for clients for the future) and then also ads what makes me
// different". Both halves of that already had a home: `brandVoice.competitors` and
// `brandVoice.differentiator` are fed into every ad and every landing page the OS writes
// (`brief()` in ad-gen-shared, `generate-landing`, `landing`). They were simply always
// empty, because filling them was a job nobody had automated.
//
// 🔴 THE RISK THIS FILE EXISTS TO CONTAIN. A differentiator is a CLAIM a business makes
// in public, in a paid ad. A model asked "what makes them different" will happily answer
// "24/7 emergency callouts" or "lifetime warranty" for a business that offers neither,
// and it will sound completely reasonable. That is not a copy problem, it is a business
// making a promise it cannot keep, to customers, with money behind it.
//
// So the rules here are mechanical, not just prompt text:
//   • every proposal must name its BASIS, and the basis decides whether it needs
//     confirming before it can be used,
//   • a proposal with no evidence behind it is DROPPED, not shown with a caveat,
//   • nothing here writes to `brandVoice`. It writes a PROPOSAL. A person clicks Use.
// The prompt asks for the same things, but a prompt is a request and this is a gate.
//
// Kept separate from the function so the tests can run the real thing (KB `repo-tests`).

import { humanize } from "./humanize.mjs";

// How a proposed differentiator is grounded, and what that means for trusting it.
//   record   — traceable to something the business itself has stated in the OS (their
//              offer, their average job value, their own site). Safe to use as written.
//   observed — seen on their own public site or listing this run. Safe, but worth a look.
//   gap      — an opening the competitors leave. This is the valuable kind AND the
//              dangerous kind: it is a claim nobody has verified the business can keep,
//              so it can never be used without the owner confirming it.
export const BASES = ["record", "observed", "gap"];
export const needsConfirmation = (basis) => String(basis || "gap") !== "record";

const clip = (s, n) => humanize(String(s == null ? "" : s)).trim().replace(/\s{2,}/g, " ").slice(0, n).trim();

// A differentiator has to fit in an ad. Anything longer is a paragraph, not a position,
// and will be truncated mid-thought by the ad builders downstream.
export const MAX_DIFF = 90;

// Which area to research. The service area is the most specific thing the business told
// us; target locations is where the ads point; the business address is the last resort.
// An empty answer is returned as empty rather than guessed at, because searching the
// wrong city returns real businesses that are the wrong competitors, which is worse than
// returning nothing.
export const researchArea = (cl) => {
  const cs = (cl && cl.campaignSetup) || {};
  const first = (s) => String(s || "").split(/[,\n]/)[0].trim();
  return clip(cs.serviceArea || first(cs.targetLocations) || cl && cl.businessAddress || "", 120);
};

// ─── SOME BUSINESSES DO NOT HAVE A LOCAL MARKET ──────────────────────────────
// Bryson, 2026-08-22: "when researching competitors don't just search only in Gilbert
// search in other places as well because marketing agencies can be anywhere".
//
// He is right, and the first version had it wrong in a way that mattered. A roofer's
// competitors are the roofers a customer could actually call, so one metro is the whole
// market. BoldLine works with businesses remotely and nationally, so its competitors are
// every agency a business owner could hire, wherever they sit. Searching only Gilbert
// returned a handful of small shops and called that the market.
//
// This is derived, not hardcoded to the house account, because it is equally true of a
// client who sells remotely and of every e-commerce brand: their buyer does not care
// where they are.
const NATIONAL_WORDS = /\b(nationwide|nationally|national|united states|u\.?s\.?a?|all 50|anywhere|remote(ly)?|online only|worldwide|global)\b/i;

export const sellsNationally = (cl) => {
  if (cl && cl.internal) return true;                       // BoldLine itself, always
  const cs = (cl && cl.campaignSetup) || {};
  if (NATIONAL_WORDS.test(`${cs.serviceArea || ""} ${cs.targetLocations || ""}`)) return true;
  // An e-commerce brand ships to whoever buys. Its competitor is a store, not a neighbour.
  return /e-?commerce|online store|subscription box|dtc/i.test(String((cl && cl.niche) || ""));
};

// 🔴 SPLITTING A SERVICE AREA IS A SOLVED PROBLEM IN THIS REPO, AND I RESOLVED IT WRONG
// FIRST. The naive split on commas turns "Mesa, Arizona, Tempe, Arizona" into four
// entries and searches for competitors in a place called "Arizona" and a place called
// "Mesa" separately. `toLocationLines` in index.html hit exactly this and its comment
// records the fix: only pair two chunks when the SECOND one actually looks like a state,
// otherwise a bare list of cities silently becomes "Phoenix, Mesa", a place nobody meant.
// Same rule here. There is a test pinning both known-bad inputs.
const US_STATE = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)$/i;

export const splitAreas = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return [];
  // Newlines and semicolons are unambiguous, so trust them when they are there.
  const explicit = raw.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit.map((x) => clip(x, 120));
  const parts = raw.split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (i + 1 < parts.length && US_STATE.test(parts[i + 1])) { out.push(`${parts[i]}, ${parts[i + 1]}`); i++; }
    else out.push(parts[i]);
  }
  return out.map((x) => clip(x, 120)).filter(Boolean);
};

// A spread of the metros where agencies and remote-selling businesses actually cluster,
// so a national search is not just one city repeated. Deliberately short: each entry is
// another lookup, and past a handful the extra names stop changing the picture.
export const NATIONAL_MARKETS = [
  "Los Angeles, California", "New York, New York", "Dallas, Texas",
  "Chicago, Illinois", "Atlanta, Georgia", "Miami, Florida",
];

// Everywhere worth looking, own market first. A local business gets its own area plus
// the places its ads point at; a national one gets its own area plus the wider markets,
// because leaving its own out would hide the competitors it bumps into most.
export const researchAreas = (cl, max = 7) => {
  const cs = (cl && cl.campaignSetup) || {};
  const own = researchArea(cl);
  const targets = splitAreas(cs.targetLocations);
  const list = sellsNationally(cl)
    ? [own, ...NATIONAL_MARKETS]
    : [own, ...targets];
  const seen = new Set();
  return list.filter((a) => {
    const k = a.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, max);
};

export const researchNiche = (cl) => clip((cl && cl.niche) || "", 80);

// A business must never appear in its own competitor list. Matching is loose on purpose:
// Places returns "BoldLine Media LLC" for "BoldLine Media", and a list that includes you
// makes every conclusion drawn from it wrong.
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(llc|inc|co|company|corp|ltd|the|and)\b/g, " ").replace(/\s+/g, " ").trim();

export const isSelf = (name, cl) => {
  const a = norm(name);
  if (!a) return true;
  const b = norm(cl && cl.name);
  if (b && (a === b || a.includes(b) || b.includes(a))) return true;
  // Their own website domain showing up under a different trading name.
  const site = String((cl && cl.website) || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  return !!(site && norm(site.split(".")[0]) && norm(site.split(".")[0]) === a);
};

// Rank by how much a competitor actually matters to this business: someone already
// buying ads is bidding against you today, and review volume is the closest public
// proxy for how much of the market they are taking.
export const rankCompetitors = (list, cl, max = 8) => (Array.isArray(list) ? list : [])
  .filter((c) => c && c.name && !isSelf(c.name, cl))
  .filter((c, i, a) => a.findIndex((x) => norm(x.name) === norm(c.name)) === i)
  .map((c) => ({
    ...c,
    _w: (c.runningAds ? 1000 : 0) + Math.min(500, Number(c.reviewCount || 0)) + (c.website ? 20 : 0),
  }))
  .sort((a, b) => b._w - a._w)
  .slice(0, max)
  .map(({ _w, ...c }) => c);

// The model's output contract. Everything is required so a partial answer fails loudly
// here rather than rendering as a half-empty card nobody can interpret.
export const MR_TOOL = {
  name: "market_research",
  description: "Report what the competition is doing and what this business could own that they do not.",
  input_schema: {
    type: "object",
    properties: {
      competitorsLine: { type: "string", description: "The competitor names, comma separated, ready to store as a plain list. Real names only, from the ones supplied or found." },
      landscape: { type: "string", description: "Two or three sentences on what this market looks like right now. Plain English, no marketing language." },
      commonClaims: {
        type: "array", items: { type: "string" },
        description: "The things nearly all of them already say. These are what a new ad must NOT lead with, because saying them makes you sound like everyone else.",
      },
      gaps: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gap: { type: "string", description: "Something customers in this market want that nobody is clearly claiming." },
            why: { type: "string", description: "What you saw that makes you say that." },
          },
          required: ["gap", "why"],
        },
      },
      differentiators: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: `The position itself, as it would appear in an ad. Under ${MAX_DIFF} characters. No dashes.` },
            basis: { type: "string", enum: BASES, description: "record = traceable to what the business already told us. observed = seen on their own public site this run. gap = an opening nobody claims, which the owner must confirm they can deliver." },
            evidence: { type: "string", description: "The specific thing you saw or were told that supports this. Never a general statement about the industry." },
            why: { type: "string", description: "Why this would win against the competitors listed, in one sentence." },
          },
          required: ["text", "basis", "evidence", "why"],
        },
      },
    },
    required: ["competitorsLine", "landscape", "commonClaims", "gaps", "differentiators"],
  },
};

// 🔴 THE GATE. The prompt asks for grounded answers; this enforces it. A proposal with
// no evidence, no basis, or nothing to say is removed entirely rather than shown with a
// warning next to it, because a warning beside a good-sounding line is not a defence:
// the line still gets read, remembered and used.
export const cleanResearch = (data, cl) => {
  const d = data || {};
  const diffs = (Array.isArray(d.differentiators) ? d.differentiators : [])
    .map((x) => ({
      text: clip(x && x.text, MAX_DIFF),
      basis: BASES.includes(String(x && x.basis)) ? String(x.basis) : "gap",
      evidence: clip(x && x.evidence, 300),
      why: clip(x && x.why, 300),
    }))
    // Evidence is not optional. An unevidenced claim is exactly the thing this is
    // built to stop a business from putting in a paid ad.
    .filter((x) => x.text && x.evidence)
    .map((x) => ({ ...x, needsConfirmation: needsConfirmation(x.basis) }))
    .slice(0, 4);

  return {
    competitorsLine: clip(d.competitorsLine, 400),
    landscape: clip(d.landscape, 700),
    commonClaims: (Array.isArray(d.commonClaims) ? d.commonClaims : [])
      .map((s) => clip(s, 120)).filter(Boolean).slice(0, 8),
    gaps: (Array.isArray(d.gaps) ? d.gaps : [])
      .map((g) => ({ gap: clip(g && g.gap, 140), why: clip(g && g.why, 300) }))
      .filter((g) => g.gap && g.why).slice(0, 6),
    differentiators: diffs,
  };
};

export const mrSystem = ({ isAgency, name, niche, area, offer, avgTicket, site }) => `You are a market analyst. You are working out what a business can honestly claim in a paid ad that its competitors are not already claiming.

THE BUSINESS
Name: ${name || "not given"}
${isAgency
  ? `What they do: BoldLine Media runs Google and Meta ads for other businesses and builds the landing pages behind them. They work with businesses remotely and nationally, so NEVER describe their customers as "local businesses". They have NO CLIENTS YET, so there are no results, case studies or testimonials, and inventing any would be a lie. Things that ARE true and are fair to use: the client owns and is billed for their own ad account so nothing is held hostage if they leave, every campaign gets a purpose-built landing page instead of pointing at a homepage, and the operation is run by software rather than a large retainer team.`
  : `Industry: ${niche || "not given"}
What they sell: ${offer || "not given"}
Typical job value: ${avgTicket || "not given"}`}
Area to research: ${area || "not given"}
Their own site: ${site || "not given"}

WHAT TO PRODUCE
1. The competitors. Use the ones supplied below as your starting point. You may add others you find, but only ones that genuinely exist and serve this market.
2. What nearly all of them already say. This matters as much as anything else: a business that leads with a claim everyone makes has no position at all.
3. The openings nobody is clearly claiming.
4. Up to four things this business could own, each written as it would appear in an ad.

🔴 THE RULE THAT MATTERS MOST. A differentiator is a promise made in public with money behind it. You are NOT writing marketing copy here, you are reporting what is defensible.
- Every proposal must carry the specific thing you saw or were told that supports it. Not "roofers usually offer this". Something real, from this run.
- Mark the basis honestly. Use "record" ONLY when it traces to what the business itself has already stated above. Use "observed" for something on their own public site. Use "gap" when it is an opening you spotted but nobody has confirmed this business can deliver it. When in doubt it is a gap.
- NEVER propose a capability the business has not told you it has. Same day service, 24 hour response, lifetime warranties, free anything, price guarantees, years in business, certifications, crew size. If it is not above and you did not see it on their own site, it is a gap at best and usually should not be proposed at all.
- If the honest answer is that you found little, say so. A short, true report is worth more than a long invented one.

HOW TO WRITE
Plain English, the way a person would say it out loud. NEVER use a dash to join or interrupt a sentence: not an em dash, not an en dash, not a hyphen with spaces around it. Write two sentences or use a comma. Hyphens inside a word are fine. Do not use marketing words like unlock, elevate, leverage, seamless, robust or game-changer.`;

export const mrPrompt = ({ competitors, area, areas, niche, placesOff, national }) => {
  const lines = (competitors || []).map((c, i) => {
    const bits = [
      c.rating ? `${c.rating} stars` : "",
      c.reviewCount ? `${c.reviewCount} reviews` : "",
      c.website || "",
      c.runningAds === true ? "IS running ads" : c.runningAds === false ? "no ads detected" : "",
      c.adsNote || "",
    ].filter(Boolean).join(", ");
    return `${i + 1}. ${c.name}${bits ? ` (${bits})` : ""}`;
  }).join("\n");

  const where = (areas && areas.length > 1)
    ? `across ${areas.join(", ")}`
    : `in ${area || "their area"}`;

  return `Research the market for ${niche || "this business"} ${where}.

${national
  ? `🔴 THIS BUSINESS DOES NOT HAVE A LOCAL MARKET. It sells remotely, so its competitors are every business of this kind a buyer could choose, wherever they are based. Do not treat the areas above as a boundary. They are only where the verified listings were pulled from. The most relevant competitors may well be ones that operate entirely online and have no office anywhere near.\n`
  : `These are the areas this business actually serves, so a competitor outside them is not really a competitor. Stay inside them.\n`}
${lines
  ? `VERIFIED COMPETITORS, pulled from Google's own business listings this run. The ratings, review counts and whether they are running ads are measured facts, so treat them as true and build on them:\n${lines}`
  : placesOff
    ? "No verified business listings were available this run, so find the competitors yourself with web search. Only name businesses you can actually see."
    : "No competitors came back from the business listings for this area. Find them yourself with web search, and only name businesses you can actually see."}

Use web search to see what these businesses actually say on their own sites, what their reviews complain about and praise, and how they price. Then report back through the market_research tool.`;
};
