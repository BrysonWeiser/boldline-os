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
  { id: "g-launch",      name: "Launch System",      platform: "Google Ads",    price: 400,  setup: 750,  leadFee: true,  pricingModel: "per_lead", adSpend: "$500–$2,500/mo",   tier: "launch"      },
  { id: "g-growth",      name: "Growth System",      platform: "Google Ads",    price: 700,  setup: 1500, leadFee: true,  pricingModel: "per_lead", adSpend: "$2,500–$10,000/mo", tier: "growth"     },
  { id: "g-acquisition", name: "Acquisition System", platform: "Google Ads",    price: 1200, setup: 3000, leadFee: true,  pricingModel: "per_lead", adSpend: "$10,000+/mo",      tier: "acquisition" },
  { id: "m-launch",      name: "Launch System",      platform: "Meta Ads",      price: 400,  setup: 750,  leadFee: true,  pricingModel: "per_lead", adSpend: "$500–$2,500/mo",   tier: "launch"      },
  { id: "m-growth",      name: "Growth System",      platform: "Meta Ads",      price: 700,  setup: 1500, leadFee: true,  pricingModel: "per_lead", adSpend: "$2,500–$10,000/mo", tier: "growth"     },
  { id: "m-acquisition", name: "Acquisition System", platform: "Meta Ads",      price: 1200, setup: 3000, leadFee: true,  pricingModel: "per_lead", adSpend: "$10,000+/mo",      tier: "acquisition" },
  { id: "c-growth",      name: "Full System — Growth", platform: "Google + Meta", price: 700,  setup: 2300, leadFee: true, pricingModel: "per_lead", adSpend: "$5,000–$10,000/mo", tier: "growth"     },
  { id: "c-acquisition", name: "Full System — Acquisition", platform: "Google + Meta", price: 1200, setup: 4900, leadFee: true, pricingModel: "per_lead", adSpend: "$10,000+/mo", tier: "acquisition" },
  { id: "e-launch",      name: "Store Launch",       platform: "Meta Ads (ecom)",      price: 400,  setup: 800,  leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 15, adSpend: "$500–$2,500/mo",   tier: "launch"      },
  { id: "e-growth",      name: "Store Growth",       platform: "Meta Ads (ecom)",      price: 700,  setup: 1400, leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 15, adSpend: "$2,500–$10,000/mo", tier: "growth"     },
  { id: "e-domination",  name: "Store Domination",   platform: "Meta + Google (ecom)", price: 1200, setup: 2500, leadFee: false, pricingModel: "ad_spend_pct", adSpendPct: 12, adSpend: "$10,000+/mo",      tier: "acquisition" },
];

// The one billing calculation — "whichever is more". Mirrors index.html's copy.
export const calcMonthlyBill = (pkg, { qualifiedLeads = 0, perLeadFee = 0, adSpend = 0 } = {}) => {
  if (!pkg) return { floor: 0, earned: 0, billed: 0, atFloor: false, model: "none" };
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
    `- ${p.id} — "${p.name}" (${p.platform}): $${p.setup} one-time setup, then $${p.price}/mo MINIMUM or ${
      p.leadFee ? `$${leadFee}/qualified lead` : `${p.adSpendPct}% of ad spend`
    }, whichever is higher (never both). Client ad budget: ${p.adSpend}.`
  ).join("\n");
