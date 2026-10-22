// Founder video footage: the REAL OS (index.html) in headless Chromium, with the database and server calls
// answered by made-up sample businesses, so no real client ever appears. Based on tools/os-screenshot.js.
// node film.cjs <outdir> [shotName ...]
const fs = require("fs"), path = require("path"), http = require("http"), { execFileSync } = require("child_process");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const REPO = "/home/user/boldline-os", HERE = __dirname;
const OUT = process.argv[2] || path.join(HERE, "shots"); fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(3);
const RENDER = path.join(HERE, "render"); fs.mkdirSync(RENDER, { recursive: true });
const nm = (m) => path.join(HERE, "node_modules", m);
fs.copyFileSync(path.join(nm("react"), "umd/react.production.min.js"), path.join(RENDER, "react.js"));
fs.copyFileSync(path.join(nm("react-dom"), "umd/react-dom.production.min.js"), path.join(RENDER, "react-dom.js"));
fs.copyFileSync(path.join(nm("@babel/standalone"), "babel.min.js"), path.join(RENDER, "babel.js"));

const bs = { intake: "done", ceo: "done", research: "done", avatar: "done", offer: "done", funnel: "done", architect: "done", copy: "done" };
const now = Date.now(), ago = (h) => new Date(now - h * 3600e3).toISOString();
const base = (o) => Object.assign({
  email: "owner@example.com", contactName: "", businessPhone: "(602) 555-0100", businessAddress: "Phoenix, AZ",
  adBudget: "$1,500/mo", contractSigned: true, intakeComplete: true, healthScore: 92, alerts: [], commLog: [], upgradeRequest: null, botStatuses: bs,
  campaignSetup: { serviceArea: "Metro Phoenix", mainOffer: "", avgTicket: "$400", targetLocations: "Phoenix, Mesa", excludedKeywords: "", leadDestination: "owner@example.com", crmSystem: "" },
  brandVoice: { tone: "Friendly", competitors: "", differentiator: "Fast and reliable" }, mediaLibrary: [], callTrackingNumber: "", callTrackingNumberSid: "",
  landingPage: { headline: "", subheadline: "", bullets: [], ctaText: "", published: true, generatedAt: ago(200) },
  pendingActions: [], googleAdsCustomerId: "", portalToken: "tok-" + o.id, leadToken: "lead-" + o.id,
  landingSlug: o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-x1",
}, o);
const lead = (n, svc, src, h, st = "new") => ({ id: "L" + Math.random().toString(36).slice(2, 8), name: n, phone: "(480) 555-01" + String(10 + Math.floor(Math.random() * 80)), email: "", service: svc, source: src, receivedAt: ago(h), status: st });
// The welcome and access emails count as sent, so the client page has no "send the Welcome email" banner in shot.
const SENT = [{ date: "Oct 1, 2026", note: 'Sent "Welcome + Portal" email to owner@example.com', cat: "email", ts: now - 20 * 864e5 },
  { date: "Oct 2, 2026", note: 'Sent "Ad Account Access" email to owner@example.com', cat: "email", ts: now - 19 * 864e5 }];
const CLIENTS = [
  base({ id: "c1", name: "Summit Roofing", commLog: SENT, niche: "Roofing", packageId: "g-growth", stage: "optimizing", contractStatus: "active", billingStatus: "active", stripeCustomerId: "cus_demo", stripeSubscriptionId: "sub_demo", billingMonthly: 700, billingSetup: 0, contractStart: "2026-09-01", contractEnd: "2026-12-01", leads: 37, cpl: 61, contactName: "Marcus Bell",
    leadsLog: [lead("Sarah K.", "Roof repair", "Google ad", 3), lead("Mike O.", "Full replacement", "Landing page", 9), lead("Jen P.", "Inspection", "Google ad", 20), lead("Chris D.", "Leak repair", "Call", 30), lead("Ana R.", "Roof repair", "Meta ad", 52)] }),
  base({ id: "c2", name: "Luxe Med Spa", niche: "Med Spa", packageId: "c-growth", stage: "active", contractStatus: "active", contractStart: "2026-08-15", contractEnd: "2026-11-15", leads: 52, cpl: 34, contactName: "Dana Reyes",
    leadsLog: [lead("Taylor M.", "Botox consult", "Meta ad", 5), lead("Jess L.", "Facial", "Landing page", 14)] }),
  base({ id: "c3", name: "Apex Auto Detailing", niche: "Auto Detailing", packageId: "m-launch", stage: "building", contractStatus: "pending", contractStart: "2026-10-27", contractEnd: "2027-01-27", leads: 0, cpl: 0, contactName: "Tony Vasquez", leadsLog: [] }),
];
const LEADS = [];
const P = (id, name, city, niche, score, rating, rc, extra = {}) => ({ id, name, niche, area: city + ", AZ", score, status: "new",
  data: Object.assign({ name, city, state: "AZ", rating, reviewCount: rc, googleAds: "no", metaAds: "no", completeness: 80 + (score % 15),
    phones: [{ number: "(480) 555-0" + (100 + score), kind: "main", whose: "business", source: "Google" }], website: "", ownerName: "",
    siteCheck: { state: "weak", seen: ["No way to book online", "No reviews on the page"] },
    verdict: "Busy shop with strong reviews and no ads running. A good first call." }, extra.data || {}),
  scoreFactors: [{ label: "Fit", points: 24, max: 25, why: "Exactly the kind of business we help" }, { label: "Can afford it", points: 20, max: 20, why: "Several staff and steady work" }], ...extra.top });
const PROSPECTS = [
  P("p1", "Northline Auto Detailing", "Mesa", "Car Detailing", 88, 4.8, 96),
  P("p2", "Summit Handyman Co.", "Gilbert", "Handyman", 82, 4.9, 130),
  P("p3", "Bluebird Pet Grooming", "Chandler", "Pet Grooming", 77, 4.7, 211),
  P("p4", "Ridgeway Remodeling", "Tempe", "Remodeling", 71, 4.6, 58),
  P("p5", "Copper Canyon Landscaping", "Scottsdale", "Landscaping", 64, 4.5, 41),
];
const API = {
  "lead-scout": (u) => u.includes("action=prospects") ? { ok: true, prospects: PROSPECTS, counts: { ads: 5, website: 0, both: 0 } }
    : u.includes("action=facets") ? { ok: true, total: 48, niches: [{ value: "Car Detailing", count: 21 }, { value: "Handyman", count: 15 }, { value: "Pet Grooming", count: 12 }], areas: [{ value: "Mesa, AZ", count: 18 }, { value: "Gilbert, AZ", count: 16 }, { value: "Chandler, AZ", count: 14 }] }
    : u.includes("action=providers") ? { ok: true, providers: { places: true, apollo: true } } : { ok: true },
  "outreach": (u) => u.includes("action=queue") ? { ok: true, queue: PROSPECTS, waiting: 0, counts: { ads: 5, website: 0, both: 0 } }
    : u.includes("action=touches") ? { ok: true, touches: [] } : { ok: true },
};
const STUB = `<script>(function(){
  var CLIENTS=${JSON.stringify(CLIENTS)},LEADS=${JSON.stringify(LEADS)},API_KEYS=${JSON.stringify(Object.keys(API))};
  function q(t){var rows=t==="clients"?CLIENTS.map(function(c){return{id:c.id,data:c};}):[];var p=Promise.resolve({data:rows,error:null});var a={select:function(){return a;},order:function(){return a;},limit:function(){return a;},in:function(){return a;},gte:function(){return a;},lte:function(){return a;},maybeSingle:function(){return Promise.resolve({data:null,error:null});},single:function(){return Promise.resolve({data:null,error:null});},insert:function(){return Promise.resolve({error:null});},upsert:function(){return Promise.resolve({error:null});},update:function(){return a;},delete:function(){return a;},eq:function(){return a;},then:function(r,j){return p.then(r,j);}};return a;}
  var ch={on:function(){return ch;},subscribe:function(){return ch;}};
  window.supabase={createClient:function(){return{auth:{getSession:function(){return Promise.resolve({data:{session:{access_token:"demo",user:{id:"demo",email:"bryson@example.com"}}}});},getUser:function(){return Promise.resolve({data:{user:{id:"demo"}}});},onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}};},signInWithPassword:function(){return Promise.resolve({error:null});},signOut:function(){return Promise.resolve({error:null});}},from:q,channel:function(){return ch;},removeChannel:function(){},storage:{from:function(){return{list:function(){return Promise.resolve({data:[],error:null});},getPublicUrl:function(){return{data:{publicUrl:""}};}};}}};}};
  var real=window.fetch;
  window.fetch=function(u,o){ var s=String(u); var m=s.match(/\\/\\.netlify\\/functions\\/([a-z0-9-]+)/);
    if(m){ return real("/__api?fn="+m[1]+"&u="+encodeURIComponent(s),{method:"GET"}); }
    return real.apply(this,arguments); };
  try{ localStorage.setItem("aria-voice-on","0"); }catch(e){}
  // 🔴 PUBLIC FOOTAGE RULES (CLAUDE.md): no emojis and no em or en dashes in anything prospects see. The OS's own
  // labels use both (allowed there, Bryson alone sees them), so for filming every text node is cleaned as it renders:
  // emojis dropped (the typographic marks ✓ ★ ✕ ▶ → stay), a dash between words becomes a comma, any other dash
  // (an empty-value placeholder) becomes a hyphen. Footage only; the OS itself is untouched.
  var KEEP="✓★✕▶→", EMO=/\\p{Extended_Pictographic}\\uFE0F?|\\u200D|\\uFE0F/gu;
  function clean(t){ var o=t;
    t=t.replace(/(\\S)\\s*[\\u2014\\u2013]\\s*(?=\\S)/g,"$1, ");
    t=t.replace(/[\\u2014\\u2013]/g,"-");
    t=t.replace(EMO,function(m){return KEEP.indexOf(m[0])>=0?m:"";});
    if(t!==o) t=t.replace(/^\\s+(?=\\S)/,"").replace(/ {2,}/g," ");
    return t; }
  // 🔴 TEXT ON SCREEN ONLY. The OS's code arrives as a text node inside a <script> while the page loads; cleaning that
  // rewrote the OS's own strings ("–" became ", ") before Babel compiled them. Skip anything inside script/style.
  function walk(n){ if(n.nodeType===3){ var p=n.parentNode; if(p&&/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(p.nodeName)) return; var v=n.nodeValue, c=clean(v); if(c!==v) n.nodeValue=c; return; }
    if(n.nodeType!==1||/^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.nodeName)) return; for(var k=n.firstChild;k;k=k.nextSibling) walk(k); }
  new MutationObserver(function(ms){ ms.forEach(function(m){ if(m.type==="characterData") walk(m.target); else m.addedNodes.forEach(walk); }); })
    .observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener("DOMContentLoaded",function(){ walk(document.body); });
})();</script>`;
let html = fs.readFileSync(path.join(REPO, "index.html"), "utf8")
  .replace('<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>', '<script src="react.js"></script>')
  .replace('<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>', '<script src="react-dom.js"></script>')
  .replace('<script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>', '<script src="babel.js"></script>')
  .replace('<script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>', STUB);
fs.writeFileSync(path.join(RENDER, "os.html"), html);
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__api") { const fn = u.searchParams.get("fn"), full = u.searchParams.get("u") || ""; const h = API[fn]; res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(h ? h(full) : { ok: true })); return; }
  const f = path.join(RENDER, decodeURIComponent(u.pathname));
  fs.readFile(f, (e, buf) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html" : "text/javascript" }); res.end(buf); });
});
const curl = (url) => execFileSync("curl", ["-sSL", "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36", url], { maxBuffer: 5e7 });
(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/os.html`;
  const d = fs.readdirSync("/opt/pw-browsers").find((x) => /^chromium-\d+$/.test(x));
  const browser = await chromium.launch({ executablePath: path.join("/opt/pw-browsers", d, "chrome-linux/chrome"), args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  // Morning in Phoenix (ARIA says "Good morning" in the video), with time still moving so clocks tick.
  await ctx.addInitScript(() => { const R = Date, off = Date.UTC(2026, 9, 22, 16, 12, 0) - R.now();
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off); } static now() { return R.now() + off; } }
    window.Date = D; });
  const pg = await ctx.newPage(); const errs = [];
  pg.on("pageerror", (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
    if (!/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(u)) return r.abort();
    try { const body = curl(u); return r.fulfill({ status: 200, body, contentType: /googleapis/.test(u) ? "text/css" : /\.js(\?|$)/.test(u) ? "text/javascript" : "font/woff2", headers: { "access-control-allow-origin": "*" } }); } catch (e) { return r.abort(); } });
  await pg.goto(url, { waitUntil: "domcontentloaded" });
  await pg.waitForFunction(() => { const r = document.getElementById("root"); return r && r.textContent && r.textContent.length > 200; }, { timeout: 40000 });
  await pg.waitForTimeout(2500);
  const shot = async (name, full = false) => { if (ONLY.length && !ONLY.includes(name)) return; await pg.screenshot({ path: path.join(OUT, name + ".png"), fullPage: full }); console.log("shot", name); };
  const go = async (what) => { await pg.keyboard.press("Control+k"); await pg.waitForTimeout(400); await pg.keyboard.type(what, { delay: 20 }); await pg.waitForTimeout(300); await pg.keyboard.press("Enter"); await pg.waitForTimeout(1800); };
  await shot("home"); await shot("home-full", true);
  // ARIA's core, filmed: a run of quick shots of just that area, with their times, to play back in motion.
  if (!ONLY.length || ONLY.includes("orb")) { const c = await pg.$("canvas"); const bb = c && await c.boundingBox();
    if (bb) { fs.mkdirSync(path.join(OUT, "orb"), { recursive: true }); const t0 = Date.now(), times = [];
      for (let i = 0; i < 90; i++) { await pg.screenshot({ path: path.join(OUT, "orb", `o${String(i).padStart(3, "0")}.png`), clip: { x: 0, y: Math.max(0, bb.y - 20), width: 390, height: Math.min(844 - bb.y + 20, bb.height + 40) } }); times.push(Date.now() - t0); }
      fs.writeFileSync(path.join(OUT, "orb", "times.json"), JSON.stringify({ bb, times })); console.log("orb frames", times.length, "in", times[times.length - 1], "ms"); } }
  try { await go("Lead Scout"); await pg.getByText("My call list", { exact: false }).first().click({ timeout: 5000 }); await pg.waitForTimeout(1500); await shot("leadscout"); await shot("leadscout-full", true); } catch (e) { errs.push("leadscout: " + e.message); }
  try { await go("Outreach"); await pg.waitForTimeout(1200); await shot("outreach"); await shot("outreach-full", true);
    await pg.getByText("START", { exact: true }).first().click({ timeout: 5000 }); await pg.waitForTimeout(3300); await shot("outreach-running"); } catch (e) { errs.push("outreach: " + e.message); }
  try { await go("Campaigns"); await shot("campaigns"); } catch (e) { errs.push("campaigns: " + e.message); }
  try { await go("Leads"); await shot("leads"); await shot("leads-full", true); } catch (e) { errs.push("leads: " + e.message); }
  try { await go("Summit Roofing"); await pg.waitForTimeout(800); await shot("client"); await pg.getByText("Contract", { exact: true }).first().click({ timeout: 5000 }); await pg.waitForTimeout(1200); await shot("contract"); await shot("contract-full", true);
    for (const [tab, name] of [["Campaign", "campaign"], ["Leads", "client-leads"], ["Pipeline", "pipeline"]]) { try { await pg.locator(".ch-bar").getByText(tab, { exact: true }).first().click({ timeout: 4000 }); await pg.waitForTimeout(1200); await shot(name); await shot(name + "-full", true); } catch (e) { errs.push(name + ": " + e.message); } } } catch (e) { errs.push("client: " + e.message); }
  await browser.close(); server.close();
  if (errs.length) console.log("ERRORS:\n" + errs.slice(0, 12).join("\n"));
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
