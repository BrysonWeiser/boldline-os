// Every repo file the client-websites functions use, found by following their relative imports. Pure Node
// (no packages), because the ignore step runs before anything is installed.
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SITES_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(SITES_DIR, "..");
export const ENTRIES = ["functions/website.mjs", "functions/site-hit.mjs", "functions/lead.mjs", "functions/book.mjs", "functions/optout.mjs"].map((f) => join(SITES_DIR, f));

const IMPORT_RE = /(?:import|export)\s[^"'`;]*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

export function sitesInputs() {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(IMPORT_RE)) walk(resolve(dirname(file), m[1] || m[2]));
  };
  ENTRIES.forEach(walk);
  return [...seen].map((f) => relative(REPO, f)).sort();
}
