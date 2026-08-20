// Nothing BoldLine writes may contain a dash used as a sentence connector.
// Run: node tests/verify-no-dashes.mjs
//
// Bryson, 2026-08-14: no copy may read as AI-written, and the em dash is the tell he named.
// Bryson, 2026-08-20: "make sure for all of the ad copy for my ads and clients and anything
// we write that we avoid using - because it makes it seem ai written."
//
// TWO THINGS WERE WRONG, and the second is the one that let it keep reaching him.
//
// 1. THE PLAIN HYPHEN WAS NEVER CAUGHT. Every implementation matched only "—" and "–", so
//    "Roof repair - done right" shipped untouched. That is the same tell wearing the
//    character that is actually on a keyboard, which is why a model reaches for it most.
//
// 2. NINE OF THIRTEEN MODEL-WRITING SURFACES CLEANED NOTHING AT ALL and relied on the
//    prompt. Among them: the LANDING PAGE writer, the CLIENT REPORT writer, and the audit
//    email sent to prospects. A prompt is guidance. This suite pins the guarantee.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { humanize, humanizeDeep, NO_DASH_RULE } from "../netlify/lib/humanize.mjs";

let n = 0; const fails = [];
const t = (name, fn) => { try { fn(); n++; } catch (e) { fails.push(`${name}: ${e.message}`); } };

// ── The character itself ───────────────────────────────────────────────────
t("a spaced hyphen is treated as a dash", () => {
  assert.equal(humanize("Roof repair - done right"), "Roof repair. Done right");
  assert.equal(humanize("We fix roofs -- fast"), "We fix roofs. Fast");
});

t("em and en dashes still go", () => {
  assert.equal(humanize("Steady leads — not luck"), "Steady leads. Not luck");
  assert.equal(humanize("Fast service – guaranteed"), "Fast service. Guaranteed");
  // The first letter of the whole string is deliberately left as written: we do not know
  // whether it starts a sentence, and force-capitalising it would break "e-commerce brands".
  assert.equal(humanize("word—word"), "word. Word");
});

t("a dash at either end is dropped, not converted", () => {
  assert.equal(humanize("Trailing dash -"), "Trailing dash");
  assert.equal(humanize("- Leading dash"), "Leading dash");
  assert.equal(humanize("— Leading long dash"), "Leading long dash");
});

// 🔴 THE HALF THAT MATTERS MORE. A blanket find-and-replace would wreck all of this, and
// the damage would be invisible until a client noticed their phone number was mangled.
t("hyphens inside words are untouchable", () => {
  for (const s of [
    "Done-for-you ad management",
    "No-obligation quote",
    "24-hour emergency service",
    "e-commerce brands",
    "day-to-day running",
    "Call 602-555-0199 today",
    "Conversion id AW-18269689296",
    "act_1045064901242944",
    "1080x1920 story size",
    "State-of-the-art equipment",
  ]) {
    assert.equal(humanize(s), s, `mangled: ${s}`);
  }
});

t("a bullet on its own line is not swallowed into prose", () => {
  const src = "Why us:\n- Fast\n- Honest\n- Straight answers";
  assert.equal(humanize(src), src,
    "using \\s instead of horizontal whitespace turns a list into a paragraph");
});

// ── The two join styles ────────────────────────────────────────────────────
t("prose joins with a comma, ad copy with a full stop", () => {
  assert.equal(humanize("We run your ads - and the pages behind them", { join: ", " }),
    "We run your ads, and the pages behind them");
  assert.equal(humanize("We run your ads - and the pages behind them"),
    "We run your ads. And the pages behind them");
});

t("no double punctuation is left behind", () => {
  assert.ok(!/\.\s*\./.test(humanize("Done. - Next thing")));
  assert.ok(!/,\s*,/.test(humanize("Done, - next thing", { join: ", " })));
});

t("non-strings pass through untouched", () => {
  assert.equal(humanize(null), null);
  assert.equal(humanize(42), 42);
  assert.equal(humanize(undefined), undefined);
});

t("humanizeDeep reaches nested strings and leaves structure alone", () => {
  const out = humanizeDeep({
    a: "Roof repair - fast", b: [{ c: "Leads — not luck" }], n: 7, ok: true,
  });
  assert.equal(out.a, "Roof repair. Fast");
  assert.equal(out.b[0].c, "Leads. Not luck");
  assert.equal(out.n, 7);
  assert.equal(out.ok, true);
});

// ── Every surface that writes copy must clean AND instruct ────────────────
// Discovered from the source, not listed by hand: a new copy-writing function added later
// is caught automatically instead of quietly shipping dashes.
const FN_DIRS = ["../netlify/functions", "../netlify/lib"];
const writers = [];
for (const dir of FN_DIRS) {
  for (const f of readdirSync(new URL(dir + "/", import.meta.url))) {
    if (!f.endsWith(".mjs") || f === "humanize.mjs") continue;
    const src = readFileSync(new URL(`${dir}/${f}`, import.meta.url), "utf8");
    if (/anthropic\.messages\.create|runTool\(/.test(src)) writers.push([f, src]);
  }
}

t("the surfaces were actually found", () => {
  assert.ok(writers.length >= 12, `only found ${writers.length} copy-writing surfaces`);
});

for (const [name, src] of writers) {
  t(`${name} cleans what the model returns`, () => {
    // 🔴 IMPORT LINES ARE STRIPPED FIRST. The first version of this matched the word
    // "humanize" anywhere in the file, so it happily matched the leftover `import` after
    // the actual CALL was deleted — a test that could not fail, guarding the thing this
    // whole suite exists for. Found by deliberately breaking generate-landing.
    const body = src.split("\n").filter((l) => !/^\s*import\s/.test(l)).join("\n");
    const cleans = /\b(humanize|humanizeDeep|stripDashes|deDash|cleanGoogle|cleanMeta|cleanCreatives)\s*\(/.test(body);
    assert.ok(cleans, "model output reaches a reader without any dash cleaning");
  });
  t(`${name} tells the model the rule`, () => {
    // Either its own copy of the rule, or it inherits one of the shared prompt builders.
    const has = /NEVER use a dash|NO_DASH_RULE|systemFor\(|VOICE/.test(src);
    assert.ok(has, "relies on the code alone; a model mirrors the style of its prompt");
  });
}

// ── The rule text itself has to name the plain hyphen ─────────────────────
// The old wording said "em dash or en dash", which a model can read as permission to use
// "-" instead. That is very likely how this kept happening.
t("the shared rule names all three characters", () => {
  assert.ok(/em dash/i.test(NO_DASH_RULE));
  assert.ok(/en dash/i.test(NO_DASH_RULE));
  assert.ok(/plain hyphen/i.test(NO_DASH_RULE), "the spaced hyphen is the one that kept slipping through");
  assert.ok(/INSIDE a word are fine/i.test(NO_DASH_RULE),
    "without this the model avoids done-for-you and no-obligation too");
});

// ── The OS carries its own copy, and it must behave identically ──────────
t("the browser-side humanizer matches the server", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const i = src.indexOf("const humanizeAdCopy =");
  const j = src.indexOf("\n  .trim();", i) + "\n  .trim();".length;
  assert.ok(i > 0 && j > i, "humanizeAdCopy not found in index.html");
  const { humanizeAdCopy } = new Function(src.slice(i, j) + "\nreturn { humanizeAdCopy };")();

  assert.equal(humanizeAdCopy("Roof repair - done right"), "Roof repair. Done right");
  assert.equal(humanizeAdCopy("Steady leads — not luck"), "Steady leads. Not luck");
  assert.equal(humanizeAdCopy("We fix roofs -- fast"), "We fix roofs. Fast");
  // and the same things must survive
  for (const s of ["Done-for-you ads", "24-hour service", "Call 602-555-0199", "no-obligation quote"]) {
    assert.equal(humanizeAdCopy(s), s, `OS side mangled: ${s}`);
  }
});

// ── No hardcoded dash may sit in client-facing copy ──────────────────────
// One was found in the prospect audit email's footer: "BoldLine Media &mdash; ...".
t("no client-facing template hardcodes an em dash", () => {
  const offenders = [];
  for (const [name, src] of writers) {
    for (const m of src.matchAll(/^(?!\s*\/\/).*&mdash;|&ndash;/gm)) {
      offenders.push(`${name}: ${String(m[0]).trim().slice(0, 60)}`);
    }
  }
  assert.equal(offenders.length, 0, `hardcoded dash entity in copy: ${offenders.join("; ")}`);
});

console.log(fails.length ? `✕ ${fails.length} failed, ${n} passed\n  ` + fails.join("\n  ")
  : `✓ verify-no-dashes: ${n} checks passed`);
process.exit(fails.length ? 1 : 0);
