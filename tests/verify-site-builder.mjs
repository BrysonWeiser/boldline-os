// Client websites: the renderer, the server, the copy writer and the OS tab.
// Run: node tests/verify-site-builder.mjs
//
// Bryson, 2026-10-06: sell OS-built websites and make them "the most up to date modern website ...
// micro animations 3d graphics". KB `website-builder` + `website-design-bar`. Every check RUNS the
// code. The rules marked 🔴 are the ones that cost a client money or trust if they slip.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderSite, siteContent, THEME_IDS, SITE_PAGES, brandName, siteReady, motionRecipe, glSceneFor, MOTION, LENIS, glShader } from "../netlify/lib/site-render.mjs";
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
// Every rule that hides content until it animates in must be gated on a class the script adds.
const hidingRules = (h) => [...(h.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => /\.(rv|hl|ln|ch|w|pcopy|sk|ph)\b/.test(m[1]) && /opacity:0[;}]|opacity:0$|translateY\(1\d\d%\)|clip-path:inset\((100%|-20% 100%)/.test(m[2]))
  .map((m) => m[1].trim());
const ungated = all.flatMap((x) => hidingRules(x.html).flatMap((sel) => sel.split(",").filter((one) => !/^html\.(mo|js)\b/.test(one.trim()))));
ok("🔴 content is visible with no script: every hide-until-revealed rule sits under html.mo or html.js", ungated.length === 0, [...new Set(ungated)].slice(0, 3).join(" | "));
ok("🔴 every hidden state has a 'shown' rule specific enough to beat it (this once left a whole hero invisible)",
  /html\.mo body \.rv\.in\{opacity:1/.test(home) && /html\.mo body \.hl\.in \.ln>span/.test(home) && hidingRules(home).length >= 6);
ok("🔴 the page itself is never hidden waiting for a script", all.every((x) => !/body\{opacity:0|body\.ready/.test(x.html)));
ok("🔴 if the motion script throws, it takes its classes back off so everything shows", /catch\(err\)\{h\.classList\.remove\('js','mo'\)/.test(home));
ok("🔴 'reduce motion' never gets the motion class at all", /if\(!rm\)h\.classList\.add\('mo'\)/.test(home));
ok("headline lines keep a space between them when they sit inline (no script)", /better\.<\/span><\/span> <span class="ln">/.test(renderSite(FULL, "home", { base: BASE, theme: "aurora" })));
ok("🔴 'reduce motion' switches the motion off", /@media \(prefers-reduced-motion:reduce\)/.test(home));
ok("🔴 the 3D piece waits for idle and skips reduce-motion, Data Saver and small-memory phones",
  /requestIdleCallback/.test(home) && /prefers-reduced-motion: reduce/.test(home) && /saveData/.test(home) && /deviceMemory<4/.test(home));
ok("the 3D piece pauses when it is off screen or the tab is hidden", /IntersectionObserver/.test(home) && /document\.hidden/.test(home));
ok("the Editorial design ships no 3D at all", !/getContext\('webgl'/.test(renderSite(FULL, "home", { base: BASE, theme: "editorial" })));
ok("🔴 the 3D stops itself on a device too slow to keep up", /slow>60\)\{dead=true/.test(home));
ok("🔴 smooth scrolling loads one pinned file, checked by its integrity hash, only for a mouse, never for Data Saver",
  home.includes(LENIS.src) && /^sha384-[A-Za-z0-9+/=]{64}$/.test(LENIS.sri) && home.includes(`s.integrity='${LENIS.sri}'`) && /@\d+\.\d+\.\d+\//.test(LENIS.src)
  && /if\(fine&&!rm\)\{[\s\S]*if\(!lite\)\{var ld=/.test(home));

// ── 4b. Motion: varied per client, at the right amount ──────────────────────────────────────
const recipes = Array.from({ length: 300 }, (_, i) => ({ id: `client-${i}` }));
for (const k of ["entrance", "scene", "reveal", "transition", "marquee"]) {
  const seen = new Set(recipes.flatMap((cl) => THEME_IDS.map((t) => motionRecipe(cl, t)[k])));
  ok(`every ${k} option actually gets used across clients`, MOTION[k].every((o) => seen.has(o)), [...seen].join(","));
}
ok("🔴 the three designs one client sees never share the big scroll moment or the headline entrance",
  recipes.every((cl) => new Set(THEME_IDS.map((t) => motionRecipe(cl, t).scene)).size === 3 && new Set(THEME_IDS.map((t) => motionRecipe(cl, t).entrance)).size === 3));
ok("the same client always gets the same mix (it doesn't change on every page load)", JSON.stringify(motionRecipe(FULL, "aurora")) === JSON.stringify(motionRecipe({ ...FULL }, "aurora")));
const sig = (cl) => THEME_IDS.map((t) => { const r = motionRecipe(cl, t); return [r.entrance, r.scene, r.reveal, r.transition, r.marquee].join("/"); }).join("|");
ok("'Try different animations' re-rolls the mix", sig(FULL) !== sig({ ...FULL, website: { ...FULL.website, motionSeed: "x9" } }));
ok("two clients on the same design usually look different", new Set(recipes.slice(0, 40).map((cl) => sig(cl))).size >= 30);
const sceneHome = (scene, th) => { for (let i = 0; i < 400; i++) { const cl = { ...FULL, website: { ...FULL.website, motionSeed: `s${i}` } }; if (motionRecipe(cl, th).scene === scene) return renderSite(cl, "home", { base: BASE, theme: th }); } return ""; };
for (const scene of MOTION.scene) for (const th of THEME_IDS) {
  const h = sceneHome(scene, th);
  ok(`🔴 the ${scene} scene (${th}) still shows every service and the story as plain content`, h && ["Back pain", "Neck pain", "TMJ"].every((n) => shown(h).includes(n)) && shown(h).includes("One."));
}
ok("the scroll scenes only pin and stretch under the motion class", /html\.mo \.portal\{height:300svh\}/.test(sceneHome("portal", "aurora")) && !/^\.portal\{height/m.test(sceneHome("portal", "aurora")));
// Bryson, 2026-10-07: three pictures sliding sideways "didn't make sense". The sideways scroll needs at least five
// cards AND real distance to travel (40% of a screen); otherwise the cards sit as a plain grid.
ok("the rail only turns sideways on a wide screen with enough cards", /innerWidth>=900&&r\.querySelectorAll\('\.rc'\)\.length>=5/.test(home));
ok("🔴 and only when there is real distance to travel", /if\(dx<innerWidth\*\.4\)\{r\.classList\.remove\('on'\)/.test(home));
// The moving strip slides by half its length, so each half must outlast the widest screen.
{
  const strip = (home.match(/<div class="marq"[^>]*><div class="tr">([\s\S]*?)<\/div><\/div>/) || [])[1] || "";
  const n = (strip.match(/<span>/g) || []).length;
  ok("🔴 the moving strip never runs out on a wide screen (each half repeats to at least twelve items)", n >= 24 && n % 2 === 0, `${n} items`);
  ok("and its two halves are identical, so the loop is seamless", strip.slice(0, strip.length / 2) === strip.slice(strip.length / 2));
}
ok("🔴 the right amount: the home page has exactly one big scroll moment", MOTION.scene.every((sc) => { const h = sceneHome(sc, "cinematic"); return (h.match(/class="portal"|class="sec rail"|class="stk"/g) || []).length === 1; }));
ok("no AI tells: no all-caps labels, no [01] numbering, no monospace font", all.every((x) => !/text-transform:uppercase/.test(x.html) && !/\[\d\d\]/.test(shown(x.html)) && !/JetBrains|monospace/.test(x.html)));
ok("button labels roll on hover, and the copy is silent to screen readers", /content:attr\(data-t\) \/ ""/.test(home) && /<span class="bt"><span data-t="Book a visit">Book a visit<\/span><\/span>/.test(home));
ok("3D backdrops match the trade", glSceneFor({ niche: "Pool Construction" }) === "water" && glSceneFor({ niche: "Auto Detailing" }) === "chrome" && glSceneFor({ niche: "Chiropractic" }) === "silk"
  && glSceneFor({ niche: "Med Spa" }) === "silk" && glSceneFor({ niche: "Roofing" }) === "topo" && glSceneFor({ niche: "Bookkeeping" }) === "liquid");
ok("each trade's backdrop is a real, separate shader", new Set(["water", "chrome", "silk", "topo", "liquid"].map((k) => glShader(k, false))).size === 5 && /calm/.test(glShader("water", true)));
ok("the shaders avoid reversed smoothstep edges (undefined on some phones' graphics chips)", ["water", "chrome", "silk", "topo", "liquid"].every((k) => ![...glShader(k, true).matchAll(/smoothstep\(([-\d.]+),([-\d.]+),/g)].some((m) => +m[1] > +m[2])));

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
ok("addresses parse", parsePath("/site/springbok/").slug === "springbok" && parsePath("/site/springbok/").page === "home" && parsePath("/site/springbok/about").page === "about" && parsePath("/site/springbok/nope").page === null
  && parsePath("/site/springbok/nope").seg === "nope" && parsePath("/site/springbok/blog/how-to/").post === "how-to" && parsePath("/site/springbok/about/x").bad === true);
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
{
  const goLive = tab.slice(tab.indexOf("const goLive="), tab.indexOf("return (", tab.indexOf("const goLive=")));
  ok("🔴 nothing goes live until he presses 'Put it live', and only after the server agreed (paid in full, care plan started)",
    (tab.match(/published:true/g) || []).length === 1 && goLive.includes("published:true")
    && goLive.indexOf("if(publishLock)") < goLive.indexOf('action:"launch"') && goLive.indexOf('action:"launch"') < goLive.indexOf("published:true")
    && goLive.indexOf("if(!r.ok||!out.ok) throw") < goLive.indexOf("published:true"));
}
ok("the client gets three preview links to choose from, built on the site's own preview key", /previewLink\(id\)/.test(tab) && /previewKey:w\.previewKey\|\|siteKey\(\)/.test(tab));
ok("🔴 rewriting the words asks first, because it replaces his edits", /window\.confirm\("Rewrite all the website text\?/.test(tab));
ok("hand edits go through the no-dash rule too", /save\(\{content:siteDeDash\(c\)/.test(tab));
ok("the 'Try different animations' button stores a new motion seed and nothing else", /save\(\{motionSeed:Math\.random\(\)\.toString\(36\)\.slice\(2,10\)\}\)/.test(tab));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-builder: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
