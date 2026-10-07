import Anthropic from "@anthropic-ai/sdk";
import { humanize } from "./humanize.mjs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./report-shared.mjs";
import { pingIndexNow } from "./indexnow-shared.mjs";

const anthropic = new Anthropic();

const clip = (s, n) => String(s || "").slice(0, n);

// The only facts the AI is allowed to state about BoldLine. Keep this in
// sync with marketing-site/index.html -- never let generated posts invent
// client results, testimonials, or capabilities not listed here.
export const BLOG_FACTS = `Business: BoldLine Media -- plans, builds and runs Google Ads and Meta Ads, the landing pages behind them, and the websites businesses send people to. Based in Phoenix, working with businesses across the U.S. Never describe the clients as "local businesses".
Who it is for: service businesses that want a steadier phone, especially trades like car detailing, handyman work, epoxy floors and window tint, plus any business that sells a service people search for.
Ads: every call and form is traced back to the ad that caused it, and the client gets a plain-English report. Each month the client pays the plan's minimum or the fee for qualified leads delivered, whichever is higher, never both. Plans start at $400 a month. The ad budget is separate and goes straight to Google or Meta on the client's own card.
Websites: five pages written for the business in one of three modern designs, $1,500 to build (all up front, or half now and half before it goes live), then $100 a month for hosting, security and up to two small edits a month. Extra pages and a blog are add-ons.
The one rule that never bends: the client's ad account is always owned and paid for directly by the client. BoldLine only ever holds manager-level access to run it -- BoldLine never holds, fronts, or touches client ad spend.
Contract terms: ads engagements start with a three month minimum (the first month is learning, the second applies the data, the third shows judgeable momentum), then run month to month.
Free offer: the Free Lead-Leak Check at boldlinemedia.com/free-check/ looks at a business's website and says where customers are slipping away.
BoldLine is a young company. It does not have client case studies, testimonials, results or numbers to cite yet -- never invent any, and never say things like "a question we hear from every client" or "one of our clients".`;

export function slugify(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

function uniqueSlug(base, existingSlugs) {
  const taken = new Set(existingSlugs);
  if (!base) base = "post";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const paragraphsToHTML = (text) =>
  String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n");

const renderBullet = (b) => {
  const lead = esc(String(b.lead || "").replace(/[.:]+$/, ""));
  const rest = esc(String(b.rest || "").trim());
  return lead ? `<li><strong>${lead}.</strong> ${rest}</li>` : `<li>${rest}</li>`;
};

// 🔴 Six posts went live in 2026 as two paragraphs followed by ~65 empty headings: the model's answer came
// back with `sections` in the wrong shape and nothing checked it before publishing. Every AI post is now
// checked here, and every scheduled post again right before it goes live (blog-autopublish).
const words = (s) => String(s || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
export function postProblems(post) {
  const out = [];
  if (!post || typeof post !== "object") return ["no post"];
  for (const k of ["title", "excerpt", "intro", "conclusion"]) if (!String(post[k] || "").trim()) out.push(`missing ${k}`);
  const secs = post.sections;
  if (!Array.isArray(secs)) out.push("sections is not a list");
  else {
    if (secs.length < 3 || secs.length > 7) out.push(`${secs.length} sections`);
    secs.forEach((x, i) => {
      if (!x || typeof x !== "object" || !String(x.heading || "").trim()) out.push(`section ${i + 1} has no heading`);
      else if (words(x.body) + (Array.isArray(x.bullets) ? x.bullets.reduce((n, b) => n + words(b && b.lead) + words(b && b.rest), 0) : 0) < 40) out.push(`section ${i + 1} is nearly empty`);
    });
  }
  return out;
}
export function htmlProblems(html) {
  const out = [];
  const empty = (String(html || "").match(/<h[23][^>]*>\s*<\/h[23]>/g) || []).length;
  if (empty) out.push(`${empty} empty headings`);
  if (words(html) < 450) out.push(`only ${words(html)} words`);
  if (!/<h2[^>]*>\s*\S/.test(String(html || ""))) out.push("no headings");
  return out;
}

function postToHTML(post) {
  const parts = [paragraphsToHTML(post.intro)];
  for (const section of post.sections || []) {
    parts.push(`<h2>${esc(section.heading)}</h2>`);
    if (section.body) parts.push(paragraphsToHTML(section.body));
    if (Array.isArray(section.bullets) && section.bullets.length) {
      parts.push(`<ul>\n${section.bullets.map(renderBullet).join("\n")}\n</ul>`);
    }
  }
  if (post.pull_quote) parts.push(`<blockquote>${esc(post.pull_quote)}</blockquote>`);
  if (post.conclusion) parts.push(paragraphsToHTML(post.conclusion));
  return parts.filter(Boolean).join("\n\n");
}

// The answer must come back in exactly this shape (structured output), so `sections` can never arrive as
// anything but a list of headed sections.
const S = (description) => ({ type: "string", description });
const POST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "category", "excerpt", "meta_description", "read_minutes", "intro", "sections", "pull_quote", "conclusion"],
  properties: {
    title: S("Headline, under 70 characters. No trailing period."),
    category: S("One of: Google Ads, Meta Ads, Websites, Landing Pages, Lead Follow-Up, Budgeting, Getting Started, Trades."),
    excerpt: S("1-2 sentence teaser for the blog index card, under 200 characters."),
    meta_description: S("SEO meta description, under 160 characters."),
    read_minutes: { type: "integer", description: "Honest reading time in minutes, typically 4-7." },
    intro: S("Opening paragraphs, no heading. Separate paragraphs with a blank line."),
    sections: {
      type: "array",
      description: "3-5 body sections. Each becomes an H2 plus its content.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "body", "bullets"],
        properties: {
          heading: S("H2 heading for this section."),
          body: S("Prose for this section, paragraphs separated by a blank line. Empty string only if the bullets carry the section."),
          bullets: {
            type: "array",
            description: "Optional list for this section. Empty list if the section is prose only.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["lead", "rest"],
              properties: { lead: S("Short bolded lead-in, no trailing period."), rest: S("The rest of the sentence, with its own punctuation.") },
            },
          },
        },
      },
    },
    pull_quote: S("One or two punchy sentences with the post's core point. Not a verbatim copy of a sentence in the post."),
    conclusion: S("Closing paragraph, no heading."),
  },
};
export const BLOG_MODEL = "claude-opus-5-5";

// What the weekly post is about rotates, so the blog covers websites and the trades BoldLine calls, not only ads.
export const BLOG_LANES = [
  "Google or Meta ads: a decision a business owner faces before or while running ads",
  "Websites: what makes a service business's website turn visitors into calls, or how to judge one before paying for it",
  "A trade guide: getting more booked jobs for one specific trade (car detailing, handyman, epoxy floors, window tint, pressure washing, or a similar service trade), with the searches and offers that trade's customers respond to",
  "Landing pages and lead follow-up: what happens between the click and the booked job",
];
export const laneFor = (ms = Date.now()) => BLOG_LANES[Math.floor(ms / (7 * 864e5)) % BLOG_LANES.length];

async function askForPost(client, system) {
  const req = {
    model: BLOG_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: { type: "json_schema", schema: POST_SCHEMA } },
    system,
    messages: [{ role: "user", content: "Write the post." }],
  };
  let res;
  try {
    // A safety decline on one model is retried on another inside the same call.
    res = await client.beta.messages.create({ ...req, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (!(e && e.status === 400)) throw e;
    res = await client.messages.create(req);
  }
  if (res.stop_reason === "refusal") throw new Error("The writer declined this topic.");
  if (res.stop_reason === "max_tokens") throw new Error("The post came back cut off.");
  const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try { return JSON.parse(text); } catch { throw new Error("The post came back in the wrong shape."); }
}

export async function generateBlogPost({ topic, existingSlugs = [], existingTitles = [], lane = laneFor(), client = anthropic } = {}) {
  const topicInstruction = topic
    ? `Write specifically about this topic, in your own words and structure -- this is a fresh attempt at an existing post, so improve on it rather than just rephrasing it: "${topic}"`
    : `Pick your own topic in this lane: ${lane}. It should be something a real business owner would type into Google or ask on a sales call. Write something only a team that builds the ads and the websites itself would know, not generic advice anyone could write.`;

  const avoidInstruction = existingTitles.length
    ? `Do not repeat or closely rephrase any of these existing post topics:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  const system = `You are writing a new post for the BoldLine Media marketing blog, aimed at business owners deciding whether and how to run paid ads. Match the tone of BoldLine's existing posts: direct, plain-spoken, no hype, no generic "10 tips" listicles, willing to say plainly when something might not be right for a given business yet. Ground every factual claim about BoldLine in the real data below -- never invent client results, testimonials, statistics, or capabilities not listed.

REAL BUSINESS DATA (the only facts you may state about BoldLine):
${BLOG_FACTS}

${topicInstruction}
${avoidInstruction}

WRITING STYLE (this is how NOT to sound like AI — follow it closely):
- NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, and a plain hyphen with spaces around it. All three read as machine-written, and the spaced hyphen is the most common tell of all. Write two sentences, or use a comma. Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour. This is the single biggest tell that writing is AI-generated.
- Never use parentheses anywhere in the post. If an aside matters, write it as its own sentence; if it doesn't, cut it.
- Vary your sentence length. Mix short, blunt sentences with longer ones. Avoid the steady, evenly-balanced rhythm AI defaults to.
- Avoid these tics: "It's not X, it's Y" setups, rule-of-three triads, "here's the thing," "the truth is," "no fluff," "let's dive in," "in today's world," "when it comes to," and constant hedging.
- Go easy on "actually," "simply," "just," "truly," "seamless," "robust," "leverage," "elevate," "unlock."
- Write like one experienced person talking to a business owner across the table: plain, direct, a little blunt. Use contractions. It's fine to start a sentence with "And" or "But," and fine to have an opinion.
- Be concrete: real search terms, real numbers worked through as examples (labelled as examples), real page elements. Never invent clients, quotes, results or "we see this all the time".
- 900 to 1,400 words. Every section earns its place with substance, never filler.

Return the finished post in the required JSON shape.`;

  // One retry if the answer is malformed; a post that is still wrong is never saved.
  let post = await askForPost(client, system);
  let problems = postProblems(post);
  if (problems.length) { post = await askForPost(client, system); problems = postProblems(post); }
  if (problems.length) throw new Error("The post came back incomplete: " + problems.join(", "));
  // Safety net behind the style prompt: guarantee no em-dashes ever ship, even
  // if the model slips. Replace "—" (with any surrounding spaces) with ", ".
  // Shared humanizer: this used to match ONLY the em dash, so en dashes and spaced
  // hyphens both survived into published posts. Prose join, so a dash becomes a comma
  // rather than chopping a sentence in half.
  const deDash = (s) => humanize(s, { join: ", " });
  const body_html = deDash(postToHTML(post));
  const bad = htmlProblems(body_html);
  if (bad.length) throw new Error("The post came back incomplete: " + bad.join(", "));
  return {
    slug: uniqueSlug(slugify(post.title), existingSlugs),
    title: clip(deDash(post.title), 150),
    category: clip(deDash(post.category), 40),
    excerpt: clip(deDash(post.excerpt), 240),
    meta_description: clip(deDash(post.meta_description), 200),
    body_html,
    read_minutes: Math.max(3, Math.min(12, Number(post.read_minutes) || 5)),
  };
}

async function activePostsExcept(supabase, excludeId) {
  let query = supabase.from("blog_posts").select("id, slug, title").neq("status", "deleted");
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Generates a brand-new post on a topic the AI picks itself, inserts it as
// PUBLISHED immediately, and returns the inserted row. Owner-only escape hatch
// ("Write + Publish Now") -- the normal path since 2026-07-03 is
// createScheduledPost + the review pipeline below.
export async function createAndPublishPost() {
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const existing = await activePostsExcept(supabase, null);

  const post = await generateBlogPost({
    existingSlugs: existing.map((p) => p.slug),
    existingTitles: existing.map((p) => p.title),
  });

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({ ...post, status: "published", source: "ai", published_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  await pingIndexNow([`/blog/${data.slug}/`, "/blog/"]);   // fail-soft
  return data;
}

// --- Fixed weekly schedule (Bryson, 2026-07-03): each post publishes MONDAY
//     08:00 America/Phoenix, and the next one is written+scheduled the preceding
//     TUESDAY 08:00. Arizona keeps Mountain Standard Time all year (UTC-7, no
//     daylight saving), so 08:00 AZ is always 15:00 UTC -- no tz library needed. ---
export const AZ_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Most recent UTC instant (ms) that falls on Arizona-local `dow` (0=Sun..6=Sat)
// at `hour`:00, at or before nowMs.
export function azMostRecent(nowMs, dow, hour) {
  const wall = new Date(nowMs - AZ_OFFSET_MS);   // read AZ wall-clock off UTC getters
  wall.setUTCHours(hour, 0, 0, 0);
  let delta = wall.getUTCDay() - dow;
  if (delta < 0) delta += 7;
  wall.setUTCDate(wall.getUTCDate() - delta);
  let slot = wall.getTime() + AZ_OFFSET_MS;       // back to a real UTC instant
  if (slot > nowMs) slot -= WEEK_MS;
  return slot;
}

// The Monday-08:00-AZ target for the current Tue->Mon cycle: the most recent
// Tuesday 08:00 AZ plus 6 days lands on the following Monday 08:00 AZ.
export function weeklyTargetMs(nowMs = Date.now()) {
  return azMostRecent(nowMs, 2, 8) + 6 * DAY_MS;
}

// Bucket ANY instant to its Tue->Mon publishing week, keyed by that week's
// Monday-08:00-AZ ms. Two posts in the same week share a key regardless of the
// exact time either one is set to -- this is what "one post per week" and "that
// week is blocked" are measured against (Bryson, 2026-07-18).
export function weekKeyMs(ms) {
  return weeklyTargetMs(ms);
}

// Set of week-keys already occupied by a non-deleted post. `exclude` is a Set
// of post ids to ignore (used when respacing the very drafts we're moving).
async function occupiedWeekKeys(supabase, exclude = new Set()) {
  const { data, error } = await supabase.from("blog_posts").select("id, published_at").neq("status", "deleted");
  if (error) throw error;
  const keys = new Set();
  for (const p of data || []) {
    if (exclude.has(p.id) || !p.published_at) continue;
    keys.add(String(weekKeyMs(new Date(p.published_at).getTime())));
  }
  return keys;
}

// Next Monday-08:00-AZ publish slot whose WEEK holds no non-deleted post yet.
// Used by the manual "Write & Schedule" button and the auto-scheduler so a week
// that already has a post is skipped entirely and the new one lands on the next
// open week -- never two in one week (Bryson's one-per-week rule).
export async function nextOpenWeeklySlotISO(supabase, nowMs = Date.now()) {
  const occupied = await occupiedWeekKeys(supabase);
  let mon = weeklyTargetMs(nowMs);
  while (mon <= nowMs) mon += WEEK_MS;
  for (let i = 0; i < 260; i++) {
    if (!occupied.has(String(weekKeyMs(mon)))) return new Date(mon).toISOString();
    mon += WEEK_MS;
  }
  return new Date(mon).toISOString();
}

// One-time / maintenance enforcement of the one-per-week rule on EXISTING
// scheduled drafts. Loads all future-dated drafts (kept in their current order),
// then reassigns them to consecutive open Monday-08:00-AZ slots -- one per week,
// skipping any week already held by a published post -- collapsing stacks so no
// two drafts share a week. Idempotent: run it again and it moves nothing.
export async function respaceScheduledDrafts(supabase, nowMs = Date.now()) {
  const nowISO = new Date(nowMs).toISOString();
  const { data: drafts, error } = await supabase
    .from("blog_posts").select("id, title, published_at")
    .eq("status", "draft").gte("published_at", nowISO)
    .order("published_at", { ascending: true });
  if (error) throw error;
  if (!drafts || !drafts.length) return { moved: 0, total: 0, assignments: [] };

  // Weeks locked by everything we are NOT moving (published posts, etc.).
  const occupied = await occupiedWeekKeys(supabase, new Set(drafts.map((d) => d.id)));

  let mon = weeklyTargetMs(nowMs);
  while (mon <= nowMs) mon += WEEK_MS;
  const assignments = [];
  for (const d of drafts) {
    while (occupied.has(String(weekKeyMs(mon)))) mon += WEEK_MS;   // skip taken weeks
    occupied.add(String(weekKeyMs(mon)));
    const iso = new Date(mon).toISOString();
    if (iso !== d.published_at) {
      const { error: uErr } = await supabase.from("blog_posts").update({ published_at: iso }).eq("id", d.id);
      if (uErr) throw uErr;
      assignments.push({ id: d.id, title: d.title, from: d.published_at, to: iso });
    }
    mon += WEEK_MS;
  }
  return { moved: assignments.length, total: drafts.length, assignments };
}

// Generates a brand-new post but parks it as a SCHEDULED draft: status stays
// 'draft' (invisible to the public blog, which filters status='published')
// and published_at holds the future go-live time. blog-autopublish flips it
// to published when that time arrives -- the owner reviews/edits it in the
// OS Website tab in the meantime.
export async function createScheduledPost(whenISO) {
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // ONE POST PER WEEK, race-hardened. Scheduled functions deliver at-least-once,
  // so blog-autopublish can fire twice at nearly the same moment (or a manual
  // "Write & Schedule" can overlap the cron). Both runs used to pass the outer
  // guard, spend ~30s writing, and insert into the same week -> two near-identical
  // posts on one Monday (the bug Bryson kept hitting). Guard the WEEK BUCKET here,
  // and RE-CHECK it right before the insert, after generation: whichever run
  // inserts first claims the week; any other run sees it occupied and backs off
  // (returns null) instead of creating a duplicate. Callers treat null as
  // "this week is already covered -- nothing to do."
  const targetKey = String(weekKeyMs(new Date(whenISO).getTime()));
  if ((await occupiedWeekKeys(supabase)).has(targetKey)) return null;

  const existing = await activePostsExcept(supabase, null);
  const post = await generateBlogPost({
    existingSlugs: existing.map((p) => p.slug),
    existingTitles: existing.map((p) => p.title),
  });

  // Re-check after the slow AI call closes the long race window.
  if ((await occupiedWeekKeys(supabase)).has(targetKey)) return null;

  const { data, error } = await supabase
    .from("blog_posts")
    .insert({ ...post, status: "draft", source: "ai", published_at: whenISO })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Rewrites an existing post in place: same id and slug (so the live URL never
// breaks), fresh title/content on the same topic, bumped to the top as newest
// so the owner can immediately see the new version. Used by the owner's
// per-post "Regenerate" button.
export async function regeneratePost(postId, { keepDate = false } = {}) {
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: target, error: fetchErr } = await supabase.from("blog_posts").select("*").eq("id", postId).single();
  if (fetchErr || !target) throw new Error("Post not found");

  const existing = await activePostsExcept(supabase, postId);
  const post = await generateBlogPost({
    topic: target.title,
    existingTitles: existing.map((p) => p.title),
  });

  const { data, error } = await supabase
    .from("blog_posts")
    .update({
      title: post.title,
      category: post.category,
      excerpt: post.excerpt,
      meta_description: post.meta_description,
      body_html: post.body_html,
      read_minutes: post.read_minutes,
      source: "ai",
      // Scheduled drafts keep their future publish time -- rewriting the text
      // must not change WHEN it goes live. Published posts bump to newest.
      published_at: target.status === "draft" || keepDate ? target.published_at : new Date().toISOString(),
    })
    .eq("id", postId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Self-repair (2026-10-07): a PUBLISHED post that fails the article check (empty headings, a few dozen words) is
// rewritten on the same topic with the fixed writer, keeping its date and address so links and search results keep
// working. At most one per run, so a bad day can never turn into a burst of AI calls. Returns the repaired post or null.
export async function repairOneBrokenPost(supabase) {
  const { data, error } = await supabase.from("blog_posts").select("id, slug, title, body_html").eq("status", "published").order("published_at", { ascending: false }).limit(200);
  if (error) throw error;
  const broken = (data || []).find((p) => htmlProblems(p.body_html).length);
  if (!broken) return null;
  const fixed = await regeneratePost(broken.id, { keepDate: true });
  return { ...fixed, was: htmlProblems(broken.body_html) };
}
