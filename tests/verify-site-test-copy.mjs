// The marketing site's TEST COPY (KB website-builder, "Homepage refresh"). Bryson, 2026-10-06: "is there a
// way to have a live version of the website and a not live version that we can edit and see then if we like
// it we can push it to the live version?" Netlify's branch address for the dev branch is that test copy.
// 🔴 A preview must never change anything real (standing rule), and this one carries the REAL forms, so
// this suite RUNS the guard in each page against a fake browser: on a test address every POST, beacon and
// form is stopped and the page says so; on the live address nothing is touched.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SITE_PAGES } from "./helpers/marketing-site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));

const guardOf = (html) => { const i = html.indexOf("/* Test copy guard."); const a = html.lastIndexOf("<script>", i); const b = html.indexOf("</script>", i); return i > 0 ? html.slice(a + 8, b) : ""; };

async function run(code, host) {
  const calls = { fetch: [], beacon: 0, meta: [], banner: null, prevented: 0 };
  const listeners = {};
  const realFetch = async (u, o) => { calls.fetch.push([u, (o && o.method) || "GET"]); return new Response("{}", { status: 200 }); };
  const win = { fetch: realFetch, location: { hostname: host } };
  const doc = {
    head: { appendChild: (el) => calls.meta.push(el) },
    body: { appendChild: (el) => { calls.banner = el; } },
    createElement: () => ({ style: {}, setAttribute() {} }),
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
  };
  const nav = { sendBeacon: () => { calls.beacon++; return true; } };
  new Function("window", "document", "navigator", "location", "alert", "Response", code)(win, doc, nav, win.location, () => {}, Response);
  // What the page's own scripts would do next.
  const post = await win.fetch("/.netlify/functions/lead-leak-audit", { method: "POST", body: "{}" });
  const get = await win.fetch("/.netlify/functions/founding-status");
  nav.sendBeacon("/site-hit", "x");
  for (const fn of listeners.submit || []) fn({ target: { method: "post" }, preventDefault: () => { calls.prevented++; }, stopImmediatePropagation() {} });
  for (const fn of listeners.DOMContentLoaded || []) fn();
  return { calls, post: await post.text(), get: get.status, test: !!win.__TEST_COPY };
}

for (const page of [...SITE_PAGES.map((f) => `marketing-site/${f}`), "marketing-site/get-started/index.html"]) {
  const html = readFileSync(join(ROOT, page), "utf8");
  const code = guardOf(html);
  ok(`${page} carries the test-copy guard`, code.length > 100);
  ok(`${page}: the guard runs before any other script on the page`, html.indexOf("/* Test copy guard.") < html.indexOf("<script", html.indexOf("/* Test copy guard.") + 10) && html.indexOf("<script") === html.lastIndexOf("<script>", html.indexOf("/* Test copy guard.")));
  ok(`${page}: the character set still comes first`, html.indexOf("charset") < html.indexOf("/* Test copy guard."));
  const t = await run(code, "claude-monday-sept-7-catchup-hyschf--boldline-media.netlify.app");
  ok(`🔴 ${page}: on the test copy a form POST never leaves the page`, !t.calls.fetch.some(([, m]) => m === "POST") && /testCopy/.test(t.post));
  ok(`🔴 ${page}: on the test copy no visit is counted`, t.calls.beacon === 0);
  ok(`🔴 ${page}: on the test copy a plain form submit is stopped`, t.calls.prevented === 1);
  ok(`${page}: reading still works on the test copy (the founding offer check)`, t.get === 200 && t.calls.fetch.some(([u, m]) => /founding-status/.test(u) && m === "GET"));
  ok(`${page}: the test copy says so on screen and is hidden from search engines`, !!t.calls.banner && /Test version/.test(t.calls.banner.textContent) && t.calls.meta.some((m) => m.name === "robots" && /noindex/.test(m.content)));
  ok(`${page}: also guards Netlify's numbered previews`, (await run(code, "deploy-preview-12--boldline-media.netlify.app")).test === true);
  const live = await run(code, "boldlinemedia.com");
  ok(`🔴 ${page}: on the live address nothing is touched`, !live.test && live.calls.fetch.some(([, m]) => m === "POST") && live.calls.beacon === 1 && live.calls.prevented === 0 && !live.calls.banner);
  ok(`${page}: nor on the site's own netlify address`, (await run(code, "boldline-media.netlify.app")).test === false);
  ok(`${page}: the guard names nobody and no date`, !/Bryson|20\d\d-\d\d/.test(code));
  ok(`🔴 ${page}: on the test copy the analytics never load (visits there are Bryson, not prospects)`, /function load\(\)\{if\(done\|\|window\.__TEST_COPY\)return;/.test(html) && /ga-disable-G-MG7T0687RT/.test(code));
}

// The hand-written pages (privacy, terms, 404, every blog page) load the same guard from /test-copy.js as
// the first script in <head>, so a visit or a newsletter signup on the test copy is never real either.
{
  const shared = readFileSync(join(ROOT, "marketing-site/test-copy.js"), "utf8");
  ok("test-copy.js is the very same guard the generated pages inline", shared.trim() === guardOf(readFileSync(join(ROOT, "marketing-site/index.html"), "utf8")).trim());
  const t = await run(shared, "claude-monday-sept-7-catchup-hyschf--boldline-media.netlify.app");
  ok("🔴 test-copy.js: on the test copy nothing posts, counts or submits", !t.calls.fetch.some(([, m]) => m === "POST") && t.calls.beacon === 0 && t.calls.prevented === 1 && t.test);
  const live = await run(shared, "boldlinemedia.com");
  ok("🔴 test-copy.js: on the live address nothing is touched", !live.test && live.calls.beacon === 1 && live.calls.prevented === 0);
  for (const page of ["marketing-site/privacy.html", "marketing-site/terms.html", "marketing-site/404.html", "marketing-site/netlify/lib/blog-render.mjs"]) {
    const file = readFileSync(join(ROOT, page), "utf8");
    // The blog file holds several templates; what matters is the one that opens every blog page's <head>.
    const src = page.endsWith("blog-render.mjs") ? file.slice(file.indexOf("export const headTags")) : file;
    const at = src.indexOf('<script src="/test-copy.js"></script>');
    ok(`${page} loads the guard`, at > 0);
    ok(`${page}: right after the character set, before any other script`, at > src.indexOf("charset") && src.indexOf("<script") === at);
    ok(`${page}: its analytics stay off on the test copy`, /function load\(\)\{if\(done\|\|window\.__TEST_COPY\)return;/.test(file));
  }
}

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-test-copy: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
