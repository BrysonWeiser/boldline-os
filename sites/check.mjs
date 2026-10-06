// Build step for the client-websites site: refuse to deploy if any file the functions need is missing,
// so a broken build fails here (the live sites keep the last good deploy) instead of shipping.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { sitesInputs, REPO } from "./deps.mjs";

const files = sitesInputs();
const missing = files.filter((f) => !existsSync(join(REPO, f)));
if (missing.length || files.length < 5) { console.error("client websites: missing", missing); process.exit(1); }
for (const p of ["@supabase/supabase-js", "@anthropic-ai/sdk"]) {
  if (!existsSync(join(REPO, "node_modules", p))) { console.error(`client websites: package ${p} not installed`); process.exit(1); }
}
console.log(`client websites: ${files.length} files ok`);
