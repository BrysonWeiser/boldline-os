// Results from one of Bryson's own businesses on boldlinemedia.com (Bryson, 2026-10-07: "I'm planning on
// also using what we do with that business as results we can show", then "can you make those two ideas").
// What has to stay true:
//  1. Only real numbers, only once there are enough to mean something, only when he switched it on, and
//     only for a business he owns. Nothing per lead ever leaves the OS.
//  2. It always says it is his own business, never a client's.
//  3. The preview in the OS and the section on the site use the very same arithmetic.
//  4. On the site it is hidden until real numbers arrive, and any failure leaves it hidden.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const S = await import("../netlify/lib/showcase.mjs");

const NOW = Date.parse("2026-10-07T20:00:00Z");
const ago = (d) => new Date(NOW - d * 864e5).toISOString();
const leads = (n, won = 0, d = 2) => Array.from({ length: n }, (_, i) => ({ receivedAt: ago(d), status: i < won ? "won" : "new", name: "Secret Customer", phone: "4805550100" }));
const BIZ = (o = {}) => ({ internal: true, owned: true, name: "Desert Gloss Detailing", niche: "Auto Detailing", businessAddress: "Gilbert, Arizona",
  showcase: { on: true }, adPerf: { totals: { spend30d: 640 } }, leadsLog: leads(16, 4), ...o });

// 1. The numbers and the gates
{
  const n = S.showcaseNumbers(BIZ(), NOW);
  ok("leads, spend, cost per lead and jobs won from the last 30 days", n.leads === 16 && n.spend === 640 && n.costPerLead === 40 && n.won === 4 && n.ready);
  const old = S.showcaseNumbers(BIZ({ leadsLog: [...leads(16, 4), ...leads(9, 0, 45)] }), NOW);
  ok("leads older than 30 days do not count", old.leads === 16);
  const fut = S.showcaseNumbers(BIZ({ leadsLog: [...leads(16), { receivedAt: new Date(NOW + 864e5).toISOString() }] }), NOW);
  ok("a lead stamped in the future does not count", fut.leads === 16);
  const thin = S.showcaseNumbers(BIZ({ leadsLog: leads(6) }), NOW);
  ok("🔴 too few leads: not ready, and it says how many more", !thin.ready && thin.short[0] === "4 more leads in the last 30 days");
  const noSpend = S.showcaseNumbers(BIZ({ adPerf: {} }), NOW);
  ok("🔴 no ad spend: not ready, and never a cost per lead of zero", !noSpend.ready && noSpend.costPerLead === null);
  ok("the minimums", S.SHOWCASE_MIN_LEADS === 10 && S.SHOWCASE_MIN_SPEND === 100);
  const items = S.showcaseItems([{ data: BIZ() }, { data: BIZ({ owned: false }) }, { data: BIZ({ showcase: { on: false } }) }, { data: BIZ({ leadsLog: leads(3) }) }, { data: { ...BIZ(), internal: false } }], NOW);
  ok("🔴 only an owned business, switched on, past the minimums", items.length === 1);
  ok("🔴 aggregates only: nothing per lead, no ad account, no customer names", Object.keys(items[0]).sort().join(",") === "costPerLead,label,leads,spend,updatedAt,window,won" && !JSON.stringify(items).includes("Secret Customer"));
}

// 2. Always his own business
{
  ok("🔴 the default description says it is his own business", S.showcaseLabel(BIZ()) === "Desert Gloss Detailing, our own auto detailing business in Gilbert, Arizona");
  const built = [src("marketing-site/index.html"), src("marketing-site/about/index.html")];
  ok("🔴 the site always adds that these are his numbers, not a client's", built.every((h) => h.includes("Our own business. We run it on the same system we sell, so these are our numbers, not a client's.")));
  ok("the OS says the same before he switches it on", UI.includes(`The site always adds: "Our own business. We run it on the same system we sell, so these are our numbers, not a client's."`));
  ok("no dashes in the site copy", !/[—–]/.test(src("marketing-src/proof.html")));
}

// 3. One arithmetic
{
  const mark = (s) => s.slice(s.indexOf("// SHOWCASE-MIRROR-START"), s.indexOf("// SHOWCASE-MIRROR-END"));
  ok("🔴 the OS copy is the server's, character for character", mark(UI).length > 200 && mark(UI) === mark(src("netlify/lib/showcase.mjs")));
  const os = new Function(`${mark(UI)}\nreturn { showcaseNumbers, showcaseLabel };`)();
  for (const c of [BIZ(), BIZ({ leadsLog: leads(4) }), BIZ({ adPerf: {} }), BIZ({ showcase: { on: true, label: "  Our own detailers  " } })]) {
    ok("and gives the same answer on the same record", JSON.stringify(os.showcaseNumbers(c, NOW)) === JSON.stringify(S.showcaseNumbers(c, NOW)) && os.showcaseLabel(c) === S.showcaseLabel(c));
  }
  ok("the card is on the Overview tab of an owned business only", /\{isOwned\(client\)&&<ShowcaseCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
}

// 4. On the site
{
  const P = src("netlify/functions/proof.mjs");
  ok("the endpoint reads only owned businesses", /\.eq\("data->>owned", "true"\)/.test(P) && /showcaseItems\(data \|\| \[\]\)/.test(P));
  ok("🔴 a failure answers with nothing to show, never an error the site would print", /return new Response\(JSON\.stringify\(\{ ok: true, items: \[\] \}\)/.test(P));
  ok("the website can read it", /"access-control-allow-origin": "\*"/.test(P));
  const built = [src("marketing-site/index.html"), src("marketing-site/about/index.html")];
  ok("🔴 the section is hidden in the page until real numbers arrive", built.every((h) => /<section class="x-sec proof-sec" id="own-results" style="padding-top:20px" hidden>/.test(h)));
  const JS = src("marketing-site/site.js");
  ok("the site asks the OS for them", JS.includes('fetch("https://os.boldlinemedia.com/.netlify/functions/proof", { credentials: "omit" })'));
  ok("🔴 it only shows itself when there is something to show", /if \(!d \|\| !d\.items \|\| !d\.items\.length\) return;/.test(JS) && JS.indexOf("sec.hidden = false") > JS.indexOf("d.items.forEach"));
  ok("🔴 numbers go in as text, never as markup", /el\("div", "proof-label", it\.label\)/.test(JS) && !/innerHTML\s*=\s*[^"']*it\./.test(JS));
  ok("a missing cost per lead is left out, not shown as $0", /if \(it\.costPerLead != null\) add/.test(JS));
  ok("the home page shows it just before the founder, the About page after him", built[0].indexOf('id="own-results"') < built[0].indexOf('class="f-strip') && built[1].indexOf('id="own-results"') > built[1].indexOf("founder"));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-showcase: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
