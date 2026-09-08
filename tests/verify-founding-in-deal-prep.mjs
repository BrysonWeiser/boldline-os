// 🔴 Deal Prep was about to hand Bryson a worse offer than the one he gives.
//
// 2026-09-07: the briefing it produced for Scottsdale Roofing told him to quote "$750
// one-time setup, then $400/mo minimum or $75 per qualified lead". Both halves are wrong for
// anyone he would sign today. The setup fee is WAIVED for the first three clients, and
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
  // 🔴 Scarcity has to stay honest. An invented deadline is the one thing that would make
  // this offer feel like a tactic, and Bryson's standing rule is that nothing may read as
  // manufactured. The offer's real limit is a count, so the model is told to say the count.
  ok("🔴 it forbids inventing a deadline or a countdown",
    /DO NOT invent a deadline/.test(block),
    "a made-up deadline turns an honest offer into a sales trick");

  // The site and the prompt are the same promise made to the same people.
  ok("the marketing site still carries the matching founding banner",
    /Founding client offer/i.test(SITE) && /first three clients it is free/i.test(SITE),
    "if the site and the call disagree about the offer, the prospect believes neither");
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
  ok("open at zero, one and two signed clients",
    [0, 1, 2].every((n) => foundingOfferActive(signed(n))));
  ok("🔴 SPENT the moment the third signs", foundingOfferActive(signed(3)) === false);
  ok("🔴 and it never re-opens if a client later churns",
    foundingOfferActive(signed(4)) === false,
    "we gave the first three a free build is a statement about history, not about headcount");
  ok("places left counts down and stops at zero",
    foundingSlotsLeft(signed(1)) === 2 && foundingSlotsLeft(signed(5)) === 0);
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
