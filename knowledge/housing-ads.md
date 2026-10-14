---
name: housing-ads
topic: Ads
task: run ads for a real estate agent, broker, property manager, rental, mortgage, title/escrow, home insurance or home builder client, or change how Google/Meta campaigns are labelled and targeted for housing
keywords: [housing ads, special ad category, HOUSING, fair housing, real estate ads, realtor ads, mortgage ads, rental ads, property management ads, special_ad_categories, special_ad_category_country, age targeting, gender targeting, zip code targeting, 15 mile radius, isHousing, ad-categories, real estate website, IDX, listings]
status: verified
summary: Built 2026-10-14 (Bryson - "yes do the ads fix now", after asking how we'd do a real estate agent's website + ads). US housing ads (sale/rental of homes, mortgages, home insurance, title/escrow, home builders) must carry Meta's HOUSING special ad category and may not be aimed by age, gender or ZIP code on either platform. Every Meta campaign used to go out with special_ad_categories [] and an age range (the launch path sends 25 to 65), so a real estate client's ads would have been rejected. Now `isHousing` (netlify/lib/ad-categories.mjs) decides from the client's niche/name; Meta gets HOUSING + the country, ages 18 to 65, no genders; Google refuses ZIP codes (typed or resolved as postal). All four OS builds and the automatic Google build send the niche. Real estate WEBSITE pieces (listings, home valuation form, brokerage/license/Equal Housing footer) were recommended but NOT built: build when an agent is actually interested.
verified: 2026-10-14
---

## Rules enforced (server side)
- **Meta** (`meta-ads.mjs` createCampaign): `special_ad_categories ["HOUSING"]`, `special_ad_category_country [country]`,
  age 18 to 65 regardless of what was asked, no gender targeting. Locations are already city/region only (no ZIPs)
  with a 25-mile city radius, above Meta's 15-mile housing minimum. Result carries `housing: true`; the manual
  Meta card's success message says it was built as a housing ad.
- **Google** (`google-ads.mjs` createCampaign): refuses ZIP codes for housing, both typed (`isZip`) and any location
  Google resolves to a postal code (`targetType`). Google campaigns never used age or gender targeting.
- **Who counts** (`HOUSING_PATTERNS`): real estate/realtor/realty, property management, apartments/home rentals,
  mortgage/home loans/refinance/home equity, home insurance, title/escrow/appraisal, home builders, manufactured homes.
  🔴 Narrow on purpose: equipment/car/party/dumpster rentals, remodelers, cleaners, general insurance agencies are NOT
  housing. If a new housing-type niche shows up (e.g. "vacation rentals"), decide and add it with a test row.
- Not handled yet: Meta's separate FINANCIAL_PRODUCTS_SERVICES category (loans, credit repair, general insurance) and
  EMPLOYMENT (hiring ads). Add the same way if such a client signs.

## Real estate websites (advice given, nothing built)
Needs four things the service-trade builder lacks: listings (photo, price, beds/baths, status), a "What's my home worth?"
seller form as the main lead capture, the brokerage name + license number + Equal Housing Opportunity in the footer
(Arizona requires the brokerage name), and neighbourhood pages (already possible as extra pages). Full MLS search comes
from the agent's own IDX provider (IDX Broker, Showcase IDX, about $50 to $100/mo on their card), linked or embedded,
never built. Recommendation: build these when an agent is actually in the pipeline (about a day); real estate is one
of the most cold-called niches (KB niche-selection), so not a calling target.

## Tests
`tests/verify-housing-ads.mjs` (19): who is and is not housing (28 niches), ZIP detection, the Meta label, country,
ages and genders, Meta location types and radius, the Google ZIP refusals and their order, every builder sending the niche.
