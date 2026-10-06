// Client websites: the renderer, the server, the copy writer and the OS tab.
// Run: node tests/verify-site-builder.mjs
//
// Bryson, 2026-10-06: sell OS-built websites and make them "the most up to date modern website ...
// micro animations 3d graphics". KB `website-builder` + `website-design-bar`. Every check RUNS the
// code. The rules marked 🔴 are the ones that cost a client money or trust if they slip.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderSite, siteContent, THEME_IDS, SITE_PAGES, brandName, siteReady } from "../netlify/lib/site-render.mjs";
import { parsePath, viewFor, siteBase } from "../netlify/functions/site.mjs";
import { SITE_SCHEMA, buildPrompt, writeCopy, stockPhotos } from "../netlify/functions/site-build-background.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const TOML = readFileSync(join(ROOT, "netlify.toml"), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const t = async (l, fn) => { try { await fn(); } catch (e) { fails.push(`${l} — threw ${e.message}`); } };

const BASE = "https://boldlinemedia.netlify.app/site/springbok";
const FULL = {
  id: "c1", name: "Springbok Chiropractic, LLC", niche: "Chiropractic", leadToken: "LEADTOKEN123", businessPhone: "(480) 558-0474",
  businessAddress: "1400 N Gilbert Rd, Suite M, Gilbert, AZ 85234", campaignSetup: { serviceArea: "Gilbert, AZ" }, googleReviewUrl: "https://g.page/r/abc/review",
  mediaLibrary: [{ category: "logo", url: "https://x.supabase.co/logo.png" }, { category: "photo", url: "https://x.supabase.co/p1.jpg", label: "Front desk" }],
  website: { brandName: "Springbok Wellness", brandColor: "#2F6FED", publicEmail: "hi@springbok.com", googleListingUrl: "https://maps.app.goo.gl/xyz",
    stock: [{ url: "https://images.pexels.com/photos/1/a.jpeg", alt: "a" }], reviews: [{ name: "Maria G.", text: "Great care.", stars: 5 }],
    content: { hero: { eyebrow: "Chiropractic in Gilbert", headline: "Move better. Feel better.", lineA: "Move better.", lineB: "Feel better.", sub: "Gentle care." },
      services: [{ name: "Back pain", blurb: "Relief.", detail: "More." }, { name: "Neck pain", blurb: "Ease." }, { name: "TMJ", blurb: "Jaw." }],
      why: [{ title: "Hands on", text: "x" }, { title: "Fast", text: "y" }, { title: "Clear", text: "z" }], about: { headline: "Care that listens", story: ["One.", "Two."] },
      process: [{ title: "Book", text: "a" }, { title: "Visit", text: "b" }, { title: "Feel better", text: "c" }], faqs: [{ q: "Insurance?", a: "Call us." }],
      cta: { headline: "Ready?", sub: "Book now.", button: "Book a visit" }, marquee: ["Back", "Neck"], seo: { title: "Chiropractor in Gilbert | Springbok", description: "d" } } },
};
const BARE = { id: "c2", name: "Acme Pools LLC", niche: "Pool Construction", leadToken: "T2" };

const all = [];
for (const cl of [FULL, BARE]) for (const th of THEME_IDS) for (const p of SITE_PAGES) {
  let html = ""; try { html = renderSite(cl, p.id, { base: BASE, theme: th }); } catch (e) { fails.push(`render ${cl.id} ${th} ${p.id} threw ${e.message}`); }
  all.push({ cl, th, page: p.id, html });
}
ok("every design renders every page, for a full client and for one with nothing filled in", all.every((x) => x.html.length > 5000), `${all.filter((x) => x.html.length <= 5000).length} short`);

// ── 1. The visitor-facing rules ─────────────────────────────────────────────────────────────
const decode = (h) => h.replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, "&");
const shown = (h) => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " "));
ok("🔴 no em or en dashes anywhere a visitor reads", all.every((x) => !/[—–]/.test(shown(x.html))));
const TYPO = new Set(["✓", "★", "✦", "©"]);
ok("🔴 no emojis", all.every((x) => [...shown(x.html).matchAll(/\p{Extended_Pictographic}/gu)].every((m) => TYPO.has(m[0]))));
const hrefs = (h) => [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const linkOk = (u) => u.startsWith(BASE + "/") || /^tel:\+?\d+$/.test(u) || /^mailto:/.test(u)
  || /^https:\/\/(g\.page|maps\.app\.goo\.gl|www\.google\.com|search\.google\.com)\//.test(u) || /^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(u);
const bad = all.flatMap((x) => hrefs(x.html).filter((u) => !linkOk(u)));
ok("🔴 every link is absolute: the site's own pages, phone, email, or Google. Nothing relative, nothing else", bad.length === 0, [...new Set(bad)].slice(0, 5).join(" "));
ok("🔴 nothing links to BoldLine's own site or the OS", all.every((x) => !hrefs(x.html).some((u) => /boldlinemedia\.com|\/\.netlify\/|\/index\.html|#\//.test(u))));
const scripts = (h) => [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok("🔴 no // comments in shipped script (it is delivered verbatim to the client's domain)",
  all.every((x) => scripts(x.html).every((s) => !/(^|[\s;{}()])\/\/(?!\S*\.(com|net|org))/m.test(s.replace(/'[^'\n]*'|"(?:[^"\\\n]|\\.)*"/g, "''")))));
const hostile = { ...FULL, website: { ...FULL.website, content: { ...FULL.website.content, hero: { ...FULL.website.content.hero, headline: "<script>alert(1)</script>" } } } };
ok("words are escaped, never run", !/<script>alert/.test(renderSite(hostile, "home", { base: BASE })));

// ── 2. No invented proof ────────────────────────────────────────────────────────────────────
const bareRev = all.find((x) => x.cl === BARE && x.page === "reviews").html;
ok("🔴 a client with no reviews shows no quotes and no stars", !/class="stars"|<blockquote/.test(bareRev));
ok("their real review shows, word for word", /Great care\./.test(all.find((x) => x.cl === FULL && x.page === "reviews").html));
ok("the 'read our reviews' button goes to their Google listing", hrefs(all.find((x) => x.cl === FULL && x.page === "reviews").html).includes("https://maps.app.goo.gl/xyz"));

// ── 3. The form ─────────────────────────────────────────────────────────────────────────────
const contact = renderSite({ ...FULL, niche: "Pool Construction", name: "Acme Pools" }, "contact", { base: BASE });
ok("the contact form posts to the same lead intake as landing pages, with the client's token", /fetch\('\/lead\?token=LEADTOKEN123'/.test(contact));
ok("🔴 the form refuses to send from a preview, and checks BEFORE it sends", contact.indexOf("if(PREVIEW){done();return;}") > 0 && contact.indexOf("if(PREVIEW){done();return;}") < contact.indexOf("fetch('/lead"));
ok("🔴 a health business gets no free-text message box (patients describe symptoms in it)",
  !/<textarea/.test(renderSite(FULL, "contact", { base: BASE })) && /<textarea/.test(contact));
ok("either a phone or an email is enough, neither alone is forced", /if\(!ph&&!em\)/.test(contact));

// ── 4. Fast first ───────────────────────────────────────────────────────────────────────────
const home = renderSite(FULL, "home", { base: BASE, theme: "aurora" });
ok("🔴 content is visible with no script: hidden-until-revealed only applies under html.js", /html\.js \.rv\{opacity:0/.test(home) && !/^\.rv\{opacity:0/m.test(home));
ok("🔴 'reduce motion' switches the motion off", /@media \(prefers-reduced-motion:reduce\)/.test(home));
ok("🔴 the 3D piece waits for idle and skips reduce-motion, Data Saver and small-memory phones",
  /requestIdleCallback/.test(home) && /prefers-reduced-motion: reduce/.test(home) && /saveData/.test(home) && /deviceMemory<4/.test(home));
ok("the 3D piece pauses when it is off screen or the tab is hidden", /IntersectionObserver/.test(home) && /document\.hidden/.test(home));
ok("the Editorial design ships no 3D at all", !/getContext\('webgl'/.test(renderSite(FULL, "home", { base: BASE, theme: "editorial" })));

// ── 5. Search and sharing ───────────────────────────────────────────────────────────────────
ok("each page has its own title, description and canonical address", /<title>Services \| Springbok Wellness<\/title>/.test(renderSite(FULL, "services", { base: BASE }))
  && /<link rel="canonical" href="https:\/\/boldlinemedia\.netlify\.app\/site\/springbok\/about\/">/.test(renderSite(FULL, "about", { base: BASE })));
ok("Google gets structured business data", /"@type":"LocalBusiness"/.test(home) && /"telephone":"\(480\) 558-0474"/.test(home));
ok("a draft or preview is kept out of search", /noindex/.test(renderSite(FULL, "home", { base: BASE, noindex: true })) && !/noindex/.test(home));
ok("legal suffixes come off the brand name", brandName({ name: "Acme Pools, LLC" }) === "Acme Pools" && brandName(FULL) === "Springbok Wellness");
ok("🔴 a non-https base is refused", (() => { try { renderSite(FULL, "home", { base: "/site/x" }); return false; } catch { return true; } })());

// ── 6. Preview links stay preview links while you click around ───────────────────────────────
const pv = renderSite(FULL, "home", { base: BASE, query: "?preview=k1&theme=editorial" });
ok("every internal link carries the preview key and design", hrefs(pv).filter((u) => u.startsWith(BASE)).every((u) => /\?preview=k1&theme=editorial(#|$)/.test(u)));

// ── 7. Serving ──────────────────────────────────────────────────────────────────────────────
ok("addresses parse", JSON.stringify(parsePath("/site/springbok/")) === '{"slug":"springbok","page":"home"}' && parsePath("/site/springbok/about").page === "about" && parsePath("/site/springbok/nope").page === null);
const q = (s) => new URLSearchParams(s);
ok("🔴 an unpublished site shows to nobody without the preview key", viewFor({ published: false, previewKey: "K" }, q("")).show === false && viewFor({ published: false, previewKey: "K" }, q("preview=wrong")).show === false);
ok("🔴 an empty stored key never matches an empty preview", viewFor({ published: false, previewKey: "" }, q("preview=")).show === false);
ok("the right key shows the draft, in the design asked for", viewFor({ published: false, previewKey: "K" }, q("preview=K&theme=editorial")).theme === "editorial");
ok("🔴 the public cannot switch a live site's design with ?theme=", viewFor({ published: true }, q("theme=editorial")).theme === undefined);
ok("links are built on https", siteBase("boldlinemedia.netlify.app", "acme") === "https://boldlinemedia.netlify.app/site/acme");
ok("a site with no words yet is not 'ready'", !siteReady(BARE) && siteReady(FULL));
ok("routes exist, page before root", TOML.indexOf('from = "/site/:slug/:page/"') > 0 && TOML.indexOf('from = "/site/:slug/:page/"') < TOML.indexOf('from = "/site/:slug/"'));

// ── 8. The copy writer ──────────────────────────────────────────────────────────────────────
const walk = (s, f) => { f(s); if (s.properties) Object.values(s.properties).forEach((x) => walk(x, f)); if (s.items) walk(s.items, f); };
let schemaOk = true; walk(SITE_SCHEMA, (s) => { if (s.type === "object" && (s.additionalProperties !== false || JSON.stringify(Object.keys(s.properties).sort()) !== JSON.stringify([...s.required].sort()))) schemaOk = false; });
ok("the structured-output schema is strict everywhere", schemaOk);
ok("🔴 the prompt itself has no dashes (a model mirrors the style it is given)", !/[—–]/.test(buildPrompt(FULL)) && !/[—–]/.test(JSON.stringify(SITE_SCHEMA)));
ok("🔴 the prompt forbids invented facts", /DON'T INVENT ANYTHING/.test(buildPrompt(BARE)) && /years in business/.test(buildPrompt(BARE)));
ok("a health business gets the no-cures rule; a pool builder does not", /Don't promise cures/.test(buildPrompt(FULL)) && !/Don't promise cures/.test(buildPrompt(BARE)));
const fake = (resp, failBeta) => ({ beta: { messages: { create: async (r) => { fake.calls.push(r); if (failBeta) { const e = new Error("bad"); e.status = 400; throw e; } return resp; } } },
  messages: { create: async (r) => { fake.calls.push(r); return resp; } } });
fake.calls = [];
const good = { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify({ hero: { headline: "Fast — friendly", sub: "Done-for-you care" } }) }] };
await t("writer", async () => {
  const out = await writeCopy(FULL, fake(good));
  ok("🔴 dashes the model slips in are taken out before anything is saved", !/[—–]/.test(JSON.stringify(out)) && /Fast/.test(out.hero.headline));
  ok("it asks the newest Opus with a strict JSON format and the refusal fallback", fake.calls[0].model === "claude-opus-5-5" && fake.calls[0].output_config.format.type === "json_schema" && fake.calls[0].fallbacks === "default");
  fake.calls = [];
  await writeCopy(FULL, fake(good, true));
  ok("if the fallback option is refused, it still writes the copy without it", fake.calls.length === 2 && fake.calls[1].fallbacks === undefined);
  let msg = ""; try { await writeCopy(FULL, fake({ stop_reason: "refusal", content: [] })); } catch (e) { msg = e.message; }
  ok("a decline is said plainly, never saved as an empty site", /declined/.test(msg));
  msg = ""; try { await writeCopy(FULL, fake({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] })); } catch (e) { msg = e.message; }
  ok("cut-off copy is refused", /cut off/.test(msg));
});
await t("photos", async () => {
  const f = async () => ({ ok: true, json: async () => ({ photos: [{ src: { large2x: "https://images.pexels.com/p/1.jpg" }, alt: "a" }, { src: { large2x: "https://evil.example/p.jpg" } }] }) });
  const got = await stockPhotos("Chiropractic", "KEY", f);
  ok("🔴 only Pexels' own image host is ever used", got.length === 1 && got[0].url.startsWith("https://images.pexels.com/"));
  ok("no key means no photos, not an error", (await stockPhotos("x", "", f)).length === 0);
});

// ── 9. The OS tab ───────────────────────────────────────────────────────────────────────────
const tab = UI.slice(UI.indexOf("function WebsiteTab("), UI.indexOf("// ─── Review requests:"));
ok("the Website tab exists and is wired in", /\["website","Website"\]/.test(UI) && /tab==="website"&&<WebsiteTab/.test(UI));
ok("🔴 nothing goes live until he presses 'Put it live'", /save\(\{published:!w\.published\}\)/.test(tab) && !/published:true/.test(tab));
ok("the client gets three preview links to choose from, built on the site's own preview key", /previewLink\(id\)/.test(tab) && /previewKey:w\.previewKey\|\|siteKey\(\)/.test(tab));
ok("🔴 rewriting the words asks first, because it replaces his edits", /window\.confirm\("Rewrite all the website text\?/.test(tab));
ok("hand edits go through the no-dash rule too", /save\(\{content:siteDeDash\(c\)/.test(tab));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-builder: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
