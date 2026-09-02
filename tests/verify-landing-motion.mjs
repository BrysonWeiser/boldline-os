// 🔴 MICRO MOTION MUST NEVER BE LOAD-BEARING.
//
// Bryson, 2026-09-02: *"can we also add micro animations so they dont feel stale (do this
// for every one)"*. Motion is the easiest thing in this whole project to add badly, because
// a broken animation does not look broken. It looks like a blank section, and it looks that
// way only to the people it breaks for, which is nobody testing it.
//
// This file holds the two rules the motion layer lives by, and checks them against the REAL
// rendered page rather than against the source.
//
//   1. NOTHING RESTS INVISIBLE. Every element's resting state is its finished state. Motion
//      is layered on top. So a visitor with JavaScript off, an animation that never fires,
//      and a visitor whose system asks for reduced motion all get a complete page. The lone
//      exception is `.reveal`, which is gated on the `.js` class, backed by a 1.5s safety net
//      and explicitly unwound under reduced motion. This file pins all three of those.
//      🔴 This is not hypothetical: scroll reveals already left whole sections blank on this
//      exact page once, in any context that does not scroll, and it took a screenshot to find.
//   2. ANYTHING THAT LOOPS ANIMATES TRANSFORM OR OPACITY ONLY. Those two the browser hands
//      to the graphics card. Animating width, height, top, left or background-position makes
//      it re-measure the page on every frame forever, which reads as a stutter while somebody
//      is reading the page we are paying for clicks to.
//
// It also catches the failure that has bitten this file most often: an animation that is
// written, looks right, and never runs, because the name does not match a @keyframes block
// or because a later rule of equal weight quietly wins.

import { renderLandingPage } from "../netlify/functions/landing.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const LAYOUTS = ["split", "centered", "overlay", "capture"];
const BENEFITS = ["cards", "list", "numbered"];

const FULL = {
  name: "Stencil and Thread",
  brandColor: "#C8A84B",
  callTrackingNumber: "602 555 0134",
  campaignSetup: { serviceArea: "Gilbert, Arizona", mainOffer: "Free quote this week" },
  brandVoice: { differentiator: "Same crew start to finish" },
  reviews: "They turned it around in two days — Dana R.\nStraightforward pricing — Marcus L.",
  mediaLibrary: [
    { category: "photo", url: "https://example.com/hero.jpg", path: "h" },
    { category: "photo", url: "https://example.com/a.jpg", path: "a" },
    { category: "photo", url: "https://example.com/b.jpg", path: "b" },
    { category: "photo", url: "https://example.com/c.jpg", path: "c" },
  ],
  landingPage: {
    headline: "Custom work, done right the first time",
    subheadline: "Tell us what you need and we come back with a real number today.",
    bullets: [
      "Same day quotes: you hear back before the end of the day",
      "Licensed and insured: every job is covered",
      "Fixed pricing: the number we quote is the number you pay",
      "Real crews: the same team from start to finish",
    ],
    steps: ["Tell us what you need", "We send a real number", "We book the date"],
    faqs: [{ q: "How fast can you start?", a: "Most jobs begin within a week." }, { q: "Do you charge for quotes?", a: "No, quotes are free." }],
    ctaText: "Get my quote",
  },
};

const render = (design = {}, over = {}) =>
  renderLandingPage({ ...FULL, ...over, landingPage: { ...FULL.landingPage, ...(over.landingPage || {}), design: { layout: "split", benefits: "cards", background: "glowgrid", shape: "rounded", font: "modern", motion: "up", order: "a", ...design } } });

const styleOf = (html) => {
  const m = /<style>([\s\S]*?)<\/style>/.exec(html);
  if (!m) throw new Error("rendered page has no stylesheet");
  return m[1];
};
const scriptOf = (html) => {
  // The one inline script at the end of the body, which is what a hand-off client's own
  // developer opens and what every visitor's browser runs.
  const m = /<script>\n\(function\(\)\{([\s\S]*?)\}\)\(\);/.exec(html);
  return m ? m[1] : "";
};

// ── A small CSS reader. Comments are stripped first so prose about a rule can never
//    be mistaken for the rule, which has already caused a false pass in this repo. ──
function parseRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  const re = /@media([^{]+)\{([\s\S]*?)\n?\}\n|@keyframes\s+([A-Za-z0-9_-]+)\s*\{([\s\S]*?\n?)\}\n|([^{}@]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    if (m[1] != null) {
      const inner = /([^{}]+)\{([^{}]*)\}/g;
      let x;
      while ((x = inner.exec(m[2]))) rules.push({ kind: "rule", media: m[1].trim(), sel: x[1].trim(), body: x[2] });
    } else if (m[3] != null) {
      rules.push({ kind: "keyframes", name: m[3], body: m[4] });
    } else {
      rules.push({ kind: "rule", media: null, sel: m[5].trim(), body: m[6] });
    }
  }
  return rules;
}

// Every animation shorthand or animation-name in the sheet, with whether it loops.
function animationsUsed(css) {
  const out = [];
  for (const r of parseRules(css)) {
    if (r.kind !== "rule") continue;
    for (const d of r.body.split(";")) {
      const m = /^\s*animation(-name)?\s*:\s*(.+)$/.exec(d);
      if (!m) continue;
      const val = m[2].replace(/!important/g, "").trim();
      if (val === "none" || !val) continue;
      const infinite = /\binfinite\b/.test(val);
      // The name is the one token that is not a time, a timing function, a count or a keyword.
      const tokens = val.replace(/cubic-bezier\([^)]*\)/g, " ").split(/\s+/);
      const RESERVED = new Set(["infinite", "alternate", "alternate-reverse", "reverse", "both", "forwards", "backwards", "none", "linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end", "running", "paused", "normal"]);
      const name = tokens.find((t) => t && !RESERVED.has(t) && !/^[\d.]+m?s$/.test(t) && !/^\d+$/.test(t));
      if (name) out.push({ name, infinite, sel: r.sel });
    }
  }
  return out;
}

const keyframesIn = (css) => parseRules(css).filter((r) => r.kind === "keyframes");

// ── 1. 🔴 EVERY ANIMATION ACTUALLY EXISTS, AND EVERY KEYFRAME IS ACTUALLY USED ───
// A name that matches no @keyframes block is CSS that looks correct and does nothing.
{
  const css = styleOf(render());
  const defined = new Set(keyframesIn(css).map((k) => k.name));
  const used = animationsUsed(css);
  ok("the page declares animations at all", used.length >= 8, `found ${used.length}`);
  for (const u of used) ok(`animation ${u.name} has a keyframes block`, defined.has(u.name), `used by ${u.sel}`);
  const usedNames = new Set(used.map((u) => u.name));
  for (const name of defined) ok(`keyframes ${name} is referenced`, usedNames.has(name), "dead animation, nothing uses it");
}

// ── 2. 🔴 ANYTHING THAT LOOPS TOUCHES ONLY TRANSFORM AND OPACITY ─────────────────
{
  const css = styleOf(render());
  const kf = new Map(keyframesIn(css).map((k) => [k.name, k.body]));
  const loops = animationsUsed(css).filter((u) => u.infinite);
  ok("something does loop, or there is nothing continuous to check", loops.length >= 2, `${loops.length} looping animations`);
  const CHEAP = new Set(["transform", "opacity"]);
  for (const u of loops) {
    const body = kf.get(u.name) || "";
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    const costly = props.filter((p) => !CHEAP.has(p));
    ok(`looping ${u.name} animates only transform or opacity`, costly.length === 0, `also animates ${costly.join(", ")} — that re-measures the page every frame, forever`);
  }
}

// ── 3. 🔴 NOTHING RESTS INVISIBLE ────────────────────────────────────────────────
// Any rule that hides an element must either be gated on the .js class (so a visitor
// without script sees it), or belong to a decorative pseudo-element that carries no
// content of its own.
{
  const css = styleOf(render());
  for (const r of parseRules(css)) {
    if (r.kind !== "rule") continue;
    if (!/(?:^|;)\s*(?:opacity\s*:\s*0(?![.\d])|visibility\s*:\s*hidden|display\s*:\s*none)/.test(r.body)) continue;
    const sel = r.sel;
    const excused = /(^|,)\s*\.js\s/.test(sel) || /::/.test(sel) || /\.(err|thanks|mcta|hdr-cta)\b/.test(sel);
    ok(`nothing rests hidden: ${sel}`, excused, "hides content with no .js gate and no safety net behind it");
  }
}

// ── 4. 🔴 THE OFF SWITCH ─────────────────────────────────────────────────────────
{
  const css = styleOf(render());
  const block = /@media\(prefers-reduced-motion:reduce\)\{((?:[^{}]*\{[^{}]*\})*)\}/.exec(css.replace(/\/\*[\s\S]*?\*\//g, ""));
  ok("reduced motion is honoured", !!block);
  if (block) {
    const b = block[1];
    // !important, not source order. This block is easy to move and must win anyway.
    ok("it kills animation with !important", /animation:none!important/.test(b));
    ok("and transition too", /transition:none!important/.test(b));
    // 🔴 The universal selector matches ELEMENTS ONLY. Every continuous animation in this
    // stylesheet lives on a pseudo-element (the drifting glow, the button sheen, the
    // sending spinner), so a bare `*` left the whole motion layer running for a visitor
    // who had asked their computer for less of it. Found in a browser, not by reading it.
    ok("and it reaches pseudo-elements, which * does not",
      /\*,\*::before,\*::after\{[^}]*animation:none!important/.test(b),
      "a bare * leaves ::before and ::after animating under reduced motion");
    // 🔴 Without this line the reveal freezes hidden forever, which is worse than the
    // motion it was trying to remove.
    ok("and it un-hides the scroll reveals", /\.js \.reveal\{opacity:1!important;transform:none!important\}/.test(b));
  }
}

// ── 5. Every layout gets motion, and the photo hero gets its own ─────────────────
// A layout that renders no animated element is a layout Bryson would see as stale, and
// "do this for every one" is the whole request.
{
  for (const layout of LAYOUTS) {
    const html = render({ layout });
    const overlay = layout === "overlay";
    // 🔴 Checked as ELEMENT PLUS RULE, and against the MARKUP only, because either half
    // alone lies. A rule for an element that never renders is not motion, and an element
    // with no rule behind it is not either. The stylesheet is identical on every page, so
    // grepping the whole document would pass for a layout that renders none of this.
    const body = html.slice(html.indexOf("</style>"));
    const css = styleOf(html);
    // The photo hero switches the glow layers off, which is exactly why it breathes its
    // scrim instead of drifting a glow that is not there.
    ok(`${layout}: hero carries a continuous treatment`,
      overlay
        ? /class="hero-ov-scrim"/.test(body) && /\.hero-ov-scrim\{animation:scrim/.test(css)
        : /<section class="hero"/.test(body) && !/hero-ov/.test(body) && /\.hero::before\{animation:drift/.test(css),
      overlay ? "no scrim element breathing over the photo" : "no standard hero drifting");
    ok(`${layout}: entrance animation on the headline`, /class="headline an"/.test(html));
    ok(`${layout}: scroll reveals present`, (html.match(/reveal/g) || []).length >= 6);
    ok(`${layout}: a call to action that answers a press`, /class="cta"/.test(html));
  }
}

// ── 6. Every benefit style answers a pointer ─────────────────────────────────────
{
  const css = styleOf(render());
  ok("cards lift on hover", /\.bcard:hover\{[^}]*transform:translateY/.test(css));
  ok("list rows tint on hover", /\.brow:hover\{[^}]*background:/.test(css));
  ok("numbered figures respond on hover", /\.bnum:hover \.bn\{/.test(css));
  ok("steps lift on hover", /\.step:hover[^{]*\{[^}]*transform:translateY/.test(css));
  ok("reviews lift on hover", /\.rev:hover[^{]*\{[^}]*transform:translateY|\.step:hover,\.rev:hover\{[^}]*transform:translateY/.test(css));
  ok("chips lift on hover", /\.chip:hover\{[^}]*transform:translateY/.test(css));
  ok("the faq marker turns rather than blinking", /\.faq\[open\] summary::after\{transform:rotate/.test(css));
}

// ── 7. Reveals arrive in sequence, in every section that has more than one thing ──
{
  const html = render({ benefits: "cards" });
  const sections = {
    benefits: /class="bcard reveal" style="transition-delay:(\d+)ms"/g,
    steps: /class="step reveal" style="transition-delay:(\d+)ms"/g,
    gallery: /class="gitem reveal" style="transition-delay:(\d+)ms"/g,
    reviews: /class="rev reveal" style="transition-delay:(\d+)ms"/g,
    faq: /class="faq reveal" style="transition-delay:(\d+)ms"/g,
    chips: /class="chip reveal" style="transition-delay:(\d+)ms"/g,
  };
  for (const [name, re] of Object.entries(sections)) {
    const delays = [...html.matchAll(re)].map((m) => +m[1]);
    ok(`${name} staggers`, delays.length >= 2, `only ${delays.length} staggered items rendered`);
    if (delays.length < 2) continue;
    ok(`${name} starts at zero`, delays[0] === 0, `starts at ${delays[0]}ms`);
    ok(`${name} increases evenly`, delays.every((d, i) => i === 0 || d - delays[i - 1] === delays[1]), delays.join(","));
  }
}

// ── 8. 🔴 THE STAGGER COUNTS WHAT SURVIVES THE FILTER ────────────────────────────
// The chips list drops entries a client has not filled in, and most new clients have
// not filled in most of them. Numbering before the filter leaves holes in the timing,
// so the row arrives with visible gaps in it.
{
  const bare = render({}, { callTrackingNumber: "", campaignSetup: {}, brandVoice: {} });
  const delays = [...bare.matchAll(/class="chip reveal" style="transition-delay:(\d+)ms"/g)].map((m) => +m[1]);
  ok("a client with nothing filled in still gets chips", delays.length >= 1, `${delays.length} chips`);
  ok("and their timing has no holes in it", delays.every((d, i) => d === i * (delays[1] ?? 45) || i === 0), delays.join(","));
  ok("the first one is immediate", delays[0] === 0);
}

// ── 9. The sending state, both ways ──────────────────────────────────────────────
// A spinner that is switched on and never switched off leaves a failed submission
// looking like it is still working, and the visitor waits instead of retrying.
{
  const html = render();
  const js = scriptOf(html);
  ok("the submit button shows it is working", /classList\.add\('sending'\)/.test(js));
  ok("and stops when the send fails", /classList\.remove\('sending'\)/.test(js));
  ok("the spinner is drawn without touching the label", /\.cta\.sending::after\{/.test(styleOf(html)));
}

// ── 10. The header script is safe to hand to somebody else's developer ───────────
{
  const js = scriptOf(render());
  ok("the header condenses on scroll", /classList\.add\('stuck'\)/.test(js) && /classList\.remove\('stuck'\)/.test(js));
  ok("its listener is passive so scrolling stays smooth", /addEventListener\('scroll',[^,]+,\{passive:true\}\)/.test(js));
  ok("it runs once at load, so a page opened part-scrolled is right", /settle\(\);/.test(js));
  ok("it cannot throw", /try\{[\s\S]*querySelector\('\.hdr'\)[\s\S]*\}catch\(e\)\{\}/.test(js));
  // 🔴 The hand-off page is delivered verbatim to the client's own domain, where their
  // developer reads this script. Internal comments do not go with it.
  ok("no internal comments ship inside the page script", !/(^|[^:])\/\/[^\n]*/.test(js.replace(/https?:\/\//g, "")), "a // comment reaches the client's own site");
}

// ── 11. Motion survives every combination, not just the default one ──────────────
{
  for (const layout of LAYOUTS) {
    for (const benefits of BENEFITS) {
      const css = styleOf(render({ layout, benefits }));
      const defined = new Set(keyframesIn(css).map((k) => k.name));
      const missing = animationsUsed(css).filter((u) => !defined.has(u.name));
      ok(`${layout}/${benefits}: every animation resolves`, missing.length === 0, missing.map((m) => m.name).join(","));
    }
  }
}

// ── 12. 🔴 BREAK EVERY GUARD ONCE ────────────────────────────────────────────────
// Each mutation is a real way this regresses, applied to the real stylesheet.
{
  const css = styleOf(render());
  const defined = () => new Set(keyframesIn(css).map((k) => k.name));

  ok("sanity: the real sheet resolves every animation", animationsUsed(css).every((u) => defined().has(u.name)));

  // (a) A renamed keyframes block. The animation still reads correctly and never runs.
  const renamed = css.replace("@keyframes drift{", "@keyframes drfit{");
  ok("caught: a keyframes block renamed out from under its animation",
    animationsUsed(renamed).some((u) => !new Set(keyframesIn(renamed).map((k) => k.name)).has(u.name)),
    "a typo'd animation name would ship as silent dead CSS");

  // (b) A looping animation given something expensive to animate.
  const costly = css.replace("@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}", "@keyframes float{0%,100%{top:0}50%{top:-6px}}");
  ok("the float keyframes exist to be mutated", costly !== css);
  const kfC = new Map(keyframesIn(costly).map((k) => [k.name, k.body]));
  const loopsC = animationsUsed(costly).filter((u) => u.infinite);
  ok("caught: a loop animating a layout property",
    loopsC.some((u) => [...(kfC.get(u.name) || "").matchAll(/([a-z-]+)\s*:/g)].some((m) => m[1] !== "transform" && m[1] !== "opacity")),
    "an infinite animation could re-measure the page every frame undetected");

  // (c0) 🔴 The pseudo-element selectors dropped from the off switch. Nothing about the
  //      page looks different; the entire continuous motion layer simply ignores the
  //      visitor's setting, because every bit of it sits on a ::before or an ::after.
  const bareStar = css.replace("*,*::before,*::after{animation:none!important", "*{animation:none!important");
  ok("caught: the off switch narrowed back to elements only",
    !/\*,\*::before,\*::after\{[^}]*animation:none!important/.test(bareStar),
    "reduced motion would silently stop covering the animations that actually loop");

  // (c) The reduced-motion escape hatch weakened to a plain rule.
  const weakened = css.replace("*,*::before,*::after{animation:none!important;transition:none!important}", "*,*::before,*::after{animation:none;transition:none}");
  ok("caught: reduced motion downgraded to a suggestion",
    !/animation:none!important/.test(weakened),
    "without !important the off switch loses to any rule that follows it");

  // (d) The line that un-hides the scroll reveals removed.
  const frozen = css.replace(".js .reveal{opacity:1!important;transform:none!important}", "");
  ok("caught: reveals left frozen hidden under reduced motion",
    !/@media\(prefers-reduced-motion:reduce\)\{[^}]*\}\.js \.reveal\{opacity:1!important/.test(frozen)
    && !/\.js \.reveal\{opacity:1!important;transform:none!important\}/.test(frozen),
    "a visitor who asked for less motion would get a page of blank sections");

  // (e) Something hidden at rest with no way back.
  const hidden = css.replace(".chip{transition:", ".chip{opacity:0;transition:");
  const restsHidden = parseRules(hidden).some((r) => r.kind === "rule"
    && /(?:^|;)\s*opacity\s*:\s*0(?![.\d])/.test(r.body)
    && !/(^|,)\s*\.js\s/.test(r.sel) && !/::/.test(r.sel) && !/\.(err|thanks|mcta|hdr-cta)\b/.test(r.sel));
  ok("caught: an element hidden at rest with no script to bring it back", restsHidden,
    "content that only appears if an animation runs would ship undetected");
}

console.log(fail ? `\n✗ landing motion: ${pass} passed, ${fail} FAILED` : `✓ landing motion: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
