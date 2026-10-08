// My Businesses (Bryson, 2026-10-07): "I need a place in the os for me to build a website for my other
// businesses and then also to be able to run whatever ads I want to the other businesses including
// making landing pages for them" (a car detailing business with a friend, whose results he will show).
// An owned business is a record flagged `internal` AND `owned`. What has to stay true:
//  1. Money and relationship: it is NEVER a client. Never counted, never the founding offer, never
//     billed or invoiced, never sent client emails, never charged for its website. (`internal` does this.)
//  2. Identity: it is NEVER BoldLine. Anything that means "BoldLine's own account" (its website leads,
//     its heartbeat alerts, its owner report, its agency ad wording, its /get-started page) must ask
//     isHouse, never "the first internal record".
//  3. It gets the customer-facing tools a client gets: its own ad wording, landing page options, website
//     tab, review asks, trade playbook, scorecard, and the manager link request for its ad account.
//  4. Its own section exists and is reachable on a computer and a phone.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const body = (name) => { const a = UI.indexOf(`function ${name}(`); if (a < 0) return ""; const b = UI.indexOf("\nfunction ", a + 10); return UI.slice(a, b < 0 ? undefined : b); };

const { isHouse, isOwned } = await import("../netlify/lib/owned.mjs");
const HOUSE = { id: "h", internal: true, name: "BoldLine Media", contractSigned: true, contractStatus: "internal" };
const BIZ = { id: "b", internal: true, owned: true, name: "Desert Gloss Detailing", contractSigned: true, contractStatus: "internal", email: "hi@dg.example" };
const CLIENT = { id: "c", name: "Apex", contractSigned: true, contractStatus: "active", email: "a@x.example" };

// The two questions, answered the same way in the OS and on the server
ok("isHouse: BoldLine's own account only", isHouse(HOUSE) && !isHouse(BIZ) && !isHouse(CLIENT) && !isHouse(null));
ok("isOwned: an owned business only", isOwned(BIZ) && !isOwned(HOUSE) && !isOwned(CLIENT) && !isOwned(undefined));
ok("🔴 an owned business without `internal` is not treated as owned (it would lose every money rule)", !isOwned({ owned: true }));
ok("the OS asks the same two questions", UI.includes("const isHouse = (c) => !!(c && c.internal && !c.owned);") && UI.includes("const isOwned = (c) => !!(c && c.internal && c.owned);"));

// 1. Never a client
{
  const { isFoundingClient, countFoundingClients } = await import("../netlify/lib/founding.mjs");
  ok("🔴 never the founding offer, even though the record says signed", !isFoundingClient(BIZ) && countFoundingClients([BIZ, HOUSE]) === 0);
  const { exempt } = await import("../netlify/lib/website-deal.mjs");
  ok("🔴 never charged for its website (no agreement, no payment locks)", exempt(BIZ) === true);
  const { autoSendClientEmail } = await import("../netlify/lib/client-email-auto.mjs");
  const r = await autoSendClientEmail(BIZ, "welcome");
  ok("🔴 never sent client emails (welcome, onboarding, nurture)", r && r.sent === false);
  ok("the OS keeps it out of the client list, revenue and counts", /const realClients = clients\.filter\(c=>!c\.internal\);/.test(UI));
  ok("never invoiced per lead", /if \(c\.internal\) return false;/.test(src("netlify/functions/lead-invoice-run.mjs")));
  ok("the record is created internal and owned, with no contract to renew", (() => {
    const m = body("makeOwnedBusiness");
    return /const base = makeInternalClient\(\);/.test(m) && /owned: true/.test(m) && !/contractEnd:\s*"\d/.test(m);
  })());
}

// 2. Never BoldLine
ok("🔴 the OS's My Ads account is the house, not the first internal record", /const myAccount\s+= clients\.find\(isHouse\) \|\| null;/.test(UI) && !/clients\.find\(c=>c\.internal\)/.test(UI));
ok("🔴 BoldLine's website leads mirror into the house only", /\.find\(\(r\) => isHouse\(r && r\.data\)\)/.test(src("netlify/lib/house-leads-run.mjs")) && !/const house = \(houses \|\| \[\]\)\[0\];/.test(src("netlify/lib/house-leads-run.mjs")));
ok("🔴 the OS only pulls BoldLine's website leads on the house account", /if \(!isHouse\(client\) \|\| syncingHouseLeads\.current\) return;/.test(UI));
ok("🔴 the heartbeat and founding alerts read the house", (src("netlify/functions/alerts-watch.mjs").match(/\.find\(\(r\) => isHouse\(r\.data\)\)/g) || []).length === 2);
ok("🔴 the monthly owner report reads the house", /const house = all\.find\(isHouse\) \|\| null;/.test(src("netlify/lib/report-shared.mjs")));
ok("🔴 the weekly briefing on an owned business talks about that business, not BoldLine", /\$\{isOwned\(client\)\s*\? `You are writing a private \$\{period\} briefing for Bryson Weiser about \$\{client\.name\}/.test(src("netlify/lib/report-shared.mjs")));
ok("🔴 no ad is ever written in BoldLine's agency voice for an owned business", !/agency:\s*!!client\.internal/.test(UI) && (UI.match(/agency:\s*!!isHouse\(client\)/g) || []).length >= 4);
ok("🔴 the ad fill and brief use the business's own customers, not BoldLine's", /isHouse\(client\) \? agencySeed\(audience\) : clientSeed\(audience\)/.test(UI) && /isHouse\(client\) \? metaAgencySeed\(audience\) : metaClientSeed\(audience\)/.test(UI));
ok("🔴 its ads never default to BoldLine's /get-started page", (UI.match(/const landingDefault = isHouse\(client\) \? HOUSE_LANDING_URL/g) || []).length === 2 && !/client\.internal \? HOUSE_LANDING_URL/.test(UI));
ok("the ad bots write for the business, not the agency", (src("netlify/functions/ads-autopilot.mjs").match(/systemFor\(isHouse\(cl\)\)/g) || []).length === 2 && /systemFor\(isHouse\(cl\)\)/.test(src("netlify/functions/client-autobuild.mjs")));
ok("market research treats it as a business in its own area, not an agency selling nationally", /const isAgency = isHouse\(cl\);/.test(src("netlify/functions/market-research-background.mjs")) && /if \(isHouse\(cl\)\) return true;/.test(src("netlify/lib/market-research-shared.mjs")));
ok("alerts and campaign screens never call it BoldLine's own", /isHouse\(r\.client\)\?"BoldLine's own"/.test(UI) && /isHouse\(g\.client\)\?"My Ads — BoldLine Media"/.test(UI) && /isHouse\(cl\) \? "My Ads \(BoldLine's own account\)"/.test(src("netlify/functions/ads-autopilot.mjs")));
ok("ARIA is told it is his own business, not BoldLine's house account", /isOwned\(c\)\?" \[OWNED: a business Bryson owns himself/.test(UI));
ok("its website is watched for downtime like a client's", /if \(!host \|\| isHouse\(cl\)\) continue;/.test(src("netlify/functions/site-uptime.mjs")));

// 3. Customer-facing tools
ok("🔴 it keeps the Reviews tab (asking its own customers for reviews)", /k==="log"\|\|\(isHouse\(client\)&&k==="reviews"\)/.test(UI) && /tab==="reviews"&&!isHouse\(client\)&&<ReviewRequestsCard/.test(UI));
ok("🔴 it always gets the Website tab to build its site", /isHouse\(client\)&&k==="website"&&!\(client\.website/.test(UI));
ok("it gets the client landing page builder and the three page options", /\{isHouse\(client\) \? \(\s*<>\s*<Card style=\{\{borderColor:`\$\{C\.gold\}2a`\}\}>/.test(UI) && /\{!isHouse\(client\)&&<LandingOptionsCard/.test(UI));
ok("it gets the trade playbook and the 30-day scorecard (its results)", /\{!isHouse\(client\) && <ScorecardCard/.test(UI) && /\{!isHouse\(client\) && <TradePlaybookCard/.test(UI));
ok("🔴 it gets the manager link request (its ad account starts outside the MCC)", /\{!isHouse\(client\)&&<LinkRequestRow/.test(UI));
ok("its leads use the customer pipeline, not BoldLine's sales calls", /const STATUSES = isHouse\(client\)/.test(UI) && /\{isHouse\(client\)&&<button onClick=\{\(\)=>openReachOut/.test(UI));
ok("🔴 the setup steps say its ad accounts are its own and paid on its own card", /needs its <b style=\{\{color:C\.textDim\}\}>own<\/b> ad accounts, paid on its own card/.test(body("MyAdsSetupCards")));
ok("🔴 BoldLine's fixed ad angles (\"Stop buying shared leads\") never reach an owned business's ad images", /\{isHouse\(client\) && runsMeta && <AdCreativeStudio/.test(UI) && !/client\.internal && runsMeta && <AdCreativeStudio/.test(UI));
ok("nothing says Meta ads still wait on approval (approved 2026-09-14)", !/Meta ads also need App Review approved first/.test(UI));
ok("its results speak in customers, not clients", /tile\("Customers won"/.test(body("MyAdsInsights")) && /isOwned\(client\)\?"Cost \/ customer"/.test(body("MyAdsInsights")));

// 4. Its own section
ok("the My Businesses screen exists, on the shared header with a next-step line", /function MyBusinessesScreen\(/.test(UI) && /<ScreenHeader group="Run clients" title="My Businesses" icon="business"/.test(body("MyBusinessesScreen")) && /focus=\{focus\}/.test(body("MyBusinessesScreen")));
ok("🔴 it says the two rules: its own ad accounts and card, and say it is yours when showing results", /Each business pays for its own ads, from its own Google and Meta ad accounts on its own card, never BoldLine's\. And when you show its results to a prospect, say it is your own business/.test(body("MyBusinessesScreen")));
ok("adding one saves an owned business and opens it", /\{showAddBiz&&<AddBusinessSheet onSave=\{\(f\)=>\{ setShowAddBiz\(false\); addClient\(makeOwnedBusiness\(f\)\); \}\}/.test(UI));
ok("on a computer: the side menu", /\{svg\(BIZ,businessesActive\?C\.gold:C\.textMuted\)\}My Businesses<\/button>/.test(UI) && /onBusinesses=\{\(\)=>setScreen\("businesses"\)\}/.test(UI));
ok("on a phone: the More menu and the home screen", /"My Businesses","Your own businesses: websites, pages, ads",onBusinesses\)/.test(UI) && /onOpenBusinesses=\{\(\)=>setScreen\("businesses"\)\}/.test(UI));
ok("search finds it", /\{id:"g-biz",k:"go",label:"My Businesses"/.test(UI));
ok("back from a business returns to My Businesses", /onBack=\{\(\)=>setScreen\(isOwned\(activeClient\)\?"businesses":"home"\)\}/.test(UI));
ok("My Ads only lights up for BoldLine's own account", /myAdsActive=\{screen==="client"&&isHouse\(activeClient\)\}/.test(UI));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-owned-businesses: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
