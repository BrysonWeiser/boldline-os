import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./report-shared.mjs";

const anthropic = new Anthropic();

const clip = (s, n) => String(s || "").slice(0, n);

// The only facts the AI is allowed to state about BoldLine. Keep this in
// sync with marketing-site/index.html -- never let generated posts invent
// client results, testimonials, or capabilities not listed here.
export const BLOG_FACTS = `Business: BoldLine Media -- a digital marketing agency running Google Ads, Meta Ads, custom landing pages, call tracking, and CRM lead routing for small and mid-size businesses.
Niches served (by design, a limited number of clients): home services, medical & wellness, automotive, e-commerce brands.
Process used on every engagement: Discovery (learn the business and customer before any money moves) -> Build (campaign structure, ad creative, tracking, and a dedicated landing page, all checked before launch) -> Launch (quality-checked against the full plan, then live) -> Optimize (reviewed on a set cadence against real performance data, never left untouched) -> Scale (budget grows only once the numbers earn it, and only with the client's sign-off).
True on every plan regardless of tier: a landing page built specifically for the campaign; leads reach the business immediately (automatic notification, no manual forwarding); reporting in plain English on a set cadence; scope locked and checked before anything launches; full account transparency; no spend without the client's sign-off.
The one rule that never bends: the client's ad account is always owned and paid for directly by the client. BoldLine only ever holds manager-level access to run it day to day -- BoldLine never holds, fronts, or touches client ad spend.
Contract terms: engagements start with a three month minimum (paid ads compound; the first month is learning, the second applies the data, the third shows judgeable momentum), then run month to month.
Booking link for every CTA: https://calendly.com/theboldlinemedia/30min
BoldLine does not have real client case studies, testimonials, or performance numbers to cite yet -- never invent any.`;

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

const BLOG_POST_TOOL = {
  name: "blog_post",
  description: "Submit a finished blog post for the BoldLine Media marketing blog.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Headline, under 70 characters. No trailing period." },
      category: { type: "string", description: "A short one-or-two word topic label shown as an eyebrow tag, e.g. 'Strategy', 'Conversion', 'Getting Started'." },
      excerpt: { type: "string", description: "1-2 sentence teaser for the blog index card, under 200 characters." },
      meta_description: { type: "string", description: "SEO meta description, under 160 characters. Can match the excerpt or be a close variant." },
      read_minutes: { type: "integer", description: "Honest estimated reading time in minutes, typically 4-7." },
      intro: { type: "string", description: "Opening paragraph(s), no heading. Separate paragraphs with a blank line." },
      sections: {
        type: "array",
        description: "3-5 body sections, each becomes an H2 plus supporting content.",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "H2 heading for this section." },
            body: { type: "string", description: "Supporting prose for this section. Separate paragraphs with a blank line. Omit if this section is a bulleted list with no lead-in prose." },
            bullets: {
              type: "array",
              description: "Optional bulleted list for this section. Omit entirely if this section is prose-only.",
              items: {
                type: "object",
                properties: {
                  lead: { type: "string", description: "Short bolded lead-in clause, e.g. 'It loads fast'. No trailing period." },
                  rest: { type: "string", description: "The rest of the sentence after the bolded lead-in, including its own closing punctuation." },
                },
                required: ["lead", "rest"],
              },
            },
          },
          required: ["heading"],
        },
      },
      pull_quote: { type: "string", description: "One punchy sentence or two summarizing the post's core point, used as a blockquote. Should not be a verbatim copy of a sentence already used elsewhere in the post." },
      conclusion: { type: "string", description: "Closing paragraph, no heading." },
    },
    required: ["title", "category", "excerpt", "meta_description", "read_minutes", "intro", "sections", "pull_quote", "conclusion"],
  },
};

export async function generateBlogPost({ topic, existingSlugs = [], existingTitles = [] } = {}) {
  const topicInstruction = topic
    ? `Write specifically about this topic, in your own words and structure -- this is a fresh attempt at an existing post, so improve on it rather than just rephrasing it: "${topic}"`
    : `Pick your own topic -- something a real business owner would search for or wonder about before/while running Google Ads or Meta Ads, or about landing pages or lead follow-up.`;

  const avoidInstruction = existingTitles.length
    ? `Do not repeat or closely rephrase any of these existing post topics:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  const system = `You are writing a new post for the BoldLine Media marketing blog, aimed at business owners deciding whether and how to run paid ads. Match the tone of BoldLine's existing posts: direct, plain-spoken, no hype, no generic "10 tips" listicles, willing to say plainly when something might not be right for a given business yet. Ground every factual claim about BoldLine in the real data below -- never invent client results, testimonials, statistics, or capabilities not listed.

REAL BUSINESS DATA (the only facts you may state about BoldLine):
${BLOG_FACTS}

${topicInstruction}
${avoidInstruction}

WRITING STYLE (this is how NOT to sound like AI — follow it closely):
- Never use em-dashes (the "—" character). Use a period or comma instead. This is the single biggest tell that writing is AI-generated.
- Never use parentheses anywhere in the post. If an aside matters, write it as its own sentence; if it doesn't, cut it.
- Vary your sentence length. Mix short, blunt sentences with longer ones. Avoid the steady, evenly-balanced rhythm AI defaults to.
- Avoid these tics: "It's not X, it's Y" setups, rule-of-three triads, "here's the thing," "the truth is," "no fluff," "let's dive in," "in today's world," "when it comes to," and constant hedging.
- Go easy on "actually," "simply," "just," "truly," "seamless," "robust," "leverage," "elevate," "unlock."
- Write like one experienced person talking to a business owner across the table: plain, direct, a little blunt. Use contractions. It's fine to start a sentence with "And" or "But," and fine to have an opinion.

Call the blog_post tool with the finished post. Do not write any other text.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 3000,
    system,
    messages: [{ role: "user", content: "Write the post." }],
    tools: [BLOG_POST_TOOL],
    tool_choice: { type: "tool", name: "blog_post" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("No post generated");

  const post = toolUse.input;
  // Safety net behind the style prompt: guarantee no em-dashes ever ship, even
  // if the model slips. Replace "—" (with any surrounding spaces) with ", ".
  const deDash = (s) => (typeof s === "string" ? s.replace(/\s*—\s*/g, ", ") : s);
  return {
    slug: uniqueSlug(slugify(post.title), existingSlugs),
    title: clip(deDash(post.title), 150),
    category: clip(deDash(post.category), 40),
    excerpt: clip(deDash(post.excerpt), 240),
    meta_description: clip(deDash(post.meta_description), 200),
    body_html: deDash(postToHTML(post)),
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
export async function regeneratePost(postId) {
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
      published_at: target.status === "draft" ? target.published_at : new Date().toISOString(),
    })
    .eq("id", postId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
