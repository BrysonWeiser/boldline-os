// The founding-client offer says the same thing in both places, and leaves together.
//
// Bryson, 2026-08-27: *"for my first 3 clients I am waiving the set up fee entirely that way
// I can get clients and get case studies. I also want to advertise this as well."* It was
// never advertised anywhere until 2026-08-28, so he was giving away $1,500 to $4,900 and
// telling nobody.
//
// 🔴 THE FAILURE THIS GUARDS IS A HALF-REMOVED OFFER. It lives on two pages. When the third
// client signs, both come out. If only one does, the site promises a free build on the
// homepage and stays silent on the page the ads point at, or worse, the reverse. A stale
// scarcity claim on a live site is an honesty problem, not a formatting one.
//
// Deliberately NOT pinned: the wording. Bryson should be free to rewrite the pitch without a
// test arguing with him. What is pinned is that the two copies agree and that the claim
// stays honest.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const home = readFileSync(join(ROOT, "marketing-site/index.html"), "utf8");
const gs = readFileSync(join(ROOT, "marketing-site/get-started/index.html"), "utf8");
const doc = readFileSync(join(ROOT, "docs/FOUNDING-OFFER.md"), "utf8");

const onHome = /CS:FOUNDING:START home/.test(home) && /CS:FOUNDING:END home/.test(home);
const onAds = /CS:FOUNDING:START get-started/.test(gs) && /CS:FOUNDING:END get-started/.test(gs);

// 🔴 The whole point: both, or neither. Never one.
ok("🔴 the offer is on both pages or on neither, never half", onHome === onAds,
  `homepage: ${onHome ? "present" : "gone"}, ads page: ${onAds ? "present" : "gone"} — ` +
  "a client reading one page would be told something the other page denies");

if (onHome || onAds) {
  // While it IS running, it has to actually make the offer legible.
  for (const [where, src] of [["the homepage", home], ["the ads page", gs]]) {
    const block = (src.match(/CS:FOUNDING:START[\s\S]*?CS:FOUNDING:END/) || [""])[0];
    ok(`${where} states what the build normally costs`, /\$1,500 to \$4,900/.test(block),
      "the site never mentions a setup fee anywhere else, so 'waived' means nothing on its own");
    ok(`${where} says it is free for the first three`, /first three clients it is free/i.test(block));
    // 🔴 A number of remaining spots decays into a lie the moment a client signs and nobody
    // edits the page. "Our first three clients" stays true throughout.
    ok(`🔴 ${where} makes no countdown claim that will rot`,
      !/\b(spots?|places?|slots?)\s+(left|remaining)\b/i.test(block) && !/only \d+ (spot|place|slot)/i.test(block),
      "a stale 'two spots left' is a live honesty problem nobody notices for months");
    ok(`${where} does not read as AI-written`, !/[—–]/.test(block),
      "the standing rule bans the dash in every piece of client-facing copy");
  }
  // The hard business rule, at exactly the moment a reader might assume otherwise.
  const hb = (home.match(/CS:FOUNDING:START[\s\S]*?CS:FOUNDING:END/) || [""])[0];
  ok("🔴 a free build still says the client pays their own ad spend", /ad spend/i.test(hb),
    "BoldLine never holds or fronts ad spend, and 'free' is the moment someone assumes it does");

  ok("there is a written way to take it down", /CS:FOUNDING:START home/.test(doc) && /To remove/.test(doc));
  ok("and the doc says when", /third client signs/i.test(doc));
}

console.log(`verify-founding-offer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
