// 🔴 NOTHING ON A LANDING PAGE MAY BE LEFT ALONE ON A ROW.
//
// Bryson, 2026-09-01, with a screenshot: *"remember make sure everything is uniform and
// looks good."* The page had four benefits. Three sat across one row and the fourth hung
// by itself under the left edge, next to a wide empty gap. It reads like the page broke.
//
// The cause was a grid pinned to `repeat(3,1fr)` no matter how many items the copy writer
// produced, and the copy writer is asked for "3-4 benefits". So a stranded fourth was the
// COMMON case, not an edge case, and it would have kept happening on every client page.
//
// The fix makes the column count follow the item count. This file is what stops it coming
// back, and it checks the thing that actually decides the layout: THE RESOLVED CASCADE.
// The first attempt at the fix looked correct in the source and did nothing at all, because
// the four-across rule was written ABOVE the two-across rule. Same specificity, so source
// order decides, and the later rule silently won. Reading the file would not have caught
// that; only resolving the cascade the way a browser does catches it.
//
// So: render the REAL page, pull the REAL stylesheet out of it, resolve which
// `grid-template-columns` actually wins at each screen width, and do the arithmetic.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderLandingPage } from "../netlify/functions/landing.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

// The four widths every BoldLine surface has to look intentional at.
const WIDTHS = [390, 768, 1280, 1600];
const STYLES = ["cards", "numbered", "list"];
const ITEM_CLASS = { cards: "bcard", numbered: "bnum", list: "brow" };
const WRAP_CLASS = { cards: "bene", numbered: "benum", list: "belist" };

const BULLETS = [
  "Same day quotes: you hear back before the end of the day, not next week",
  "Licensed and insured: every job is covered, no exceptions",
  "Fixed pricing: the number we quote is the number you pay",
  "Real crews: the same team from start to finish",
  "Two year warranty: we come back if anything goes wrong",
  "No pushy sales: a number and a date, that is it",
];

const render = (style, n, extra = {}) =>
  renderLandingPage({
    name: "Stencil and Thread",
    brandColor: "#C8A84B",
    landingPage: {
      headline: "Custom work, done right the first time",
      subheadline: "Tell us what you need and we come back with a real number today.",
      bullets: BULLETS.slice(0, n),
      ctaText: "Get my quote",
      design: { benefits: style, layout: "split", order: "a", background: "clean", shape: "rounded", font: "modern", motion: "up", ...extra },
    },
  });

// ── A very small CSS cascade, enough to answer one question honestly ──────────
// Walks the stylesheet in source order and keeps the LAST `grid-template-columns`
// whose media query applies at `width` and whose selector matches the wrapper's
// classes. That last-one-wins step is the whole reason this file exists.
function parseRules(css) {
  const rules = [];
  // Strip comments first so a selector inside one cannot be mistaken for a rule.
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /@media([^{]+)\{([\s\S]*?)\n?\}\n|([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    if (m[1] != null) {
      const cond = m[1].trim();
      const inner = /([^{}]+)\{([^{}]*)\}/g;
      let x;
      while ((x = inner.exec(m[2]))) rules.push({ media: cond, sel: x[1].trim(), body: x[2] });
    } else {
      rules.push({ media: null, sel: m[3].trim(), body: m[4] });
    }
  }
  return rules;
}

// Only the two forms this stylesheet actually uses. Anything else is a loud failure
// rather than a quiet wrong answer.
function mediaApplies(cond, width) {
  if (!cond) return true;
  if (/prefers-reduced-motion|prefers-color-scheme|print/.test(cond)) return false;
  let applies = true, saw = false;
  for (const m of cond.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)) {
    saw = true;
    applies = applies && (m[1] === "min" ? width >= +m[2] : width <= +m[2]);
  }
  if (!saw) throw new Error(`cannot evaluate media query: ${cond}`);
  return applies;
}

// `.bene.g4` matches a wrapper carrying both classes. Descendant / child selectors
// are not used on these wrappers, so a simple class-set test is exact here.
const selectorMatches = (sel, classes) =>
  sel.split(",").some((one) => {
    const s = one.trim();
    if (!/^\.[A-Za-z0-9_.-]+$/.test(s)) return false;
    return s.slice(1).split(".").every((c) => classes.includes(c));
  });

function columnsFor(css, classes, width) {
  let cols = null, isGrid = false;
  for (const r of parseRules(css)) {
    if (!mediaApplies(r.media, width)) continue;
    if (!selectorMatches(r.sel, classes)) continue;
    if (/(?:^|;)\s*display\s*:\s*grid\b/.test(r.body)) isGrid = true;
    const g = /(?:^|;)\s*grid-template-columns\s*:\s*([^;}]+)/.exec(r.body);
    if (g) cols = g[1].trim();
  }
  // A grid with no explicit template is one implicit column. That is how the plain
  // list style is laid out, and it is a real answer, not a missing one.
  if (cols == null) return isGrid ? 1 : null;
  const rep = /^repeat\(\s*(\d+)\s*,/.exec(cols);
  if (rep) return +rep[1];
  return cols.split(/\s+/).filter(Boolean).length; // "1fr" -> 1
}

const styleOf = (html) => {
  const m = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!m) throw new Error("rendered page has no <style> block");
  return m[1];
};

const classesOf = (html, wrap) => {
  const m = new RegExp(`class="(${wrap}(?: [A-Za-z0-9_-]+)*)"`).exec(html);
  return m ? m[1].split(/\s+/) : null;
};

// ── 1. 🔴 THE RULE: no lone item on a final row, at any width, any count ──────
{
  for (const style of STYLES) {
    for (let n = 1; n <= 6; n++) {
      const html = render(style, n);
      const css = styleOf(html);
      const classes = classesOf(html, WRAP_CLASS[style]);
      ok(`${style} ${n}: wrapper renders`, !!classes, "no wrapper element found in the page");
      if (!classes) continue;

      // The items really are all there. Without this, a grid that renders nothing
      // would sail through every column assertion below.
      const items = (html.match(new RegExp(`class="${ITEM_CLASS[style]} `, "g")) || []).length;
      ok(`${style} ${n}: renders ${n} items`, items === n, `rendered ${items}`);

      for (const w of WIDTHS) {
        const cols = columnsFor(css, classes, w);
        ok(`${style} ${n} @${w}: has a column count`, cols != null, `classes ${classes.join(".")} match no grid rule`);
        if (cols == null) continue;
        const rows = Math.ceil(n / cols);
        const last = n - (rows - 1) * cols;
        ok(
          `${style} ${n} @${w}: no item left alone (${cols} cols)`,
          !(cols > 1 && rows > 1 && last === 1),
          `${n} items in ${cols} columns leaves ${last} alone on row ${rows}`,
        );
      }
    }
  }
}

// ── 2. The four-across rule is REACHED, not just written ─────────────────────
// This is the assertion that would have failed on the first attempt at the fix.
{
  const html = render("cards", 4);
  const css = styleOf(html);
  const classes = classesOf(html, "bene");
  ok("four cards go two-by-two on a tablet", columnsFor(css, classes, 768) === 2, `got ${columnsFor(css, classes, 768)}`);
  ok("four cards open to four across on a wide screen", columnsFor(css, classes, 1280) === 4, `got ${columnsFor(css, classes, 1280)}`);
  // Numbered benefits lay out sideways and are deliberately left at two.
  const nhtml = render("numbered", 4);
  const ncls = classesOf(nhtml, "benum");
  ok("four numbered benefits stay two-by-two when wide", columnsFor(styleOf(nhtml), ncls, 1600) === 2, `got ${columnsFor(styleOf(nhtml), ncls, 1600)}`);
}

// ── 3. Everything stacks on a phone ──────────────────────────────────────────
{
  for (const style of STYLES) {
    const html = render(style, 4);
    ok(`${style} stacks at 390px`, columnsFor(styleOf(html), classesOf(html, WRAP_CLASS[style]), 390) === 1);
  }
}

// ── 4. 🔴 BREAK EVERY GUARD ONCE ─────────────────────────────────────────────
// A checker that cannot fail is not a checker. Each mutation below is a real way
// this could regress, applied to the real stylesheet, and each must be caught.
{
  const html = render("cards", 4);
  const css = styleOf(html);
  const classes = classesOf(html, "bene");

  const strandsSomething = (mutated) => {
    for (const w of WIDTHS) {
      const cols = columnsFor(mutated, classes, w);
      if (cols == null) return true;
      const rows = Math.ceil(4 / cols);
      if (cols > 1 && rows > 1 && 4 - (rows - 1) * cols === 1) return true;
    }
    return false;
  };

  ok("sanity: the real stylesheet strands nothing", !strandsSomething(css));

  // (a) The original bug: one fixed three-column grid for every count.
  const backToThree = css.replace(/\.bene\.g2[^}]*\}/, ".bene.g2,.bene.g3,.bene.g4,.bene.g5{grid-template-columns:repeat(3,1fr)}");
  ok("caught: a grid pinned to three columns", strandsSomething(backToThree), "the original stranded-fourth bug went undetected");

  // (b) The near miss: the four-across rule written before the two-across rule,
  //     where it loses on source order and never applies. Nothing strands here,
  //     so check the thing that actually went wrong: the rule stops being reached.
  const wide = /@media\(min-width:1100px\)\{[^}]*\}\}/.exec(css);
  ok("the wide rule exists to be moved", !!wide);
  if (wide) {
    const moved = css.replace(wide[0], "").replace("@media(min-width:720px)", wide[0] + "@media(min-width:720px)");
    ok("caught: the wide rule moved above the rule it must beat", columnsFor(moved, classes, 1280) !== 4, "source order was not honoured, so the check is not resolving the cascade");
  }

  // (c) The wrapper stops carrying a count class at all.
  const noClass = classesOf(html.replace('class="bene g4"', 'class="bene"'), "bene");
  ok("caught: the count class dropped off the wrapper", (() => { const c = columnsFor(css, noClass, 1280); return c === null || c === 1; })(), `still resolved to ${columnsFor(css, noClass, 1280)} columns`);

  // (d) The count class stops tracking the item count.
  const wrongClass = classesOf(render("cards", 4).replace('class="bene g4"', 'class="bene g3"'), "bene");
  ok("caught: four items labelled as three", (() => { const c = columnsFor(css, wrongClass, 1280); return c === 3; })(), "the class no longer drives the column count, so the mapping is untested");
}

// ── 5. The mapping is driven by the count, not hard coded per style ──────────
{
  const seen = {};
  for (let n = 1; n <= 6; n++) seen[n] = classesOf(render("cards", n), "bene").find((c) => /^g\d$/.test(c));
  ok("one item", seen[1] === "g1", seen[1]);
  ok("two items", seen[2] === "g2", seen[2]);
  ok("three items", seen[3] === "g3", seen[3]);
  ok("four items", seen[4] === "g4", seen[4]);
  ok("five items", seen[5] === "g5", seen[5]);
  ok("six items falls back to three across", seen[6] === "g3", seen[6]);
  // Six in three columns is two full rows, which is exactly why it is allowed to.
  ok("six items strand nothing", 6 % 3 === 0);
}

console.log(fail ? `\n✗ landing grid: ${pass} passed, ${fail} FAILED` : `✓ landing grid: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
