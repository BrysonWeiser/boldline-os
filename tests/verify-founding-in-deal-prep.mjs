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
import { FOUNDING_OFFER_ACTIVE, FOUNDING_CLIENT_COUNT, foundingTermsBlock, packagesPromptBlock } from "../netlify/lib/pricing-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEAL = readFileSync(join(ROOT, "netlify/functions/deal-research-background.mjs"), "utf8");
const SITE = readFileSync(join(ROOT, "marketing-site/index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

const block = foundingTermsBlock();

ok("Deal Prep imports the founding terms at all", /foundingTermsBlock/.test(DEAL),
  "a briefing that does not know about the offer quotes the standard prices");
ok("🔴 and actually puts them in the prompt it sends",
  /\$\{foundingTermsBlock\(\)\}/.test(DEAL),
  "importing it and never interpolating it is the same as not having it");
ok("the standing pricing sentence warns the model it is overridden",
  /FOUNDING_OFFER_ACTIVE \?/.test(DEAL),
  "two pricing statements in one prompt, with nothing saying which wins, is how it quoted the wrong one");

if (FOUNDING_OFFER_ACTIVE) {
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
} else {
  ok("with the offer off, no founding terms are injected", block === "");
  ok("and the site banner is gone too", !/Founding client offer/i.test(SITE),
    "the switch and the banner are one promise and must come down together");
}

// The standard prices must still be intact underneath, because the offer ends.
ok("the standard package prices are still there for when the offer ends",
  /\$400\/mo MINIMUM/.test(packagesPromptBlock(75)) && /\$750 one-time setup/.test(packagesPromptBlock(75)));

console.log(`verify-founding-in-deal-prep: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
