// The privacy policy must describe the trackers the site ACTUALLY runs, and nothing it does not.
// Run: node tests/verify-privacy-disclosure.mjs
//
// Found 2026-09-24: the policy said "We do not run third-party advertising or cross-site tracking
// on this website" and "This site uses only the minimal cookies needed to function", while every
// page loaded Google Analytics and Microsoft Clarity and the Get Started page loaded the Meta Pixel
// and a Google Ads conversion tag. Meta's own terms require a policy that discloses the pixel.
//
// 🔴 THE TRACKERS ARE DISCOVERED FROM THE PAGES, NEVER LISTED BY HAND. The failure this guards
// against is exactly a tracker being added to a page without anyone opening privacy.html, so a
// hand-kept list would go stale the same way the old policy did. Where the policy makes a claim
// that a code change could falsify ("Get Started page only", "we don't send Meta your email"),
// the claim is checked against the code, not trusted.

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
const pages = htmlFiles(SITE).map((f) => ({ rel: f.slice(SITE.length + 1), html: readFileSync(f, "utf8") }));
const privacyRaw = readFileSync(join(SITE, "privacy.html"), "utf8");
// What a visitor reads: the article body, with scripts and comments removed.
const body = (privacyRaw.split('<div class="article-body')[1] || "").split("</main>")[0]
  .replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
const text = body.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

// 🔴 A NAME MENTIONED IN PASSING IS NOT A DISCLOSURE. The first version checked the whole page, so
// deleting the paragraph that explains Clarity still passed because "Microsoft Clarity" also
// appears in the cookie and sharing lists. Each tool has to be EXPLAINED in the section written to
// explain them, as the first words of its own list item.
const toolsSection = (body.split("<h2>Analytics and advertising tools</h2>")[1] || "").split("<h2>")[0];
ok("the policy has an analytics and advertising tools section", toolsSection.length > 200);
const explains = (name) => new RegExp("<li><strong>" + name + "</strong>[^<]{40,}").test(toolsSection);

const TRACKERS = [
  { name: "Google Analytics", label: "Google Analytics", finds: /googletagmanager\.com\/gtag\/js\?id=G-|gtag\('config',\s*'G-/, says: /Google Analytics/ },
  { name: "Microsoft Clarity", label: "Microsoft Clarity", finds: /clarity\.ms\/tag\//, says: /Microsoft Clarity/ },
  { name: "Meta Pixel", label: "Meta Pixel", finds: /connect\.facebook\.net\/[a-z_A-Z]+\/fbevents\.js|fbq\('init'/, says: /Meta Pixel/ },
  { name: "Google Ads conversion tag", label: "Google Ads conversion tracking", finds: /gtag\('config',\s*'AW-/, says: /Google Ads conversion tracking/ },
];

for (const t of TRACKERS) {
  const on = pages.filter((p) => t.finds.test(p.html)).map((p) => p.rel);
  if (on.length) {
    ok(`🔴 ${t.name} runs on ${on.join(", ")}, and the policy explains it`, explains(t.label),
      "a tracker the policy does not explain is a policy that is not true");
  } else {
    ok(`${t.name} is not on any page, so the policy must not describe it`, !explains(t.label) && !t.says.test(text),
      "the policy must not describe tools that are not present");
  }
}

// 🔴 CLAIMS A CODE CHANGE COULD FALSIFY, checked against the code.
const everyPage = (re) => pages.every((p) => re.test(p.html));
for (const [name, re] of [["Google Analytics", TRACKERS[0].finds], ["Microsoft Clarity", TRACKERS[1].finds]]) {
  if (/runs on every page/.test(text.split(name)[1] || "")) {
    ok(`"${name} runs on every page" is true`, everyPage(re),
      pages.filter((p) => !re.test(p.html)).map((p) => p.rel).join(", ") + " lack it");
  }
}
for (const [name, re] of [["Meta Pixel", TRACKERS[2].finds], ["Google Ads conversion tracking", TRACKERS[3].finds]]) {
  const on = pages.filter((p) => re.test(p.html)).map((p) => p.rel);
  const claimsOnly = new RegExp(name + " runs on our Get Started page only").test(text);
  if (claimsOnly) ok(`🔴 "${name} runs on our Get Started page only" is true`,
    on.length > 0 && on.every((r) => r === "get-started/index.html"), `actually on: ${on.join(", ") || "nowhere"}`);
}
const gs = (pages.find((p) => p.rel === "get-started/index.html") || {}).html || "";
if (/We don't send Meta your name, email address or phone number/.test(text)) {
  ok("🔴 \"we don't send Meta your details\" is true: no advanced matching in the pixel",
    !/fbq\('init',\s*[^)]*,\s*\{/.test(gs) && !/\b(em|ph|fn|ln)\s*:\s*[^,}]*(email|phone|name)/i.test(gs),
    "the pixel is being passed customer details, so that sentence is now false");
}
if (/We don't send Google your name, email address or phone number/.test(text)) {
  ok("🔴 \"we don't send Google your details\" is true: no enhanced conversions data",
    !/user_data|enhanced_conversion|allow_enhanced_conversions/.test(gs),
    "the Google Ads tag is being passed customer details, so that sentence is now false");
}

// The old, false sentences must never come back.
for (const stale of [/We do not run third-party advertising/, /minimal cookies needed to function/,
                     /If we add website analytics in the future/, /don't share it for others' advertising/]) {
  ok(`the old false claim ${stale} is gone`, !stale.test(text));
}

// A visitor who wants out has somewhere to go.
ok("the Google Analytics opt-out add-on is linked", /href="https:\/\/tools\.google\.com\/dlpage\/gaoptout"/.test(body));
ok("Google's ad settings are linked", /href="https:\/\/myadcenter\.google\.com\/"/.test(body));
ok("Meta's ad preferences are explained and linked", /Ad preferences/.test(text) && /facebook\.com\/help\//.test(body));
ok("cookies can be refused and the site still works", /block or delete cookies in your browser settings/.test(text));

// Client-facing copy rules from CLAUDE.md.
ok("no em or en dash anywhere a visitor reads", !/[—–]/.test(text), (text.match(/.{30}[—–].{30}/) || [""])[0]);
ok("the Text messages section is intact", /<h2>Text messages<\/h2>/.test(body) && /We do not share your mobile number or your consent/.test(text));
ok("the policy carries a last-updated date", /Last updated [A-Z][a-z]+ \d{1,2}, \d{4}/.test(privacyRaw));

console.log(`verify-privacy-disclosure: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
