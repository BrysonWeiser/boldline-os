/*
 * OS/portal render harness — screenshot the REAL app (headless Chromium) so we can
 * self-QA layout on desktop + mobile before shipping, instead of relying on Bryson's
 * screenshots for the obvious stuff. See knowledge/os-screenshot-harness.md.
 *
 * It stubs Supabase + auth with sample clients/leads, swaps the CDN <script>s for
 * local copies, runs the actual index.html app, and captures PNGs.
 *
 * RUN (deps are ephemeral — install into a temp dir each time):
 *   DIR=$(mktemp -d); cd "$DIR"
 *   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright react@18 react-dom@18 @babel/standalone@7.23.5
 *   NODE_PATH="$DIR/node_modules" PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node /home/user/boldline-os/tools/os-screenshot.js "$DIR/shots"
 *
 * NOTE: headless Chromium has no address bar, so mobile-browser-chrome bugs
 * (e.g. vh vs dvh sheet clipping) will NOT reproduce here — those still need a real
 * phone screenshot. Everything else (layout, overflow, popup position) is checkable.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const REPO = path.resolve(__dirname, "..");
const OUT = process.argv[2] || path.join(process.cwd(), "shots");
const RENDER = fs.mkdtempSync(path.join(require("os").tmpdir(), "osrender-"));
fs.mkdirSync(OUT, { recursive: true });

// auto-detect the pre-installed Chrome (build number varies)
function findChrome() {
  const root = "/opt/pw-browsers";
  const dir = fs.existsSync(root) && fs.readdirSync(root).find(d => /^chromium-\d+$/.test(d));
  const p = dir && path.join(root, dir, "chrome-linux/chrome");
  return p && fs.existsSync(p) ? p : undefined; // undefined => Playwright default
}

const nm = (m) => path.dirname(require.resolve(m + "/package.json"));
fs.copyFileSync(path.join(nm("react"), "umd/react.production.min.js"), path.join(RENDER, "react.js"));
fs.copyFileSync(path.join(nm("react-dom"), "umd/react-dom.production.min.js"), path.join(RENDER, "react-dom.js"));
fs.copyFileSync(path.join(nm("@babel/standalone"), "babel.min.js"), path.join(RENDER, "babel.js"));

const bs = { intake:"done",ceo:"done",research:"done",avatar:"done",offer:"done",funnel:"done",architect:"active",copy:"waiting" };
const base = (o) => Object.assign({
  email:"owner@example.com", contactName:"", businessPhone:"(602) 555-0100", businessAddress:"Phoenix, AZ",
  adBudget:"$3,000/mo", contractSigned:true, intakeComplete:true, healthScore:null,
  alerts:[], commLog:[], leadsLog:[], upgradeRequest:null, botStatuses:bs,
  campaignSetup:{serviceArea:"Metro Phoenix",mainOffer:"",avgTicket:"$5,000",targetLocations:"Phoenix, Scottsdale",excludedKeywords:"",leadDestination:"owner@example.com",crmSystem:""},
  brandVoice:{tone:"Professional",competitors:"",differentiator:"Fast, reliable, local"},
  mediaLibrary:[], callTrackingNumber:"", callTrackingNumberSid:"",
  landingPage:{headline:"",subheadline:"",bullets:[],ctaText:"",published:false,generatedAt:null},
  pendingActions:[], googleAdsCustomerId:"", portalToken:"tok-"+o.id, leadToken:"lead-"+o.id,
  landingSlug:o.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-x1",
}, o);
const CLIENTS = [
  base({ id:"c1", name:"Summit Roofing", niche:"Roofing", packageId:"g-growth", stage:"optimizing", contractStatus:"active", contractStart:"2026-04-01", contractEnd:"2026-10-01", leads:37, cpl:61, contactName:"Marcus Bell" }),
  base({ id:"c2", name:"Luxe Med Spa", niche:"Med Spa", packageId:"c-growth", stage:"active", contractStatus:"active", contractStart:"2026-05-01", contractEnd:"2026-07-23", leads:52, cpl:34, contactName:"Dana Reyes" }),
  base({ id:"c3", name:"Apex Auto Detailing", niche:"Auto Detailing", packageId:"m-launch", stage:"building", contractStatus:"pending", contractStart:"2026-06-20", contractEnd:"2026-09-20", leads:0, cpl:0, contactName:"Tony Vasquez" }),
];
const LEADS = [
  { id:"l1", name:"Sarah Kim", phone:"(602) 555-0148", email:"sarah@ex.com", status:"new", source:"landing_page", created_at:"2026-07-06T15:12:00Z", notes:"" },
  { id:"l2", name:"Mike Ortiz", phone:"(480) 555-0193", email:"mike@ex.com", status:"contacted", source:"landing_page", created_at:"2026-07-05T18:40:00Z", notes:"Called" },
];

const STUB = `<script>(function(){
  var CLIENTS=${JSON.stringify(CLIENTS)},LEADS=${JSON.stringify(LEADS)};
  function q(t){var rows=t==="clients"?CLIENTS.map(function(c){return{id:c.id,data:c};}):LEADS;var p=Promise.resolve({data:rows,error:null});var a={select:function(){return a;},order:function(){return a;},insert:function(){return Promise.resolve({error:null});},update:function(){return a;},delete:function(){return a;},eq:function(){return Promise.resolve({error:null});},then:function(r,j){return p.then(r,j);}};return a;}
  var ch={on:function(){return ch;},subscribe:function(){return ch;}};
  window.supabase={createClient:function(){return{auth:{getSession:function(){return Promise.resolve({data:{session:{user:{id:"demo"}}}});},onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}};},signInWithPassword:function(){return Promise.resolve({error:null});},signOut:function(){return Promise.resolve({error:null});}},from:q,channel:function(){return ch;},removeChannel:function(){}};}};
})();</script>`;

let html = fs.readFileSync(path.join(REPO, "index.html"), "utf8")
  .replace('<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>', '<script src="react.js"></script>')
  .replace('<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>', '<script src="react-dom.js"></script>')
  .replace('<script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>', '<script src="babel.js"></script>')
  .replace('<script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>', STUB);
fs.writeFileSync(path.join(RENDER, "os.html"), html);

const TYPES = { ".html":"text/html", ".js":"text/javascript" };
const server = http.createServer((req, res) => {
  fs.readFile(path.join(RENDER, decodeURIComponent(req.url.split("?")[0])), (e, buf) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(req.url)] || "application/octet-stream" });
    res.end(buf);
  });
});
const ready = (page) => page.waitForFunction(() => {
  const r = document.getElementById("root");
  return r && r.textContent && (r.textContent.includes("Home") || r.textContent.includes("Client"));
}, { timeout: 25000 }).then(() => page.waitForTimeout(1200));

(async () => {
  const errs = [];
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/os.html`;
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ["--no-sandbox"] });

  // DESKTOP — real desktop width (>1024 breakpoint) so the sidebar shell renders
  const dctx = await browser.newContext({ viewport: { width:1440, height:900 }, deviceScaleFactor:1.5 });
  const dp = await dctx.newPage(); dp.on("pageerror", e => errs.push("desktop: "+e.message));
  await dp.goto(url, { waitUntil:"domcontentloaded" });
  try {
    await ready(dp);
    await dp.screenshot({ path: path.join(OUT,"os-home-desktop.png") }); console.log("shot: os-home-desktop");
    await dp.getByText("Expiring", { exact:false }).first().click({ timeout:5000 }); await dp.waitForTimeout(700);
    await dp.screenshot({ path: path.join(OUT,"os-segment-desktop.png") }); console.log("shot: os-segment-desktop");
    await dp.getByText("Dashboard", { exact:true }).first().click({ timeout:5000 }); await dp.waitForTimeout(500);
    await dp.getByText("Revenue", { exact:true }).first().click({ timeout:5000 }); await dp.waitForTimeout(700);
    await dp.screenshot({ path: path.join(OUT,"os-revenue-desktop.png") }); console.log("shot: os-revenue-desktop");
    await dp.getByText("Dashboard", { exact:true }).first().click({ timeout:5000 }); await dp.waitForTimeout(500);
    await dp.getByText("Summit Roofing", { exact:false }).first().click({ timeout:5000 }); await dp.waitForTimeout(800);
    await dp.screenshot({ path: path.join(OUT,"os-client-desktop.png") }); console.log("shot: os-client-desktop");
    await dp.getByText("Leads", { exact:true }).first().click({ timeout:5000 }); await dp.waitForTimeout(600);
    await dp.screenshot({ path: path.join(OUT,"os-leads-desktop.png") }); console.log("shot: os-leads-desktop");
  } catch(e){ errs.push("desktop flow: "+e.message); }
  await dctx.close();

  const mctx = await browser.newContext({ viewport: { width:390, height:844 }, deviceScaleFactor:3, isMobile:true, hasTouch:true });
  const mp = await mctx.newPage(); mp.on("pageerror", e => errs.push("mobile: "+e.message));
  await mp.goto(url, { waitUntil:"domcontentloaded" });
  try {
    await ready(mp);
    await mp.screenshot({ path: path.join(OUT,"os-home-mobile.png") }); console.log("shot: os-home-mobile");
    // stat segment (tap the Alerts tile — unique tile text is "Alerts ›")
    await mp.getByText("Alerts ›", { exact:false }).first().click({ timeout:5000 }); await mp.waitForTimeout(800);
    await mp.screenshot({ path: path.join(OUT,"os-segment-mobile.png") }); console.log("shot: os-segment-mobile");
    await mp.getByText("‹").first().click({ timeout:5000 }); await mp.waitForTimeout(500);
    // revenue breakdown (tap the MRR hero card)
    await mp.getByText("Monthly Recurring Revenue", { exact:false }).first().click({ timeout:5000 }); await mp.waitForTimeout(800);
    await mp.screenshot({ path: path.join(OUT,"os-revenue-mobile.png") }); console.log("shot: os-revenue-mobile");
    await mp.getByText("Revenue by Client", { exact:false }).first().waitFor({ timeout:5000 });
    await mp.getByText("‹").first().click({ timeout:5000 }); await mp.waitForTimeout(500);
    await mp.getByText("Summit Roofing", { exact:false }).first().click({ timeout:5000 }); await mp.waitForTimeout(900);
    await mp.screenshot({ path: path.join(OUT,"os-client-mobile.png") }); console.log("shot: os-client-mobile");
    await mp.getByText("Pipeline", { exact:true }).first().click({ timeout:5000 }); await mp.waitForTimeout(700);
    await mp.getByText("Market Research", { exact:false }).first().click({ timeout:5000 }); await mp.waitForTimeout(900);
    await mp.screenshot({ path: path.join(OUT,"os-botsheet-mobile.png") }); console.log("shot: os-botsheet-mobile");
  } catch(e){ errs.push("mobile flow: "+e.message); }
  await mctx.close();

  await browser.close(); server.close();
  if (errs.length) { console.log("\n--- app errors ---"); errs.forEach(x => console.log(x)); }
  console.log("\nDONE →", OUT);
})().catch(e => { console.error("HARNESS FAIL:", e); process.exit(1); });
