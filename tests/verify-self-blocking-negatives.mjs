// A negative keyword that blocks the client's own offer.
// Run: node tests/verify-self-blocking-negatives.mjs
//
// Found 2026-09-09, in the box, seconds before the first real client's campaign was
// built. Bryson asked whether the screen looked right. It did not.
//
// The seed list of negatives started with the bare word **"free"**. A one-word negative
// keyword in Google blocks EVERY search containing that word, so "free" blocks
// "free quote screen printing" — and "Get Your Free Quote" is the button on every
// landing page BoldLine builds. We were paying to write the offer and then paying again
// to block the people searching for it. The same is true of "quote", "estimate" and
// "near me", which is the highest-intent phrase a local buyer types.
//
// The bad intent is in the SECOND word, not the first: "for free" and "free sample" are
// freebie hunters; "free quote" is a buyer. So the bare words go and the phrases stay.
//
// THREE SOURCES CAN SUPPLY A NEGATIVE — the box he types, the model that writes the
// campaign, and a playbook a previous client taught us — so the refusal sits at the
// build, where all three arrive, and every source is checked here.

import { readFileSync } from "node:fs";
import { NEVER_NEGATIVE, UNIVERSAL_NEGATIVES, dropSelfBlockingNegatives } from "../netlify/lib/trade-playbooks.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const os = read("../index.html");
const google = read("../netlify/functions/google-ads.mjs");
const shared = read("../netlify/lib/ad-gen-shared.mjs");

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE BARE WORDS ARE REFUSED, THE PHRASES ARE NOT
// ══════════════════════════════════════════════════════════════════════════════

for (const bad of ["free", "quote", "quotes", "estimate", "estimates", "consultation", "near me", "free quote", "free estimate", "free consultation"]) {
  const [kept, refused] = dropSelfBlockingNegatives([bad]);
  eq(`"${bad}" is refused as a negative`, refused, [bad]);
  eq(`and does not survive into the campaign`, kept, []);
}

for (const good of ["for free", "free download", "free sample", "cheap", "cheapest", "bargain", "discount code", "coupon", "promo code", "jobs", "salary", "tutorial"]) {
  const [kept, refused] = dropSelfBlockingNegatives([good]);
  eq(`"${good}" is still blocked, which is the point`, kept, [good]);
  eq(`and is not refused`, refused, []);
}

// Case and stray punctuation must not be a way past it — these arrive from a model and
// from a text box, neither of which is tidy.
{
  const [kept, refused] = dropSelfBlockingNegatives(["  FREE  ", '"quote"', "[Near Me]", "Free Estimate", "free  quote"]);
  eq("case, spacing and Google's own bracket notation are all caught", kept, []);
  // Reported EXACTLY as they arrived. He has to find the line he typed in a box of 25,
  // and a tidied-up echo is not the line he is looking for.
  eq("and every one is reported the way it was written", refused,
    ["  FREE  ", '"quote"', "[Near Me]", "Free Estimate", "free  quote"]);
}

// The order and the originals survive, because what is reported has to be what he typed.
{
  const [kept, refused] = dropSelfBlockingNegatives(["cheap", "free", "jobs", "quote", "bargain"]);
  eq("the kept terms keep their order", kept, ["cheap", "jobs", "bargain"]);
  eq("the refused ones are reported verbatim", refused, ["free", "quote"]);
}

eq("nothing in, nothing out", dropSelfBlockingNegatives([]), [[], []]);
eq("an absent list does not throw", dropSelfBlockingNegatives(undefined), [[], []]);

// ══════════════════════════════════════════════════════════════════════════════
// 2. THE SEED LIST NO LONGER CARRIES THEM
// ══════════════════════════════════════════════════════════════════════════════
// The guard is the net. The seed list should not need it.

{
  const [, refused] = dropSelfBlockingNegatives(UNIVERSAL_NEGATIVES);
  eq("🔴 the seed list every client starts from blocks nothing it should not", refused, []);
  ok("it still blocks freebie hunters", UNIVERSAL_NEGATIVES.includes("for free") && UNIVERSAL_NEGATIVES.includes("free sample"),
    "dropping the bare word must not mean giving up on the searcher it was aimed at");
  ok("and price shoppers", UNIVERSAL_NEGATIVES.includes("cheap") && UNIVERSAL_NEGATIVES.includes("cheapest"));
  ok("and coupon hunters, which is what bare 'discount' was reaching for",
    UNIVERSAL_NEGATIVES.includes("discount code") && UNIVERSAL_NEGATIVES.includes("coupon"),
    "bare 'discount' also blocks 'bulk discount', which is a buying search for a printer");
  ok("bare 'discount' is gone", !UNIVERSAL_NEGATIVES.includes("discount"));
  ok("and job hunters and students are untouched",
    ["jobs", "salary", "tutorial", "course"].every((t) => UNIVERSAL_NEGATIVES.includes(t)));
}

// The OS keeps its own copy of the list (one file, no imports), and the two must agree.
{
  const uiBlock = os.slice(os.indexOf("const UNIVERSAL_NEGATIVES = ["), os.indexOf("const UNIVERSAL_QUESTIONS"));
  ok("🔴 the OS copy of the seed list is fixed too", !/"free","cheap"/.test(uiBlock) && /"for free"/.test(uiBlock),
    "the OS seeds the box he actually looks at; fixing only the server fixes nothing he sees");
  for (const t of ["for free", "free sample", "cheap", "discount code", "coupon"]) {
    ok(`the OS copy carries "${t}"`, uiBlock.includes(`"${t}"`));
  }
  ok("and the OS copy has no bare 'free' or 'discount'",
    !/"free"/.test(uiBlock) && !/"discount"/.test(uiBlock));
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE REFUSAL SITS WHERE ALL THREE SOURCES ARRIVE
// ══════════════════════════════════════════════════════════════════════════════

ok("the campaign build refuses them", /dropSelfBlockingNegatives\(/.test(google),
  "the box, the model and a learned playbook all reach this one point");
ok("and it imports the shared list rather than keeping a second one",
  /import \{ dropSelfBlockingNegatives \} from "\.\.\/lib\/trade-playbooks\.mjs"/.test(google));
{
  const build = google.slice(google.indexOf("const [negativeKeywords, negativesRefused]"), google.indexOf("const name = String(p.name"));
  ok("the refusal runs on what the CALLER sent, not on a default", /p\.negativeKeywords/.test(build));
}
ok("the generator's output is filtered too", /dropSelfBlockingNegatives\(/.test(shared),
  "a prompt is guidance; the model will write 'free' the moment the wind changes");
ok("and the prompt no longer TELLS it to write 'free'",
  !/beyond the obvious \(free, jobs, salary\)/.test(shared),
  "the schema used to name 'free' as the obvious example of a good negative");
ok("the prompt says why the bare word is wrong", /blocks \\"free quote\\"/.test(shared));

// ══════════════════════════════════════════════════════════════════════════════
// 4. NOTHING IS DROPPED SILENTLY
// ══════════════════════════════════════════════════════════════════════════════
// An instruction that is quietly ignored is how an operator comes to rely on a block
// that does not exist.

ok("the build reports what it refused", /negativesRefused,/.test(google));
ok("the OS reads that back", /const refused=\(d\.negativesRefused\|\|\[\]\)/.test(os));
ok("and says it in the message he reads after building",
  /Not blocked, on purpose: \$\{refused\.join\(", "\)\}/.test(os));
ok("and says WHY, not just what", /which is the button on the landing page/.test(os),
  "a refusal he cannot explain reads as a bug");

// ══════════════════════════════════════════════════════════════════════════════
// 5. THE WHOLE PATH, RUN
// ══════════════════════════════════════════════════════════════════════════════
// The seed list, through a client teaching us a bad one, through the build.

{
  const typedByHand = [...UNIVERSAL_NEGATIVES, "free", "screen print jobs", "free quote"];
  const [kept, refused] = dropSelfBlockingNegatives(typedByHand);
  ok("a bad negative added by hand is still caught at the build", refused.includes("free") && refused.includes("free quote"));
  ok("and the good ones he added survive", kept.includes("screen print jobs"));
  ok("nothing from the seed list is lost on the way through",
    UNIVERSAL_NEGATIVES.every((t) => kept.includes(t)));
}

console.log(`verify-self-blocking-negatives: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
