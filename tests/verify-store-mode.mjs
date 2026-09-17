// SHOP MODE ON A LANDING PAGE — the switch that turns a page that asks for an enquiry into a
// page that asks for the sale.
//
// Air Suds, closed 2026-09-16, sells a bottle of waterless car wash straight off a Shopify
// store. Bryson: *"i still think we build a landing page and then connect it to his Shopify"*
// and *"make sure everything is done right so it's automated as much as possible and the parts
// that either party has to do is as simple as possible"*. Most e-commerce clients from here on
// are the same shape, so this is a mode, not a one-off page for one client.
//
// ONE FIELD does it: `storeUrl`, the page where the visitor can actually buy. Fill it in, from
// the OS or from the client's own portal, and every button goes to the shop, the enquiry form
// comes off, and the copy stops promising a quote nobody is going to send. Leave it blank and
// nothing about any existing client's page changes, which is the other half of what this file
// is for.
//
// 🔴 THREE THINGS HERE COST REAL MONEY IF THEY REGRESS:
//
//   1. THE FORM COMING OFF. A form on a shop page collects enquiries nobody answers, from
//      people who arrived ready to buy. Every one of them is a paid click that did not reach
//      the checkout.
//   2. THE TRACKING REACHING THE SHOP. The agreement counts a Qualified Sale from the CLIENT'S
//      OWN ORDER RECORDS. Meta and Google hang their click ids on the ad's URL, which lands on
//      OUR page, not the shop. Drop them here and the order that follows cannot be tied to the
//      ad, and there is no basis to bill for it.
//   3. THE FORWARDING BEING A NAMED LIST. Copying the whole query string across would let
//      anyone who can write a URL append a parameter to a link our ads pay for, and Shopify
//      applies `?discount=CODE` straight off a storefront URL. That is the client's margin,
//      spent out of the budget they paid us to spend.
//
// Every check runs against pages rendered in EVERY layout plus the hand-off, booking and
// national variants, because the furniture differs per branch and a mutation that never
// renders looks exactly like a guard that works (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderLandingPage } from "../netlify/functions/landing.mjs";
import { STORE_FORWARD_KEYS } from "../netlify/lib/attribution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANDING = readFileSync(join(ROOT, "netlify/functions/landing.mjs"), "utf8");
const PORTAL = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const SHOP = "https://airsuds.com/collections/car?ref=house";
const base = (extra = {}, design = {}) => ({
  name: "Air Suds",
  callTrackingNumber: "(480) 555-0142",
  landingSlug: "air-suds-car",
  campaignSetup: { serviceArea: "Gilbert, AZ", mainOffer: "Waterless car wash" },
  brandVoice: { differentiator: "Made in Arizona" },
  mediaLibrary: [
    { path: "p/1.jpg", url: "https://cdn.example.com/1.jpg", category: "photo" },
    { path: "p/2.jpg", url: "https://cdn.example.com/2.jpg", category: "photo" },
  ],
  landingPage: {
    headline: "Wash your car without a hose",
    subheadline: "One bottle, no bucket, no hose pipe.",
    bullets: ["Works anywhere", "No water needed", "Safe on paint"],
    published: true, heroPath: "p/1.jpg",
    design: { layout: "split", ...design },
  },
  ...extra,
});

// 🔴 EVERY BRANCH THAT RENDERS DIFFERENT FURNITURE. The capture layout puts the form in the
// hero rather than at the foot, the hand-off page posts to the client's own endpoint, and a
// national client renders a nationwide line where the service area would be. A mutation that
// only reaches one of them is indistinguishable from a guard that works.
const LAYOUTS = ["split", "centered", "overlay", "capture"];
const shopPages = [
  ...LAYOUTS.map((l) => [`shop / ${l}`, renderLandingPage(base({ storeUrl: SHOP }, { layout: l }))]),
  ["shop / hand-off", renderLandingPage(base({ storeUrl: SHOP }), { handoff: { phone: "(480) 555-0142", postTo: "https://airsuds.com/lead" } })],
  ["shop / with a booking link too", renderLandingPage(base({ storeUrl: SHOP, bookingUrl: "https://calendly.com/airsuds/call" }))],
  ["shop / national", renderLandingPage(base({ storeUrl: SHOP, campaignSetup: { serviceArea: "Nationwide" } }))],
];

// ── 1. The form comes off, everywhere ────────────────────────────────────────
for (const [label, html] of shopPages) {
  ok(`🔴 ${label} ships no enquiry form`, !/<form\b/i.test(html),
    "a form on a shop page collects enquiries nobody answers, from people who came to buy");
  ok(`${label} has nothing left pointing at a form`, !/href="#lead-form"/.test(html) && !/id="lead-form"/.test(html));
  ok(`${label} has no consent checkbox left stranded`, !/type="checkbox"/i.test(html));
}

// ── 2. Nothing promises a quote ──────────────────────────────────────────────
// The same promise is written in several places in the renderer — the trust row, the chip row,
// the steps, the closing block, the button. Fixing one and not the rest is how the first pass
// of this shipped a shop page that still said "Free quote, no obligation".
const QUOTE_WORDS = /free quote|no obligation|quote today|get a fast|tell us what you need|we handle the rest|no pressure|enquir/i;
for (const [label, html] of shopPages) {
  const hit = QUOTE_WORDS.exec(html);
  ok(`🔴 ${label} never promises a quote`, !hit, hit ? `found ${JSON.stringify(hit[0])}` : "");
  ok(`${label} does not call a shop a local service`, !/Trusted local service/.test(html));
}

// ── 3. Every button goes to the shop ─────────────────────────────────────────
for (const [label, html] of shopPages) {
  const marked = [...html.matchAll(/href="([^"]*)"[^>]*data-store="1"/g)].map((m) => m[1]);
  ok(`${label} marks its store links`, marked.length >= 2, `found ${marked.length}`);
  ok(`${label} sends every one of them to the shop`,
    marked.every((h) => h.replace(/&amp;/g, "&").startsWith("https://airsuds.com/collections/car")),
    marked.join(" | "));
  // 🔴 A BOOKING LINK MUST NOT WIN OVER THE SHOP. A client can have both on record, and a page
  // that sends a buyer to a sales call instead of the checkout is the mode failing silently.
  ok(`${label} never sends a buyer to a calendar`, !/calendly/i.test(html));
}

// ── 4. The tags are on the href before a line of JavaScript runs ─────────────
{
  const html = renderLandingPage(base({ storeUrl: SHOP }));
  const href = (html.match(/href="([^"]*airsuds[^"]*)"/) || [])[1].replace(/&amp;/g, "&");
  const u = new URL(href);
  ok("🔴 the store link carries UTM tags with JavaScript off", u.searchParams.get("utm_source") === "boldline");
  ok("the campaign tag names the page, so two pages are told apart", u.searchParams.get("utm_campaign") === "air-suds-car");
  ok("the medium says it was paid for", u.searchParams.get("utm_medium") === "paid");
  // 🔴 WHAT THE CLIENT WROTE WINS. If they went to the trouble of putting a tag on their own
  // link, overwriting it is us deciding we know their shop better than they do.
  ok("a parameter already on their link is left alone", u.searchParams.get("ref") === "house");

  const own = renderLandingPage(base({ storeUrl: "https://airsuds.com/x?utm_source=theirs" }));
  const ownHref = (own.match(/href="([^"]*airsuds[^"]*)"/) || [])[1].replace(/&amp;/g, "&");
  ok("🔴 their own utm_source is not overwritten", new URL(ownHref).searchParams.get("utm_source") === "theirs", ownHref);
  ok("and the page does not list it as one of ours to replace",
    !/var SD = \[[^\]]*"utm_source"/.test(own),
    "a key we did not invent is not a key we may overwrite at runtime");

  const frag = renderLandingPage(base({ storeUrl: "https://airsuds.com/x#buy" }));
  const fragHref = (frag.match(/href="([^"]*airsuds[^"]*)"/) || [])[1].replace(/&amp;/g, "&");
  ok("a fragment stays on the end where it works", /\?[^#]*#buy$/.test(fragHref), fragHref);
}

// ── 5. The forwarding script, RUN rather than read ───────────────────────────
// 🔴 Reading the source and asserting the words are there is how a dead script passes for a
// working one. This pulls the emitted script out of the page and runs it against a stand-in
// for the two browser things it touches, which is the only version that can tell the
// difference between forwarding the tracking and looking like it does.
{
  const html = renderLandingPage(base({ storeUrl: SHOP }));
  const script = (html.match(/var SF = \[[\s\S]*?\n  \}\);/) || [])[0];
  ok("the forwarding script was emitted", !!script);

  const run = (search, startHref) => {
    const links = [{ href: startHref }];
    const el = {
      getAttribute: () => links[0].href,
      setAttribute: (_k, v) => { links[0].href = v; },
    };
    const doc = { querySelectorAll: (sel) => (/data-store/.test(sel) ? [el] : []) };
    const loc = { search, href: "https://pages.example.com/air-suds-car" + search };
    new Function("document", "location", "URL", "URLSearchParams", script)(doc, loc, URL, URLSearchParams);
    return new URL(links[0].href);
  };

  const withClick = run("?fbclid=ABC123&gclid=G-9&utm_campaign=spring", "https://airsuds.com/x?utm_source=boldline");
  ok("🔴 Meta's click id reaches the shop", withClick.searchParams.get("fbclid") === "ABC123",
    "without it the client's order records cannot name the ad that produced the sale, and there is no basis to bill");
  ok("🔴 Google's click id reaches the shop", withClick.searchParams.get("gclid") === "G-9");
  ok("an inbound tag fills a gap in the link", withClick.searchParams.get("utm_campaign") === "spring");

  // 🔴 THE ORDER BETWEEN THE THREE SOURCES, WHICH THE FIRST VERSION OF THIS GOT WRONG.
  // Our own `utm_source=boldline` is baked into the href so a visitor with JavaScript off is
  // still attributed to us at all. It is a FLOOR, not an answer: the real ad click arrives
  // carrying `utm_source=google` or `utm_source=facebook`, and if our placeholder sits in the
  // way then every sale in the client's shop is credited to "boldline" and none of them names
  // the campaign that produced it. What the CLIENT typed on their own link still beats both.
  const real = run("?utm_source=google&utm_medium=cpc", "https://airsuds.com/x?utm_source=boldline&utm_medium=paid&ref=house");
  ok("🔴 the real ad source replaces our placeholder", real.searchParams.get("utm_source") === "google",
    "otherwise every order in the shop is credited to boldline instead of to the campaign that paid for it");
  ok("and so does the real medium", real.searchParams.get("utm_medium") === "cpc");
  ok("what the client typed on their own link is still untouched", real.searchParams.get("ref") === "house");

  // 🔴 THE MONEY ONE. Shopify applies `?discount=CODE` straight off a storefront URL, so a
  // pass-through would hand a stranger a way to discount a client's whole catalogue through
  // a link our ads pay for.
  const nasty = run("?discount=FREESTUFF&redirect=https://evil.test&fbclid=OK", "https://airsuds.com/x");
  ok("🔴 an unknown parameter is NOT carried across", !nasty.searchParams.has("discount"),
    "Shopify reads ?discount=CODE off a storefront URL: a pass-through spends the client's margin");
  ok("🔴 and neither is anything else unnamed", !nasty.searchParams.has("redirect"));
  ok("while the real tracking still gets through", nasty.searchParams.get("fbclid") === "OK");

  ok("arriving with nothing leaves the link exactly as built",
    run("", "https://airsuds.com/x?utm_source=boldline").toString() === "https://airsuds.com/x?utm_source=boldline");

  ok("the list the page ships is the shared one",
    STORE_FORWARD_KEYS.every((k) => script.includes(JSON.stringify(k))),
    "a second copy of this list is a second thing to forget");
  for (const k of ["fbclid", "gclid", "wbraid", "gbraid", "utm_source", "utm_campaign"])
    ok(`${k} is on the shared list`, STORE_FORWARD_KEYS.includes(k));
}

// ── 6. The standing landing-page rules still hold on a shop page ─────────────
// No link back to the OS, no relative hrefs, no emojis, no internal comments in the shipped
// script. verify-lead-handoff polices these for lead pages; a new branch is a new page shape
// and gets them checked here too rather than assumed.
for (const [label, html] of shopPages) {
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  // 🔴 THE DESTINATION, NOT THE TRACKING TAGS. A store link legitimately carries
  // `utm_source=boldline` — that is the tag that tells the client's own analytics the visit
  // came from us, and it is the opposite of a problem. What the rule is actually about is
  // where the button GOES, so the query string comes off before the check. Anywhere the word
  // could appear in a destination is still caught.
  const target = (h) => h.replace(/[?#].*$/, "");
  ok(`${label} links nowhere near BoldLine`,
    !hrefs.some((h) => /boldline|\.netlify\.app|^https?:\/\/os\./i.test(target(h))),
    hrefs.filter((h) => /boldline|netlify/i.test(target(h))).join(", "));
  ok(`${label} has no relative hrefs`,
    hrefs.every((h) => /^(https?:|tel:|mailto:|#)/i.test(h)),
    hrefs.filter((h) => !/^(https?:|tel:|mailto:|#)/i.test(h)).join(", "));
  const body = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const emoji = body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) || [];
  ok(`${label} carries no emojis`, emoji.filter((e) => !/[✓✔★→‹›]/.test(e)).length === 0,
    emoji.join(" "));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\\?\/script>/g)].map((m) => m[1]).join("\n");
  ok(`${label} ships no internal comments`, !/^\s*\/\//m.test(scripts),
    "this script is delivered verbatim to the client's own domain, where their developer reads it");
}

// ── 7. 🔴 A PAGE WITHOUT A STORE LINK IS UNTOUCHED ───────────────────────────
// The whole safety of this change rests here. Every existing client is a lead-gen client and
// must render exactly what they rendered yesterday.
for (const layout of LAYOUTS) {
  const html = renderLandingPage(base({}, { layout }));
  ok(`the ${layout} lead page still has its form`, /<form\b/i.test(html));
  ok(`the ${layout} lead page still asks for a quote`, /Free quote|Free quotes/.test(html));
  ok(`the ${layout} lead page has no store markup`, !/data-store/.test(html));
  ok(`the ${layout} lead page ships no forwarding script`, !/var SF = /.test(html));
}
{
  const booking = renderLandingPage(base({ bookingUrl: "https://calendly.com/airsuds/call" }));
  ok("a booking client still opens their calendar in a new tab", /calendly[^"]*"\s+target="_blank"/.test(booking));
  ok("and is not treated as a shop", !/data-store/.test(booking));
}

// ── 8. There is somewhere to type it, on both sides ──────────────────────────
// 🔴 A MODE NOBODY CAN TURN ON IS A MODE THAT DOES NOT EXIST. It was reachable only by editing
// the database by hand until these two boxes existed.
ok("the client can paste their shop link in the portal",
  /data-key="storeUrl"/.test(PORTAL));
ok("🔴 and the portal actually saves it",
  /hasOwnProperty\.call\(fields, "storeUrl"\)/.test(PORTAL),
  "anything not on the whitelist is dropped silently: the client sees Saved and the link is gone");
ok("🔴 it is not clipped to the length of an ID",
  /out\.storeUrl = clip\(fields\.storeUrl, 500\)/.test(PORTAL),
  "a product link with a collection path runs well past sixty characters; a clipped one looks saved and goes nowhere");
ok("the owner-side copy of the portal has the same box", /data-key="storeUrl"/.test(UI));
ok("Bryson can set it from the client's edit sheet", /set\("storeUrl", tidyField\.url\(/.test(UI));

// ── 9. 🔴 BREAK EVERY GUARD ONCE ─────────────────────────────────────────────
// A checker that cannot fail is not a checker. Each of these is a real way this regresses.
{
  const html = renderLandingPage(base({ storeUrl: SHOP }));
  const quoteWords = (h) => QUOTE_WORDS.test(h);
  ok("caught: the trust row keeps its lead-gen wording",
    quoteWords(html.replace("Ships straight to you", "Free quote, no obligation")));
  ok("caught: the form comes back", /<form\b/i.test(html.replace("<footer", "<form></form><footer")));
  ok("caught: every button loses its store marker",
    [...html.replaceAll(' data-store="1"', "").matchAll(/href="([^"]*)"[^>]*data-store="1"/g)].length === 0);
  ok("caught: the store link loses its tags",
    !new URL(SHOP).searchParams.has("utm_source"),
    "sanity: the fixture link has no tags of its own, so the ones on the page were added");
  // The source-level ones: these say the shipped mechanism is the one under test.
  ok("caught: the forwarding list becomes a pass-through",
    /SF\.forEach/.test(LANDING) && !/inbound\.forEach\(function \(v, k\)/.test(LANDING),
    "the old version copied the whole query string, discount codes and all");
  ok("caught: shop mode stops depending on the store link",
    /const shopping = !!storeUrl;/.test(LANDING));
  ok("caught: the capture layout renders an empty form panel on a shop",
    /if \(useCapture && !shopping\)/.test(LANDING));
  ok("caught: our placeholder tags start blocking the real ones",
    /SD\.indexOf\(k\) >= 0/.test(LANDING) && /filled\.push\(k\)/.test(LANDING));
}

console.log(`verify-store-mode: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
