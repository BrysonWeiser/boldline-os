// Every fixed button label used in a client email, read straight from the code that sends them, so the
// pictures (scripts/build-email-buttons.mjs) and the check that they exist (tests/verify-email-buttons.mjs)
// can never disagree about which buttons there are. Labels written by the AI at send time (the newsletter)
// are not fixed, so they are not here; they get the drawn button instead.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const EMAIL_BUTTON_SOURCES = ["netlify/lib/client-emails-shared.mjs", "netlify/functions/lead-leak-audit-background.mjs"];

export function scanEmailButtonLabels(root) {
  const labels = new Set();
  for (const f of EMAIL_BUTTON_SOURCES) {
    const src = readFileSync(join(root, f), "utf8");
    for (const m of src.matchAll(/\b(?:button|emailButton)\(\s*"([^"]+)"/g)) labels.add(m[1]);
    // The portal button on the weekly summary changes with what the client sells.
    for (const m of src.matchAll(/\bseeAll:\s*"([^"]+)"/g)) labels.add(m[1]);
  }
  return [...labels].sort();
}
