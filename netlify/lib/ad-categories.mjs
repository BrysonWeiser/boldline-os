// Housing ads: the legal rules Google and Meta apply to real estate, mortgage and rental advertising (KB `housing-ads`).
//
// Bryson, 2026-10-14, about taking on a real estate agent: "yes do the ads fix now". In the US, ads for selling or
// renting a home, mortgages and home insurance are "housing" ads under fair housing law. Meta REQUIRES every such
// campaign to be labelled HOUSING (an unlabelled one is rejected, and repeat misses can restrict the ad account),
// and both platforms forbid aiming them by age, gender or ZIP code. Before this, every Meta campaign went out with
// no label and an age range, so the first real estate client's ads would have been rejected.
//
// 🔴 DECIDED FROM THE BUSINESS, NOT REMEMBERED PER CAMPAIGN. The niche (and name) say whether a business is in
// housing, so nobody has to remember to tick a box, and the server enforces the targeting limits itself.
// 🔴 NARROW ON PURPOSE. "rental" alone would catch equipment, car and party rentals, which are not housing; a
// remodeler or a roofer works ON homes but does not sell or rent them. Each pattern names housing itself.

export const HOUSING_PATTERNS = [
  /\breal[\s-]?estate\b/i, /\brealtors?\b/i, /\brealty\b/i, /\bhome[\s-]?sellers?\b/i, /\bhomes? for sale\b/i,
  /\bproperty management\b/i, /\bproperty managers?\b/i,
  /\b(apartments?|condos?|townhomes?|house|home|housing|residential) (rentals?|leasing|for rent)\b/i,
  /\bapartments?\b/i, /\bleasing office\b/i, /\btenant\b/i,
  /\bmortgages?\b/i, /\bhome ?loans?\b/i, /\brefinanc/i, /\bhome equity\b/i, /\bhomeowners? insurance\b/i, /\bhome insurance\b/i,
  /\btitle (company|agency|insurance)\b/i, /\bescrow\b/i, /\b(home|real estate) apprais/i,
  /\bnew[\s-]?home (builder|communit)/i, /\bhome ?builders?\b/i, /\bmanufactured homes?\b/i, /\bmobile home (sales|dealer|park)/i,
];

export const isHousing = (business) => {
  const text = [business && business.niche, business && business.name].filter(Boolean).join(" ");
  return !!text && HOUSING_PATTERNS.some((re) => re.test(text));
};

// A bare US ZIP (or ZIP+4) typed as a location. Housing ads may not be aimed by ZIP code.
export const isZip = (s) => /^\s*\d{5}(-\d{4})?\s*$/.test(String(s || ""));

export const HOUSING_NOTE = "Housing ad: by law it can't be aimed by age, gender or ZIP code, so it reaches all adults 18 and up in the areas you chose.";
