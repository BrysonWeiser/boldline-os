// Pricing data for the Deal Prep tool (pre-call research + package recommendation).
//
// Per-lead FEE by niche — what BoldLine charges the client per qualified lead, scaled
// to the value of a customer in that industry. The OS only had 3 niches (Roofing 75,
// Med Spa 35, Auto Detailing 15) for health scoring; this is the broader STARTER table
// the deal tool quotes from. Bryson: review + edit these — they're my estimates, not
// gospel. First keyword match wins, so order specific -> general. Anything unmatched
// falls back to DEFAULT_LEAD_FEE and the AI reasons a number in its briefing.
const LEAD_FEE_TABLE = [
  { fee: 125, kw: ["personal injury", "injury lawyer", "injury attorney", "accident attorney", "car accident", "medical malpractice", "wrongful death", "workers comp"] },
  { fee: 95,  kw: ["attorney", "lawyer", "law firm", "legal", " law", "dui", "criminal defense", "family law", "divorce", "estate planning", "bankruptcy", "immigration law"] },
  { fee: 90,  kw: ["solar", "foundation repair", "custom home", "home builder", "kitchen remodel", "bathroom remodel", "remodel", "general contractor", "pool builder", "pool construction"] },
  { fee: 75,  kw: ["roofing", "roofer", "hvac", "heating", "air conditioning", "dental implant", "cosmetic dentist", "orthodont", "plastic surgery", "cosmetic surgery", "windows", "siding", "concrete", "paving", "epoxy", "garage floor"] },
  { fee: 55,  kw: ["plumb", "electrician", "electrical", "pest control", "garage door", "fencing", "deck", "landscap", "hardscap", "tree service", "pool service", "flooring", "painting", "water damage", "restoration", "mold", "chiropract", "physical therapy", "veterinar", "dentist", "dental"] },
  { fee: 45,  kw: ["real estate", "realtor", "mortgage", "insurance", "financial advisor", "accounting", "cpa", "tax", "senior care", "home care", "assisted living", "locksmith", "moving", "movers", "junk removal", "appliance repair", "roadside", "towing"] },
  { fee: 35,  kw: ["aesthetic", "botox", "med spa", "spa", "salon", "gym", "fitness", "personal train", "cleaning", "maid", "house cleaning", "carpet clean", "pressure wash", "window cleaning", "auto repair", "mechanic", "tire", "dealership", "photograph", "wedding", "event", "catering", "tutoring", "day care", "daycare"] },
  { fee: 15,  kw: ["auto detail", "car wash", "detailing", "mobile detail"] },
];
export const DEFAULT_LEAD_FEE = 45;

// Case-insensitive keyword match against the free-text niche Bryson typed.
export const getNicheLeadFee = (niche) => {
  const n = String(niche || "").toLowerCase().trim();
  if (!n) return DEFAULT_LEAD_FEE;
  for (const row of LEAD_FEE_TABLE) {
    if (row.kw.some((k) => n.includes(k))) return row.fee;
  }
  return DEFAULT_LEAD_FEE;
};

// ─── PRICING MODEL (rewritten 2026-08-18) ────────────────────────────────────
// There is no monthly management fee any more. `price` is the monthly MINIMUM and the
// performance fee counts toward it — the client pays whichever is higher, never both.
// Bryson, 2026-08-18: "we set a monthly bottom so if we would only make $180 off of the
// leads we generated but the bottom is $200 then they pay the $200 but if we make more
// than the bottom then we take whichever is more."
// Backend copy of index.html's PACKAGES_DB. Keep the two in sync (dual-copy, same
// pattern as report-shared's PACKAGES_DB) — tests/verify-packages.mjs compares them.
export const MIN_AD_BUDGET = 500;    // hard floor to be a managed client at all
export const COMBO_MIN_BUDGET = 5000; // below this, one platform only

export const PACKAGES = [
  { id: "g-launch",      name: "Launch System",      platform: "Google Ads",    price: 400,  setup: 750,  leadFee: true,  pricingModel: "per_lead", adSpend: "$500 to $2,500/mo",   minBudget: 500, maxBudget: 2500, tier: "launch"      },
  { id: "g-growth",      name: "Growth System",      platform: "Google Ads",    price: 700,  setup: 1500, leadFee: true,  pricingModel: "per_lead", adSpend: "$2,500 to $10,000/mo", minBudget: 2500, maxBudget: 10000, tier: "growth"     },
  { id: "g-acquisition", name: "Acquisition System", platform: "Google Ads",    price: 1200, setup: 3000, leadFee: true,  pricingModel: "per_lead", adSpend: "$10,000+/mo",      minBudget: 10000, maxBudget: null, tier: "acquisition" },
  { id: "m-launch",      name: "Launch System",      platform: "Meta Ads",      price: 400,  setup: 750,  leadFee: true,  pricingModel: "per_lead", adSpend: "$500 to $2,500/mo",   minBudget: 500, maxBudget: 2500, tier: "launch"      },
  { id: "m-growth",      name: "Growth System",      platform: "Meta Ads",      price: 700,  setup: 1500, leadFee: true,  pricingModel: "per_lead", adSpend: "$2,500 to $10,000/mo", minBudget: 2500, maxBudget: 10000, tier: "growth"     },
  { id: "m-acquisition", name: "Acquisition System", platform: "Meta Ads",      price: 1200, setup: 3000, leadFee: true,  pricingModel: "per_lead", adSpend: "$10,000+/mo",      minBudget: 10000, maxBudget: null, tier: "acquisition" },
  { id: "c-growth",      name: "Full System: Growth", platform: "Google + Meta", price: 900,  setup: 2300, leadFee: true, pricingModel: "per_lead", adSpend: "$5,000 to $10,000/mo", minBudget: 5000, maxBudget: 10000, tier: "growth"     },
  { id: "c-acquisition", name: "Full System: Acquisition", platform: "Google + Meta", price: 1500, setup: 4900, leadFee: true, pricingModel: "per_lead", adSpend: "$10,000+/mo", minBudget: 10000, maxBudget: null, tier: "acquisition" },
  // One-time build, no management. $1,500 sits below managed Launch across its
  // 3-month minimum ($750 + 3 x $400 = $1,950) but above the $750 managed setup,
  // which is deliberately underpriced because it buys a recurring client.
  { id: "h-handoff",     name: "Launch & Hand Off",  platform: "Google Ads",           price: 0,    setup: 1500, leadFee: false, pricingModel: "one_time", adSpend: "Any budget", minBudget: 0, maxBudget: null, tier: "handoff" },
  { id: "e-launch",      name: "Store Launch",       platform: "Meta Ads (ecom)",      price: 400,  setup: 800,  leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 15, adSpend: "$500 to $2,500/mo",   minBudget: 500, maxBudget: 2500, tier: "launch"      },
  { id: "e-growth",      name: "Store Growth",       platform: "Meta Ads (ecom)",      price: 700,  setup: 1400, leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 15, adSpend: "$2,500 to $10,000/mo", minBudget: 2500, maxBudget: 10000, tier: "growth"     },
  { id: "e-domination",  name: "Store Domination",   platform: "Meta + Google (ecom)", price: 1200, setup: 2500, leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 12, adSpend: "$10,000+/mo",      minBudget: 10000, maxBudget: null, tier: "acquisition" },
];

// The one billing calculation — "whichever is more". Mirrors index.html's copy.
export const calcMonthlyBill = (pkg, { qualifiedLeads = 0, perLeadFee = 0, adSpend = 0 } = {}) => {
  if (!pkg) return { floor: 0, earned: 0, billed: 0, atFloor: false, model: "none" };
  // A one-time build has no monthly side at all.
  if (pkg.pricingModel === "one_time")
    return { floor: 0, earned: 0, billed: 0, atFloor: false, model: "one_time" };
  const floor = Number(pkg.price) || 0;
  const pctModel = pkg.pricingModel === "ad_spend_pct";
  const earned = pctModel
    ? Math.round(((Number(adSpend) || 0) * (Number(pkg.adSpendPct) || 0)) / 100)
    : Math.round((Number(qualifiedLeads) || 0) * (Number(perLeadFee) || 0));
  return { floor, earned, billed: Math.max(floor, earned), atFloor: earned < floor,
           model: pctModel ? "ad_spend_pct" : "per_lead" };
};

// Compact catalog block for the research prompt. The wording matters: a model told
// "$400/mo management + $45/lead" will quote a retainer plus a fee on a live sales
// call, which is exactly the structure a prospect already turned down.
export const packagesPromptBlock = (leadFee) =>
  PACKAGES.map((p) =>
    p.pricingModel === "one_time"
      ? `- ${p.id} — "${p.name}" (${p.platform}): $${p.setup} ONCE and nothing after that. No monthly fee, no per-lead fee, no contract term. BoldLine builds the campaign and the landing page in the client's own account, runs two optimization passes over the first 30 days, hands over a written playbook and a training call, and then it is entirely theirs to run. This is the option for a business below the $${MIN_AD_BUDGET}/mo ad-budget floor, or one that wants the build without the monthly. If they move onto a managed plan within 6 months, the managed setup fee is waived because they already paid for the build.`
      : `- ${p.id} — "${p.name}" (${p.platform}): $${p.setup} one-time setup, then $${p.price}/mo MINIMUM or ${
          p.leadFee ? `$${leadFee}/qualified lead` : `${p.adSpendPct}% of ad spend`
        }, whichever is higher (never both). Client ad budget: ${p.adSpend}.`
  ).join("\n");

// Which package an ad budget qualifies for. `family` is "g" | "m" | "c" | "e".
// Combined is a deliberate budget unlock: below COMBO_MIN_BUDGET it returns null rather
// than a smaller combined tier, because no such tier exists on purpose.
export const packageForBudget = (budget, family = "g") => {
  const n = Number(budget) || 0;
  // Below the floor there is no MANAGED plan, which is exactly when the hand-off is the
  // right answer. Callers asking for the hand-off family get it at any budget.
  if (family === "h") return PACKAGES.find((p) => p.id.startsWith("h-")) || null;
  if (n < MIN_AD_BUDGET) return null;
  const inFamily = PACKAGES.filter((p) => p.id.startsWith(family + "-"));
  return inFamily.find((p) => n >= p.minBudget && (p.maxBudget === null || n < p.maxBudget)) || null;
};
