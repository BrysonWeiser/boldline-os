// The demo website at a few scroll positions (its full-page capture repeats the hero), for a scroll in the edit.
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const MS = "/home/user/boldline-os/marketing-site", HERE = path.dirname(new URL(import.meta.url).pathname), GEN = path.join(HERE, "gen"), OUT = path.join(HERE, "shots");
const server = http.createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const f = fs.existsSync(path.join(GEN, p)) && fs.statSync(path.join(GEN, p)).isFile() ? path.join(GEN, p) : path.join(MS, p.endsWith("/") ? p + "index.html" : p);
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[path.extname(f)] || "application/octet-stream" }); res.end(b); }); });
await new Promise((r) => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}`;
const d = fs.readdirSync("/opt/pw-browsers").find((x) => /^chromium-\d+$/.test(x));
const browser = await chromium.launch({ executablePath: path.join("/opt/pw-browsers", d, "chrome-linux/chrome"), args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const pg = await ctx.newPage(); await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
await pg.goto(base + "/demo.html", { waitUntil: "load" }); await pg.waitForTimeout(1500);
const H = await pg.evaluate(() => document.documentElement.scrollHeight); console.log("height", H);
for (const y of [0, 520, 1040, 1560, 2080, 2600]) { await pg.evaluate((y) => window.scrollTo(0, y), y); await pg.waitForTimeout(700); await pg.screenshot({ path: path.join(OUT, `demo-y${y}.png`) }); }
await browser.close(); server.close(); console.log("ok");
