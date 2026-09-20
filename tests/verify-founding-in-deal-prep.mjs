// 🔴 Deal Prep was about to hand Bryson a worse offer than the one he gives.
//
// 2026-09-07: the briefing it produced for Scottsdale Roofing told him to quote "$750
// one-time setup, then $400/mo minimum or $75 per qualified lead". Both halves are wrong for
// anyone he would sign today. The setup fee is WAIVED for the founding clients, and
// founding clients pay for RESULTS ONLY with no monthly minimum at all.
//
// "You owe $400 whether it works or not" and "you owe nothing unless I deliver" are not a
// difference in price, they are different products — and the second is the entire answer to
// the objection Deal Prep itself predicts most often, "I got burned by a marketing company".

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FOUNDING_CLIENT_COUNT, foundingTermsBlock, packagesPromptBlock } from "../netlify/lib/pricing-shared.mjs";
import { foundingOfferActive, foundingSlotsLeft, countFoundingClients, isFoundingClient } from "../netlify/lib/founding.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEAL = readFileSync(join(ROOT, "netlify/functions/deal-research-background.mjs"), "utf8");
const ALERTS = readFileSync(join(ROOT, "netlify/functions/alerts-watch.mjs"), "utf8");
const SITE = readFileSync(join(ROOT, "marketing-site/index.html"), "utf8");
const OS = readFileSync(join(ROOT, "index.html"), "utf8");
const OSCODE = OS.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

const block = foundingTermsBlock(true);
const SITEFN = readFileSync(join(ROOT, "marketing-site/netlify/functions/founding-status.mjs"), "utf8");
const GS = readFileSync(join(ROOT, "marketing-site/get-started/index.html"), "utf8");

ok("Deal Prep imports the founding terms at all", /foundingTermsBlock/.test(DEAL),
  "a briefing that does not know about the offer quotes the standard prices");
ok("🔴 and actually puts them in the prompt it sends",
  /\$\{foundingTermsBlock\(foundingOpen\)\}/.test(DEAL),
  "importing it and never interpolating it is the same as not having it");
ok("the standing pricing sentence warns the model it is overridden",
  /\$\{foundingOpen \?/.test(DEAL),
  "two pricing statements in one prompt, with nothing saying which wins, is how it quoted the wrong one");

{
  ok("🔴 the terms say the setup fee is waived, not discounted", /WAIVED/.test(block) && /Not reduced, waived/.test(block));
  ok("🔴 and that there is NO monthly minimum", /NO monthly minimum/.test(block),
    "the monthly minimum is the exact thing a burned prospect is afraid of");
  ok("it says they are billed in arrears, after delivery", /in arrears/.test(block));
  ok("it spells out the zero-delivery case in plain words",
    /delivers nothing in a month, they owe nothing/.test(block),
    "this is the sentence that answers the objection, so it cannot be left implied");
  ok("the hard constraint survives: the client pays their own ad spend",
    /pays their ad spend directly/.test(block) && /never holds or fronts/.test(block));
  ok("it names the real client count rather than a vague 'a few'",
    block.includes(String(FOUNDING_CLIENT_COUNT)));
  // 🔴 AND NAMES NO OTHER COUNT. Found by mutation 2026-09-20: the prompt quotes the figure
  // TWICE, so re-hardcoding one of them back to the old number left the other reading from the
  // constant, the block still contained "5", and this check passed while the model was being
  // told "the first 3 clients" in the very sentence that leads the pitch.
  const wrongCounts = [...block.matchAll(/first (\d+) clients/g)]
    .map((m) => m[1]).filter((n) => n !== String(FOUNDING_CLIENT_COUNT));
  ok(`🔴 and quotes no other count than ${FOUNDING_CLIENT_COUNT}`, wrongCounts.length === 0,
    `the prompt tells a prospect the offer covers the first ${wrongCounts.join("/")} clients`);
  // 🔴 Scarcity has to stay honest. An invented deadline is the one thing that would make
  // this offer feel like a tactic, and Bryson's standing rule is that nothing may read as
  // manufactured. The offer's real limit is a count, so the model is told to say the count.
  ok("🔴 it forbids inventing a deadline or a countdown",
    /DO NOT invent a deadline/.test(block),
    "a made-up deadline turns an honest offer into a sales trick");

  // The site and the prompt are the same promise made to the same people.
  // 🔴 DERIVED FROM THE CONSTANT, NOT TYPED. Bryson widened the offer from 3 to 5 on
  // 2026-09-20. A test that spells the number out by hand has to be edited before the change
  // can land, which means it would just as happily have passed a site promising three places
  // while the code granted five. The count is the source; the banner is checked against it.
  const WORD = ["zero","one","two","three","four","five","six","seven","eight","nine","ten"][FOUNDING_CLIENT_COUNT] || String(FOUNDING_CLIENT_COUNT);
  ok("the marketing site still carries the matching founding banner",
    /Founding client offer/i.test(SITE) && new RegExp(`first ${WORD} clients it is free`, "i").test(SITE),
    "if the site and the call disagree about the offer, the prospect believes neither");
}

// ── 🔴 THE "OFFER IS SPENT" ALERT HAS TO SURVIVE THE LIMIT MOVING ───────────
//
// The alert exists so the pitch never changes under him in silence. It used to dedupe on a bare
// "already alerted" flag, which was fine while the limit was a fixed 3. Bryson widening it to 5
// on 2026-09-20 proved it is not fixed, and a bare flag means the alert can only ever fire ONCE
// in the lifetime of the business: spend the offer at three, widen it to five, and the day the
// fifth signs he finds out from a prospect asking for a free build he no longer offers.
{
  const AW = readFileSync(join(ROOT, "netlify/functions/alerts-watch.mjs"), "utf8");
  ok("🔴 the alert remembers the LIMIT it fired at, not just that it fired",
    /foundingOfferSpentAt/.test(AW),
    "a boolean flag lets the alert fire once, ever, however many times the offer is reopened");
  ok("and it writes that limit when it fires",
    /foundingOfferSpentAt: FOUNDING_CLIENT_COUNT/.test(AW));
  ok("and the old boolean is still honoured so nobody gets a duplicate",
    /foundingOfferSpentAlerted \? 3 : 0/.test(AW),
    "an account that already alerted at the old limit of 3 must not be told again about 3");

  // Run the real rule rather than trusting the source read above.
  const armed = (hd, signed, N) => {
    const alertedFor = Number(hd.foundingOfferSpentAt || 0) || (hd.foundingOfferSpentAlerted ? 3 : 0);
    return signed >= N && !(alertedFor >= N);
  };
  ok("a fresh account alerts when the last place goes", armed({}, 5, 5));
  ok("🔴 an account that alerted at 3 alerts again once the offer is widened and refilled",
    armed({ foundingOfferSpentAlerted: "2026-01-01" }, 5, 5));
  ok("but not before the new limit is actually reached",
    !armed({ foundingOfferSpentAlerted: "2026-01-01" }, 4, 5));
  ok("and never twice for the same limit", !armed({ foundingOfferSpentAt: 5 }, 6, 5));
}

// ── 🔴 THE TWO COPIES OF THE LIMIT MUST BE THE SAME NUMBER ──────────────────
//
// The count lives twice: `netlify/lib/founding.mjs`, which the marketing site's banner endpoint
// and the sales prompt read, and a mirror in `index.html`, because the OS is one file served to
// a browser and cannot import it. Found by mutation 2026-09-20: leaving the OS mirror at 3 while
// the server said 5 passed every test. That is not cosmetic. Deal Prep would quote founding
// terms to a fourth prospect and then show "0 of 3 places left" beside the quote, or refuse to
// show founding pricing for a deal the website is still publicly advertising.
{
  const osCount = (OSCODE.match(/const FOUNDING_CLIENT_COUNT = (\d+);/) || [])[1];
  ok("the OS carries its own copy of the limit", !!osCount, "the mirror was not found at all");
  ok(`🔴 and it is the same number the server enforces (${FOUNDING_CLIENT_COUNT})`,
    Number(osCount) === FOUNDING_CLIENT_COUNT,
    `the OS says ${osCount} and netlify/lib/founding.mjs says ${FOUNDING_CLIENT_COUNT}, so the `
    + "screen and the website disagree about how many free builds are left");
}

// ── 🔴 THE SCREEN HAS TO AGREE WITH THE BRIEFING ─────────────────────────────
// Fixing the prompt was NOT enough. The package list rendered directly under the briefing in
// Deal Prep still printed "$400/mo min · $750 setup", so the screen contradicted the words
// above it. A price shown beside a recommendation IS the quote, whatever the prose says.


ok("🔴 the OS computes the offer from the client list, not a constant",
  /foundingSignedCount\(clients\) < FOUNDING_CLIENT_COUNT/.test(OSCODE)
  && /const foundingOpen = foundingOfferOpen\(clients\)/.test(OSCODE),
  "a hardcoded true in the app is the same forgettable switch this whole change removed");
ok("and Deal Prep is actually handed the clients to count",
  /<DealPrepScreen[\s\S]{0,240}?clients=\{clients\}/.test(OSCODE),
  "computing from a list nobody passes in is a very convincing way to always say yes");
ok("the Deal Prep package card is aware of the offer at all",
  /foundingOpen&&pkg\.leadFee&&leadFee/.test(OSCODE));
{
  ok("🔴 it leads with the per-lead fee, not a monthly minimum he would not charge",
    /\$\{leadFee\}<span[^>]*>\/lead/.test(OSCODE));
  ok("it says no monthly minimum in plain words on the card itself",
    /color:C\.green,fontWeight:700\}\}>no monthly minimum</.test(OSCODE),
    "the loose check also matched the banner below, so the card could say the opposite and pass");
  ok("and shows the setup fee struck through rather than hiding it",
    /textDecoration:"line-through"/.test(OSCODE) && /waived/.test(OSCODE),
    "he needs to know what he is giving away, or he cannot sell it as worth anything");
  ok("the card explains which pricing is on screen",
    /Founding client pricing is shown/.test(OSCODE),
    "a struck-out number with no label reads as a bug");
}

// The standard prices must still be intact underneath, because the offer ends.
ok("the standard package prices are still there for when the offer ends",
  /\$400\/mo MINIMUM/.test(packagesPromptBlock(75)) && /\$750 one-time setup/.test(packagesPromptBlock(75)));

// ── 🔴 IT TAKES ITSELF DOWN. NOBODY HAS TO REMEMBER. ─────────────────────────
// Bryson, 2026-09-07: "once I land a third client... that triggers the copy and website banner
// to take down the offer". It used to be a hand-flipped constant, which is a thing to forget on
// the single day it matters: the site would go on advertising a free build worth $1,500 to
// $4,900 and he would find out when a prospect asked for it.
{
  const signed = (n) => Array.from({ length: n }, () => ({ contractSigned: true }));
  // 🔴 EXPRESSED AGAINST THE CONSTANT so widening the offer does not need this rewritten, and
  // so the BOUNDARY is still tested wherever it sits: open at every count below it, spent at
  // it, and spent above it.
  const N = FOUNDING_CLIENT_COUNT;
  ok("open at every count below the limit",
    Array.from({ length: N }, (_, i) => i).every((n) => foundingOfferActive(signed(n))),
    `one of 0..${N - 1} signed clients reads as spent`);
  ok("🔴 SPENT the moment the last place goes", foundingOfferActive(signed(N)) === false);
  ok("🔴 and it never re-opens if a client later churns",
    foundingOfferActive(signed(N + 1)) === false,
    "we gave our first clients a free build is a statement about history, not about headcount");
  ok("places left counts down and stops at zero",
    foundingSlotsLeft(signed(1)) === N - 1 && foundingSlotsLeft(signed(N + 2)) === 0);
  ok("a client signed on paper counts, not just DocuSign",
    isFoundingClient({ contractStatus: "active" }) === true,
    "Stencil & Thread signed an emailed PDF; a DocuSign-only test would have missed the first client");
  ok("🔴 the demo client and the house account never count",
    countFoundingClients([{ demo: true, contractSigned: true }, { internal: true, contractStatus: "active" }]) === 0,
    "the demo exists so empty screens look alive; letting it eat a founding place would be absurd");

  // The website banner.
  ok("both marketing pages hide the banner until told otherwise",
    /<div hidden data-founding/.test(SITE) && /<div hidden data-founding/.test(GS),
    "a banner that is visible by default is one that keeps advertising a spent offer");
  ok("and both ask the server whether it is still open",
    /founding-status/.test(SITE) && /founding-status/.test(GS));
  ok("🔴 it is only revealed on an explicit yes",
    /d\.active===true/.test(SITE) && /d\.active===true/.test(GS),
    "anything looser turns a failed fetch into a live offer");
  ok("🔴 the endpoint fails CLOSED, not open",
    /active: false, reason: "unconfigured"/.test(SITEFN) && /active: false, reason: "error"/.test(SITEFN),
    "an error is not evidence the offer is open");
  ok("the endpoint counts real signed clients rather than trusting a flag",
    /foundingOfferActive/.test(SITEFN));

  // The briefing.
  ok("Deal Prep looks up the live answer before writing anything",
    /foundingOfferActive\(/.test(DEAL) && /runResearch\(input, foundingOpen\)/.test(DEAL));
  ok("🔴 and falls back to STANDARD prices if that lookup fails",
    /let foundingOpen = false;/.test(DEAL),
    "quoting more than the offer is a conversation; quoting a giveaway that is gone is a broken promise");

  // And he gets told.
  ok("he is alerted once when the offer is spent",
    /Founding offer is now spent/.test(ALERTS) && /foundingOfferSpentAlerted/.test(ALERTS),
    "a pitch that changes silently is one he learns about from a prospect");
}

console.log(`verify-founding-in-deal-prep: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
