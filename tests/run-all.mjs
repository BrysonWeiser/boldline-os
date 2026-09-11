// Run every suite in tests/ and report once.
// Run: node tests/run-all.mjs
//
// There was no single command and no CI, so 80 suites only ran when somebody remembered to
// run them. On 2026-09-10 the client portal shipped a syntax error that killed every button
// on it, live, for a day. Nothing was watching. This is half the answer; the other half is
// `netlify/functions/daily-check.mjs`, which looks at the DEPLOYED site, because a suite
// that reads this repo cannot see what Netlify actually served.
//
// Exits non-zero if any suite fails, so CI fails with it.

import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const quiet = process.argv.includes("--quiet");

const suites = readdirSync(HERE)
  .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs"))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

const run = (file) => new Promise((resolve) => {
  const started = Date.now();
  const p = spawn(process.execPath, [join(HERE, file)], { cwd: join(HERE, ".."), stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  // A suite that hangs is a failing suite, not a reason for CI to sit for an hour.
  const killer = setTimeout(() => { p.kill("SIGKILL"); out += "\n[timed out after 180s]"; }, 180000);
  p.on("close", (code) => { clearTimeout(killer); resolve({ file, code, out, ms: Date.now() - started }); });
});

const results = [];
for (const f of suites) {
  const r = await run(f);
  results.push(r);
  if (!quiet) process.stdout.write(r.code === 0 ? "." : "\n✗ " + r.file + "\n");
}

const failed = results.filter((r) => r.code !== 0);
const slow = [...results].sort((a, b) => b.ms - a.ms).slice(0, 3);

console.log(`\n\n${suites.length} suites, ${results.length - failed.length} passed, ${failed.length} failed`);
console.log(`slowest: ${slow.map((r) => `${r.file.replace(/^verify-|\.mjs$/g, "")} ${(r.ms / 1000).toFixed(1)}s`).join(", ")}`);

if (failed.length) {
  for (const r of failed) {
    console.log(`\n──────── ${r.file} ────────`);
    console.log(r.out.trim().split("\n").slice(-25).join("\n"));
  }
  process.exit(1);
}
