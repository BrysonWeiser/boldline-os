// The view-only business portal (Bryson, 2026-10-08: "give me a portal link (similar to client portals)
// except include everything for the business but dont allow edits through there but have the calendar
// showing all of the bookings for that specific business with the ability to click each person whos booked
// and it will open up to their details of what they filled out"). What has to stay true:
//  1. Only an owned business with the link on has a page; off kills the link; a new business has one ready.
//  2. 🔴 View only, enforced by the server: the endpoint has no write path at all.
//  3. Everything the business needs is there: right now, calendar, coming up, numbers, leads, ads, setup,
//     and a booking opens to every field the customer filled in.
//  4. Only what the page needs leaves the server, and a customer's words can never become HTML or script.
//  5. No emojis, no dashes, nothing pointing at BoldLine; the OS opens it in a new tab and never embeds it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const P = await import("../netlify/lib/biz-portal.mjs");

const TOKEN = "7c1d2e3f-2222-4a2b-9c3d-abcdefabcdef";
const NOW = Date.parse("2026-10-08T17:00:00Z");   // Thursday 10:00 AM in Phoenix
const h = (n) => new Date(NOW + n * 36e5).toISOString();
const BIZ = {
  id: "b", internal: true, owned: true, name: "Desert Gloss <Detailing>", niche: "Auto Detailing", businessPhone: "(480) 555-0100", email: "hi@desertgloss.example",
  landingSlug: "desert-gloss", portal: { on: true, token: TOKEN }, team: { on: true, token: "secret-team-token-should-not-leak" },
  website: { published: true, brandColor: "#C8A84B" }, landingPage: { published: true, headline: "x" }, intake: { how: "book" },
  booking: { on: true, packages: [{ id: "full", name: "Full Detail", price: "$199", minutes: 180, deposit: "$50", depositLink: "https://buy.stripe.com/secret_link" }, { id: "int", name: "Interior Only", price: "$129", minutes: 120 }] },
  bookings: [
    { id: "k1", packageName: "Full Detail", price: "$199", minutes: 180, start: h(4), end: h(7), name: "Ana Ruiz", phone: "(480) 555-0199", email: "ana@x.example", address: "123 Main St, Gilbert", notes: "Gate code 4411 </script><script>alert(1)</script>", status: "booked", deposit: { amount: "$50", link: "https://buy.stripe.com/secret_link", paid: false }, createdAt: h(-30) },
    { id: "k2", packageName: "Interior Only", price: "$129", minutes: 120, start: h(28), end: h(30), name: "Sam Lee", phone: "4805550123", address: "9 Elm Ave, Mesa", status: "booked", deposit: null, createdAt: h(-5) },
    { id: "k3", packageName: "Full Detail", price: "$199", minutes: 180, start: h(52), end: h(55), name: "Cancelled Carl", status: "cancelled", createdAt: h(-50) },
    { id: "k4", packageName: "Interior Only", price: "$129", minutes: 120, start: h(-48), end: h(-46), name: "Past Pat", status: "booked", createdAt: h(-200) },
  ],
  leadsLog: [{ leadId: "L1", name: "Lead One", phone: "4805550101", receivedAt: h(-2), status: "new", message: "Hi" }, { leadId: "L2", name: "Lead Two", receivedAt: h(-80), status: "won" }],
  adPerf: { syncedAt: h(-1), totals: { liveCampaigns: 2, spend30d: 412.6, clicks: 380, impressions: 9100 }, budget: { monthly: 900, pacing: 600, pct: 67 } },
  adminNotes: "private", googleAdsCustomerId: "123-456-7890", portalToken: "nope",
};

// 1. Who has a page
ok("🔴 only an owned business with the link on", P.portalOn(BIZ) && !P.portalOn({ ...BIZ, owned: false }) && !P.portalOn({ ...BIZ, internal: false })
  && !P.portalOn({ ...BIZ, portal: { on: false, token: TOKEN } }) && !P.portalOn({ ...BIZ, portal: { on: true, token: "" } }));
ok("the link is the OS address plus the token", P.portalUrl("https://os.example/", TOKEN) === `https://os.example/biz?t=${TOKEN}`);
ok("🔴 turning it off removes the token, so the old link is dead", /onUpdate\(\{\.\.\.client, portal:\{\.\.\.portal, on:false, token:""\}\}\)/.test(UI));
ok("🔴 every business he adds comes with its portal link ready", /portal: \{ on: true, token: crypto\.randomUUID\(\), createdAt: new Date\(\)\.toISOString\(\) \},\n    landingSlug: makeSlug\(name\) \};/.test(UI));
ok("a dead link gets a plain 'turned off' page", /This link is turned off/.test(P.portalOffPage()));

// 2. View only
{
  const F = src("netlify/functions/biz.mjs");
  ok("🔴 the endpoint refuses anything but reading", /if \(req\.method !== "GET" && req\.method !== "HEAD"\) return json\(\{ ok: false, error: "This page is view only\." \}, 405\);/.test(F));
  ok("🔴 and has no way to write at all", !/\.update\(|\.insert\(|\.upsert\(|\.delete\(|req\.json\(/.test(F));
  ok("it only answers a well-formed token on an owned business with the link on", /const TOKEN_RE = \/\^\[0-9a-f-\]\{32,64\}\$\/i;/.test(F) && /if \(!row \|\| !portalOn\(row\.data\)\) return off\(\);/.test(F));
  ok("never cached, never indexed, never sent on as a referrer", /"cache-control": "no-store"/.test(F) && /"x-robots-tag": "noindex, nofollow"/.test(F) && /"referrer-policy": "no-referrer"/.test(F));
  ok("/biz reaches the endpoint", /from = "\/biz"\n  to = "\/\.netlify\/functions\/biz"\n  status = 200/.test(src("netlify.toml")));
  const html = P.renderBizPortal(BIZ, { token: TOKEN, base: "https://os.example", now: NOW });
  ok("🔴 the page itself never sends anything but a read", !/method:\s*["']POST/i.test(html) && (html.match(/fetch\(/g) || []).length === 1 && html.includes('"&data=1",{cache:"no-store"}'));
  ok("the page says it is view only", html.includes('<span class="vo">View only</span>'));
}

// 3. Everything for the business
{
  const D = P.portalData(BIZ, { base: "https://os.example", now: NOW });
  ok("every booking is on the calendar, cancelled ones marked, oldest first", D.bookings.map((b) => b.id).join(",") === "k4,k1,k2,k3" && D.bookings.find((b) => b.id === "k3").status === "cancelled");
  const k1 = D.bookings.find((b) => b.id === "k1");
  ok("🔴 a booking carries everything the customer filled in", k1.name === "Ana Ruiz" && k1.phone === "(480) 555-0199" && k1.email === "ana@x.example" && k1.address === "123 Main St, Gilbert"
    && /Gate code 4411/.test(k1.notes) && k1.pkg === "Full Detail" && k1.price === "$199" && k1.minutes === 180 && k1.deposit.amount === "$50" && k1.deposit.paid === false && !!k1.bookedAt);
  ok("right now: jobs today, booked ahead, leads waiting, unpaid deposits", D.numbers.todayJobs === 1 && D.numbers.upcoming === 2 && D.numbers.waiting === 1 && D.numbers.unpaid === 1);
  ok("booked ahead is added up from the prices", D.numbers.upcomingValue === 328 && P.priceNumber("$1,250.50") === 1250.5 && P.priceNumber("call for price") === 0);
  ok("the last 30 days: leads, bookings made, ad spend, cost per lead", D.numbers.leads === 2 && D.numbers.bookings === 3 && D.numbers.spend === 413 && D.numbers.costPerLead === 207);
  ok("a leads-per-day chart from real leads, 30 days, on the business's clock", D.numbers.perDay.length === 30 && D.numbers.perDay[29] === 1 && D.numbers.perDay[26] === 1 && D.numbers.perDay.reduce((a, b) => a + b, 0) === 2);
  ok("the ads: live campaigns, spend, clicks, budget", D.ads.live === 2 && D.ads.spend30d === 413 && D.ads.clicks === 380 && D.ads.monthly === 900 && D.ads.pct === 67);
  ok("no ads yet reads as nothing, not zeros", P.portalData({ ...BIZ, adPerf: undefined }, { now: NOW }).ads === null);
  ok("the setup: how customers book, packages, hours", D.setup.how === "Customers book online" && D.setup.packages.length === 2 && D.setup.packages[0].deposit === "$50" && D.setup.hours[0] === "Sunday: Closed" && D.setup.hours[1] === "Monday: 8:00 AM to 5:00 PM");
  ok("its live pages, and only the live ones", D.links.website === "https://os.example/site/desert-gloss/" && D.links.book === "https://os.example/site/desert-gloss/book/" && D.links.landing === "https://os.example/lp/desert-gloss"
    && P.portalLinks({ ...BIZ, website: { published: false }, landingPage: {} }, "https://os.example").website === "");
  ok("a live custom domain wins over the OS address", P.portalLinks({ ...BIZ, websiteDeal: { domain: { live: true, host: "desertgloss.com" } } }, "https://os.example").website === "https://desertgloss.com/");
  const html = P.renderBizPortal(BIZ, { token: TOKEN, base: "https://os.example", now: NOW });
  ok("every section is on the page", ["now", "calendar", "coming", "numbers", "leads", "ads", "setup"].every((id) => html.includes(`id="${id}"`)));
  ok("🔴 tapping a booking opens its details: package, address, phone, email, deposit, when booked, what they told us", /r\.onclick=function\(\)\{openB\(b\);\}/.test(html)
    && ["\"Package\"", "\"Address\"", "\"Phone\"", "\"Email\"", "\"Deposit\"", "\"Booked\"", "\"What they told us\""].every((k) => html.includes(`row(${k}`)));
  ok("tapping a day shows that day's bookings", /c\.onclick=function\(\)\{SEL=k;cal\(\);day\(\);\};/.test(html));
  ok("months forward and back, and a Today button", html.includes('id="prev"') && html.includes('id="next"') && html.includes('id="tdy"'));
  ok("call, text, email and a map from a booking", html.includes('link("btn p","Call","tel:"+d)') && html.includes('link("btn","Text","sms:"+d)') && html.includes("https://www.google.com/maps/search/?api=1&query=\"+encodeURIComponent(b.address)"));
  ok("times are on the business's own clock", html.includes("timeZone:D.tz") && D.tz === "America/Phoenix");
}

// 4. Only what it needs, and safe
{
  const html = P.renderBizPortal(BIZ, { token: TOKEN, base: "https://os.example", now: NOW });
  ok("🔴 a customer's words cannot close the script and run their own", !html.includes("</script><script>alert(1)") && html.includes("\\u003c/script\\u003e"));
  ok("🔴 the business's name is escaped", html.includes("Desert Gloss &lt;Detailing&gt;") && !html.includes("Desert Gloss <Detailing>"));
  ok("🔴 everything a customer wrote is drawn as text, never as HTML", !/innerHTML\s*=\s*(?!"")/.test(html));
  ok("🔴 no payment links, ad account ids, other tokens or private notes leave the server", !html.includes("secret_link") && !html.includes("123-456-7890") && !html.includes("secret-team-token") && !html.includes("private"));
  ok("an email only becomes a link when it looks like one", html.includes('/^[^\\s@<>"]+@[^\\s@<>"]+$/.test(b.email)'));
  ok("a light brand colour keeps its text readable (dark text on gold, grey ink for words)", html.includes(".btn.p{background:#C8A84B;border-color:#C8A84B;color:#0B0B0C}") && html.includes(".biz{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4B5563}"));
  const dark = P.renderBizPortal({ ...BIZ, website: { published: true, brandColor: "#1D4ED8" } }, { token: TOKEN, now: NOW });
  ok("a dark brand colour keeps white text", dark.includes(".btn.p{background:#1D4ED8;border-color:#1D4ED8;color:#FFFFFF}"));
}

// 5. Rules
{
  const html = P.renderBizPortal(BIZ, { token: TOKEN, base: "https://os.example", now: NOW });
  ok("no emojis", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));
  ok("no dashes", !/[\u2014\u2013]/.test(html));
  ok("nothing pointing at BoldLine", !/boldline/i.test(html));
  ok("fits a phone (viewport set, columns that can shrink, big buttons)", html.includes("width=device-width") && html.includes("grid-template-columns:repeat(7,minmax(0,1fr))") && /min-height:42px/.test(html));
  ok("reduce motion makes it still", html.includes("@media (prefers-reduced-motion:reduce)"));
  ok("the card is on the Overview tab of an owned business only", /\{isOwned\(client\)&&<BusinessPortalCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
  ok("🔴 the OS opens the real page in a new tab and never embeds it", /const url = portal\.on && portal\.token \? `\$\{window\.location\.origin\}\/biz\?t=\$\{portal\.token\}` : "";/.test(UI)
    && /<a href=\{url\} target="_blank" rel="noopener noreferrer" style=\{btn\(true\)\}>Open<\/a>/.test(UI) && !/<iframe[^>]*biz\?t=/.test(UI) && !/srcDoc=\{[^}]*biz/i.test(UI));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-business-portal: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
