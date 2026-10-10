// Replacing a SIGNED agreement (Bryson, 2026-10-09, Springbok: "I need to cancel that contract he signed and make a new
// one ... he signed it by mistake") and the signed copy fitting a phone ("it's to big and it doesn't"). What has to
// stay true:
//  1. The new agreement says in writing that it replaces and cancels the signed one (both copies of the template).
//  2. Replacing keeps the signed copy on the record, unlocks the terms, and clears the old envelope so a new one sends.
//  3. The client keeps counting as signed until the new one is signed (the old one still binds).
//  4. The signed PDF is drawn at page width and shrunk to the screen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const require = createRequire(import.meta.url);
const { makeContractHTML } = require("../netlify/lib/contract-shared.cjs");
const F = await import("../netlify/lib/founding.mjs");

const cl = { id: "sb", name: "Springbok Chiropractic", contactName: "Brendon Gibb", email: "b@x.example", packageId: "g-launch", billingPerLead: 40,
  replacesAgreement: { envelopeId: "0259A1B9-F199-88EE-80E1-011D1DA29211", signedAt: "2026-10-06T20:00:00Z" } };
const h = makeContractHTML(cl, null, "/logo.png");
ok("🔴 the new agreement says it replaces and cancels the signed one, with its date and envelope", /This Agreement replaces an earlier one/.test(h) && /signed on October 6, 2026/.test(h) && /0259A1B9-F199-88EE-80E1-011D1DA29211/.test(h) && /that earlier agreement is cancelled and has no further effect, and nothing is owed under it/.test(h));
ok("an ordinary agreement says nothing about it", !/replaces an earlier one/.test(makeContractHTML({ ...cl, replacesAgreement: undefined }, null, "/logo.png")));
ok("an odd envelope id can't inject anything", !/<script/.test(makeContractHTML({ ...cl, replacesAgreement: { envelopeId: "<script>x</script>", signedAt: "2026-10-06T20:00:00Z" } }, null, "/logo.png").split("replaces an earlier one")[1].slice(0, 400)));
ok("🔴 the OS copy of the template carries the same clause", UI.includes("This Agreement replaces an earlier one.</strong> It replaces the Advertising Services Agreement between the parties signed on '+new Date(cl.replacesAgreement.signedAt)"));
ok("no dashes in it", !/[—–]/.test(h.split("replaces an earlier one")[1].slice(0, 400)));

// 2. The OS action
const card = UI.slice(UI.indexOf("function ReplaceAgreementCard("), UI.indexOf("function ContractTabContent("));
ok("🔴 the signed copy is kept on the record", /contractHistory:\[prev,\.\.\.\(client\.contractHistory\|\|\[\]\)\]\.slice\(0,10\)/.test(card) && /signedContractPath:client\.signedContractPath/.test(card));
ok("🔴 the terms unlock and the old envelope is cleared, so a new one can be sent", /contractSigned:false,contractStatus:"pending",docusignEnvelopeId:"",docusignStatus:"",docusignSentAt:"",contractSignedAt:"",signedContractPath:""/.test(card));
ok("it asks first and explains why DocuSign can't just cancel it", /window\.confirm\(`Replace/.test(card) && /DocuSign can't cancel a signed agreement/.test(card));
ok("it only shows on a signed agreement, never the house account", /\{client\.contractSigned&&!client\.internal&&<ReplaceAgreementCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
ok("while replacing, the send card says what the new agreement does", /This replaces the agreement signed /.test(UI));
ok("the server unlocks terms as soon as the agreement is no longer marked signed", /row\.data\.contractSigned\)/.test(src("netlify/functions/contract-terms.mjs")));

// 3. Still counted
ok("🔴 a client replacing a signed agreement still counts (the old one binds until the new one is signed)", F.isFoundingClient({ contractSigned: false, contractStatus: "pending", replacesAgreement: { signedAt: "2026-10-06T20:00:00Z" } })
  && !F.isFoundingClient({ contractSigned: false, contractStatus: "pending" }) && /c\.replacesAgreement && c\.replacesAgreement\.signedAt/.test(UI));

// 4. The phone
const fit = UI.slice(UI.indexOf("function FitFrame("), UI.indexOf("function SignedContractCard("));
const pp = UI.slice(UI.indexOf("function PdfPages("), UI.indexOf("function SignedContractCard("));
ok("🔴 the signed PDF is drawn page by page, trimmed to the writing, so it reads on a phone", /<PdfPages url=\{link\.url\}\/>/.test(UI) && /const k = cssW \/ \(x1 - x0\);/.test(pp) && /offsetX: -x0 \* k \* dpr/.test(pp));
ok("the envelope stamp along the top is left out of the trim", /it\.transform\[5\] > vy1 - 36/.test(UI));
ok("🔴 pdf.js runs with eval off", /isEvalSupported: false/.test(pp));
ok("if pdf.js cannot load, the shrunk frame is shown at the letter page's real width", /<FitFrame src=\{url\} title="Signed agreement" natural=\{612\}/.test(pp) && /const k=w&&w<natural\?w\/natural:1;/.test(fit));
ok("the responsive contract previews are never shrunk", (UI.match(/<FitFrame srcDoc=\{html\} title="(Contract|Current terms)" natural=\{1\}/g) || []).length === 2);

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-contract-replace: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
