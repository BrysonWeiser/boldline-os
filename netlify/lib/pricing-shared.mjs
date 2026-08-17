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

// Full package catalog (prices + setup + per-lead applicability) — a backend copy of
// index.html's PACKAGES_DB so the research prompt can quote real numbers. Keep the two
// in sync if pricing changes (dual-copy, same pattern as report-shared's PACKAGES_DB).
export const PACKAGES = [
  { id: "g-launch",      name: "Launch System",      platform: "Google Ads",    price: 400,  setup: 750,  leadFee: true,  adSpend: "$750–$2,500/mo",     tier: "entry" },
  { id: "g-growth",      name: "Growth System",      platform: "Google Ads",    price: 600,  setup: 1500, leadFee: true,  adSpend: "$2,000–$8,000/mo",   tier: "mid"  },
  { id: "g-acquisition", name: "Acquisition System", platform: "Google Ads",    price: 900,  setup: 3000, leadFee: true,  adSpend: "$5,000–$20,000+/mo", tier: "top"  },
  { id: "m-launch",      name: "Launch System",      platform: "Meta Ads",      price: 350,  setup: 600,  leadFee: true,  adSpend: "$500–$2,000/mo",     tier: "entry" },
  { id: "m-growth",      name: "Growth System",      platform: "Meta Ads",      price: 550,  setup: 1200, leadFee: true,  adSpend: "$1,500–$5,000/mo",   tier: "mid"  },
  { id: "m-acquisition", name: "Acquisition System", platform: "Meta Ads",      price: 850,  setup: 2500, leadFee: true,  adSpend: "$4,000–$15,000+/mo", tier: "top"  },
  { id: "c-launch",      name: "Full System — Launch", platform: "Google + Meta", price: 650,  setup: 1100, leadFee: true, adSpend: "$1,000–$4,000/mo",  tier: "mid"  },
  { id: "c-growth",      name: "Full System — Growth", platform: "Google + Meta", price: 1000, setup: 2300, leadFee: true, adSpend: "$3,000–$12,000/mo", tier: "mid"  },
  { id: "c-acquisition", name: "Full System — Acquisition", platform: "Google + Meta", price: 1500, setup: 4900, leadFee: true, adSpend: "$9,000–$35,000+/mo", tier: "top"  },
  { id: "e-launch",      name: "Store Launch",       platform: "Meta Ads (ecom)",      price: 450,  setup: 800,  leadFee: false, adSpend: "$500–$1,500/mo",    tier: "entry" },
  { id: "e-growth",      name: "Store Growth",       platform: "Meta + Google (ecom)", price: 750,  setup: 1400, leadFee: false, adSpend: "$1,500–$5,000/mo",  tier: "mid"  },
  { id: "e-domination",  name: "Store Domination",   platform: "Meta + Google (ecom)", price: 1200, setup: 2500, leadFee: false, adSpend: "$4,000–$15,000+/mo", tier: "top" },
];

// Compact catalog block for the research prompt.
export const packagesPromptBlock = (leadFee) =>
  PACKAGES.map((p) =>
    `- ${p.id} — "${p.name}" (${p.platform}): $${p.price}/mo management + $${p.setup} one-time setup${p.leadFee ? ` + $${leadFee}/qualified lead` : " (e-commerce ROAS bonus model, no per-lead fee)"}. Client ad spend: ${p.adSpend}.`
  ).join("\n");
