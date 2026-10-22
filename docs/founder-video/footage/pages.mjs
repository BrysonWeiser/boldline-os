// Founder video footage, part 2: pages the OS makes, rendered by the real code with made-up businesses.
//   demo   the sample detailer website with the real demo "Preview for ..." strip (demo-site.mjs decorateDemo)
//   landing the sample handyman landing page
//   portal the client portal (portal.mjs makePortalHTML) for a sample roofer, results chart included
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const REPO = "/home/user/boldline-os", MS = path.join(REPO, "marketing-site");
const HERE = path.dirname(new URL(import.meta.url).pathname), GEN = path.join(HERE, "gen"), OUT = process.argv[2] || path.join(HERE, "shots");
fs.mkdirSync(GEN, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
const { decorateDemo } = await import(REPO + "/netlify/lib/demo-site.mjs");
const { _internal } = await import(REPO + "/netlify/functions/portal.mjs");

const hideSample = (h) => h.replace("</head>", "<style>.bl-sample,[class*=bl-sample]{display:none!important}body{padding-top:0!important}</style></head>");
const site = fs.readFileSync(path.join(MS, "examples/car-detailing/index.html"), "utf8");
fs.writeFileSync(path.join(GEN, "demo.html"), decorateDemo(hideSample(site), { name: "Northline Auto Detailing", designs: [{ id: "a", label: "Aurora", href: "#", current: true }, { id: "c", label: "Cinematic", href: "#" }, { id: "e", label: "Editorial", href: "#" }] }));
fs.writeFileSync(path.join(GEN, "landing.html"), hideSample(fs.readFileSync(path.join(MS, "examples/handyman/landing/index.html"), "utf8")));

const now = Date.now(), DAY = 864e5;
const weekly = [2, 3, 3, 4, 5, 6, 7, 9];   // eight weeks, oldest first
const leadsLog = []; let k = 0;
weekly.forEach((n, w) => { for (let i = 0; i < n; i++) leadsLog.push({ id: "L" + (k++), name: ["Sarah K.", "Mike O.", "Jen P.", "Chris D.", "Ana R.", "Luis M.", "Kim T.", "Rob S.", "Dee W."][i % 9], service: ["Roof repair", "Inspection", "Full replacement", "Leak repair"][i % 4], source: ["Google ad", "Landing page", "Meta ad", "Call"][i % 4], status: "new", receivedAt: new Date(now - (7 - w) * 7 * DAY - (i + 1) * 0.6 * DAY).toISOString() }); });
const cl = { id: "c1", name: "Summit Roofing", contactName: "Marcus Bell", niche: "Roofing", packageId: "g-growth", stage: "optimizing", contractSigned: true, contractStatus: "active",
  contractStart: new Date(now - 60 * DAY).toISOString().slice(0, 10), contractEnd: new Date(now + 40 * DAY).toISOString().slice(0, 10), portalToken: "demo", leadsLog, commLog: [], alerts: [],
  adBudget: "$1,500/mo", campaignSetup: { serviceArea: "Mesa, Gilbert and Chandler" }, landingPage: { published: true }, botStatuses: {} };
const pkg = _internal.findPkg ? _internal.findPkg("g-growth") : { id: "g-growth", name: "Growth System", platform: "Google Ads", price: 700 };
fs.writeFileSync(path.join(GEN, "portal.html"), _internal.makePortalHTML(cl, pkg, undefined));

const server = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = fs.existsSync(path.join(GEN, p)) && fs.statSync(path.join(GEN, p)).isFile() ? path.join(GEN, p) : path.join(MS, p.endsWith("/") ? p + "index.html" : p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } const ext = path.extname(f);
    res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[ext] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
const d = fs.readdirSync("/opt/pw-browsers").find((x) => /^chromium-\d+$/.test(x));
const browser = await chromium.launch({ executablePath: path.join("/opt/pw-browsers", d, "chrome-linux/chrome"), args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url();
  if (!/fonts\.(googleapis|gstatic)\.com|images\.pexels\.com|cdnjs|jsdelivr/.test(u)) return r.abort();
  try { const body = execFileSync("curl", ["-sSL", "-A", "Mozilla/5.0 Chrome/124", u], { maxBuffer: 5e7 }); return r.fulfill({ status: 200, body, contentType: /googleapis/.test(u) ? "text/css" : /\.js/.test(u) ? "text/javascript" : /pexels/.test(u) ? "image/jpeg" : "font/woff2", headers: { "access-control-allow-origin": "*" } }); } catch (e) { return r.abort(); } });
for (const [name, url] of [["demo", "/demo.html"], ["landing", "/landing.html"], ["portal", "/portal.html"]]) {
  await pg.goto(base + url, { waitUntil: "load" }); await pg.waitForTimeout(1800);
  // scroll through once so lazy images and reveal-on-scroll sections show, then back to the top
  await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: path.join(OUT, name + ".png") }); await pg.screenshot({ path: path.join(OUT, name + "-full.png"), fullPage: true }); console.log("shot", name);
}
await browser.close(); server.close();
if (errs.length) console.log("ERRORS:\n" + errs.slice(0, 8).join("\n"));
