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

// ── 🔴 WHERE A CLIENT'S PHOTOS GO, AND WHETHER THEY ALL GET USED ────────────────
// Bryson, 2026-09-02: *"make sure on the see the results page that there is at least
// 4-6 good images and if there is less to make sure that they are all used [...] right
// now in the header for one of the landing pages there is a background image of a
// T-shirt which doesn't make sense."*
//
// Stencil and Thread uploaded three t-shirt photos and got both halves of that wrong:
// one shirt stretched full-bleed behind the headline, and only two left for the gallery.
{
  const P = (n) => ({ category: "photo", url: `https://example.com/${n}.jpg`, path: n });
  const shoot = (media, layout, extra = {}) => renderLandingPage({
    name: "Stencil and Thread", brandColor: "#C8A84B", mediaLibrary: media, ...extra,
    campaignSetup: { mainOffer: "Custom shirts", targetLocations: "Oregon" },
    landingPage: { headline: "H", subheadline: "S", bullets: ["a: b", "c: d", "e: f"], ctaText: "Go",
      ...(extra.landingPage || {}),
      design: { layout, benefits: "cards", background: "clean", shape: "rounded", font: "modern", motion: "up", order: "a" } },
  });
  const laidOut = (html) => ((/<body class="([^"]+)"/.exec(html) || [])[1] || "").split(/\s+/).find((c) => c.startsWith("lay-"));
  const inGallery = (html) => (html.match(/class="gitem reveal"/g) || []).length;

  const three = [P("a"), P("b"), P("c")];

  // 🔴 His case. An uploaded product shot never becomes wallpaper, whatever layout the
  // design picked, because the page cannot tell a shirt from a scene and a shirt behind
  // a headline is the failure he actually looked at.
  for (const layout of ["overlay", "split", "centered", "capture"]) {
    const html = shoot(three, layout);
    ok(`${layout}: three product photos never become a full-bleed background`,
      laidOut(html) !== "lay-overlay", laidOut(html));
    ok(`${layout}: and all three are used in the gallery`, inGallery(html) === 3, `${inGallery(html)} shown`);
  }

  // With a real set there is one to spare, so the hero takes one and the gallery still fills.
  const six = ["a", "b", "c", "d", "e", "f"].map(P);
  const wide = shoot(six, "overlay");
  ok("six photos do allow the full-bleed hero", laidOut(wide) === "lay-overlay", laidOut(wide));
  ok("and the gallery still gets five of them", inGallery(wide) === 5, `${inGallery(wide)} shown`);

  // 🔴 The gallery grid follows its own count, or four photos give three across and one
  // stranded, which is the bug already fixed once on the benefits grid.
  const css = styleOf(shoot(three, "split"));
  // 🔴 Tied to what the gallery ACTUALLY RENDERS, not to how many were uploaded. A first
  // version compared against the upload count and failed on five, because at five the hero
  // takes one and the gallery shows four. The assertion was wrong, not the page, and an
  // assertion that restates the fixture instead of the output is worth nothing anyway.
  const WANT = { 1: "g1", 2: "g2", 3: "g3", 4: "g4", 5: "g5", 6: "g3" };
  for (const n of [2, 3, 4, 5, 6]) {
    const html = shoot(["a", "b", "c", "d", "e", "f"].slice(0, n).map(P), "split");
    const shown = inGallery(html);
    const cls = ((/class="gal (g\d)"/.exec(html)) || [])[1];
    ok(`${n} uploaded: the gallery grid matches the ${shown} it shows`, cls === WANT[shown],
      `shows ${shown}, asks for ${cls}, expected ${WANT[shown]}`);
  }
  ok("the stylesheet answers to those gallery classes", /\.gal\.g2,\.gal\.g4\{/.test(css) && /\.gal\.g3,\.gal\.g5\{/.test(css));

  // 🔴 BREAK IT ONCE. Without the count gate, three uploads go back to being wallpaper.
  ok("sanity: the gate is what stops it", laidOut(shoot(three, "overlay")) === "lay-split");
}

// ── 🔴 A LONE PHOTO ON THE LAST ROW SITS IN THE MIDDLE ──────────────────────────
// Bryson, 2026-09-02, with a screenshot of Stencil and Thread's three shirts: *"make
// sure when there is 3 images the one one the bottom is in the middle and everything is
// uniform and formatted."* Two on top, the third hard against the left edge with a hole
// beside it.
//
// The earlier gallery fix only sized the grid from 720px up. The gallery is the ONLY grid
// on this page with a TWO-COLUMN BASE, so it is the only one where an odd count strands an
// item on a phone, and a phone is exactly what the in-app preview renders at. The benefits,
// steps and reviews all stack single-column down there and cannot hit this.
//
// The rule: at any width and any count, the last row either holds more than one item, or
// its single item is centred. Checked through the resolved cascade, not by reading a rule.
{
  const P = (n) => ({ category: "photo", url: "https://example.com/" + n + ".jpg", path: n });
  const gal = (n) => renderLandingPage({
    name: "Stencil and Thread", brandColor: "#C8A84B",
    mediaLibrary: "abcdef".slice(0, n).split("").map(P),
    campaignSetup: { mainOffer: "Shirts", targetLocations: "Oregon" },
    landingPage: { headline: "H", subheadline: "S", bullets: ["a: b", "c: d", "e: f"], ctaText: "Go",
      design: { layout: "split", benefits: "cards", background: "clean", shape: "rounded", font: "modern", motion: "up", order: "a" } },
  });

  for (let n = 2; n <= 6; n++) {
    const html = gal(n);
    const css = styleOf(html);
    const classes = classesOf(html, "gal");
    const shown = (html.match(/class="gitem reveal"/g) || []).length;
    ok(`${n} uploaded: the gallery renders`, !!classes && shown >= 2, `${shown} shown`);
    if (!classes || shown < 2) continue;

    for (const w of WIDTHS) {
      const cols = columnsFor(css, classes, w);
      ok(`gallery ${shown} @${w}: has a column count`, cols != null, classes.join("."));
      if (cols == null) continue;
      const rows = Math.ceil(shown / cols);
      const last = shown - (rows - 1) * cols;
      if (!(cols > 1 && rows > 1 && last === 1)) continue;
      // A lone trailing item exists at this width, so the centring rule has to reach it.
      // Resolved the same way the browser does: last matching rule wins.
      let centred = false;
      for (const r of parseRules(css)) {
        if (!mediaApplies(r.media, w)) continue;
        const sel = r.sel.split(",").map((x) => x.trim());
        if (!sel.some((x) => classes.every((c) => x.includes("." + c) || c === "gal") && /:last-child/.test(x) && x.includes("." + classes[1]))) continue;
        centred = /justify-self:\s*center/.test(r.body);
      }
      ok(`gallery ${shown} @${w}: the lone last photo is centred, not left`, centred,
        `${shown} photos in ${cols} columns leaves one alone and nothing centres it`);
    }
  }

  // 🔴 BREAK IT ONCE. Without the centring rule the third shirt goes back to the left edge.
  const css = styleOf(gal(3));
  const stripped = css.replace(/\.gal\.g3>:last-child,\.gal\.g5>:last-child\{grid-column:1\/-1;justify-self:center;width:calc\(50% - 6px\)\}/, "");
  ok("the centring rule exists to be removed", stripped !== css);
  ok("caught: the lone photo pushed back to the left edge",
    !/\.gal\.g3>:last-child[^}]*justify-self:center/.test(stripped),
    "three photos would strand the third against the left edge again with nothing to say so");

  // And it must be undone where three go across, or the last photo shrinks for no reason.
  ok("the centring is undone at the width where three fit across",
    /@media\(min-width:720px\)[^@]*\.gal\.g3>:last-child,\.gal\.g5>:last-child\{grid-column:auto/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
    "a centred half-width photo would float in the middle of a three-across row");
}

console.log(fail ? `\n✗ landing grid: ${pass} passed, ${fail} FAILED` : `✓ landing grid: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
