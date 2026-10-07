// Writes a client's website copy, and picks background photos until they send real ones.
//
// A `-background` function: Netlify returns 202 at once and lets it run for up to 15 minutes,
// because five pages of copy is far more than the ~10 seconds a normal function gets. The result
// goes on the CLIENT RECORD at `data.siteJob` (read-merge-write of that one key, the adGenJob
// pattern, no table to migrate), and the OS polls `site` action:"poll" and saves it into
// `website` itself. KB `website-builder`.
//
// POST { clientId } with the owner's session.  Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
// PEXELS_API_KEY (optional: without it the site uses color and light instead of photos).

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { humanizeDeep } from "../lib/humanize.mjs";
import { brandName } from "../lib/site-render.mjs";
import { buildLock, termsOf, exempt } from "../lib/website-deal.mjs";
import { slugify, RESERVED_SLUGS } from "../lib/site-render.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const MODEL = "claude-opus-5-5";

const str = (d) => ({ type: "string", description: d });
const obj = (props, d) => ({ type: "object", description: d, properties: props, required: Object.keys(props), additionalProperties: false });
const arr = (items, d) => ({ type: "array", description: d, items });

// The shape every page is rendered from (site-render.mjs `siteContent`).
export const SITE_SCHEMA = obj({
  hero: obj({
    eyebrow: str("4 to 7 words naming what they do and where, e.g. 'Chiropractic care in Gilbert'."),
    headline: str("The main headline, 3 to 8 words, confident and specific. No business name."),
    lineA: str("The headline's first half, 1 to 3 words, for the two-part hero."),
    lineB: str("The headline's second half, 1 to 3 words."),
    sub: str("One or two sentences under the headline, under 200 characters."),
  }, "The top of the home page."),
  services: arr(obj({ name: str("Service name, 2 to 5 words."), blurb: str("One sentence, under 130 characters."), detail: str("Two to three sentences for the Services page.") }, "One service."), "3 to 6 of the services this business actually offers."),
  why: arr(obj({ title: str("2 to 4 words."), text: str("One sentence.") }, "A reason to choose them."), "Exactly 3 reasons, each grounded in what you were told. No invented facts."),
  about: obj({ headline: str("About page headline, 3 to 7 words."), story: arr(str("A paragraph of 2 to 4 sentences."), "2 or 3 paragraphs.") }, "The About page."),
  process: arr(obj({ title: str("2 to 4 words."), text: str("One sentence.") }, "A step."), "Exactly 3 steps from first contact to the job being done."),
  faqs: arr(obj({ q: str("A real question a customer would ask."), a: str("An honest answer, 1 to 3 sentences, that never promises what you were not told.") }, "A question."), "4 to 6 questions."),
  cta: obj({ headline: str("A short closing call to action headline, 3 to 8 words."), sub: str("One sentence."), button: str("Button text, 2 to 4 words, e.g. 'Book a visit' or 'Get a free quote'."), explore: str("The second button next to it, which opens their services page. 2 to 4 words, specific to this business, e.g. 'See our pool designs' or 'Browse detail packages'. Never 'Our services' or 'Learn more'."), send: str("The contact form's send button, 2 to 4 words in their voice, e.g. 'Send my request' or 'Request my quote'.") }, "The calls to action."),
  marquee: arr(str("1 to 3 words."), "6 to 8 short service or area words for the moving strip."),
  seo: obj({ title: str("Page title under 60 characters: what they do and where, then the business name."), description: str("Meta description under 155 characters.") }, "Search listing text."),
}, "Website copy.");

// No em or en dashes anywhere in this prompt, on purpose: a model mirrors the style it is given.
export function buildPrompt(cl) {
  const cs = (cl && cl.campaignSetup) || {};
  const bv = (cl && cl.brandVoice) || {};
  const facts = [
    ["Business name", brandName(cl)],
    ["What they do", cl.niche],
    ["Services they mentioned", (cl.services || cs.services || "")],
    ["Main offer", cs.mainOffer],
    ["Service area", cs.serviceArea || cs.targetLocations],
    ["Average job", cs.avgTicket],
    ["What makes them different", bv.differentiator],
    ["Tone they want", bv.tone],
    ["Notes from the sales call", String(cl.notes || "").slice(0, 1500)],
    ["What counts as a good customer", String(cl.qualifiedLeadDef || "").slice(0, 600)],
  ].filter(([, v]) => String(v || "").trim()).map(([k, v]) => `${k}: ${String(v).trim()}`).join("\n");
  const health = /chiro|dental|med ?spa|medical|clinic|therap|physio|wellness|dermatolog|optom|audiolog|counsel|psych/i.test(`${cl.niche} ${cl.name}`);
  return `Write the copy for a small business website. It has five pages: Home, Services, About, Reviews and Contact.

WHAT WE KNOW ABOUT THE BUSINESS
${facts || "Only the name is known."}

HOW TO WRITE IT
Write the way the owner would say it to a customer face to face. Short sentences mixed with longer ones. Use contractions. Talk to the reader as "you".
Never use an em dash or an en dash. Use a comma or start a new sentence.
Never use these words or patterns: unlock, elevate, leverage, seamless, robust, game changer, cutting edge, "in today's world", "it's not just X, it's Y", "look no further".
Don't open every line with a question.
Never say "local businesses".

THE MOST IMPORTANT RULE: DON'T INVENT ANYTHING
Only state facts you were given. Do not make up years in business, numbers of customers, star ratings, awards, certifications, guarantees, prices, insurance details or reviews. If you don't know something, write around it. The "why choose us" points must come from what you were told, or be things true of any honest business in this trade that care about their customers.
${health ? "This is a health business. Don't promise cures or results, don't diagnose, and don't ask the reader to share medical details.\n" : ""}
Fill in every field.`;
}

// An extra page (add-on): one page written from a title and a one-line brief Bryson types.
export const PAGE_SCHEMA = obj({
  headline: str("The page headline, 3 to 8 words."),
  intro: str("One or two sentences under the headline, under 220 characters."),
  sections: arr(obj({ heading: str("2 to 6 words."), text: str("Two to four sentences.") }, "A section of the page."), "3 to 6 sections."),
}, "An extra website page.");

export function pagePrompt(cl, title, brief) {
  return `${buildPrompt(cl).replace("Write the copy for a small business website. It has five pages: Home, Services, About, Reviews and Contact.", `Write ONE extra page for this business's website. The page is called "${String(title).slice(0, 60)}". What it is for: ${String(brief || title).slice(0, 400)}.`)}`;
}

// How many extra pages this client may have: the number in their signed website deal.
export const extraPageRoom = (cl, slug) => {
  if (exempt(cl)) return true;
  const have = (((cl.website || {}).extraPages) || []).filter((p) => p && p.slug && p.slug !== slug && p.content).length;
  return have < termsOf(cl).extraPages;
};

async function writeJob(supabase, clientId, job) {
  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  const next = { ...((row && row.data) || {}), siteJob: job };
  const { error } = await supabase.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", clientId);
  if (error) console.error("site-build-background: could not store job:", error.message);
}

export async function writeCopy(cl, client = new Anthropic(), { schema = SITE_SCHEMA, prompt = buildPrompt(cl) } = {}) {
  const req = {
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: prompt }],
  };
  let res;
  try {
    // A safety decline on one model is retried on another inside the same call.
    res = await client.beta.messages.create({ ...req, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (!(e && e.status === 400)) throw e;
    res = await client.messages.create(req);
  }
  if (res.stop_reason === "refusal") throw new Error("The writer declined this one. Try again, or add more detail to the client record.");
  if (res.stop_reason === "max_tokens") throw new Error("The copy came back cut off. Try again.");
  const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("The copy came back in the wrong shape. Try again."); }
  return humanizeDeep(parsed, { join: ", " });
}

// Background photos until the client sends real ones. Pexels' own image host only.
export async function stockPhotos(niche, key = process.env.PEXELS_API_KEY, fetchImpl = fetch) {
  if (!key) return [];
  const q = `${String(niche || "small business").trim()} professional at work`;
  try {
    const r = await fetchImpl(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`, { headers: { Authorization: key } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.photos || []).filter((p) => p && p.src && /^https:\/\/images\.pexels\.com\//.test(p.src.large2x || ""))
      .slice(0, 4).map((p) => ({ url: p.src.large2x, alt: String(p.alt || "").slice(0, 80), credit: String(p.photographer || "").slice(0, 60), source: "pexels" }));
  } catch { return []; }
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: ae } = await supabase.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (!row || !row.data) return json({ ok: false, error: "Client not found" }, 404);
  // 🔴 No website is written until the client has signed and paid (Bryson, 2026-10-06). Checked here, on
  // the server, so a stale or tampered button in the OS cannot start a build. KB `website-builder`.
  const lock = buildLock({ ...row.data, id: clientId });
  if (lock) return json({ ok: false, error: lock }, 409);

  const id = `site-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // One extra page rather than the whole site.
  if (body.extraPage) {
    const title = String(body.extraPage.title || "").trim().slice(0, 60);
    const slug = slugify(body.extraPage.slug || title);
    if (!title || !slug || RESERVED_SLUGS.includes(slug)) return json({ ok: false, error: "Give the page a name that isn't one of the five main pages." }, 400);
    // 🔴 Only as many extra pages as the client paid for.
    if (!extraPageRoom({ ...row.data, id: clientId }, slug)) return json({ ok: false, error: `Their agreement includes ${termsOf(row.data).extraPages} extra page(s), and they're all written. Add more to the deal first.` }, 409);
    await writeJob(supabase, clientId, { id, kind: "page", status: "running", startedAt: new Date().toISOString(), page: null, error: null });
    try {
      const content = await writeCopy(row.data, new Anthropic(), { schema: PAGE_SCHEMA, prompt: pagePrompt(row.data, title, body.extraPage.brief) });
      await writeJob(supabase, clientId, { id, kind: "page", status: "done", finishedAt: new Date().toISOString(), page: { slug, title, brief: String(body.extraPage.brief || "").slice(0, 400), content }, error: null });
    } catch (e) {
      await writeJob(supabase, clientId, { id, kind: "page", status: "error", finishedAt: new Date().toISOString(), page: null, error: String((e && e.message) || e).slice(0, 240) });
    }
    return json({ ok: true, id }, 202);
  }
  await writeJob(supabase, clientId, { id, status: "running", startedAt: new Date().toISOString(), content: null, stock: null, error: null });
  try {
    const [content, stock] = await Promise.all([writeCopy(row.data), stockPhotos(row.data.niche)]);
    await writeJob(supabase, clientId, { id, status: "done", startedAt: null, finishedAt: new Date().toISOString(), content, stock, error: null });
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("site-build-background failed:", msg);
    const friendly = /credit balance|billing/i.test(msg) ? "The AI account is out of credits. Add credits in the Anthropic console, then try again." : msg.slice(0, 240);
    await writeJob(supabase, clientId, { id, status: "error", finishedAt: new Date().toISOString(), content: null, stock: null, error: friendly });
  }
  return json({ ok: true, id }, 202);
};
