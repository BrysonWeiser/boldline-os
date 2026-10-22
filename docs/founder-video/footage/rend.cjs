// node rend.cjs <seg> <dur> <outdir>: frames of one B-roll clip at 30 fps
const { chromium } = require("/opt/node22/lib/node_modules/playwright"); const path = require("path"), fs = require("fs"), http = require("http"), { execFileSync } = require("child_process");
const [SEG, DUR, OUT] = [process.argv[2], +process.argv[3], process.argv[4]]; fs.mkdirSync(OUT, { recursive: true });
const DIR = __dirname;
const srv = http.createServer((q, r) => { const p = path.join(DIR, decodeURIComponent(new URL(q.url, "http://x").pathname)); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": p.endsWith(".html") ? "text/html" : p.endsWith(".json") ? "application/json" : "image/png" }); r.end(b); }); });
(async () => { await new Promise((r) => srv.listen(0, r));
  const d = fs.readdirSync("/opt/pw-browsers").find((x) => /^chromium-\d+$/.test(x));
  const b = await chromium.launch({ executablePath: path.join("/opt/pw-browsers", d, "chrome-linux/chrome"), args: ["--no-sandbox"] });
  const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { const u = r.request().url(); try { const body = execFileSync("curl", ["-sSL", "-A", "Mozilla/5.0 Chrome/124", u], { maxBuffer: 5e7 }); return r.fulfill({ status: 200, body, contentType: /googleapis/.test(u) ? "text/css" : "font/woff2", headers: { "access-control-allow-origin": "*" } }); } catch (e) { r.abort(); } });
  const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/broll.html?seg=${SEG}&dur=${DUR}`); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700);
  const N = Math.round(DUR * 30);
  for (let i = 0; i < N; i++) { await pg.evaluate((t) => window.render(t), i / 30); await pg.screenshot({ path: path.join(OUT, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 90 }); }
  console.log(SEG, "frames", N, errs.join("|")); await b.close(); srv.close(); })();
