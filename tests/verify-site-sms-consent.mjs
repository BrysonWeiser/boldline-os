// Every phone field on the marketing site carries texting consent, and the privacy page explains it.
// Run: node tests/verify-site-sms-consent.mjs
//
// Bryson, 2026-09-24, straight after booking a meeting on a cold call: *"it wont let me text and it
// says i need to register with US carriers"*. US carriers (A2P 10DLC, filed through Quo) reject a
// texting registration when a form that collects a phone number has no consent wording beside it,
// and a rejection costs a resubmission fee and days. The site had three phone fields and no
// consent line on any of them, and the privacy page never mentioned texts.
//
// 🔴 A GUARD, NOT A MEMORY. The next form someone adds with a phone field has to carry the line
// too, or this fails. It checks every `type="tel"` it can FIND, never a hand-kept list.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "marketing-site");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const htmlFiles = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (["node_modules", "fonts", "netlify"].includes(f)) return [];
  return statSync(p).isDirectory() ? htmlFiles(p) : (f.endsWith(".html") ? [p] : []);
});

const CONSENT = /By providing your phone number, you agree to receive text messages from BoldLine Media[\s\S]{0,200}Message and data rates may apply\.[\s\S]{0,40}Reply STOP to opt out/;

let fields = 0;
for (const file of htmlFiles(SITE)) {
  const html = readFileSync(file, "utf8");
  const rel = file.slice(SITE.length + 1);
  const re = /<input\b[^>]*type="tel"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    fields++;
    // The consent must sit right after the field, before the form's button: "near the submission
    // form" is what the carrier reviewer looks for, and a line at the foot of the page is not it.
    const after = html.slice(m.index, m.index + 1400);
    const btn = after.search(/<button\b/);
    const zone = btn > 0 ? after.slice(0, btn) : after;
    const id = (/id="([^"]+)"/.exec(m[0]) || [])[1] || "(no id)";
    ok(`🔴 ${rel} #${id} has texting consent before its button`, CONSENT.test(zone),
      "carriers reject the texting registration without it");
    ok(`and ${rel} #${id} links the privacy policy from it`, /href="\/privacy"/.test(zone));
  }
}
ok("phone fields were actually found", fields >= 3, `found ${fields}`);

const privacy = readFileSync(join(SITE, "privacy.html"), "utf8");
ok("🔴 the privacy page has a text messages section", /<h2>Text messages<\/h2>/.test(privacy));
ok("🔴 and promises the number and consent are never shared for marketing",
  /We do not share your mobile number or your consent to receive text messages with any third party for their marketing/.test(privacy),
  "this sentence is the one reviewers look for");
ok("it explains STOP and HELP", /reply STOP/i.test(privacy) && /HELP for help/.test(privacy));
ok("it lists the texting provider", /<strong>Quo<\/strong> for business phone calls and text messages/.test(privacy));
ok("and it says phone numbers are collected at all", /email address, phone number,/.test(privacy));
ok("no em or en dash in the new wording", !/[—–]/.test((privacy.match(/<h2>Text messages<\/h2>[\s\S]*?<h2>/) || [""])[0]));

console.log(`verify-site-sms-consent: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
