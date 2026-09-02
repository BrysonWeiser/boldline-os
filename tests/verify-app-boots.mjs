// The cheapest possible guard against blanking the entire OS.
//
// Written 2026-08-26 immediately after doing exactly that. A new component used `useMemo`,
// which the app never destructured off `React`. The whole file compiled cleanly through
// Babel, every other suite passed, and the app died with a red error screen the moment
// Bryson pressed New Client.
//
// 🔴 THE LESSON, AND IT IS ABOUT TESTING, NOT ABOUT HOOKS. Babel compiles a call to an
// undefined name perfectly happily, so a syntax check can never catch this. Worse, the
// throwaway harness used to check the component DEFINED `useMemo` itself, which made the
// harness MORE PERMISSIVE THAN THE REAL PAGE and is precisely why it passed. A harness that
// supplies what the real environment does not is not a test, it is a second implementation
// that happens to work.
//
// So this suite checks the shipping file against itself: every React hook the code CALLS
// must be present in the one destructuring line the whole app depends on.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

// Comments discuss hooks by name constantly, and a mention is not a call.
const CODE = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

const m = CODE.match(/const \{([^}]+)\} = React;/);
ok("the app destructures its hooks off React exactly once", !!m && CODE.split("} = React;").length === 2);
if (!m) { console.log(`verify-app-boots: ${pass} passed, ${++fail} failed`); process.exit(1); }

const have = new Set(m[1].split(",").map((x) => x.trim()).filter(Boolean));

const REACT_HOOKS = [
  "useState", "useEffect", "useRef", "useMemo", "useCallback", "useContext",
  "useReducer", "useLayoutEffect", "useImperativeHandle", "useDeferredValue",
  "useTransition", "useId", "useSyncExternalStore", "useDebugValue",
];

// A call, not a mention: the name followed by an opening paren, and not preceded by a dot
// (so `React.useMemo(` and `foo.useState(` do not count as bare uses).
const used = REACT_HOOKS.filter((h) => new RegExp(`(?<![.\\w])${h}\\s*\\(`).test(CODE));

ok("the app really does use hooks, so this suite is testing something", used.length >= 4, `found ${used.length}`);

for (const h of used) {
  // A fully-qualified `React.useX(` call is legitimate and needs no destructuring.
  const qualified = new RegExp(`React\\.${h}\\s*\\(`).test(CODE);
  ok(`🔴 ${h} is called and is available`, have.has(h) || qualified,
    `${h}( is called but is neither destructured off React nor called as React.${h}(). ` +
    `Babel compiles this fine and the OS dies at render with "ReferenceError: ${h} is not defined".`);
}

// The specific one that broke it, pinned by name so a future tidy-up of the destructuring
// line cannot quietly drop it again.
ok("useMemo specifically is available", have.has("useMemo") || /React\.useMemo\s*\(/.test(CODE));

// createContext is not a hook but lives on the same line and the playbook context depends
// on it, so losing it breaks the campaign builder rather than a dropdown.
ok("createContext is still destructured", have.has("createContext"));

// Nothing unused, which keeps the line honest rather than a grab bag.
const surplus = [...have].filter((h) => REACT_HOOKS.includes(h) && !used.includes(h));
ok("no hook is destructured that the app never calls", surplus.length === 0, `unused: ${surplus.join(", ")}`);


// ── 🔴 THE PRESET LINE, WHICH IS TWO THIRDS OF THE LOAD TIME ──────────────────
// The browser compiles the entire app on every page load. Adding "env" to the preset list
// makes Babel additionally rewrite every modern JavaScript feature down to 2015 syntax,
// for browsers nobody uses. Measured in a real browser rendering the actual sign-in
// screen: env,react took 10.5 s to first render, react alone took 3.5 s. Same app, no
// errors either way. It is the cheapest three-fold speedup this codebase will ever get,
// and it is one word, which is exactly why it needs pinning.
{
  const m2 = S.match(/<script type="text\/babel"[^>]*data-presets="([^"]*)"/);
  ok("the babel script block declares its presets", !!m2, "no data-presets found");
  if (m2) {
    const presets = m2[1].split(",").map((x) => x.trim()).filter(Boolean);
    ok("🔴 the env preset is not loaded", !presets.includes("env"),
      `presets are "${m2[1]}" — env triples the time before anything appears on screen`);
    ok("the react preset still is, or none of the JSX compiles", presets.includes("react"));
  }
}

// ── 🔴 AND THE OTHER WAY TO BLANK THE WHOLE APP: BAD JSX ──────────────────────
// The undefined-hook bug above kills one component. A syntax error in the JSX kills the
// ENTIRE page, because the browser compiles this one script block at load time and a
// failure there means nothing renders at all — no error boundary, no partial app, a blank
// screen. The browser runs Babel on this exact text, so the test is to run Babel on this
// exact text. Nothing is stubbed and nothing is reformatted first.
{
  const blocks = [...S.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ok("the app's code is in a babel script block where this suite can find it", blocks.length === 1,
    `found ${blocks.length}`);
  if (blocks.length === 1) {
    const { transform } = await import("@babel/standalone");
    let err = "";
    try {
      // Same preset the page loads. A silent console note about code size is normal.
      transform(blocks[0], { presets: ["react"], compact: true, comments: false });
    } catch (e) { err = e.message; }
    ok("🔴 the whole app compiles, so the page is not a blank screen", !err,
      `${err.split("\n")[0]}\n        Every line of the OS is in this one block. If it does not compile, NOTHING renders.`);
  }
}

// ── 🔴 THE OS MAY NOT SEND HIM TO A TAB THAT IS NOT THERE ────────────────────────
// Bryson, 2026-09-02: *"there isn't an assets tab can you add it"*. There was. It held
// the media library, the landing page with its Publish and Regenerate buttons, the
// approvals queue and a portal preview. But it was only LABELLED "Assets" on the house
// account; on a client record the same tab read "Client View".
//
// That was not a tidiness problem. SEVEN separate pieces of the OS's own guidance say
// "on the Assets tab" — the launch checklist, the autobuild alerts, the pipeline next
// steps — so on every client record the product was giving directions to a tab that did
// not exist under that name, and it did that for months without anything noticing.
//
// This pins the label to the instructions. Rename the tab and the guidance keeps saying
// Assets, so this fails. Reword the guidance and the tab keeps saying Assets, so this
// fails. They can only move together.
{
  const guidance = [
    S,
    readFileSync(join(ROOT, "netlify/lib/autobuild-decide.mjs"), "utf8"),
    readFileSync(join(ROOT, "netlify/lib/launch-checklist.mjs"), "utf8"),
    readFileSync(join(ROOT, "netlify/functions/client-autobuild.mjs"), "utf8"),
  ].join("\n");

  // Every instruction that names the tab, with the comments stripped so this file's own
  // prose about the rule can never be mistaken for the rule. That mistake has been made
  // in this repo before.
  const code = guidance.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const named = [...code.matchAll(/on the ([A-Z][A-Za-z ]{1,14}?) tab/g)].map((m) => m[1]);
  ok("the OS does tell him which tab to use", named.length >= 5, `${named.length} such instructions`);

  const mapLine = (/\.map\(\(\[k,label\]\)=>[^\n]*/.exec(S) || [""])[0];
  const TAB_LINE = /\.map\(\(\[k,label\]\)=> k==="portal" \? \[k,"Assets"\]/;
  ok("and the tab those instructions name is actually labelled that", TAB_LINE.test(S),
    "the portal tab is no longer unconditionally labelled Assets, so every 'on the Assets tab' instruction now points at nothing");

  // 🔴 The label must not depend on which account is open, which is exactly how it broke.
  // Matched on the ONE map line, not with a loose gap that could wander across unrelated
  // code elsewhere in a 1.1MB file. A pattern that can match somebody else's code is not
  // a test, which this repo has learned the hard way more than once.
  ok("the label does not depend on whether it is the house account",
    /^\.map\(\(\[k,label\]\)=> k==="portal" \? \[k,"Assets"\]/.test(mapLine.trim()),
    `labelling it per account is what made the guidance wrong on every client record: ${mapLine.trim().slice(0, 90)}`);

  // And every tab the guidance names has to be a real tab.
  // The effective labels are the ones in the TABS literal PLUS any the .map reassigns.
  // Reading only the literal would miss the rename this whole guard is about, and report
  // the tab as missing while it is sitting right there on screen.
  const literal = (/const TABS   = (\[[^\n]*\])/.exec(S) || [])[1] || "";
  const labels = literal + " " + mapLine;
  // 🔴 This caught a SECOND instance of the same bug on its first run: four pieces of
  // guidance said "on the Campaigns tab", and Campaigns is not a tab at all. It is a
  // top-level screen reached from More. Those now name it as a screen.
  for (const n of new Set(named)) {
    ok(`"${n}" is a real tab`, labels.includes(`"${n}"`),
      `the OS says "on the ${n} tab" but no tab is called that. If it is a screen rather than a tab, say so in the instruction`);
  }
}

console.log(`verify-app-boots: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
