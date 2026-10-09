// Talking to the AI about a website (Bryson, 2026-10-09: "I want to be able to talk to the ai like how I talk to you
// and have it edit the website based off of what I say and then also have it give suggestions and also tell me if
// it's a bad idea and why (this is for my own website and then if clients want to buy a custom built website or to
// add a specific page)"). KB `site-editor`.
//
// The model never writes the site directly. It answers in plain English and proposes a short list of CHANGES from a
// fixed menu (change these words, add a section of this kind, move or hide a section, pick a photo). applySiteOps
// below checks every one against the same rules the editor screen follows and applies only those that pass, to the
// DRAFT the OS sent. The OS shows the result in the preview, and nothing reaches the live site until he presses Save.
// 🔴 So a confused or over-eager answer can, at worst, produce a draft he throws away.

export const SITE_AI_MODEL = "claude-opus-5-5";
export const MAX_OPS = 20;
const BUILT = ["hero", "marquee", "services", "story", "beforeafter", "why", "steps", "faq", "reviews", "cta"];
const BLOCK_TYPES = ["text", "gallery", "pricing", "video", "areas", "team"];
const TEXT_PATHS = { "hero.eyebrow": 60, "hero.headline": 90, "hero.lineA": 28, "hero.lineB": 28, "hero.sub": 220, "cta.headline": 90, "cta.sub": 200, "cta.button": 28,
  "cta.explore": 28, "cta.send": 28, "about.headline": 90, "seo.title": 70, "seo.description": 160 };
const LISTS = {
  services: { max: 8, fields: { name: 60, blurb: 180, detail: 600 }, need: "name" },
  why: { max: 4, fields: { title: 60, text: 220 }, need: "title" },
  process: { max: 4, fields: { title: 50, text: 200 }, need: "title" },
  faqs: { max: 8, fields: { q: 160, a: 600 }, need: "q" },
};
const SPOTS = ["hero", "story", "about"];

// House rules for anything a customer reads: no dashes (Bryson: the tell of AI writing), no emojis.
export const tidy = (s, n) => String(s == null ? "" : s).replace(/\s*[—–]\s*/g, ", ").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const https = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");

// The one tool the model answers with.
const S = (d) => ({ type: "string", description: d });
export const SITE_AI_TOOL = {
  name: "answer",
  description: "Reply to Bryson about his website, with any changes you propose.",
  input_schema: {
    type: "object",
    properties: {
      reply: S("What you say back, in plain English, like a straight talking web designer friend. Short. If his idea would hurt the site (fewer customers, slower, confusing, off brand, makes claims the business cannot back up), say so plainly and why, and offer a better way. If it is good, just do it."),
      suggestions: { type: "array", maxItems: 3, items: S("One short, specific idea he could ask for next, worth doing for THIS business."), description: "0 to 3 ideas. Leave empty when there is nothing worth adding." },
      changes: {
        type: "array", maxItems: MAX_OPS, description: "The edits to make now. Leave empty when you are only answering, advising, or pushing back.",
        items: {
          type: "object",
          properties: {
            op: { type: "string", enum: ["set_text", "set_list", "add_section", "update_section", "remove_section", "move_section", "hide_section", "show_section", "pick_photo"] },
            path: S("set_text: one of " + Object.keys(TEXT_PATHS).join(", ") + ", or about.story (paragraphs separated by a blank line). set_list: services, why, process, faqs or marquee."),
            value: S("set_text: the new words."),
            list: { type: "array", items: { type: "object" }, description: "set_list: the whole new list. services items {name, blurb, detail}; why and process items {title, text}; faqs items {q, a}; marquee items {word}." },
            key: S("The section: hero, marquee, services, story, beforeafter, why, steps, faq, reviews, cta, or b:<id> for an added section."),
            after: S("move_section and add_section: put it right after this section key. Use top to put it right under the top of the page."),
            type: { type: "string", enum: BLOCK_TYPES, description: "add_section: the kind of section." },
            block: { type: "object", description: "add_section / update_section fields: heading; text: body; gallery: photos (urls from the photo list); pricing: items [{name, price, text}], note; video: url (YouTube, Vimeo or an uploaded video url), text; areas: text, places [strings]; team: people [{name, role, photo}]." },
            spot: { type: "string", enum: SPOTS, description: "pick_photo: which spot." },
            url: S("pick_photo: a photo url from the list, or empty for automatic."),
          },
          required: ["op"],
        },
      },
    },
    required: ["reply", "suggestions", "changes"],
  },
};

// Everything the model is told. No dashes in it on purpose: a model mirrors the style it is given.
export function siteAISystem(cl, ctx) {
  const k = cl.brandKit || {};
  const pk = ((cl.booking || {}).packages || []).filter((p) => p && p.name).map((p) => `${p.name}${p.price ? ` (${p.price})` : ""}${p.desc ? `: ${p.desc}` : ""}`);
  return `You are the web designer and copywriter for ${cl.name || "this business"}${cl.niche ? `, a ${cl.niche} business` : ""}${(cl.businessAddress || (cl.campaignSetup || {}).serviceArea) ? ` serving ${cl.businessAddress || cl.campaignSetup.serviceArea}` : ""}. You are talking with Bryson, who owns it. He does not code. Talk to him the way a sharp friend who builds websites would: plain words, short, no jargon.

Your job, every message:
1. Do what he asks when it helps the business, by proposing changes with the answer tool.
2. If what he asks would hurt (fewer calls or bookings, a slower or more confusing page, something off brand, a claim the business cannot back up, a wall of text on a phone), do not just do it. Say plainly why it is a bad idea, and offer a better way. If he insists in a later message, do it and note the risk in one line.
3. Offer up to three specific next ideas when they are worth it. Skip filler.

What you can change: the words on the site, the order of the home page sections, hiding and showing them, adding sections (text, photo gallery, prices, video, areas we serve, team), and which photo goes in the top of the home page, next to the story, and on the About page. You cannot change the design style, fonts, colours or code from here: for colours and fonts, tell him to use the Brand kit on the Overview tab; for a whole new page, the Extra pages card on the Website tab.

Rules for every word a customer will read:
NEVER use a dash of any kind between words, write two sentences or use a comma. No emojis. Use contractions and write how a person talks. Avoid the phrases that make writing sound machine made: it's not just X, it's Y; in today's world; unlock, elevate, leverage, seamless, robust, game changer. Never invent facts: no years in business, awards, certifications, guarantees, numbers of customers, prices or reviews he has not given you. Keep headlines short and specific to this business. Every button says something specific to this business. Phones come first: short paragraphs.
Never mention BoldLine anywhere on the site.

What you know about the business:
${[["Services they offer", ((ctx.draft.content || {}).services || []).map((s) => s && s.name).filter(Boolean).join(", ")], ["Booking packages", pk.join("; ")], ["How customers book", ((cl.intake || {}).how) || "quote form"], ["Phone", cl.businessPhone], ["Brand colours", [k.primary, k.secondary, k.accent].filter(Boolean).join(", ")], ["Fonts", [k.headingFont, k.bodyFont].filter(Boolean).join(", ")], ["Their own photos uploaded", String(ctx.photos.filter((p) => p.own).length)], ["Before and after pairs", String((cl.beforeAfter || []).length)], ["Real reviews typed in", String(((cl.website || {}).reviews || []).length)], ["Notes", String(cl.notes || "").slice(0, 600)]].filter(([, v]) => v && v !== "0").map(([a, b]) => `${a}: ${b}`).join("\n")}

Photos you may use (url, then whether it is their own photo or a background photo):
${ctx.photos.slice(0, 40).map((p) => `${p.url} ${p.own ? "own" : "background"}${p.label ? ` ${p.label}` : ""}`).join("\n") || "none yet"}

The website as it is right now (a draft he may not have saved yet), as JSON:
${JSON.stringify({ content: ctx.draft.content || {}, homeSections: ctx.layout, addedSections: ctx.draft.blocks || [], photoPicks: ctx.draft.photoPick || {} }).slice(0, 60000)}

Answer only with the answer tool.`;
}

// ── Applying what the model proposed ───────────────────────────────────────────────────────────────
const newId = () => Math.random().toString(36).slice(2, 12);
function cleanBlockFields(type, b, photos) {
  const o = b || {};
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const out = { heading: tidy(o.heading, 90) };
  if (type === "text") out.body = String(o.body == null ? "" : o.body).replace(/\s*[—–]\s*/g, ", ").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").slice(0, 2000).trim();
  if (type === "gallery") out.photos = list(o.photos, 12).map(https).filter((u) => photos.some((p) => p.url === u));
  if (type === "pricing") { out.items = list(o.items, 6).map((i) => ({ name: tidy(i && i.name, 60), price: tidy(i && i.price, 30), text: tidy(i && i.text, 220) })).filter((i) => i.name); out.note = tidy(o.note, 160); }
  if (type === "video") { out.url = https(o.url); out.text = tidy(o.text, 300); }
  if (type === "areas") { out.text = tidy(o.text, 300); out.places = list(o.places, 30).map((p) => tidy(p, 40)).filter(Boolean); }
  if (type === "team") out.people = list(o.people, 8).map((p) => ({ name: tidy(p && p.name, 60), role: tidy(p && p.role, 60), photo: https(p && p.photo) })).filter((p) => p.name);
  return out;
}
const labelOf = (key, blocks) => {
  const names = { hero: "the top of the page", marquee: "the moving strip", services: "Services", story: "your story", beforeafter: "before and after", why: "Why choose us", steps: "How it works", faq: "Questions", reviews: "the review", cta: "the closing call to action" };
  if (names[key]) return names[key];
  const b = blocks.find((x) => `b:${x.id}` === key);
  return b ? `the ${b.type} section${b.heading ? ` "${b.heading}"` : ""}` : key;
};

// Pure: (draft, ops, {layout, photos}) -> {draft, done: [plain English], skipped: [plain English]}.
// `layout` is the resolved home order the draft renders with (site-render homeLayout), so a move always has a place.
export function applySiteOps(draft0, ops, { layout = [], photos = [] } = {}) {
  const d = { content: JSON.parse(JSON.stringify(draft0.content || {})), blocks: JSON.parse(JSON.stringify(draft0.blocks || [])), photoPick: { ...(draft0.photoPick || {}) },
    layout: { home: (layout.length ? layout : ((draft0.layout || {}).home || [])).map((x) => ({ key: x.key, hidden: !!x.hidden })) } };
  const L = d.layout.home;
  const done = [], skipped = [];
  const has = (key) => L.some((x) => x.key === key);
  const at = (key) => L.findIndex((x) => x.key === key);
  const place = (entry, after) => {
    const i = after === "top" ? 0 : at(after);
    const cta = at("cta");
    L.splice(i >= 0 ? i + 1 : (cta >= 0 ? cta : L.length), 0, entry);
  };
  for (const o of (Array.isArray(ops) ? ops : []).slice(0, MAX_OPS)) {
    const op = o && o.op;
    if (op === "set_text") {
      if (o.path === "about.story") { d.content.about = { ...(d.content.about || {}), story: String(o.value || "").split(/\n\s*\n/).map((p) => tidy(p, 700)).filter(Boolean).slice(0, 4) }; done.push("Rewrote your story"); continue; }
      const max = TEXT_PATHS[o.path];
      const v = tidy(o.value, max || 0);
      if (!max || !v) { skipped.push(`Couldn't change "${o.path || "?"}"`); continue; }
      const [a, b] = o.path.split(".");
      d.content[a] = { ...(d.content[a] || {}), [b]: v };
      done.push(`Changed ${a === "seo" ? "the Google listing" : a === "cta" ? "a button or the closing" : a === "about" ? "the About headline" : "the top of the page"}: "${v}"`);
    } else if (op === "set_list") {
      if (o.path === "marquee") { const words = (Array.isArray(o.list) ? o.list : []).map((x) => tidy(typeof x === "string" ? x : x && (x.word || x.text), 40)).filter(Boolean).slice(0, 10); if (!words.length) { skipped.push("Left the moving strip alone"); continue; } d.content.marquee = words; done.push("Updated the moving strip"); continue; }
      const spec = LISTS[o.path];
      if (!spec) { skipped.push(`Couldn't change the list "${o.path || "?"}"`); continue; }
      const items = (Array.isArray(o.list) ? o.list : []).slice(0, spec.max).map((x) => Object.fromEntries(Object.entries(spec.fields).map(([f, n]) => [f, tidy(x && x[f], n)]))).filter((x) => x[spec.need]);
      if (!items.length) { skipped.push(`Didn't empty ${o.path}`); continue; }
      d.content[o.path] = items; done.push(`Updated ${o.path === "faqs" ? "the questions" : o.path === "process" ? "How it works" : o.path === "why" ? "Why choose us" : "your services"}`);
    } else if (op === "add_section") {
      if (!BLOCK_TYPES.includes(o.type)) { skipped.push("Couldn't add that kind of section"); continue; }
      if (d.blocks.length >= 12) { skipped.push("The page already has the most sections it can hold"); continue; }
      const b = { id: newId(), type: o.type, ...cleanBlockFields(o.type, o.block, photos) };
      d.blocks.push(b); place({ key: `b:${b.id}`, hidden: false }, o.after); done.push(`Added ${labelOf(`b:${b.id}`, d.blocks)}`);
    } else if (op === "update_section") {
      const b = d.blocks.find((x) => `b:${x.id}` === o.key);
      if (!b) { skipped.push(`Couldn't find ${o.key || "that section"}`); continue; }
      const given = Object.keys(o.block || {});
      const fresh = cleanBlockFields(b.type, { ...b, ...(o.block || {}) }, photos);
      Object.assign(b, fresh); done.push(`Updated ${labelOf(o.key, d.blocks)}${given.length ? "" : ""}`);
    } else if (op === "remove_section") {
      const i = d.blocks.findIndex((x) => `b:${x.id}` === o.key);
      if (i < 0) { skipped.push(BUILT.includes(o.key) ? `Hid ${labelOf(o.key, d.blocks)} instead of removing it` : `Couldn't find ${o.key || "that section"}`); if (BUILT.includes(o.key) && o.key !== "hero" && has(o.key)) L[at(o.key)].hidden = true; continue; }
      const label = labelOf(o.key, d.blocks);
      d.blocks.splice(i, 1); const j = at(o.key); if (j >= 0) L.splice(j, 1); done.push(`Removed ${label}`);
    } else if (op === "move_section") {
      if (!has(o.key) || o.key === "hero") { skipped.push(o.key === "hero" ? "The top of the page always stays first" : `Couldn't find ${o.key || "that section"}`); continue; }
      if (o.after !== "top" && !has(o.after)) { skipped.push(`Couldn't tell where to move ${labelOf(o.key, d.blocks)}`); continue; }
      const [e] = L.splice(at(o.key), 1); place(e, o.after); done.push(`Moved ${labelOf(o.key, d.blocks)}`);
    } else if (op === "hide_section" || op === "show_section") {
      if (!has(o.key) || o.key === "hero") { skipped.push(o.key === "hero" ? "The top of the page can't be hidden" : `Couldn't find ${o.key || "that section"}`); continue; }
      L[at(o.key)].hidden = op === "hide_section"; done.push(`${op === "hide_section" ? "Hid" : "Showed"} ${labelOf(o.key, d.blocks)}`);
    } else if (op === "pick_photo") {
      if (!SPOTS.includes(o.spot)) { skipped.push("Couldn't tell which photo spot"); continue; }
      const u = https(o.url);
      if (u && !photos.some((p) => p.url === u)) { skipped.push("That photo isn't one of the business's photos"); continue; }
      d.photoPick[o.spot] = u; done.push(u ? `Picked a new photo for ${o.spot === "hero" ? "the top of the page" : o.spot === "story" ? "your story" : "the About page"}` : `Set the ${o.spot} photo back to automatic`);
    } else skipped.push("Skipped a change I couldn't make");
  }
  // The top of the page always first.
  const h = at("hero"); if (h > 0) L.unshift(L.splice(h, 1)[0]);
  if (h >= 0) L[0].hidden = false;
  return { draft: d, done, skipped };
}

// The model's tool answer, made safe to show: plain text only, short, no dashes or emojis.
export function cleanAnswer(input) {
  const i = input || {};
  return {
    reply: String(i.reply || "").replace(/\s*[—–]\s*/g, ", ").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim().slice(0, 2500) || "Done.",
    suggestions: (Array.isArray(i.suggestions) ? i.suggestions : []).filter((x) => typeof x === "string").map((x) => tidy(x, 200)).filter(Boolean).slice(0, 3),
    changes: Array.isArray(i.changes) ? i.changes.slice(0, MAX_OPS) : [],
  };
}
