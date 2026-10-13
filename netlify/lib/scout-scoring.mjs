// Lead Scout — the money math and the score breakdown.
//
// Bryson (2026-08-11): "make sure I also get reasons why it's scored as such and make
// sure it ranks lower on companies that won't have enough money to work with me (you
// can do the math)."
//
// So the score is NOT a number the model picks out of the air. It is the SUM of six
// visible factors, and the affordability factor is computed HERE, in deterministic
// code, from the prospect's headcount/revenue — because arithmetic about whether
// someone can pay you is exactly the thing a language model should not be improvising.
// A prospect who cannot cover the cheapest package gets a HARD CAP on their score, so
// they physically cannot appear near the top of the call list no matter how good the
// rest of their profile looks.

import { PACKAGES, WEBSITE_OFFER, WEBSITE_SIGNATURE } from "./pricing-shared.mjs";

// ─── Revenue estimation ──────────────────────────────────────────────────────
// Conservative annual revenue per employee by industry group. Deliberately on the
// low side: over-estimating a prospect's budget is the expensive mistake here (it
// puts a business that can't pay at the top of the call list), under-estimating just
// means Bryson finds a pleasant surprise on the call.
const REV_PER_EMPLOYEE = {
  "Legal": 250000,
  "Medical & Dental": 240000,
  "B2B & Commercial": 200000,
  "Automotive": 180000,
  "Professional & Financial Services": 180000,
  "Home Services & Trades": 150000,
  "Pets": 95000,
  "Beauty, Wellness & Fitness": 85000,
  "Senior Care & Health Services": 85000,
  "Education & Childcare": 70000,
  "Hospitality, Events & Food": 70000,
};
const ECOM_REV_PER_EMPLOYEE = 300000;
const DEFAULT_REV_PER_EMPLOYEE = 140000;

// What share of revenue a business in this group can realistically put into paid
// marketing. Lead-hungry high-ticket trades run hot; thin-margin food and childcare
// cannot.
const MARKETING_PCT = {
  "Legal": 0.09,
  "Medical & Dental": 0.08,
  "Home Services & Trades": 0.07,
  "Automotive": 0.06,
  "Professional & Financial Services": 0.06,
  "B2B & Commercial": 0.05,
  "Beauty, Wellness & Fitness": 0.07,
  "Pets": 0.06,
  "Senior Care & Health Services": 0.05,
  "Education & Childcare": 0.04,
  "Hospitality, Events & Food": 0.04,
};
const ECOM_MARKETING_PCT = 0.10;
const DEFAULT_MARKETING_PCT = 0.06;

const isEcomGroup = (g) => /^e-?commerce/i.test(String(g || ""));
const revPerEmployee = (group, kind) =>
  kind === "ecom" || isEcomGroup(group) ? ECOM_REV_PER_EMPLOYEE : (REV_PER_EMPLOYEE[group] || DEFAULT_REV_PER_EMPLOYEE);
const marketingPct = (group, kind) =>
  kind === "ecom" || isEcomGroup(group) ? ECOM_MARKETING_PCT : (MARKETING_PCT[group] || DEFAULT_MARKETING_PCT);

// "$2-4M" / "$500k" / "about 1.5 million" -> a single midpoint number.
export const parseRevenue = (s) => {
  const raw = String(s || "").toLowerCase().replace(/,/g, "");
  if (!raw || /unknown|n\/a|none/.test(raw)) return 0;
  const re = /(\d+(?:\.\d+)?)\s*(k|m|b|million|billion|thousand)?/g;
  const nums = [];
  let m;
  while ((m = re.exec(raw))) {
    let n = parseFloat(m[1]);
    const unit = m[2] || "";
    if (/^k|thousand/.test(unit)) n *= 1e3;
    else if (/^m|million/.test(unit)) n *= 1e6;
    else if (/^b|billion/.test(unit)) n *= 1e9;
    // A bare number in a revenue string is almost always millions when small
    // ("$2-4M" tokenizes the 2 without a unit because the M trails the range).
    else if (n < 1000 && /m|million/.test(raw)) n *= 1e6;
    else if (n < 1000 && /k|thousand/.test(raw)) n *= 1e3;
    if (n >= 1000) nums.push(n);
  }
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
};

// Low end of a package's client ad spend, from "$500–$2,500/mo".
export const adSpendLow = (pkg) => {
  const m = String((pkg && pkg.adSpend) || "").match(/[\d,]+/);
  return m ? Number(m[0].replace(/,/g, "")) : 0;
};

// 🔴 MANAGED PACKAGES ONLY (fixed 2026-10-12). The one-time "Launch & Hand Off" has no monthly fee and no
// number in its ad budget, so once it existed it became the "cheapest way in" at $0/mo: every business
// came out "comfortable", the affordability cap never bit, and the card said "Infinity× their capacity".
// This math is about whether they can carry BoldLine every month, so a one-time build is not an entry.
const managed = (p) => p.pricingModel !== "one_time";
const entryPackageFor = (kind) =>
  kind === "ecom"
    ? PACKAGES.filter((p) => p.id.startsWith("e-") && managed(p)).sort((a, b) => a.price - b.price)[0]
    : PACKAGES.filter((p) => !p.id.startsWith("e-") && managed(p)).sort((a, b) => a.price - b.price)[0];

const fmt = (n) => "$" + Math.round(n).toLocaleString();

// ─── Can they pay for a WEBSITE (website mode, KB `website-prospects`) ──────
// A website is one payment, not a monthly ad bill, so the question is different: how many months of
// what a business this size typically spends on marketing would the build take? A website is far easier
// to afford than ads, which is the point: plenty of businesses too small for ads are fine for a site.
// Bands: up to 1.2 months comfortable, 2 workable, 3 tight (cap 55), 5 stretch (cap 30), more cannot (cap 15).
const websiteAffordability = ({ annualRevenue, basis, pct, nicheGroup }) => {
  const build = WEBSITE_OFFER.build, hosting = WEBSITE_OFFER.hosting;
  const base = { entryId: "w-standard", entryName: "Standard website", entryMonthly: hosting, entrySetup: build, pitch: "website" };
  if (!annualRevenue) {
    return { ...base, known: false,
      note: `Company size unknown, so whether they can pay could not be worked out. The cheapest way in is the Standard website at ${fmt(build)} once, then ${fmt(hosting)}/mo hosting. Confirm they can cover that before you spend real time on them.`,
      lines: [`Cheapest way in: Standard website, ${fmt(build)} once, then ${fmt(hosting)}/mo hosting`, "Size unknown, so check the budget on the call"] };
  }
  const monthlyCapacity = (annualRevenue * pct) / 12;
  const months = build / monthlyCapacity;
  let band, points, cap, verdict;
  if (months <= 1.2)    { band = "comfortable"; points = 25; cap = 100; verdict = "Can comfortably pay for a new website."; }
  else if (months <= 2) { band = "workable";    points = 19; cap = 100; verdict = "Can pay for a website without much strain."; }
  else if (months <= 3) { band = "tight";       points = 10; cap = 55;  verdict = "A website is a real expense for them. Offer half now and half before launch."; }
  else if (months <= 5) { band = "stretch";     points = 3;  cap = 30;  verdict = `A ${fmt(build)} website would eat months of their marketing budget.`; }
  else                  { band = "cannot";      points = 0;  cap = 15;  verdict = "Too small to pay for a website right now. Not worth your time."; }
  const signature = WEBSITE_SIGNATURE.build / monthlyCapacity <= 2;
  const affordableId = band === "cannot" ? null : signature ? "w-signature" : "w-standard";
  return {
    ...base, known: true, annualRevenue, basis, monthlyCapacity, ratio: 1 / months, months,
    band, points, cap, verdict,
    affordableId, affordableName: affordableId === "w-signature" ? "Signature website" : affordableId ? "Standard website" : null,
    budgetWhy: `${verdict} The build is about ${months.toFixed(1)} months of the ~${fmt(monthlyCapacity)}/mo a business their size spends on marketing.`,
    lines: [
      `Revenue estimate: ${fmt(annualRevenue)}/yr (${basis})`,
      `Marketing budget capacity: ~${fmt(monthlyCapacity)}/mo (${Math.round(pct * 100)}% of revenue, ${nicheGroup || "general"} benchmark)`,
      `Cheapest way in: Standard website, ${fmt(build)} once, then ${fmt(hosting)}/mo hosting`,
      `The build is about ${months.toFixed(1)} months of their marketing budget: ${band}`,
      affordableId === "w-signature" ? `Realistic ceiling: Signature website at ${fmt(WEBSITE_SIGNATURE.build)}`
        : affordableId ? "Realistic ceiling: the Standard website" : "Can't comfortably pay for any website right now",
    ],
  };
};

// ─── The affordability model ─────────────────────────────────────────────────
// Returns everything needed to both SCORE the prospect and SHOW Bryson the math.
export const assessAffordability = ({ employeesEstimate, revenueEstimate, nicheGroup, kind, pitch }) => {
  if (pitch === "website") {
    const statedRevenue = parseRevenue(revenueEstimate);
    const emp = Math.max(0, Math.round(Number(employeesEstimate) || 0));
    const perEmp = revPerEmployee(nicheGroup, kind);
    const annualRevenue = statedRevenue > 0 ? statedRevenue : emp * perEmp;
    const basis = statedRevenue > 0 ? `reported revenue ~${fmt(statedRevenue)}/yr`
      : emp > 0 ? `${emp} employee${emp === 1 ? "" : "s"} × ~${fmt(perEmp)} revenue per employee (${nicheGroup || "general"} benchmark)` : "";
    return websiteAffordability({ annualRevenue, basis, pct: marketingPct(nicheGroup, kind), nicheGroup });
  }
  const entry = entryPackageFor(kind) || PACKAGES[0];
  // Monthly minimum (the floor BoldLine bills even in a dead month) + the smallest ad
  // budget the package can actually work on. That sum is what the prospect must cover.
  const entryMonthly = entry.price + adSpendLow(entry);
  const entrySetup = entry.setup;

  const statedRevenue = parseRevenue(revenueEstimate);
  const emp = Math.max(0, Math.round(Number(employeesEstimate) || 0));
  const perEmp = revPerEmployee(nicheGroup, kind);
  const pct = marketingPct(nicheGroup, kind);

  let annualRevenue = 0, basis = "";
  if (statedRevenue > 0) { annualRevenue = statedRevenue; basis = `reported revenue ~${fmt(statedRevenue)}/yr`; }
  else if (emp > 0)      { annualRevenue = emp * perEmp;  basis = `${emp} employee${emp === 1 ? "" : "s"} × ~${fmt(perEmp)} revenue per employee (${nicheGroup || "general"} benchmark)`; }

  if (!annualRevenue) {
    return {
      known: false, entryId: entry.id, entryName: entry.name, entryMonthly, entrySetup,
      note: `Company size unknown, so their budget could not be calculated. The cheapest way in is ${entry.name} at a ${fmt(entry.price)}/mo minimum plus at least ${fmt(adSpendLow(entry))}/mo of their own ad spend and a ${fmt(entrySetup)} setup — confirm they can cover roughly ${fmt(entryMonthly)}/mo before you spend real time on them.`,
      lines: [`Cheapest entry: ${entry.name} — ${fmt(entryMonthly)}/mo all-in + ${fmt(entrySetup)} setup`, "Size unknown — verify budget on the call"],
    };
  }

  const monthlyCapacity = (annualRevenue * pct) / 12;
  const ratio = monthlyCapacity / entryMonthly;

  // Bands drive both the points awarded and the hard cap on the total score.
  let band, points, cap, verdict;
  if (ratio >= 2.5)      { band = "comfortable"; points = 25; cap = 100; verdict = "Can comfortably afford BoldLine, with room to grow into a bigger package."; }
  else if (ratio >= 1.5) { band = "workable";    points = 19; cap = 100; verdict = "Can afford the entry package with room to spare."; }
  else if (ratio >= 1.0) { band = "tight";       points = 10; cap = 55;  verdict = "Can just barely cover the entry package — expect a hard price conversation."; }
  else if (ratio >= 0.6) { band = "stretch";     points = 3;  cap = 30;  verdict = "Cannot realistically cover the entry package without cutting elsewhere."; }
  else                   { band = "cannot";      points = 0;  cap = 15;  verdict = "Too small to afford BoldLine. Not worth your time."; }

  // What they could actually step up to, so Bryson never pitches above their budget.
  const pool = (kind === "ecom" ? PACKAGES.filter((p) => p.id.startsWith("e-")) : PACKAGES.filter((p) => !p.id.startsWith("e-")))
    .filter(managed).slice().sort((a, b) => b.price - a.price);
  const affordable = pool.find((p) => monthlyCapacity >= p.price + adSpendLow(p)) || null;

  return {
    known: true, annualRevenue, basis, monthlyCapacity, ratio,
    band, points, cap, verdict,
    entryId: entry.id, entryName: entry.name, entryMonthly, entrySetup,
    affordableId: affordable ? affordable.id : null,
    affordableName: affordable ? `${affordable.name} (${affordable.platform})` : null,
    lines: [
      `Revenue estimate: ${fmt(annualRevenue)}/yr — ${basis}`,
      `Marketing budget capacity: ~${fmt(monthlyCapacity)}/mo (${Math.round(pct * 100)}% of revenue, ${nicheGroup || "general"} benchmark)`,
      `Cheapest way in: ${entry.name} — ${fmt(entry.price)}/mo minimum + ${fmt(adSpendLow(entry))}/mo minimum ad spend = ${fmt(entryMonthly)}/mo, plus ${fmt(entrySetup)} setup`,
      `That is ${ratio >= 1 ? `${ratio.toFixed(1)}× their capacity — ${band}` : `${Math.round(ratio * 100)}% of what they can afford — ${band}`}`,
      affordable ? `Realistic ceiling: ${affordable.name} (${affordable.platform}) at ${fmt(affordable.price)}/mo` : "Cannot afford any package at a viable ad spend",
    ],
  };
};

// ─── Score factors ───────────────────────────────────────────────────────────
// Fixed weights so scores are comparable across prospects and across runs.
export const FACTOR_META = {
  demand:   { label: "Lead dependence", max: 25, hint: "Does this business live or die on inbound customer flow?" },
  budget:   { label: "Can they pay",    max: 25, hint: "Computed from headcount/revenue against BoldLine's entry cost." },
  gap:      { label: "Opportunity gap", max: 25, hint: "How much is broken today that BoldLine can fix." },
  reach:    { label: "Reachability",    max: 15, hint: "Is there a named decision-maker with a real number?" },
  momentum: { label: "Momentum",        max: 10, hint: "Hiring, expanding, recently investing in the business." },
  risk:     { label: "Risk / penalties", max: 0, hint: "Franchise, agency-locked, dormant, ad-restricted vertical. Negative only." },
};
export const FACTOR_ORDER = ["demand", "budget", "gap", "reach", "momentum", "risk"];

// Builds the final score FROM the factors, so the number always equals the visible
// breakdown. The model supplies every factor except `budget`, which we overwrite with
// our own arithmetic, then the affordability band caps the total.
// `opts.site` (website mode only) is `siteNeed()` from site-check.mjs: it replaces the model's "gap" factor
// with what the free website check actually found, and a site that already does the job caps the total.
export const buildScore = (rawFactors, aff, opts = {}) => {
  const site = opts && opts.site;
  const byId = {};
  (Array.isArray(rawFactors) ? rawFactors : []).forEach((f) => {
    const id = String((f && f.factor) || "").toLowerCase();
    if (!FACTOR_META[id]) return;
    byId[id] = {
      factor: id,
      label: FACTOR_META[id].label,
      max: FACTOR_META[id].max,
      points: Math.round(Number(f.points) || 0),
      why: String((f && f.why) || "").trim(),
    };
  });

  // Overwrite the budget factor with the computed money math.
  byId.budget = {
    factor: "budget",
    label: FACTOR_META.budget.label,
    max: FACTOR_META.budget.max,
    points: aff.known ? aff.points : 9,   // unknown size: middling, never rewarded
    why: aff.known
      ? (aff.budgetWhy || `${aff.verdict} ${aff.lines[1]}; entry cost ${fmt(aff.entryMonthly)}/mo.`)
      : "Company size could not be confirmed, so their budget is unverified — check it on the call.",
  };
  if (site) {
    byId.gap = { factor: "gap", label: "Website need", max: FACTOR_META.gap.max, points: Math.round(Number(site.points) || 0), why: String(site.why || "") };
  }

  const factors = FACTOR_ORDER.map((id) => byId[id]).filter(Boolean).map((f) => ({
    ...f,
    // Clamp each factor into its own band so one runaway number can't dominate.
    points: f.factor === "risk"
      ? Math.max(-40, Math.min(0, f.points))
      : Math.max(0, Math.min(FACTOR_META[f.factor].max, f.points)),
  }));

  const subtotal = factors.reduce((s, f) => s + f.points, 0);
  let score = Math.max(0, Math.min(100, subtotal));

  let cappedFrom = null, capReason = "";
  // The tightest cap that actually bites wins, and says which it was.
  const caps = [];
  if (aff.known) caps.push({ cap: aff.cap, reason: aff.verdict });
  if (site && Number(site.cap) < 100) caps.push({ cap: Number(site.cap), reason: site.capWhy || site.why });
  const binding = caps.filter((c) => score > c.cap).sort((a, b) => a.cap - b.cap)[0];
  if (binding) {
    cappedFrom = score;
    score = binding.cap;
    capReason = `Score capped at ${binding.cap} — ${binding.reason}`;
  }
  return { score, factors, subtotal, cappedFrom, capReason };
};

export { fmt as fmtMoney };
