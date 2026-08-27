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

console.log(`verify-app-boots: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
