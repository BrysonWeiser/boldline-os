// What the marketing site tells anyone who presses View Source.
// Run: node tests/verify-public-source.mjs
//
// 🔴 THE MARKETING SITE IS SERVED RAW. There is no build step and no minifier: `publish = "."`.
// So every HTML, CSS and JS comment written into those files is delivered, verbatim, to every
// visitor and every competitor, and is indexed along with the page.
//
// This was found on 2026-09-20 while confirming a copy change had reached the live site. A grep
// of boldlinemedia.com for the OLD founder quote still matched, because the comment explaining
// why it had been replaced quoted it word for word and carried the owner's private view that it
// was weak. Pulling that thread found worse:
//
//   • The plan recommender explained that one product is deliberately NOT advertised, and why,
//     which tells a reader there is an unlisted offer and hands them the reason to ask for it.
//   • The ads landing page documented its own past lead-tracking failures, with dates, on the
//     page where paid social traffic lands.
//   • A comment beside the hero form quoted real campaign numbers from a previous version.
//
// None of it was visible on the page. All of it was one keystroke away.
//
// 🔴 THE RULE, AND WHY IT IS DRAWN HERE. Technical notes about how the code works are welcome and
// several are load-bearing. What may not ship is the REASONING: who asked for something and in
// what words, what was tried and failed, what is deliberately not being advertised, and what a
// campaign actually produced. That belongs in `knowledge/`, which is exactly what it is for.
//
// Two markers, both crisp, because a fuzzy rule about "internal-sounding" text would either miss
// things or cry wolf until it was switched off:
//   1. A person's name inside a comment. Visible copy may name the founder all it likes.
//   2. A date inside a comment. In this repo a date in a comment is always an incident note.
//
// The OS (`index.html` at the root) is deliberately NOT checked: it is behind a login, and its
// comments are the durable record of why it works the way it does.

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

// Everything the public can read that is NOT rendered on the page.
// Three shapes, because the files mix HTML, CSS and JS:
//   • <!-- ... --> blocks, which span lines
//   • /* ... */ blocks, likewise
//   • lines whose first non-space characters are // or *
// A line-start test for `//` matters: an inline "https://" is not a comment, and treating one
// as a comment would flag every URL on the site.
const commentsOf = (src) => {
  const out = [];
  for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) out.push(m[0]);
  for (const m of src.matchAll(/\/\*[\s\S]*?\*\//g)) out.push(m[0]);
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*")) out.push(t);
  }
  return out;
};

const PAGES = [
  ["the homepage", "marketing-site/index.html"],
  ["the ads landing page", "marketing-site/get-started/index.html"],
];

// Proof the reader works before anything is asserted with it. A commentsOf that returned []
// would make every check below pass while the file was full of leaks.
{
  const probe = commentsOf(`<p>hi https://x.test/a</p>\n<!-- html note -->\n/* css note */\n  // js note\n`);
  ok("the comment reader finds all three shapes",
    probe.some((c) => c.includes("html note")) && probe.some((c) => c.includes("css note"))
    && probe.some((c) => c.includes("js note")), JSON.stringify(probe));
  ok("🔴 and does not treat a URL as a comment",
    !probe.some((c) => c.includes("x.test")),
    "every link on the site would be scanned as internal text");
  ok("and it finds plenty on the real pages",
    PAGES.every(([, f]) => commentsOf(readFileSync(join(ROOT, f), "utf8")).length > 20));
}

for (const [where, file] of PAGES) {
  const comments = commentsOf(readFileSync(join(ROOT, file), "utf8"));

  // 1. No names. The founder is named in the page's VISIBLE copy on purpose, in the signature
  //    under his quote and in the image alt text. A comment is a different thing: it is a note
  //    to ourselves, and shipping it attributes an internal opinion to a real person in public.
  const named = comments.filter((c) => /\bBryson\b/i.test(c));
  ok(`🔴 no comment on ${where} names him`, named.length === 0,
    named.map((c) => c.replace(/\s+/g, " ").slice(0, 110)).join("\n        "));

  // 2. No dated incident notes. Every one of these in this repo reads "on <date> this broke",
  //    which is a public admission of a past failure on a page we buy traffic to.
  const dated = comments.filter((c) => /\b20\d\d-\d\d-\d\d\b/.test(c));
  ok(`🔴 no comment on ${where} carries an incident date`, dated.length === 0,
    dated.map((c) => c.replace(/\s+/g, " ").slice(0, 110)).join("\n        "));

  // 3. The specific leaks that started this. Pinned by name so they cannot come back wearing
  //    different words, and because each one is a distinct kind of harm.
  const all = comments.join("\n");
  ok(`🔴 ${where} does not reveal an unadvertised product`,
    !/not (named|advertised) here on purpose/i.test(all) && !/dont want to advertise/i.test(all),
    "this tells a reader there is an offer we are holding back, and invites them to ask for it");
  ok(`🔴 ${where} does not quote real campaign numbers`,
    !/\b\d+ of them read the old version\b/i.test(all) && !/not one got in touch/i.test(all),
    "a prospect should not be able to read how a previous version of this page performed");
  ok(`${where} does not carry superseded copy`,
    !/roster small on purpose/i.test(all),
    "the old pitch, quoted verbatim, still matches a search of the live site");
}

// The rule is only worth having if the reasoning went somewhere. Each cleaned comment points at
// the entry that now holds it, so the next person editing that code can still find out why.
{
  const home = readFileSync(join(ROOT, "marketing-site/index.html"), "utf8");
  const ads = readFileSync(join(ROOT, "marketing-site/get-started/index.html"), "utf8");
  // Checked by ENTRY NAME, not by the words around it, so a comment may say "KB `x`" or
  // "the knowledge base (`x`)" and still count. The point is that the reason is findable.
  const points = (src, ...entries) => entries.every((e) => new RegExp("`" + e + "`").test(src));
  ok("the stripped reasoning points at the knowledge base rather than vanishing",
    points(home, "pricing-model", "site-copy-voice", "os-calendar")
    && points(ads, "lead-double-count", "ads-page-conversion"),
    "a comment deleted with nowhere to look it up is how the reason gets lost");

  // And those entries have to exist, or the pointer is worse than nothing: it sends the next
  // person looking for a file that was never written.
  const { existsSync } = await import("node:fs");
  const named = [...(home + ads).matchAll(/`([a-z][a-z0-9-]{3,})`/g)].map((m) => m[1]);
  const missing = [...new Set(named)].filter((n) => !existsSync(join(ROOT, "knowledge", n + ".md")));
  ok("🔴 every entry a comment points at actually exists", missing.length === 0, missing.join(", "));
}

console.log(`verify-public-source: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
