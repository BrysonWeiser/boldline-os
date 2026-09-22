// The niche pickers: readable on a dark theme, searchable, and never a native <select>.
// Run: node tests/verify-niche-picker.mjs
//
// 🔴 THIS IS A BUG BRYSON HAS NOW REPORTED TWICE, in the same words both times.
//   2026-08-26, the client sheet: *"the categories are white and i cant read them i also need a
//   way to search or put a specific niche."*
//   2026-09-22, Lead Scout: *"when i go to the niche drop down the category labels are all white
//   so i cant read them."*
// The first report was fixed by building `NicheSelect`, a list we draw ourselves. Lead Scout kept
// its native <select>, so the same bug sat there for a month waiting to be found again.
//
// 🔴 WHY THERE IS NO CSS FIX, and therefore why this suite bans the ELEMENT rather than policing a
// colour: a native <select> hands its open popup to the operating system, which paints <optgroup>
// headings in its own colours and ignores ours. On a dark theme they come out white on white. The
// popup is not ours to style, so the only fix is not to use one.
//
// The detector looks for the MARKUP (`<optgroup ... label=`), never the word, so the comments above
// and in index.html that explain all this cannot trip it. A guard that fires on its own
// documentation gets deleted, and then it guards nothing.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── 1. No grouped native dropdown may exist anywhere in the OS ───────────────
{
  const optgroups = [...UI.matchAll(/<optgroup[^>]*label=/g)];
  eq("🔴 no screen uses a native grouped dropdown", optgroups.length, 0);
  ok("and the ban is on the element, not on the word, so the explanations survive",
    /<optgroup>/.test(UI) && [...UI.matchAll(/<optgroup[^>]*label=/g)].length === 0,
    "the comments that explain this bug mention the tag; they must not count as a use of it");
}

// ── 2. Both niche fields are the picker we draw ourselves ────────────────────
{
  const uses = [...UI.matchAll(/<NicheSelect/g)];
  ok("every niche field uses the picker", uses.length >= 3, `found ${uses.length}, expected the two client sheets plus Lead Scout`);
  ok("🔴 Lead Scout is one of them", /<NicheSelect value=\{selected\?selected\.label:""\} source=\{SCOUT_NICHES\}/.test(UI),
    "this is the field he reported; a fix that misses it fixes nothing he can see");
  ok("the client sheets still pass their own list by leaving `source` out",
    (UI.match(/<NicheSelect value=\{form\.niche\} onChange=\{v=>set\("niche",v\)\}\/>/g) || []).length === 2,
    "one picker, two lists, and the default must keep working untouched");
  ok("the default list is the client-sheet one, reshaped rather than duplicated",
    /const NICHE_SOURCE_DEFAULT = Object\.entries\(NICHE_GROUPS\)\.map\(\(\[g,n\]\)=>\(\{g,n,k:"service"\}\)\);/.test(UI));
}

// ── 3. The picker hands back the group and the kind, not just a name ─────────
//
// 🔴 Lead Scout needs the KIND before it can decide whether an area is even required: an
// e-commerce brand sells nationwide, so demanding a city would be wrong. Losing `kind` in the
// picker would not throw — it would quietly make every online brand behave like a local trade.
{
  ok("choosing a row reports which group and kind it came from",
    /const pick = \(r\)=>\{ onChange\(r\.n,\{group:r\.g\|\|"Custom",kind:r\.k\|\|"service"\}\); /.test(UI));
  // 🔴 BOTH WAYS OF COMMITTING A TYPED NICHE, because they are separate code paths and a
  // mutation that broke only one of them survived a test that looked for either.
  const keeps = (UI.match(/pick\(\{n:q\.trim\(\),g:"Custom",k:"service"\}\)/g) || []).length;
  ok("a niche typed in that matches nothing is kept, as a service — pressing Enter AND clicking it",
    keeps === 2, `found ${keeps} of the 2 paths`);
  ok("and Enter on an empty list still keeps what was typed",
    /else if\(needle\) pick\(\{n:q\.trim\(\),g:"Custom",k:"service"\}\);/.test(UI),
    "a trade the list never thought of is a real business, not an error");
  ok("and the row that offers it is there to click",
    /onMouseDown=\{\(e\)=>\{e\.preventDefault\(\);pick\(\{n:q\.trim\(\),g:"Custom",k:"service"\}\);\}\}/.test(UI));
  ok("Lead Scout stores all three", /setNiche\(n\?\{label:n,group:meta\.group,kind:meta\.kind\}:null\)/.test(UI));
  ok("🔴 and still decides the area rule from the kind", /const isEcom = !!\(selected&&selected\.kind==="ecom"\)/.test(UI),
    "lose the kind and every online brand is forced to name a city it does not sell in");
  ok("the flat row list carries the group with each name",
    /groups\.flatMap\(\(\[g,arr,k\]\)=>arr\.map\(n=>\(\{n,g,k\}\)\)\)/.test(UI));
}

// ── 4. The list Lead Scout hands it is shaped the way the picker reads it ────
{
  const start = UI.indexOf("const SCOUT_NICHES = [");
  ok("the Lead Scout niche list was found", start > 0);
  const body = UI.slice(start, UI.indexOf("\n];", start) + 3);
  // Executed, not pattern-matched: a row missing `k` is the failure that shows up as a wrong
  // area rule months later rather than as an error now.
  const SCOUT_NICHES = new Function(`${body} return SCOUT_NICHES;`)();
  ok("it has plenty of groups", SCOUT_NICHES.length > 10, `found ${SCOUT_NICHES.length}`);
  ok("🔴 every group declares a kind", SCOUT_NICHES.every((g) => g.k === "service" || g.k === "ecom"),
    (SCOUT_NICHES.filter((g) => g.k !== "service" && g.k !== "ecom").map((g) => g.g).join(", ") || "") + " have no usable kind");
  ok("every group has a heading", SCOUT_NICHES.every((g) => typeof g.g === "string" && g.g.trim()));
  ok("and a non-empty list of niches", SCOUT_NICHES.every((g) => Array.isArray(g.n) && g.n.length > 0));
  // 🔴 NAMED, NOT COUNTED. "At least one group is ecom" passed while a real e-commerce group was
  // relabelled a service, which would silently force an online brand to name a city it does not
  // sell in. The heading and the kind have to agree.
  const ecomByName = SCOUT_NICHES.filter((g) => /^E-Commerce/i.test(g.g));
  ok("there are e-commerce groups", ecomByName.length >= 2, `found ${ecomByName.length}`);
  ok("🔴 every group whose heading says E-Commerce is marked as one",
    ecomByName.every((g) => g.k === "ecom"),
    ecomByName.filter((g) => g.k !== "ecom").map((g) => g.g).join(", ") + " would force an area on a brand that sells nationwide");
  ok("🔴 and nothing else is quietly marked e-commerce",
    SCOUT_NICHES.filter((g) => g.k === "ecom").every((g) => /^E-Commerce/i.test(g.g)),
    "a local trade marked ecom stops asking for the area it absolutely needs");
  const all = SCOUT_NICHES.flatMap((g) => g.n);
  ok("there are hundreds of niches to search through", all.length > 300, `found ${all.length}`);
  eq("and none of them is blank", all.filter((n) => !String(n).trim()).length, 0);
}

// ── 5. What made the first fix worth keeping ─────────────────────────────────
{
  ok("the list is searchable", /placeholder=\{value\?value:"Search or type a niche…"\}/.test(UI),
    "430 entries with no search is why the custom option was never found");
  // Anchored on the heading's OWN declaration, not on a shared fragment: a first pass matched
  // `textTransform:"uppercase",color:C.gold` and passed while a mutation stripped the colour,
  // because the first match in the file belonged to a different element entirely.
  ok("🔴 the headings are ours, and gold rather than whatever the OS chose",
    /The heading that was unreadable\. Ours now/.test(UI)
    && /textTransform:"uppercase",color:C\.gold,\s*\n?\s*opacity:\.85/.test(UI),
    "this is the exact declaration that makes the category names legible");
  ok("the panel has its own solid background",
    /maxHeight:260,overflowY:"auto",backgroundColor:C\.bg2,border:`1px solid \$\{C\.border\}`/.test(UI),
    "a see-through popup is how white-on-white happens in the first place");
}

console.log(`verify-niche-picker: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
