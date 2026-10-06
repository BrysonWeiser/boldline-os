// Client blogs: where the articles live, when the next one is due, and how one is written.
//
// Bryson, 2026-10-06: *"charge an extra for blog page creation and then ai blog post creations"*. A client
// who bought the blog (website deal `blog: true`, KB `website-builder`) gets about `blogPosts` articles a
// month, written from their own client record, each published two days after it is written so Bryson
// can read it first and hold it if anything is off. Nothing here invents facts about the business.
//
// 🔴 STORED IN A PRIVATE STORAGE BUCKET, NOT ON THE CLIENT RECORD. The OS loads every client record on
// every screen; a year of articles on each would make it crawl. `site-blog/<clientId>/index.json` lists the
// posts (small), and each article is its own file. No table, so nothing for Bryson to set up.
//
// 🔴 PUBLISHED MEANS publishAt HAS PASSED AND IT IS NOT HELD. One rule, used by the public site, the OS and
// the portal, so a held article can never leak through one of them.

import crypto from "node:crypto";
import { termsOf, isSigned, fullyPaid, dealOf } from "./website-deal.mjs";
import { brandName } from "./site-render.mjs";
import { humanizeDeep } from "./humanize.mjs";

export const BLOG_BUCKET = "site-blog";
export const REVIEW_HOURS = 48;

export const isPublished = (p, now = Date.now()) => !!(p && !p.held && p.publishAt && Date.parse(p.publishAt) <= now);
export const publishedPosts = (index, now = Date.now()) => (index || []).filter((p) => isPublished(p, now)).sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt));

// Is this client owed articles right now? Signed for a blog, fully paid, live, and the monthly plan still on.
export function blogActive(cl) {
  if (!cl || cl.demo) return false;
  if (cl.internal) return !!(cl.website && cl.website.blogOn);
  const t = termsOf(cl), d = dealOf(cl);
  if (!t.blog || !isSigned(cl) || !fullyPaid(cl) || !d.launchedAt) return false;
  return !(d.careSub && d.careSub.status === "canceled");
}

// When the next article is due. Spaced evenly across a month, never more than `blogPosts` in a calendar
// month (Phoenix), and a new one is only written once the last one is out or nearly out.
export function nextDue(cl, index, now = Date.now()) {
  const per = termsOf(cl).blogPosts || 4;
  const gap = Math.max(3, Math.floor(30 / per)) * 864e5;
  const posts = (index || []).filter((p) => p && p.publishAt);
  const last = posts.reduce((m, p) => Math.max(m, Date.parse(p.publishAt) || 0), 0);
  const publishAt = Math.max(now + REVIEW_HOURS * 3600e3, last ? last + gap : 0);
  const monthKey = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" }).slice(0, 7);
  const inMonth = posts.filter((p) => monthKey(Date.parse(p.publishAt)) === monthKey(publishAt)).length;
  const due = inMonth < per && (!last || last + gap <= now + REVIEW_HOURS * 3600e3);
  return { due, publishAt: new Date(publishAt).toISOString(), inMonth, per };
}

export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "article";
export const uniqueSlug = (title, index) => {
  const base = slugify(title); const taken = new Set((index || []).map((p) => p.slug));
  let s = base, i = 2; while (taken.has(s)) s = `${base}-${i++}`; return s;
};

// ── Storage ──────────────────────────────────────────────────────────────────────────────
// `store` = { read(path) -> object|null, write(path, object) }. The real one is built from Supabase in
// `supabaseStore`; tests pass a Map.
export const supabaseStore = (supabase) => ({
  async read(path) {
    const { data, error } = await supabase.storage.from(BLOG_BUCKET).download(path);
    if (error || !data) return null;
    try { return JSON.parse(await data.text()); } catch { return null; }
  },
  async write(path, obj) {
    await supabase.storage.createBucket(BLOG_BUCKET, { public: false }).catch(() => {});
    const { error } = await supabase.storage.from(BLOG_BUCKET).upload(path, Buffer.from(JSON.stringify(obj)), { contentType: "application/json", upsert: true });
    if (error) throw new Error(error.message);
  },
});
const idx = (clientId) => `${clientId}/index.json`;
const postPath = (clientId, slug) => `${clientId}/posts/${slug}.json`;
export const loadIndex = async (store, clientId) => { const v = await store.read(idx(clientId)); return Array.isArray(v) ? v : []; };
export const loadPost = async (store, clientId, slug) => store.read(postPath(clientId, slugify(slug)));
export async function savePost(store, clientId, post) {
  await store.write(postPath(clientId, post.slug), post);
  const index = (await loadIndex(store, clientId)).filter((p) => p.slug !== post.slug);
  index.push({ slug: post.slug, title: post.title, excerpt: post.excerpt, publishAt: post.publishAt, held: !!post.held, writtenAt: post.writtenAt });
  await store.write(idx(clientId), index);
  return index;
}
export async function setHeld(store, clientId, slug, held) {
  const index = await loadIndex(store, clientId);
  const hit = index.find((p) => p.slug === slug);
  if (!hit) throw new Error("No such article.");
  hit.held = !!held;
  const post = await loadPost(store, clientId, slug);
  if (post) await store.write(postPath(clientId, slug), { ...post, held: !!held });
  await store.write(idx(clientId), index);
  return index;
}
export async function removePost(store, clientId, slug) {
  const index = (await loadIndex(store, clientId)).filter((p) => p.slug !== slug);
  await store.write(idx(clientId), index);
  return index;
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────
const str = (d) => ({ type: "string", description: d });
export const POST_SCHEMA = {
  type: "object", additionalProperties: false, required: ["title", "excerpt", "blocks"],
  properties: {
    title: str("The article title, 4 to 10 words. Specific and useful, not clickbait."),
    excerpt: str("One or two sentences that make someone want to read it, under 200 characters."),
    blocks: { type: "array", description: "The article, 6 to 14 blocks: short subheadings (h2) and paragraphs (p), 600 to 900 words in total.",
      items: { type: "object", additionalProperties: false, required: ["kind", "text"], properties: { kind: { type: "string", enum: ["h2", "p"] }, text: str("The subheading or the paragraph.") } } },
  },
};

const isHealth = (cl) => /chiro|dental|med ?spa|medical|clinic|therap|physio|wellness|dermatolog|optom|audiolog|counsel|psych/i.test(`${cl.niche} ${cl.name}`);

// No dashes anywhere in this prompt, on purpose: a model mirrors the style it is given.
export function postPrompt(cl, titles = []) {
  const cs = cl.campaignSetup || {}, bv = cl.brandVoice || {}, c = (cl.website && cl.website.content) || {};
  const facts = [
    ["Business", brandName(cl)], ["What they do", cl.niche], ["Services", (c.services || []).map((s) => s && s.name).filter(Boolean).join(", ") || cs.services],
    ["Service area", cs.serviceArea || cs.targetLocations], ["What makes them different", bv.differentiator], ["Tone", bv.tone],
  ].filter(([, v]) => String(v || "").trim()).map(([k, v]) => `${k}: ${String(v).trim()}`).join("\n");
  const today = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "America/Phoenix" });
  return `Write one blog article for this business's website. Their customers will read it. It is ${today}.

ABOUT THE BUSINESS
${facts || "Only the name is known."}

ARTICLES ALREADY ON THE BLOG (do not repeat these topics)
${titles.length ? titles.map((t) => `- ${t}`).join("\n") : "None yet."}

WHAT TO WRITE
Pick one practical question their customers really ask, and answer it well: what to look for, how something works, what it costs to get wrong, how to prepare, a seasonal tip. Useful first, so a reader trusts them. Mention the business naturally once or twice near the end, and finish by inviting the reader to get in touch.

HOW TO WRITE IT
Write the way the owner would explain it to a customer. Mix short and longer sentences. Use contractions. Talk to the reader as "you".
Never use an em dash or an en dash. Use a comma or start a new sentence.
Never use these words or patterns: unlock, elevate, leverage, seamless, robust, game changer, cutting edge, delve, "in today's world", "it's not just X, it's Y", "look no further".
Never say "local businesses".

THE MOST IMPORTANT RULE: DON'T INVENT ANYTHING ABOUT THE BUSINESS
Do not make up years in business, numbers of customers, star ratings, awards, certifications, guarantees, prices, staff names or reviews. General knowledge about the trade is fine; claims about this business must come from what you were given.
${isHealth(cl) ? "This is a health business. Don't diagnose, don't promise cures or results, and suggest seeing a professional for anything specific.\n" : ""}`;
}

// One article from the model. `client` is an Anthropic client; injected so tests never call the network.
export async function writePost(cl, titles, client) {
  const req = {
    model: "claude-opus-5-5", max_tokens: 12000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: POST_SCHEMA } },
    messages: [{ role: "user", content: postPrompt(cl, titles) }],
  };
  let res;
  try { res = await client.beta.messages.create({ ...req, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }); }
  catch (e) { if (!(e && e.status === 400)) throw e; res = await client.messages.create(req); }
  if (res.stop_reason === "refusal") throw new Error("The writer declined this one.");
  if (res.stop_reason === "max_tokens") throw new Error("The article came back cut off.");
  const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let a; try { a = JSON.parse(text); } catch { throw new Error("The article came back in the wrong shape."); }
  a = humanizeDeep(a, { join: ", " });
  const blocks = (a.blocks || []).filter((b) => b && (b.kind === "h2" || b.kind === "p") && String(b.text || "").trim());
  if (!a.title || blocks.filter((b) => b.kind === "p").length < 3) throw new Error("The article came back too short.");
  return { title: String(a.title).trim().slice(0, 140), excerpt: String(a.excerpt || "").trim().slice(0, 240), blocks };
}

// The scheduled job and the background writer share a key derived from the service-role key, so the job
// can start a write without a new environment variable and nobody outside can.
export const internalKey = () => crypto.createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY || ""}:site-blog`).digest("hex");
