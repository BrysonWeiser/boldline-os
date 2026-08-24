// Module resolve hooks, so a test can RUN a Netlify function for real without touching
// Supabase, Anthropic or Google.
//
// Why this exists: every other suite in tests/ either imports a pure module or slices the
// source and evaluates the slice. Both are good, and both share one blind spot — nothing
// ever executes the FUNCTION BODY, the glue between the pure parts. Market Research shipped
// with a reference to a variable that had been renamed, sitting on the last line of the
// happy path. Every pure test passed, every regex passed, and the feature failed on every
// single run after two minutes of real work.
//
// The hooks only redirect specifiers. The stubs themselves read `globalThis.__STUB`, which
// lives on the main thread with the test, so a test controls what they return and can read
// back everything the function tried to write.

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const url = (f) => pathToFileURL(join(HERE, f)).href;

const EXACT = {
  "@supabase/supabase-js": url("stub-supabase.mjs"),
  "@anthropic-ai/sdk": url("stub-anthropic.mjs"),
};

export async function resolve(specifier, context, next) {
  if (EXACT[specifier]) return { url: EXACT[specifier], shortCircuit: true };
  // Relative, so match on the file name rather than the caller's path.
  if (/scout-providers\.mjs$/.test(specifier)) return { url: url("stub-scout.mjs"), shortCircuit: true };
  return next(specifier, context);
}
