// A website client signs the WEBSITE agreement, never the ads agreement (Bryson, 2026-10-11: "make sure when we
// take on a website client that the website contract is what is used"). KB `website-builder` (agreement).
//  1. The OS hides the ads Contract tab for a website-only client and lands them on the Website tab, where the
//     website agreement is sent.
//  2. 🔴 Even if the ads Contract tab is reached anyway (an old tab, a deep link), its readiness check stops the send
//     and says why.
//  3. 🔴 The server refuses: docusign-send looks the client up and turns away a website-only client, and a real send
//     must name its client.
//  4. The website agreement itself is its own document, says it covers the website only, and the portal asks a
//     website client to sign that one.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const UI = src("index.html");

// 1
ok("the OS's website package is w-site", /const WEB_PKG_ID = "w-site";/.test(UI));
ok("a website client opens on the Website tab", /useState\(client\._initialTab\|\|\(isWebsiteOnly\(client\)\?"website":"overview"\)\)/.test(UI));
ok("🔴 the ads Contract tab is not shown to a website client", /!\(isWebsiteOnly\(client\)&&\[[^\]]*"contract"[^\]]*\]\.includes\(k\)\)/.test(UI));

// 2: run the real readiness check
const a = UI.indexOf("function contractGaps("), b = UI.indexOf("\n}\n", a);
let gaps; try { gaps = new Function(`const isWebsiteOnly=(cl)=>!!cl&&cl.packageId==="w-site"; const PER_LEAD={}; ${UI.slice(a, b + 2)}; return contractGaps;`)(); } catch (e) { fails.push("contractGaps runs: " + e.message); }
if (gaps) {
  const g = gaps({ packageId: "w-site", name: "X", email: "x@y.co" }, { id: "w-site", name: "Website Only" });
  ok("🔴 the ads agreement will not send for a website client, and says where theirs is", g.length >= 1 && /website client/i.test(g[0].what) && /Website tab/.test(g[0].where));
}
ok("the send handler re-checks those gaps before sending", /const sendDocuSign=async\(\)=>\{\s*if\(gaps\.length\)\{/.test(UI));
ok("the OS names the client when it sends", /documentHtml:html,clientId:client\.id,kind:"ads"/.test(UI));

// 3
const DS = src("netlify/functions/docusign-send.mjs");
ok("🔴 the server looks the client up and refuses a website client", /if \(isWebsiteOnlyRecord\(row\.data\)\) return json\(\{ ok: false, websiteClient: true/.test(DS) && /const isWebsiteOnlyRecord = \(d\) => !!d && d\.packageId === WEBSITE_ONLY_PKG;/.test(DS) && /export const WEBSITE_ONLY_PKG = "w-site";/.test(DS));
ok("🔴 a real send must name its client (only the connection test may not)", /if \(!isTest\) \{\s*const clientId = String\(body\.clientId \|\| ""\)\.trim\(\);\s*if \(!clientId\) return json/.test(DS));
ok("the check comes before anything is sent", DS.indexOf("isWebsiteOnlyRecord(row.data)") > 0 && DS.indexOf("isWebsiteOnlyRecord(row.data)") < DS.indexOf("await sendEnvelope(accessToken"));
ok("the website agreement does not go through that check (it has its own sender)", /sendEnvelope\(await getAccessToken\(\), \{ subject: `Please sign: your website agreement with BoldLine Media`/.test(src("netlify/functions/website-deal.mjs")));

// 4
const W = await import("../netlify/lib/website-deal.mjs");
const html = W.websiteAgreementHTML({ name: "Sample Co", email: "a@b.co" }, { price: 1500, plan: "half", care: 100 });
ok("the website agreement is its own document", /<h1>Website Design and Care Agreement<\/h1>/.test(html) && /Version WA-\d/.test(html));
ok("it says it covers the website only, and ads have their own agreement", /This Agreement covers the Website only\. Any advertising or other service BoldLine provides is covered by its own agreement/.test(html));
ok("it carries the signature anchor DocuSign signs on", /BL_SIGN_HERE/.test(html));
ok("the portal asks a website client to sign the website agreement", /websiteAgreementSection/.test(src("netlify/functions/portal.mjs")));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-website-contract-only: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
