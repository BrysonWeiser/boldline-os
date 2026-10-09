// The website editor and the AI you can talk to (Bryson, 2026-10-09: "edit any text, show, hide, reorder, add new
// sections, choose each photo" and "talk to the ai like how I talk to you and have it edit the website ... give
// suggestions and also tell me if it's a bad idea and why"; his own businesses first). What has to stay true:
//  1. A site nobody edited renders in the original order with nothing hidden; the top of the page is always first.
//  2. Hidden sections leave the page, moved ones move, added ones render, empty ones never show an empty frame.
//  3. A chosen photo is used only if it is one of the site's own photos.
//  4. The AI can only propose changes from a fixed menu; each is checked; it edits a DRAFT, never the live site.
//  5. Save keeps the version before it so Undo puts it back; the OS and the server agree on the section order.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const R = await import("../netlify/lib/site-render.mjs");
const A = await import("../netlify/lib/site-ai.mjs");

const OWN = [{ category: "photo", url: "https://x.co/own1.jpg", label: "truck" }, { category: "photo", url: "https://x.co/own2.jpg" }];
const base = (w = {}) => ({ id: "b", internal: true, owned: true, name: "Desert Gloss", niche: "Auto Detailing", landingSlug: "dg", businessPhone: "(480) 555-0100", mediaLibrary: OWN,
  website: { theme: "aurora", published: true, stock: [{ url: "https://x.co/stock1.jpg", alt: "car" }], content: { hero: { headline: "Showroom shine at your door" }, why: [{ title: "We come to you", text: "x" }],
    process: [{ title: "Book", text: "x" }], faqs: [{ q: "Do you bring water?", a: "Yes." }], about: { story: ["We started in a garage."] } }, ...w } });
const home = (cl) => R.renderSite(cl, "home", { base: "https://dg.example" });
const keys = (L) => L.map((x) => x.key + (x.hidden ? "-" : "")).join(",");

// 1. Defaults
const DEFAULT = R.HOME_SECTIONS.map((x) => x[0]).join(",");
ok("🔴 nothing saved: the original order, nothing hidden", keys(R.homeLayout(base())) === DEFAULT);
{ const j = R.homeLayout(base({ layout: { home: [{ key: "faq" }, { key: "nope" }, { key: "why", hidden: true }, { key: "faq" }] } })).map((x) => x.key + (x.hidden ? "-" : ""));
  ok("a saved layout with junk in it keeps only real sections, in his order, and loses none", j.indexOf("faq") < j.indexOf("why-") && !j.includes("nope") && j.length === 10 && j.filter((x) => x === "faq").length === 1); }
ok("🔴 the top of the page is always first and never hidden", R.homeLayout(base({ layout: { home: [{ key: "cta" }, { key: "hero", hidden: true }] } }))[0].key === "hero" && !R.homeLayout(base({ layout: { home: [{ key: "hero", hidden: true }] } }))[0].hidden);
const a0 = R.homeLayout(base({ blocks: [{ id: "t1", type: "text", heading: "Hi", body: "x" }] }));
ok("an added section with no place goes just before the closing call to action", a0.map((x) => x.key).slice(-2).join(",") === "b:t1,cta");
{
  const cases = [base(), base({ layout: { home: [{ key: "faq" }, { key: "why", hidden: true }] } }), base({ blocks: [{ id: "t1", type: "text" }, { id: "g2", type: "gallery" }, { id: "x", type: "bogus" }], layout: { home: [{ key: "b:g2" }, { key: "hero" }] } })];
  const a = UI.indexOf("const SE_SECTIONS="), b = UI.indexOf("const seNewBlock=");
  const os = new Function(`${UI.slice(a, b)}; return seLayout;`)();
  ok("🔴 the editor screen and the live site agree on the section order", cases.every((c) => keys(os(c.website)) === keys(R.homeLayout(c))));
}

// 2. Rendering
{
  const plain = home(base());
  const order = ["Why people choose", "Simple from the first call", "Questions, answered"].map((t) => plain.indexOf(t));
  ok("the default page has its sections in the original order", order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])));
  const hid = home(base({ layout: { home: [{ key: "hero" }, { key: "faq", hidden: true }] } }));
  ok("🔴 a hidden section leaves the page", !hid.includes("Questions, answered") && hid.includes("Why people choose"));
  const moved = home(base({ layout: { home: [{ key: "hero" }, { key: "faq" }, { key: "marquee" }, { key: "services" }] } }));
  ok("a moved section moves", moved.indexOf("Questions, answered") < moved.indexOf("Why people choose"));
  const blocks = [
    { id: "t1", type: "text", heading: "Our promise", body: "Para one <b>.\n\nPara two." },
    { id: "p1", type: "pricing", heading: "Prices", items: [{ name: "Full Detail", price: "$199", text: "Inside and out" }] },
    { id: "v1", type: "video", heading: "See us work", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { id: "v2", type: "video", url: "https://vimeo.com/123456789" },
    { id: "a1", type: "areas", heading: "Areas we serve", places: ["Gilbert", "Mesa"] },
    { id: "m1", type: "team", heading: "Meet the team", people: [{ name: "Jake", role: "Lead detailer" }] },
    { id: "g1", type: "gallery", heading: "Our work", photos: [] },
    { id: "e1", type: "pricing", heading: "Empty prices", items: [] },
  ];
  const h = home(base({ blocks }));
  ok("🔴 added sections render: words in paragraphs, escaped", h.includes(">Our promise<") && h.includes("Para one &lt;b&gt;.") && h.includes(">Para two.<"));
  ok("prices with the main button", h.includes(">Full Detail<") && h.includes(">$199<"));
  ok("🔴 a YouTube link plays from the privacy-friendly address; Vimeo works too", h.includes('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"') && h.includes('src="https://player.vimeo.com/video/123456789"'));
  ok("areas and team", h.includes(">Gilbert<") && h.includes(">Lead detailer<"));
  ok("🔴 area names never borrow the floating button bar's style (it hid them)", h.includes('class="area-chip"') && !/<span class="pill"/.test(h));
  ok("a gallery with no photos picked uses his own photos, never the background ones", (() => { const g = h.slice(h.indexOf(">Our work<")); return g.includes("own1.jpg") && !g.slice(0, 2000).includes("stock1.jpg"); })());
  ok("🔴 an empty section never shows an empty frame", !h.includes("Empty prices") && !home({ ...base({ blocks: [{ id: "g9", type: "gallery", heading: "Nothing yet", photos: [] }] }), mediaLibrary: [] }).includes("Nothing yet"));
  ok("only known kinds of section, only https links, at most twelve", R.cleanBlock({ id: "x", type: "script" }) === null && R.cleanBlock({ id: "v", type: "video", url: "javascript:alert(1)" }).url === ""
    && R.blocksOf({ website: { blocks: Array.from({ length: 20 }, (_, i) => ({ id: "t" + i, type: "text" })) } }).length === 12);
  ok("no dashes reach the page from a section's words", !/[—–]/.test(home(base({ blocks: [{ id: "t", type: "text", heading: "Fast — friendly", body: "We come to you — always." }] })).replace(/<script[\s\S]*?<\/script>/g, "")));
}

// 3. Photos
{
  const h = home(base({ theme: "editorial", photoPick: { story: "https://x.co/own2.jpg" } }));
  const at = h.indexOf("We started in a garage."), near = h.slice(Math.max(0, at - 1500), at + 1500);
  ok("a chosen photo is used for its spot", /own2\.jpg/.test(near) && !/own1\.jpg/.test(near));
  ok("🔴 a photo that is not one of the site's own is ignored", Object.keys(R.photoPicks(base({ photoPick: { hero: "https://evil.example/x.jpg" } }), [{ url: "https://x.co/own1.jpg" }])).length === 0);
  ok("the About page photo can be chosen too", /own2\.jpg/.test(R.renderSite(base({ photoPick: { about: "https://x.co/own2.jpg" } }), "about", { base: "https://dg.example" })));
}

// 4. The AI's changes
{
  const draft = { content: base().website.content, blocks: [], photoPick: {}, layout: {} };
  const L = R.homeLayout(base());
  const photos = [{ url: "https://x.co/own1.jpg", own: true }];
  const r = A.applySiteOps(draft, [
    { op: "set_text", path: "hero.headline", value: "Your car — spotless" },
    { op: "set_text", path: "website.script", value: "x" },
    { op: "add_section", type: "pricing", after: "services", block: { heading: "Prices", items: [{ name: "Full Detail", price: "$199" }] } },
    { op: "move_section", key: "faq", after: "top" },
    { op: "hide_section", key: "marquee" },
    { op: "hide_section", key: "hero" },
    { op: "remove_section", key: "why" },
    { op: "pick_photo", spot: "hero", url: "https://evil.example/x.jpg" },
    { op: "pick_photo", spot: "story", url: "https://x.co/own1.jpg" },
    { op: "set_list", path: "faqs", list: [{ q: "Do you need power?", a: "No, we bring it." }] },
    { op: "explode" },
  ], { layout: L, photos });
  const k = r.draft.layout.home.map((x) => x.key);
  ok("🔴 words change, and the dash is taken out", r.draft.content.hero.headline === "Your car, spotless");
  ok("🔴 anything outside the menu is refused", r.skipped.some((x) => /website\.script/.test(x)) && r.skipped.some((x) => /couldn't make/.test(x)));
  ok("a section is added where it was asked for", k[k.indexOf("services") + 1].startsWith("b:") && r.draft.blocks[0].items[0].price === "$199");
  ok("a section moves right under the top", k[1] === "faq");
  ok("🔴 the top of the page can't be hidden or moved; a built-in section is hidden, never deleted", k[0] === "hero" && !r.draft.layout.home[0].hidden && r.draft.layout.home.find((x) => x.key === "why").hidden && r.skipped.some((x) => /can't be hidden/.test(x)));
  ok("🔴 only the business's own photos can be picked", r.draft.photoPick.story === "https://x.co/own1.jpg" && !r.draft.photoPick.hero);
  ok("a whole list can be replaced", r.draft.content.faqs.length === 1 && r.draft.content.faqs[0].q === "Do you need power?");
  ok("the draft it was given is never changed", draft.content.hero.headline === "Showroom shine at your door" && draft.blocks.length === 0);
  ok("each change is described in plain words", r.done.length >= 6 && r.done.every((x) => !/[{}]/.test(x)));
  ok("at most twenty changes at once", A.applySiteOps(draft, Array.from({ length: 40 }, () => ({ op: "hide_section", key: "faq" })), { layout: L }).done.length === 20);
  const ans = A.cleanAnswer({ reply: "Bad idea — here's why 😀", suggestions: ["Add prices — fast", 5, ""], changes: [] });
  ok("the reply is cleaned (no dashes, no emojis)", ans.reply === "Bad idea, here's why" && ans.suggestions.length === 1);
  const P = A.siteAISystem(base(), { draft, layout: L, photos });
  ok("🔴 it is told to push back on bad ideas and say why", /do not just do it\. Say plainly why it is a bad idea/.test(P) && /offer a better way/.test(P));
  ok("🔴 it is told never to invent facts or mention BoldLine, and never to use dashes", /Never invent facts/.test(P) && /Never mention BoldLine anywhere on the site/.test(P) && /NEVER use a dash/.test(P) && !/[—–]/.test(P));
  ok("it knows what it can't do and where he does it instead", /Brand kit on the Overview tab/.test(P) && /Extra pages card/.test(P));
  const F = src("netlify/functions/site-ai-background.mjs");
  ok("🔴 the AI never writes the website: its one write is its answer, on its own server-owned key", (F.match(/\.update\(/g) || []).length === 1 && /\.update\(\{ data: \{ \.\.\.row\.data, siteAiJob: job \}/.test(F) && /"siteAiJob"\]/.test(UI));
  ok("🔴 his own businesses only, for now, and signed in", /!isOwned\(row\.data\)/.test(F) && /db\.auth\.getUser\(jwt\)/.test(F));
  ok("it must answer with the change menu", /tool_choice: \{ type: "tool", name: "answer" \}/.test(F) && /tools: \[SITE_AI_TOOL\]/.test(F));
  ok("the words it writes follow the house rules, links are left alone", /humanizeDeep\(applied\.draft\.content\)/.test(F) && /NO_DASH_RULE/.test(F));
  const Pl = src("netlify/functions/site-ai-poll.mjs");
  ok("an answer is only handed back for the question that was asked", /job && job\.id === String\(body\.jobId \|\| ""\) \? job : null/.test(Pl));
}

// 5. The editor screen
{
  ok("🔴 the editor is on his own businesses' Website tab only, for now", /\{isOwned\(client\)&&<SiteEditorCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
  ok("🔴 every save keeps the version before it, and Undo puts it back", /history:\[snap,\.\.\.\(w\.history\|\|\[\]\)\]\.slice\(0,15\)/.test(UI) && /content:h\.content,layout:h\.layout,blocks:h\.blocks,photoPick:h\.photoPick/.test(UI));
  ok("🔴 the preview shows the draft; the AI's changes go into the draft, not the site", /const preview=\{\.\.\.client,website:\{\.\.\.w,content:draft\.content,layout:draft\.layout,blocks:draft\.blocks,photoPick:draft\.photoPick\}\}/.test(UI) && /if\(job\.draft\) setDraft\(job\.draft\)/.test(UI));
  ok("links and photo addresses are never rewritten by the dash cleaner", /blocks:seDeDashBlocks\(draft\.blocks\)/.test(UI) && !/blocks:siteDeDash\(/.test(UI));
  ok("the conversation stays on his device only", /localStorage\.setItem\(store,JSON\.stringify\(msgs\.slice\(-30\)\)\)/.test(UI));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-editor: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
