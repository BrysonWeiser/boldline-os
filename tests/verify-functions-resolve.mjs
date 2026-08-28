// Every name a server function uses must actually exist.
//
// Written 2026-08-27, minutes after breaking the one send that mattered. Refactoring the
// DocuSign auth out into a shared module took `SIGN_ANCHOR` with it — a constant that
// belonged to the DOCUMENT, not to auth. Bryson pressed "Send via DocuSign" on his first
// real client's agreement and got **"Send failed — try again."**
//
// 🔴 WHY NOTHING CAUGHT IT, AND IT IS THE SAME SHAPE AS THE useMemo CRASH.
// The name was only ever read INSIDE a function body. So:
//   · `node --check` passed — the syntax is perfect.
//   · `import()` of the module passed — nothing runs at import time.
//   · Every other suite passed — none of them call this function.
// A missing name is invisible until the exact moment the code runs, and for a server
// function that moment is a client contract going out. Exactly the useMemo lesson
// (KB `repo-tests`): the compiler is not a reference checker.
//
// So this walks the real scope tree of every function and library file and asks the only
// question that matters: is every identifier this file READS either declared somewhere in
// scope, imported, or a genuine global?

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
// 🔴 THE REAL PARSER PACKAGES, NOT `@babel/standalone`'s INTERNALS. This used to reach
// into `Babel.packages`, which exists in Babel 8 but not in 7.23.5 — the version the
// browser actually loads, and therefore the version pinned for the boot suite. A test that
// only runs on a different version of the tool than production is the same harness mistake
// as the useMemo crash, one dependency further out.
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";

const parser = { parse };
// The CJS default-interop shape differs between the standalone build and the real package.
const traverse = typeof _traverse === "function" ? _traverse : _traverse.default;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

// Things that genuinely exist at runtime without being declared in the file. Kept
// deliberately tight: a generous list here would hide the very bug this suite exists for.
const GLOBALS = new Set([
  "process", "console", "fetch", "Response", "Request", "Headers", "URL", "URLSearchParams",
  "Buffer", "TextEncoder", "TextDecoder", "AbortController", "AbortSignal", "FormData", "Blob",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "queueMicrotask", "structuredClone",
  "JSON", "Math", "Date", "Object", "Array", "String", "Number", "Boolean", "RegExp", "Error",
  "TypeError", "RangeError", "SyntaxError", "Promise", "Map", "Set", "WeakMap", "WeakSet",
  "Symbol", "Proxy", "Reflect", "BigInt", "Intl", "globalThis", "Infinity", "NaN", "undefined",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
  "encodeURI", "decodeURI", "atob", "btoa", "crypto", "performance", "arguments",
  "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array",
  "Float32Array", "Float64Array", "ArrayBuffer", "DataView", "ReadableStream", "WritableStream",
]);

const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .filter((e) => e.isFile() && /\.(mjs|cjs|js)$/.test(e.name))
  .map((e) => join(dir, e.name));

const FILES = [...walk("netlify/functions"), ...walk("netlify/lib")];

ok("there are server files to check", FILES.length >= 20, `found ${FILES.length}`);

const unresolved = [];
for (const rel of FILES) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  const isCjs = rel.endsWith(".cjs");
  let ast;
  try {
    ast = parser.parse(src, {
      sourceType: isCjs ? "script" : "module",
      allowReturnOutsideFunction: isCjs,
      plugins: ["topLevelAwait"],
    });
  } catch (e) {
    ok(`${rel} parses`, false, e.message.split("\n")[0]);
    continue;
  }
  // CommonJS files get the module wrapper's own names.
  const extra = isCjs ? ["require", "module", "exports", "__dirname", "__filename"] : [];

  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name;
      if (GLOBALS.has(name) || extra.includes(name)) return;
      if (path.scope.hasBinding(name, /* noGlobals */ true)) return;
      unresolved.push({ file: rel, name, line: path.node.loc && path.node.loc.start.line });
    },
  });
}

// 🔴 The whole point. One entry here is a server function that throws the moment it runs.
const seen = new Set();
const uniq = unresolved.filter((u) => {
  const k = `${u.file}:${u.name}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});
ok("🔴 every name used by a server function exists", uniq.length === 0,
  uniq.map((u) => `${relative(".", u.file)}:${u.line}  ${u.name} is used but never declared, imported, or a known global`).join("\n        "));

// And the specific one that broke the first client send, pinned by name so a future tidy-up
// of this file cannot quietly drop it again.
{
  const send = readFileSync(join(ROOT, "netlify/functions/docusign-send.mjs"), "utf8");
  ok("🔴 the signature anchor is defined in the file that builds the document",
    /const SIGN_ANCHOR\s*=\s*"[^"]+"/.test(send),
    "without it, 'Send via DocuSign' throws before it ever reaches DocuSign");
  const anchor = (send.match(/const SIGN_ANCHOR\s*=\s*"([^"]+)"/) || [])[1] || "";
  ok("the anchor is a distinctive string a contract would never contain by accident",
    anchor.length >= 8 && /[A-Z_]/.test(anchor), anchor);
  // It has to reach the envelope AND the document, or DocuSign anchors the signature box
  // to nothing and the client gets a contract with nowhere to sign.
  ok("the anchor is written into the document", /\$\{SIGN_ANCHOR\}/.test(send));
  ok("and the sign-here tab is anchored to it", /anchorString:\s*SIGN_ANCHOR/.test(send));
}

console.log(`verify-functions-resolve: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
