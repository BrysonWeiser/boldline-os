// The client portal's inline script has to actually PARSE.
// Run: node tests/verify-portal-script-parses.mjs
//
// Bryson, 2026-09-10, in the OS: *"I was looking at his client portal preview I pressed
// account and it didn't do anything"*.
//
// 🔴 NOTHING IN THE PORTAL'S SCRIPT WAS RUNNING, IN THE PREVIEW **AND** ON SEBASTIAN'S REAL
// PORTAL. Not one function was defined, so every button was dead: the tabs, Save, the photo
// upload, Approve and Request Changes, Save a Card on File, the help chat, printing the
// contract. Approving his campaign was among them, and that is the thing the whole week has
// been waiting on him for.
//
// The cause: the script is assembled inside a TEMPLATE LITERAL, and a template literal eats
// `\/`. So `/^https?:\/\//i` was emitted as `/^https?:///i`, which is a syntax error, and a
// script with a syntax error defines NOTHING. Introduced by the field-formatting change the
// same day, which added `blUrl` with two such regexes.
//
// 🔴 WHY IT LOOKED FINE. Status is the tab already on screen, so pressing it changes nothing
// and reads as working. Only Account showed the fault, and only as silence. Reading the
// source proves nothing either: `\/` is exactly what you write in a regex, and the damage
// happens at a level the eye does not see.
//
// TWO ESCAPES IN THAT LITERAL ARE DELIBERATE AND MUST NOT BE "FIXED":
//   `\\`          survives as one backslash, which is what /\\n/g needs.
//   `<\/script>`  collapses to `</script>` ON PURPOSE, so the OUTER html parser does not
//                 close the script block early.
//
// This suite evaluates the real template literal out of both files and parses what comes
// out, which is the only check that can see this class of bug.

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));

const FILES = [
  ["netlify/functions/portal.mjs", "the live portal Sebastian actually uses"],
  ["index.html", "the preview inside the OS"],
];

import { emittedPortalScript } from "./helpers/portal-script.mjs";
const emitted = (file) => emittedPortalScript(file);

for (const [file, what] of FILES) {
  const got = emitted(file);
  ok(`${file}: the script literal was found`, !!got, "the extraction anchor moved");
  if (!got) continue;

  const code = got.html.replace(/^<script>/, "").replace(/<\/script>$/, "");

  // ── THE CHECK THIS FILE EXISTS FOR ──────────────────────────────────────────
  let err = null;
  try { new Function(code); } catch (e) { err = e.message; }
  ok(`🔴 ${file}: the portal's script parses (${what})`, err === null,
    err ? `a script with a syntax error defines NOTHING, so every button is dead: ${err}` : "");

  // Tabs are what he pressed. Prove the handler survives into the emitted code.
  ok(`${file}: show() is defined in what actually ships`, /function show\(n,b\)\{/.test(code),
    "this is the function behind every tab button");

  // The regexes that were destroyed, checked as emitted rather than as written.
  ok(`🔴 ${file}: the URL tidier keeps its escaped slashes`,
    code.includes("/^https?:\\/\\//i") && code.includes("/^\\/+/"),
    "a template literal eats \\/ , which turns /^https?:\\/\\//i into a syntax error");
  ok(`🔴 ${file}: the file-extension regex keeps its escaped dot`,
    code.includes("/\\.[^.]+$/"),
    "/.[^.]+$/ still parses but matches any character, so it strips more of the filename than the extension");

  // ── THE TWO ESCAPES THAT ARE MEANT TO COLLAPSE ──────────────────────────────
  ok(`${file}: the newline regex still has its real backslash`, code.includes("/\\n/g"),
    "written as \\\\n on purpose; doubling it again would break it the other way");
  ok(`🔴 ${file}: the closing script tag still collapses`, got.html.trimEnd().endsWith("</script>"),
    "<\\/script> exists so the OUTER html parser does not close the block early; "
    + "escaping it further emits a literal backslash into the page");
  ok(`${file}: and no stray backslash reached the html`, !/<\\\/script>/.test(got.html));

  // Nothing may reintroduce a bare \/ or \. inside the literal, other than the terminator.
  const risky = [...got.lit.matchAll(/(^|[^\\])\\([/.])/g)]
    .filter((m) => !got.lit.slice(m.index, m.index + 11).includes("<\\/script>"));
  ok(`${file}: no regex escape is left for the template literal to eat`, risky.length === 0,
    risky.length ? `${risky.length} found: ${risky.map((m) => JSON.stringify(m[0])).join(", ")}` : "");
}

// Both copies ship the same script. A fix applied to one and not the other is how this kind
// of thing survives, so the two must agree on the functions they define.
{
  const a = emitted(FILES[0][0]), b = emitted(FILES[1][0]);
  if (a && b) {
    const names = (c) => [...c.matchAll(/function ([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]);
    const live = names(a.html), prev = names(b.html);
    ok("the preview defines no function the live portal lacks",
      prev.every((n) => live.includes(n)),
      `only in the preview: ${prev.filter((n) => !live.includes(n)).join(", ")}`);
    for (const n of ["show", "blUrl", "saveInfo", "blStartCard"]) {
      ok(`both copies define ${n}()`, live.includes(n) && prev.includes(n));
    }
  }
}

console.log(`verify-portal-script-parses: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
