// Demo websites built before a sales meeting, and the "buy it outright" version. KB `demo-sites`.
// Run: node tests/verify-demo-sites.mjs
//
// Bryson, 2026-10-20: "i want to build it for the full website for the company im cold calling when i hop on a meeting
// with them that way if they like it we just need to link their payment method", and "$2500 but if they want to
// include the $100/month for us to host it and do everything then itll be $1500 then the monthly".
// What this stops, worst first:
//  1. A demo (a business that agreed to nothing) sending an enquiry, counting a visit, or being indexed.
//  2. A site with the name of a business that asked not to be contacted.
//  3. A bought-outright site depending on us after handover, or being charged a monthly fee.
//  4. Private notes ("can't afford ads") reaching the copy a business reads.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { demoClientOf, demoExpired, demoSummary, DEMO_GUARD_JS, demoBarHTML, newDemoToken, validToken, DEMO_DAYS } from "../netlify/lib/demo-site.mjs";
import { renderDemo, parseDemoPath } from "../netlify/functions/demo-site.mjs";
import { demoThemeFor } from "../netlify/functions/demo-site-background.mjs";
import { exportSiteFiles, zipFiles } from "../netlify/lib/site-export.mjs";
import * as WD from "../netlify/lib/website-deal.mjs";
import { WEBSITE_OFFER } from "../netlify/lib/pricing-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const UI = read("index.html"), GET = read("netlify/functions/demo-site.mjs"), BG = read("netlify/functions/demo-site-background.mjs");
const SITE = read("netlify/functions/site.mjs"), DEAL = read("netlify/functions/website-deal.mjs"), TOML = read("netlify.toml");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const TOKEN = "abcdefghijklmnopqrstuvwx";
const prospect = (extra = {}) => ({ id: "p1", name: "Desert Shine Mobile Detail", niche: "Car Detailing", area: "Mesa, AZ",
  data: { city: "Mesa", state: "AZ", phone: "(480) 555-0141", address: "1 Main St, Mesa, AZ", services: ["Full detail", "Ceramic coating"], rating: 4.9, reviewCount: 88, reviewSource: "Google",
    ownerName: "Marco Ruiz", verdict: "Cannot afford ads, pitch a website.", notes: "said call after 2pm",
    demoSite: { token: TOKEN, status: "done", theme: "aurora", builtAt: new Date().toISOString(), content: DEMO_DETAIL.website.content, stock: [] }, ...extra } });

// ── 1. What the writer is told ───────────────────────────────────────────────
{
  const cl = demoClientOf(prospect());
  ok("their name, trade, town and public phone go in", cl.name === "Desert Shine Mobile Detail" && cl.niche === "Car Detailing" && cl.campaignSetup.serviceArea === "Mesa, AZ" && cl.businessPhone === "(480) 555-0141");
  ok("public facts go in, labelled as research", /Rated 4\.9 stars from 88 Google reviews/.test(cl.researchFacts) && /Owner: Marco\./.test(cl.researchFacts));
  ok("🔴 Bryson's private verdict and notes never reach the writer", !JSON.stringify(cl).includes("afford") && !JSON.stringify(cl).includes("2pm") && !cl.notes);
  ok("the copy writer has a line for research facts", /\["Public facts found in research", String\(cl\.researchFacts/.test(read("netlify/functions/site-build-background.mjs")));
  ok("a design that suits the trade", demoThemeFor("Car Detailing") === "aurora" && demoThemeFor("Epoxy Floors") === "cinematic" && demoThemeFor("Chiropractic") === "editorial" && demoThemeFor("x", "editorial") === "editorial");
}

// ── 2. The page: says what it is and sends nothing ───────────────────────────
{
  const pages = ["", "services", "about", "reviews", "contact"].map((pg) => renderDemo(prospect(), pg, { host: "os.boldlinemedia.com" }));
  ok("all five pages render", pages.every((p) => p.status === 200 && p.html));
  ok("🔴 the send-nothing guard is the very first script on every page", pages.every((p) => { const h = p.html; const g = h.indexOf("window.__DEMO_SITE=true"); return g > 0 && g < h.indexOf("<script", h.indexOf("<script") + 1) && g < h.indexOf("<style"); }));
  ok("🔴 every page says it's a preview for them", pages.every((p) => /Preview for Desert Shine Mobile Detail/.test(p.html) && /Not live yet/.test(p.html)));
  ok("🔴 never indexed", pages.every((p) => /<meta name="robots" content="noindex">/.test(p.html)));
  ok("🔴 no visit counter on a demo", pages.every((p) => !/site-hit/.test(p.html)));
  ok("🔴 every link stays inside the demo (absolute, never relative)", pages.every((p) => [...p.html.matchAll(/<a [^>]*href="([^"]*)"/g)].every((m) => /^(https:|tel:|mailto:|#)/.test(m[1]))) && /href="https:\/\/os\.boldlinemedia\.com\/demo\/abcdefghijklmnopqrstuvwx\/services\/"/.test(pages[0].html));
  ok("the three designs are one tap away, and keep the design as you click", /aria-label="Designs"/.test(pages[0].html) && /\?theme=editorial/.test(pages[0].html) && /\/services\/\?theme=editorial"/.test(renderDemo(prospect(), "", { host: "x.com", theme: "editorial" }).html));
  ok("an unknown page or the booking page is a 404", renderDemo(prospect(), "nope", { host: "x.com" }).status === 404 && renderDemo(prospect(), "book", { host: "x.com" }).status === 404);
  ok("🔴 the guard stops posts, beacons and form submits", /m!=='GET'&&m!=='HEAD'/.test(DEMO_GUARD_JS) && /navigator\.sendBeacon=function\(\)\{return true;\}/.test(DEMO_GUARD_JS) && /addEventListener\('submit',function\(e\)\{e\.preventDefault\(\);e\.stopImmediatePropagation\(\)/.test(DEMO_GUARD_JS) && /,true\);/.test(DEMO_GUARD_JS));
  // Run the guard for real: a POST must never reach the network.
  let reached = 0; const win = { fetch: () => { reached++; return Promise.resolve("net"); } }; const doc = { addEventListener() {} };
  new Function("window", "document", "navigator", "Response", "fetch", DEMO_GUARD_JS.replace(/window\.fetch/g, "window.fetch"))(win, doc, {}, class { constructor(b) { this.b = b; } }, win.fetch);
  win.fetch("/lead", { method: "POST" }); win.fetch("/x");
  ok("🔴 run for real: a POST is answered locally, a GET still loads", reached === 1);
  ok("🔴 nothing on the strip or in the guard has an emoji or a dash", !/\p{Extended_Pictographic}/u.test(demoBarHTML("X") + DEMO_GUARD_JS) && !/[—–]/.test(text(demoBarHTML("X")) + DEMO_GUARD_JS));
  ok("addresses: /demo/<token>/<page>/", parseDemoPath(new URL("https://h/demo/" + TOKEN + "/services/")).seg === "services" && parseDemoPath(new URL("https://h/x?token=" + TOKEN + "&page=about")).seg === "about");
  ok("the routes reach the demo function", /from = "\/demo\/:token\/:page\/"\s+to = "\/\.netlify\/functions\/demo-site\?token=:token&page=:page"/.test(TOML));
}

// ── 3. Links, expiry, privacy ────────────────────────────────────────────────
{
  const t = newDemoToken();
  ok("🔴 a long random link nobody can guess", validToken(t) && t.length >= 24 && newDemoToken() !== t && !validToken("short") && !validToken("../../etc"));
  ok(`it ends ${DEMO_DAYS} days after it was built`, !demoExpired({ builtAt: new Date(Date.now() - 29 * 864e5).toISOString() }) && demoExpired({ builtAt: new Date(Date.now() - 31 * 864e5).toISOString() }) && demoExpired({}));
  const sum = demoSummary(prospect().data.demoSite, "https://os.x.com");
  ok("the OS gets the status and link, never the copy", !("content" in sum) && sum.url === `https://os.x.com/demo/${TOKEN}/`);
  ok("🔴 a company that asked not to be contacted: no build, and an old link stops working", /if \(isBlocked\(p\)\) return json\(\{ ok: false, error: "They asked not to be contacted\." \}, 409\)/.test(BG) && /if \(!p \|\| !demo \|\| isBlocked\(p\)\) return plain\("Page not found"/.test(GET));
  ok("an ended link says so instead of showing the site", /if \(demoExpired\(demo\)\) return plain\("This preview has ended"/.test(GET));
  ok("🔴 every demo answer is private: never cached, never indexed", /"cache-control": "no-store", "x-robots-tag": "noindex, nofollow"/.test(GET));
  ok("a rebuild keeps the link already texted to them", /const token = validToken\(prev\.token\) \? prev\.token : newDemoToken\(\);/.test(BG));
  ok("only Bryson can build or read one", /supabase\.auth\.getUser\(jwt\)/.test(BG) && /if \(!\(await owner\(req, supabase\)\)\) return json\(\{ ok: false, error: "Not authenticated" \}, 401\)/.test(GET));
}

// ── 4. Buying: monthly, or outright ──────────────────────────────────────────
{
  ok("outright is $2,500 with no monthly fee", WEBSITE_OFFER.buyout === 2500 && WD.normTerms({ mgmt: "own" }).price === 2500 && WD.normTerms({ mgmt: "own", care: 100 }).care === 0);
  ok("the monthly plan stays $1,500 + $100", WD.normTerms({ mgmt: "care" }).price === 1500 && WD.normTerms({ mgmt: "care" }).care === 100);
  const own = text(WD.websiteAgreementHTML({ name: "Desert Shine", id: "c1" }, { mgmt: "own" }));
  ok("its own agreement title and a handover section", /Website Design and Purchase Agreement/.test(own) && /6\. Handover/.test(own) && /7\. After handover/.test(own) && /Bought outright\. No monthly charge/.test(own));
  ok("🔴 it promises no upkeep it won't get", !/Care Plan costs/.test(own) && !/Hosting costs/.test(own) && /BoldLine is not responsible for keeping it online/.test(own));
  ok("it owns the files once paid", /Client owns the Website as handed over: its words, its pages and its files/.test(own));
  ok("🔴 the other four versions read exactly as before", ["care", "hosting"].every((m) => { const h = text(WD.websiteAgreementHTML({ name: "X", id: "c1" }, { mgmt: m })); return /6\. Going live and the domain/.test(h) && !/Handover/.test(h); }));
  ok("no dash in the new wording", !/[—–]/.test(own));
  ok("the agreement version is WA-8 or later (the outright variant arrived in WA-8)", Number(String(WD.AGREEMENT_VERSION).replace("WA-", "")) >= 8);
  ok("🔴 the server forces no monthly fee for outright, whatever the form says", /care = body\.mgmt === "own" \? 0 : Number\(body\.care\)/.test(DEAL));
  ok("🔴 an outright site is never put live on our hosting", /if \(termsOf\(cl\)\.mgmt === "own"\) return json\(\{ ok: false, error: "They bought it outright, so we don't host it\./.test(DEAL));
  ok("the OS offers the fifth version and mirrors its price", /\["standard","own","Standard website, bought outright"/.test(UI) && /buyout:2500/.test(UI));
}

// ── 5. Handing the files over ────────────────────────────────────────────────
{
  const fake = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(2000).buffer });
  const out = await exportSiteFiles({ ...DEMO_DETAIL, intake: { how: "book" } }, { domain: "https://www.desertshine.com/x", email: "hi@desertshine.example", fetchImpl: fake });
  const names = out.files.map((f) => f.name);
  ok("every page, the photos, a sitemap, robots and a read-me", ["index.html", "services/index.html", "about/index.html", "reviews/index.html", "contact/index.html", "sitemap.xml", "robots.txt", "README.txt"].every((n) => names.includes(n)) && names.some((n) => /^images\/photo-1\./.test(n)));
  const pages = out.files.filter((f) => f.name.endsWith(".html")).map((f) => String(f.data));
  ok("🔴 every link points at THEIR domain, never ours, never relative", pages.every((h) => [...h.matchAll(/<a [^>]*href="([^"]*)"/g)].every((m) => /^(https:\/\/www\.desertshine\.com|https:\/\/(www\.)?google\.com|tel:|mailto:|#)/.test(m[1]))) && pages.every((h) => !/boldline/i.test(h.replace(/<!--[\s\S]*?-->/g, ""))));
  ok("🔴 the form goes to the business's own email, not our intake", /var MAILTO="hi@desertshine\.example"/.test(pages[4]) && /if\(MAILTO\)\{location\.href='mailto:'/.test(pages[4]));
  ok("🔴 online booking (our servers) is switched off", pages.every((h) => !/href="https:\/\/www\.desertshine\.com\/book\//.test(h) && !/fetch\('\/book/.test(h)) && !names.includes("book/index.html"));
  ok("no visitor counter and indexable", pages.every((h) => !/site-hit/.test(h) && !/content="noindex"/.test(h)));
  ok("photos are copied in and pointed at", out.photos > 0 && pages[0].includes("https://www.desertshine.com/images/photo-1."));
  // A real zip: walk its central directory and inflate each file.
  const zip = zipFiles(out.files);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(eocd + 10), cdOff = zip.readUInt32LE(eocd + 16);
  let p = cdOff, good = 0;
  for (let k = 0; k < count; k++) {
    const method = zip.readUInt16LE(p + 10), csize = zip.readUInt32LE(p + 20), usize = zip.readUInt32LE(p + 24), nlen = zip.readUInt16LE(p + 28), loff = zip.readUInt32LE(p + 42);
    const lnlen = zip.readUInt16LE(loff + 26), body = zip.subarray(loff + 30 + lnlen, loff + 30 + lnlen + csize);
    const raw = method === 8 ? inflateRawSync(body) : body;
    if (raw.length === usize) good++;
    p += 46 + nlen;
  }
  ok("🔴 the zip opens and every file comes out whole", count === out.files.length && good === count, `${good}/${count}`);
  ok("🔴 only for a site bought outright, and only once paid in full", /termsOf\(cl\)\.mgmt !== "own"\) return json\(\{ ok: false, error: "Only a website they bought outright/.test(SITE) && /!fullyPaid\(cl\)\) return json\(\{ ok: false, error: "The files are handed over once it's paid in full\." \}/.test(SITE));
  let threw = ""; try { await exportSiteFiles(DEMO_DETAIL, { domain: "", email: "a@b.co" }); } catch (e) { threw = e.message; }
  ok("it asks for their web address", /web address/.test(threw));
  ok("the read-me has no dash or emoji", !/[—–]/.test(String(out.files.find((f) => f.name === "README.txt").data)) && !/\p{Extended_Pictographic}/u.test(String(out.files.find((f) => f.name === "README.txt").data)));
}

// ── 6. The OS ────────────────────────────────────────────────────────────────
{
  ok("the demo box sits on Lead Scout and Outreach cards when he's selling a website", /\{outPitchOf\(p\)!=="ads"&&<DemoSiteBox prospect=\{p\} onCreateClient=\{onCreateClient\}\/>\}/.test(UI) && /\{outPitchOf\(cur\)!=="ads"&&<div style=\{\{marginBottom:10\}\}><DemoSiteBox prospect=\{cur\} onCreateClient=\{onCreateClient\}\/><\/div>\}/.test(UI));
  ok("both screens are handed the real way to add a client", UI.includes('onDealPrep={openDealPrep} onCreateClient={addClient}/>}') && (UI.match(/onDealPrep=\{openDealPrep\} onCreateClient=\{addClient\}\/>/g) || []).length === 2);
  const fn = UI.slice(UI.indexOf("function clientFromDemo("), UI.indexOf("function DemoSiteBox("));
  ok("🔴 'They want it' makes an unsigned website client, never a counted one", /clientFromMeeting\(\{\}, \{companyName:/.test(fn) && /WEB_PKG_ID\)/.test(fn) && !/contractSigned:true/.test(fn));
  ok("the demo becomes their website, not live", /website:\{content:demo\.content, stock:demo\.stock\|\|\[\], theme:demo\.theme\|\|"aurora", published:false/.test(fn));
  ok("the plan picked on the meeting seeds the agreement", /websitePlanChoice:plan==="own"\?"own":"care"/.test(fn) && /mgmt:client\.websitePlanChoice==="own"\?"own":"care"/.test(UI));
  ok("the two plans are the prices he set", /\$1,500 build, then \$100\/mo/.test(UI) && /\$2,500 once\. They get the site files/.test(UI));
  ok("🔴 the build state survives Lead Scout re-drawing its cards", /const DEMO_STORE=\{\}; const DEMO_SUBS=new Set\(\);/.test(UI));
  ok("the Website tab hands over files for an outright sale", /t\.mgmt==="own"&&step\(!!d\.handedOverAt,"Handover",<SiteFilesHandover/.test(UI));
}


// ── 7. Self-serve handover (Bryson: "after they pay there is a place for them to type their own web address and once
//       they do it automatically sends to them that way I dont have to do it manually where there could be mistakes")
{
  const PW = await import("../netlify/lib/portal-website.mjs");
  const { renderClientEmail } = await import("../netlify/lib/client-emails-shared.mjs");
  const PORTAL = read("netlify/functions/portal.mjs");
  const base = { id: "c1", name: "Desert Shine", packageId: "w-site", email: "hi@desertshine.example", website: { content: DEMO_DETAIL.website.content } };
  const terms = { mgmt: "own", plan: "full", price: 2500, care: 0 };
  const unpaid = { ...base, websiteDeal: { ...terms, agreement: { status: "completed", signedAt: "2026-10-20T18:00:00Z", terms }, invoices: { full: { id: "in_1", url: "https://invoice.stripe.com/x", amount: 2500 } } } };
  const paid = { ...unpaid, websiteDeal: { ...unpaid.websiteDeal, invoices: { full: { id: "in_1", amount: 2500, paidAt: "2026-10-20T19:00:00Z" } } } };
  ok("before payment the card says the files come the moment it's paid", /Ready to download here the moment your payment is in/.test(PW.siteFilesCardHTML(unpaid)) && !/wf-btn/.test(PW.siteFilesCardHTML(unpaid)));
  const card = PW.siteFilesCardHTML(paid);
  ok("🔴 once paid: the address twice, a download button, and the five minute guide", /id="wf-d"/.test(card) && /id="wf-d2"/.test(card) && /onclick="blFiles\(this\)"/.test(card) && /app\.netlify\.com\/drop/.test(card) && (card.match(/<li>/g) || []).length === 5);
  ok("and the way to hand it back to us (the monthly plan)", /onclick="blHostAsk\(this\)"/.test(card));
  ok("the card leads the Website tab once it's paid", PW.websitePortalHTML(paid, {}).indexOf('id="wf-card"') < PW.websitePortalHTML(paid, {}).indexOf("Your website</div>"));
  ok("hosted clients never see it", PW.siteFilesCardHTML({ ...paid, websiteDeal: { ...paid.websiteDeal, mgmt: "care", agreement: { ...paid.websiteDeal.agreement, terms: { ...terms, mgmt: "care" } } } }) === "");
  ok("the status says it's theirs, never 'we're putting it live'", PW.websiteStatus(paid).key === "own-ready" && !/putting your website live/.test(PW.websiteStatus(paid).text));
  ok("🔴 the portal script parses and catches a mismatch before asking the server", (() => { try { new Function(PW.WEBSITE_PORTAL_JS); return true; } catch { return false; } })() && /if\(x!==y\)/.test(PW.WEBSITE_PORTAL_JS));
  const dom = new Function(PW.WEBSITE_PORTAL_JS + ";return blDom;")();
  ok("an address is compared the way people type it", dom("https://www.Desert.com/") === "desert.com" && dom("desert.com") === "desert.com");
  ok("🔴 the server checks it all again: outright only, paid in full, both addresses the same", /if \(termsOf\(cl\)\.mgmt !== "own"\) return \{ statusCode: 403/.test(PORTAL) && /if \(!fullyPaid\(cl\)\) return \{ statusCode: 409/.test(PORTAL) && /The two addresses don't match/.test(PORTAL));
  ok("Bryson is told when they download, and when they ask us to host", /title: `\$\{cur\.name \|\| "A client"\} downloaded their website`/.test(PORTAL) && /wants you to host their website/.test(PORTAL));
  ok("asking us to host changes nothing about their plan", /if \(body\.hostRequest === true\)/.test(PORTAL) && !/hostRequest[\s\S]{0,900}websiteDeal: \{/.test(PORTAL.slice(PORTAL.indexOf("if (body.hostRequest === true)"), PORTAL.indexOf("if (body.hostRequest === true)") + 900)));
  const paidMail = renderClientEmail("website_payment", { contactName: "Marco Ruiz", businessName: "Desert Shine", amount: 2500, stage: "full", own: true, portalUrl: "https://os.x/portal?token=t" });
  ok("🔴 the paid-in-full email sends them straight to their files", /ready to download/.test(paidMail.subject) && /Get Your Website Files/.test(paidMail.html) && /portal\?token=t/.test(paidMail.html));
  const welcome = renderClientEmail("website_welcome", { contactName: "Marco", businessName: "Desert Shine", amount: 2500, payUrl: "https://pay.x", own: true, plan: "full", care: 0, portalUrl: "https://p" });
  ok("the welcome email (with the pay link) explains the outright steps, not hosting", /Pay the Invoice/.test(welcome.html) && /five minute guide/.test(welcome.html) && !/One small thing from you/.test(welcome.html));
  ok("🔴 no dash or emoji in anything the client reads here", ![card, paidMail.html, welcome.html].some((h) => /[—–]/.test(text(h)) || /\p{Extended_Pictographic}/u.test(text(h))));
  ok("the emails know it's outright", /own: termsOf\(cl\)\.mgmt === "own"/.test(read("netlify/lib/client-email-auto.mjs")));
}

console.log(`verify-demo-sites: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
