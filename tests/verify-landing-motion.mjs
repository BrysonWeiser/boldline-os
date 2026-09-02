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

// ── 11b. 🔴 EVERYTHING MOVES UP OR DOWN ──────────────────────────────────────────
// Bryson, 2026-09-02: "make sure the animations are for up and down". The vocabulary
// used to include a sideways slide and a zoom, and both were reachable from the page
// options picker, so a third of the pages he generated slid in from the left edge.
//
// Two exemptions, both deliberate and neither one content moving across the page:
//   sheen — a light travelling ACROSS a button face. A shine that runs vertically down
//           a button does not read as a shine, it reads as a glitch.
//   spin  — the sending spinner. A spinner rotates. That is what a spinner is.
{
  const css = styleOf(render());
  const EXEMPT = new Set(["sheen", "spin"]);

  // (a) The scroll-reveal offset is the movement a visitor sees on every single card,
  //     row and section. It is a custom property, so it is one string to check.
  const offsets = [...css.matchAll(/--rv:\s*([^;}]+)/g)].map((m) => m[1].trim());
  ok("the page defines reveal offsets", offsets.length >= 2, `${offsets.length} found`);
  for (const o of offsets) {
    ok(`reveal offset ${o} moves vertically`, /^translateY\(-?[\d.]+px\)$/.test(o),
      "a reveal offset that is not a plain translateY slides content sideways or zooms it");
  }
  // Both directions are actually reachable, or "up and down" is really just "up".
  ok("content rises in one style", offsets.some((o) => /translateY\((?!-)/.test(o)));
  ok("and settles in another", offsets.some((o) => /translateY\(-/.test(o)));

  // (b) No keyframe moves anything horizontally.
  for (const k of keyframesIn(css)) {
    if (EXEMPT.has(k.name)) continue;
    const sideways = /translateX\(\s*-?[1-9]/.test(k.body)
      || /skewX\(\s*-?[1-9]/.test(k.body)
      || [...k.body.matchAll(/translate3d\(\s*([^,]+),/g)].some((m) => !/^-?0[a-z%]*$/.test(m[1].trim()))
      || [...k.body.matchAll(/translate\(\s*([^,)]+)/g)].some((m) => !/^-?0[a-z%]*$/.test(m[1].trim()));
    ok(`keyframes ${k.name} does not move sideways`, !sideways, k.body.replace(/\s+/g, " ").trim());
  }

  // (c) 🔴 Every motion the OPTIONS PICKER can hand out is one the renderer understands.
  //     A value the renderer does not know falls back to the per-client hash silently, so
  //     the option Bryson picked and the page he gets stop matching.
  const { MOTIONS } = await import("../netlify/lib/landing-variants.mjs");
  ok("the picker offers three motions, so three options can differ", MOTIONS.length === 3, MOTIONS.join(","));
  // 🔴 RESOLVED END TO END, not looked up in the stylesheet. A first version of this check
  // asked whether a `.mo-down` rule existed, which it always does, and so it passed happily
  // while the renderer's own accept-list still said side and zoom. The stylesheet is not the
  // resolver: designConfig validates the requested token against ITS list and silently falls
  // back to the per-client hash on anything it does not recognise. That is the actual bug
  // shape here, and the only way to see it is to ask the renderer for a motion and check
  // which one the page comes back wearing.
  for (const m of MOTIONS) {
    const body = /<body class="([^"]+)"/.exec(render({ motion: m }));
    ok(`asking the renderer for the ${m} motion returns the ${m} motion`,
      !!body && body[1].split(/\s+/).includes(`mo-${m}`),
      `page came back as ${body ? body[1].split(/\s+/).filter((c) => c.startsWith("mo-")).join(",") : "no body"}`);
    ok(`and the stylesheet answers to it`,
      m === "up" ? /--rv:translateY\(20px\)/.test(css) : new RegExp(`\\.mo-${m}[ .:{]`).test(css),
      `the picker can assign "${m}" but nothing in the stylesheet answers to it`);
  }
  ok("and the sideways and zoom styles are gone for good",
    !MOTIONS.includes("side") && !MOTIONS.includes("zoom") && !/\.mo-(side|zoom)\b/.test(css));
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

  // (b2) 🔴 A sideways reveal reintroduced. This is the exact thing being ruled out, and
  //      it is one token away at all times.
  const sideways = css.replace(".mo-down{--rv:translateY(-22px)}", ".mo-down{--rv:translateX(-24px)}");
  ok("the down offset exists to be mutated", sideways !== css);
  ok("caught: a reveal that slides in from the edge",
    [...sideways.matchAll(/--rv:\s*([^;}]+)/g)].some((m) => !/^translateY\(-?[\d.]+px\)$/.test(m[1].trim())),
    "content would slide in horizontally again with nothing to say so");

  // (b3) The hero drift given a sideways component back.
  const diagonal = css.replace("translate3d(0,3.2%,0)", "translate3d(-3%,3.2%,0)");
  ok("the drift exists to be mutated", diagonal !== css);
  const driftKf = keyframesIn(diagonal).find((k) => k.name === "drift");
  ok("caught: the hero glow drifting diagonally again",
    !!driftKf && [...driftKf.body.matchAll(/translate3d\(\s*([^,]+),/g)].some((m) => !/^-?0[a-z%]*$/.test(m[1].trim())));

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

// ── 13. 🔴 OPTIONS SAVED BEFORE ANY OF THIS EXISTS STILL GET IT ──────────────────
// Bryson, 2026-09-02: "can you add them to the existing landing page options for stencil
// and thread". His three saved options were written before the motion layer existed, and
// the answer is that there is nothing to add to them, BECAUSE OF HOW THE OPTIONS SYSTEM
// IS BUILT: an option stores WORDS AND DESIGN TOKENS, never rendered HTML, and both the
// live page and the in-app preview render fresh through renderLandingPage on every single
// request. So improving the renderer improves every option that already exists.
//
// That is a load-bearing property, not a happy accident, and this is what holds it up. The
// day somebody caches a rendered page or stores one on the client record, his saved options
// silently freeze at whatever the page looked like the day they were written.
{
  // An option exactly as it was saved before today: a motion the renderer has since stopped
  // recognising, and no knowledge of anything added since.
  const stale = { id: "v1", label: "Option 1", generatedAt: "2026-09-01T00:00:00Z", angle: "speed",
    headline: "Custom work, done right the first time",
    subheadline: "Tell us what you need and we come back with a real number today.",
    bullets: FULL.landingPage.bullets, steps: FULL.landingPage.steps, faqs: FULL.landingPage.faqs,
    ctaText: "Get my quote",
    design: { layout: "split", benefits: "cards", background: "glowgrid", shape: "rounded", font: "modern", motion: "side", order: "a" } };

  // Rendered the way the options card renders it: the client's real data, this option's page.
  const html = renderLandingPage({ ...FULL, landingPage: stale });
  const css = styleOf(html);
  const body = /<body class="([^"]+)"/.exec(html)[1].split(/\s+/);

  ok("an option saved yesterday still renders", /class="headline an"/.test(html));
  ok("and it carries the motion layer", /@keyframes drift/.test(css) && /\.hero::before\{animation:drift/.test(css));
  ok("and the staggered reveals", (html.match(/transition-delay:/g) || []).length >= 8);
  ok("and the condensing header", /classList\.add\('stuck'\)/.test(scriptOf(html)));
  // 🔴 The retired token does not leave the page motionless or half-styled. It is not in the
  // renderer's list any more, so it falls back to a valid one rather than rendering `mo-side`
  // with no rule behind it.
  ok("its retired sideways motion falls back to a vertical one",
    body.some((c) => /^mo-(up|down|alt)$/.test(c)) && !body.includes("mo-side"),
    body.filter((c) => c.startsWith("mo-")).join(","));

  // 🔴 And nothing anywhere stores or caches a rendered page, which is the property all of
  // the above rests on.
  const { readFileSync } = await import("node:fs");
  const fn = readFileSync(new URL("../netlify/functions/landing.mjs", import.meta.url), "utf8");
  ok("the renderer sends no cache headers, so a page is never served stale",
    !/cache-control/i.test(fn), "a cached page would freeze his saved options at the day they were written");
  const ui = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  ok("the preview asks the live renderer rather than keeping its own copy",
    /fetch\("\/\.netlify\/functions\/landing"/.test(ui) && !/makeLandingHTML/.test(ui),
    "a second renderer in the OS is how the portal and the contract both drifted");
}

console.log(fail ? `\n✗ landing motion: ${pass} passed, ${fail} FAILED` : `✓ landing motion: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
