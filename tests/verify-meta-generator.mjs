// Meta launch card wiring + seed-client safety. Run: node tests/verify-meta-generator.mjs
//
// The generator's `meta` action existed unused for days: the function shipped it, the
// tests covered it, and MetaLaunchCard still used its template seed. Nothing caught that
// because "the action exists" and "something calls it" are different facts. These
// assertions check the CALL SITE, not the endpoint.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? " — " + d : ""));

const src = readFileSync("index.html", "utf8");
// Slice to the next TOP-LEVEL declaration. A bare indexOf("function ") stops at the
// first nested function expression, which silently truncates the body to nothing.
const cardStart = src.indexOf("function MetaLaunchCard");
const nextTop = src.indexOf("\nfunction ", cardStart + 30);
const card = src.slice(cardStart, nextTop > 0 ? nextTop : src.length);

// Sanity-check the slice itself first. If it were the whole file, or empty, every
// assertion below would pass or fail for the wrong reason.
ok("MetaLaunchCard slice found", cardStart > 0);
ok("slice is bounded, not the rest of the file", card.length > 2000 && card.length < 60000, `${card.length} chars`);
ok("slice really is the Meta card", /const linked = client\.metaAdAccountId/.test(card));
ok("slice does not swallow the next component", !/function GoogleLaunchCard/.test(card));

// ── the card actually calls the generator ────────────────────────────────────
ok("MetaLaunchCard calls the generator", /adGenBackground\(/.test(card));
ok("it asks for the meta action", /action:\s*"meta"/.test(card));
ok("it goes through the BACKGROUND path, not the sync one",
  /adGenBackground\(\{\s*action:\s*"meta"/.test(card.replace(/\s+/g, " ").replace(/adGenBackground\( \{/, "adGenBackground({")) || /adGenBackground\(\{ action:"meta"/.test(card.replace(/\s+/g, " ")),
  "the sync endpoint refuses meta and returns 400");
ok("it passes the clientId the background job stores its result against", /clientId:\s*client\.id/.test(card));
ok("it flags the house account so the agency prompt is used", /agency:\s*!!client\.internal/.test(card));

// ── picking a variant fills the real fields ──────────────────────────────────
ok("applying a variant sets the headline", /headline:\s*humanizeAdCopy\(v\.headline\)/.test(card));
ok("applying a variant sets the primary text", /primaryText:\s*humanizeAdCopy\(v\.primaryText\)/.test(card));
ok("generated copy goes through humanizeAdCopy (the em-dash ban)",
  (card.match(/humanizeAdCopy\(v\./g) || []).length >= 3);
ok("a variant can be picked", /setGenPick\(/.test(card));
ok("the generated set can be discarded", /setGen\(null\)/.test(card));
ok("the first variant is applied automatically", /applyVariant\(vs\[0\]\)/.test(card));
ok("an empty result is treated as an error, not silently accepted", /no usable variants/.test(card));

// ── the Google card is untouched ─────────────────────────────────────────────
const gcard = src.slice(src.indexOf("function GoogleLaunchCard"), cardStart);
ok("Google card still asks for the google action", /action:\s*"google"/.test(gcard));
ok("Google card does not ask for meta", !/action:\s*"meta"/.test(gcard));

// ── seed clients cannot reach a real inbox ───────────────────────────────────
const seed = src.slice(src.indexOf("const INIT_CLIENTS = ["), src.indexOf("// ─── AI HOOK"));
const emails = [...seed.matchAll(/email:"([^"]+)"/g)].map((m) => m[1]);
ok("seed clients exist to check", emails.length === 3, `found ${emails.length}`);
ok("every seed email is unroutable (RFC 2606)", emails.every((e) => /@example\.com$/.test(e)), emails.join(" "));
ok("no seed client points at a plausible real domain",
  !/apexroofing\.com"|luxemedspa\.com"|detailkingatl\.com"/.test(seed));
ok("every seed client is flagged demo", (seed.match(/demo:true/g) || []).length === 3,
  `found ${(seed.match(/demo:true/g) || []).length}`);

// ── the render harness cannot silently use the wrong toolchain ───────────────
const harness = readFileSync("tools/os-screenshot.js", "utf8");
ok("harness resolves deps from NODE_PATH/cwd before the repo", /paths:\s*searchPaths/.test(harness));
ok("harness checks Babel against the version index.html pins", /@babel\\\/standalone@\(\[/.test(harness) || /babelVer !== pinned/.test(harness));
ok("harness exits rather than rendering with the wrong Babel", /process\.exit\(1\)/.test(harness));
const pinned = (src.match(/@babel\/standalone@([\d.]+)/) || [])[1];
ok("index.html still pins a Babel version for it to match", !!pinned, String(pinned));

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-meta-generator: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
