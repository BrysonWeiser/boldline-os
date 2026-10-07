// The marketing site is now several pages built from marketing-src/ (scripts/build-marketing-site.mjs),
// with every page's scripts in one shared site.js. Tests that used to read the single homepage read
// "the site" from here instead: every generated page plus site.js, in a fixed order, so a rule that the
// site states something (a price, a package, a script guard) holds wherever on the site it now lives.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MK = join(ROOT, "marketing-site");

// Every page the generator writes, in the order it lists them (home first).
export const SITE_PAGES = ["index.html", "ads/index.html", "websites/index.html", "pricing/index.html",
  "how-it-works/index.html", "about/index.html", "free-check/index.html", "contact/index.html",
  "industries/index.html", "industries/car-detailing/index.html", "industries/handyman/index.html",
  "industries/epoxy-floors/index.html", "industries/window-tint/index.html", "compare/index.html"];
export const SITE_ASSETS = ["site.js", "site.css"];

export const readPage = (rel) => readFileSync(join(MK, rel), "utf8");
// Pages + the shared script. The stylesheet is left out on purpose: it would only add noise to text checks.
export const readSite = () => SITE_PAGES.map(readPage).concat(readPage("site.js")).join("\n");
export const sitePaths = () => SITE_PAGES.map((p) => `marketing-site/${p}`);

// Browser tests can't open the pages as files any more: they load /site.css and /site.js from the site
// root, which a file:// address can't resolve. This serves marketing-site/ on a free local port.
export async function serveSite() {
  const http = await import("node:http");
  const { existsSync, statSync } = await import("node:fs");
  const { extname } = await import("node:path");
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = join(MK, p);
    if (f.startsWith(MK) && existsSync(f) && statSync(f).isFile()) { r.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }
    else { r.writeHead(404); r.end(); }
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { base: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((ok) => srv.close(ok)) };
}
