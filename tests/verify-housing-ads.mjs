// Housing ads: real estate, mortgage and rental businesses get Meta's HOUSING label and the targeting limits the
// law puts on housing ads, decided from the business itself. Run: node tests/verify-housing-ads.mjs
// Bryson, 2026-10-14: "yes do the ads fix now". KB `housing-ads`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isHousing, isZip } from "../netlify/lib/ad-categories.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
const GADS = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
const AUTO = readFileSync(join(ROOT, "netlify/functions/client-autobuild.mjs"), "utf8");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; return; } fail++; console.log(`  FAIL  ${n}${x ? `\n        ${x}` : ""}`); };

// ── 1. Who is housing ──
const yes = ["Real Estate Agent", "Realtor", "Desert Realty Group", "Property Management", "Apartment Complex", "Mortgage Broker",
  "Home Loans", "Title Company", "Escrow Services", "Home Insurance", "New Home Builder", "Home Builder", "House rentals", "Real-estate team"];
const no = ["Handyman", "Roofing", "Equipment Rental", "Party Rentals", "Car Rental", "Home Remodeling", "House Cleaning", "Mobile Detailing",
  "Pool Construction", "HVAC", "Dumpster rental", "Insurance Agency", "Moving company", "Plumbing"];
const wrongYes = yes.filter((n) => !isHousing({ niche: n }));
const wrongNo = no.filter((n) => isHousing({ niche: n }));
ok("🔴 every housing business is caught", !wrongYes.length, wrongYes.join(", "));
ok("🔴 and nothing that merely works ON homes or rents equipment is", !wrongNo.length, wrongNo.join(", "));
ok("the business name counts too (a realty named on its sign)", isHousing({ niche: "", name: "Summit Realty" }));
ok("an empty business is not housing", !isHousing({}) && !isHousing(null));
ok("ZIP codes are recognised", isZip("85296") && isZip(" 85296-1234 ") && !isZip("Gilbert, Arizona") && !isZip("852"));

// ── 2. Meta ──
ok("🔴 Meta labels the campaign HOUSING", /special_ad_categories: housing \? JSON\.stringify\(\["HOUSING"\]\) : "\[\]"/.test(META));
ok("and names the country, which Meta requires with a special category", /special_ad_category_country: JSON\.stringify\(\[String\(p\.country \|\| "US"\)\.toUpperCase\(\)\]\)/.test(META));
ok("🔴 housing reaches everyone 18 and up, whatever age range was asked for",
  /age_min: housing \? 18 :/.test(META) && /age_max: housing \? 65 :/.test(META));
ok("🔴 and never targets by gender", /if \(p\.genders && !housing\) targeting\.genders = p\.genders;/.test(META));
ok("it is decided from the business, not a box", /const housing = isHousing\(\{ niche: p\.niche, name: p\.clientName \}\);/.test(META));
ok("Meta locations are cities and regions only (no ZIP codes)", /location_types: JSON\.stringify\(\["city", "region"\]\)/.test(META));
ok("city targets keep a radius above Meta's 15-mile housing minimum", /radius: (\d+), distance_unit: "mile"/.test(META) && Number(META.match(/radius: (\d+), distance_unit: "mile"/)[1]) >= 15);
ok("the result says it was a housing ad", /status: "PAUSED",\n    housing,/.test(META));

// ── 3. Google ──
ok("🔴 Google refuses ZIP codes for housing before anything is created",
  /if \(housing && locationNames\.some\(isZip\)\)/.test(GADS) && GADS.indexOf("locationNames.some(isZip)") < GADS.indexOf("const geo = await resolveGeoTargets(accessToken, locationNames"));
ok("and catches a location Google itself resolves to a postal code", /if \(housing && geo\.some\(\(g\) => \/postal\/i\.test\(g\.targetType/.test(GADS) && /targetType: hit\.geoTargetConstant\.targetType/.test(GADS));
ok("Google never targets by age or gender anyway", !/ageRange|AGE_RANGE|gender:/i.test(GADS));

// ── 4. Every builder sends the business ──
ok("the automatic Google build sends it", /niche: cl\.niche, clientName: cl\.name,/.test(AUTO));
ok("all four OS builds send it", (UI.match(/clientName:client\.name, niche:client\.niche/g) || []).length === 4);
ok("the OS says out loud when an ad was built as housing", /\$\{d\.housing\?" "\+ADS_HOUSING_NOTE:""\}/.test(UI) && /const ADS_HOUSING_NOTE=/.test(UI));

console.log(`verify-housing-ads: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
