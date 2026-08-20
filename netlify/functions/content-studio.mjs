// Content Studio — video ideas + scripts for BoldLine's own channels.
//
// Two actions, both synchronous (the ARIA pattern) because the outputs are
// deliberately BOUNDED — 6 ideas or 1 script — so a call finishes fast enough to
// return inline instead of needing a background job + a Supabase table + polling.
// If these ever start timing out, the fix is to convert to the
// deal-research-background + poll pattern; see KB content-studio.
//
// POST { action, ... } with the owner's Supabase session:
//   "ideas"  -> { mode, pillar?, topic?, avoid[] } -> 6 video ideas
//   "script" -> { mode, idea, minutes? }           -> one shootable script
//
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { humanizeDeep } from "../lib/humanize.mjs";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Cheaper first: content writing sits well inside Sonnet's range, and the
// standing preference is to keep credit burn down. Falls back if the id is
// rejected (the SDK pinned here is older than the model list).
const MODELS = ["claude-sonnet-5", "claude-opus-4-8"];

export const PILLARS = [
  { id: "build",     label: "Building in public",   note: "the honest zero-to-one story. No clients yet, and that IS the story" },
  { id: "teach",     label: "Teaching ads",         note: "how Google/Meta ads actually work for a local business owner" },
  { id: "teardown",  label: "Teardowns",            note: "pick apart a real local business's ads/site/landing page and show the fix" },
  { id: "contrarian",label: "Contrarian takes",     note: "shared leads, agencies holding ad accounts hostage, retainer myths" },
  { id: "personal",  label: "Personal brand",       note: "discipline, gym, being young and building a company, the daily reality" },
  { id: "sales",     label: "Sales + cold calling", note: "the actual cold-call grind, objections, what gets a meeting" },
];

// The single most important guardrail: BoldLine has no clients yet, so ANY
// result, testimonial or case-study number would be a lie — and the internet
// punishes a young founder for that harder than for having no results at all.
const GROUND_RULES = `HARD RULES. These override everything else:
- BoldLine Media has NO CLIENTS YET and NO RESULTS YET. Never invent client results, revenue figures, lead counts, ROAS, testimonials, case studies, "I helped X get Y", or any social proof. Not as an example, not as a placeholder, not as "imagine if".
- Where a results-based hook would normally go, use one of these instead: the honest build-in-public angle, a teaching angle, a teardown of a PUBLIC business's visible marketing, or a contrarian opinion.
- Bryson is a young founder starting an agency. His credibility comes from being useful and honest, not from claiming success he hasn't had.
- NO EMOJIS anywhere in the output. Not in titles, hooks, captions, or on-screen text. This is a standing brand rule for anything the public sees.
- No hype-bro voice. No "crushing it", no fake urgency, no "secret nobody tells you" clickbait he'd be embarrassed by. Direct, specific, confident.
- Every idea must be shootable ALONE, on a phone, with no crew, no b-roll he doesn't have, and no paid tools.
- NOTHING may read as AI-written. Standing rule. In particular:
  - NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, and a plain hyphen with spaces around it. All three read as machine-written, and the spaced hyphen is the most common tell of all. Write two sentences, or use a comma. Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour. Bryson calls this out on sight.
  - No "it's not just X, it's Y". No "in today's world". No "let's dive in". No "unlock/elevate/leverage/seamless/robust/game-changer/supercharge". No "the truth is". No rule-of-three lists where two would do.
  - Don't open every line with a rhetorical question, and don't end on a neat inspirational bow.
  - Vary sentence length. Real speech is uneven. A wall of same-length balanced clauses is what a model sounds like.
  - Contractions are fine and preferred. Write how he'd actually say it out loud.`;

const BUSINESS = `WHO THIS IS FOR:
Bryson Weiser, founder of BoldLine Media (Phoenix / Gilbert, Arizona). The agency runs Google Ads and Meta Ads for businesses and builds the custom landing pages those ads point to. Target clients are service businesses (roofing, HVAC, med spa, auto detailing, home services) plus e-commerce. He works with them remotely and nationally, so NEVER describe the audience as "local businesses" in any output. Differentiators worth working into content: the CLIENT always owns and is billed for their own ad account (BoldLine never holds it or fronts spend), every campaign gets a purpose-built landing page rather than pointing at a homepage, and the whole operation is automated by software he built himself.
He is building two audiences at once: (1) BUSINESS: business owners who could hire him, (2) PERSONAL: a founder audience who follow the building-in-public story. Say which one each idea serves.`;

const IDEA_TOOL = {
  name: "video_ideas",
  description: "Return exactly 6 distinct video ideas.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "The video's working title. Specific, not a category." },
            hook: { type: "string", description: "The literal first sentence he says on camera. Must earn the next 3 seconds." },
            audience: { type: "string", enum: ["business", "personal", "both"] },
            pillar: { type: "string" },
            platforms: { type: "array", items: { type: "string" }, description: "e.g. Reels, TikTok, YouTube Shorts, YouTube, Podcast" },
            lengthHint: { type: "string", description: "e.g. '30-45 sec' or '8-12 min'" },
            beats: { type: "array", items: { type: "string" }, description: "3-5 beats the video moves through, in order." },
            why: { type: "string", description: "One sentence: why this earns attention or trust, and what it does for the business." },
            effort: { type: "string", enum: ["easy", "medium", "involved"], description: "easy = talk to camera, no prep." },
          },
          required: ["title", "hook", "audience", "pillar", "platforms", "lengthHint", "beats", "why", "effort"],
        },
      },
    },
    required: ["ideas"],
  },
};

const SCRIPT_TOOL = {
  name: "video_script",
  description: "Return one complete, shootable script.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      hook: { type: "string", description: "The exact opening line, word for word." },
      blocks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Section name, e.g. 'Hook', 'The problem', 'Proof', 'Close'." },
            timing: { type: "string", description: "e.g. '0:00-0:05' or 'minutes 2-4'." },
            say: { type: "string", description: "What he actually says. Written to be spoken aloud, not read." },
            direction: { type: "string", description: "Camera/edit note: on-screen text, cut, b-roll, screen share." },
          },
          required: ["label", "timing", "say", "direction"],
        },
      },
      cta: { type: "string", description: "The closing ask. One clear action." },
      caption: { type: "string", description: "Post caption. No emojis." },
      hashtags: { type: "array", items: { type: "string" } },
      titleOptions: { type: "array", items: { type: "string" }, description: "3 alternate titles/thumbnail lines." },
      onScreenText: { type: "array", items: { type: "string" }, description: "Short text overlays to burn in." },
      shotNotes: { type: "string", description: "Where to shoot it, framing, anything to have ready before recording." },
    },
    required: ["title", "hook", "blocks", "cta", "caption", "hashtags", "titleOptions", "onScreenText", "shotNotes"],
  },
};

async function runTool({ tool, system, prompt, maxTokens }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: prompt }],
      });
      const use = (msg.content || []).find((b) => b.type === "tool_use");
      if (!use) throw new Error("The model replied without using the tool.");
      // Every string the model produced, dash-free. Was prompt-only before 2026-08-20.
      return { data: humanizeDeep(use.input), model };
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      // Only walk the ladder for model-availability problems; a bad request or a
      // credit failure will fail identically on the next rung, so surface it now.
      if (!/model|not_found|404|does not exist|unsupported/i.test(m)) throw e;
      console.warn(`content-studio: ${model} rejected (${m}) — trying next`);
    }
  }
  throw lastErr || new Error("No model available");
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const action = String(body.action || "ideas");
  const mode = body.mode === "long" ? "long" : "short";

  try {
    if (action === "ideas") {
      const pillar = PILLARS.find((p) => p.id === body.pillar);
      const topic = String(body.topic || "").trim().slice(0, 300);
      const avoid = (Array.isArray(body.avoid) ? body.avoid : []).slice(0, 40).map((t) => String(t).slice(0, 140));

      const shape = mode === "short"
        ? "SHORT-FORM: vertical video, 20-60 seconds, for Reels / TikTok / YouTube Shorts. The hook has to land in the first 2 seconds or the video is dead. One idea per video. No listicles that need 5 points."
        : "LONG-FORM: 6-15 minute YouTube videos, or podcast episodes/segments. These can breathe: build an argument, walk through something real on screen, tell the full story. The hook still matters but you have 30 seconds, not 2.";

      const { data, model } = await runTool({
        tool: IDEA_TOOL,
        maxTokens: 2000,
        system: `You are a content strategist who makes founders sound like themselves, not like a marketing account.\n\n${BUSINESS}\n\n${GROUND_RULES}`,
        prompt: `Give me 6 ${mode === "short" ? "short-form" : "long-form"} video ideas.\n\n${shape}\n`
          + (pillar ? `\nFOCUS THIS ROUND ON: ${pillar.label}. ${pillar.note}. All 6 ideas should sit in that lane, but attack it from 6 genuinely different angles.\n` : `\nMix the pillars: building in public, teaching ads, teardowns, contrarian takes, personal brand, sales/cold calling. Do not give me 6 variations of one idea.\n`)
          + (topic ? `\nHE SPECIFICALLY WANTS IDEAS ABOUT: ${topic}\n` : "")
          + (avoid.length ? `\nHe already has these, do not repeat them or produce near-duplicates:\n${avoid.map((t) => `- ${t}`).join("\n")}\n` : "")
          + `\nMake the hooks specific enough that only he could have said them. A hook that any agency could post is a wasted idea.`,
      });
      const ideas = Array.isArray(data.ideas) ? data.ideas.slice(0, 6) : [];
      if (!ideas.length) return json({ ok: false, error: "The model returned no ideas — try again." }, 502);
      return json({ ok: true, action, mode, ideas, model });
    }

    if (action === "script") {
      const idea = body.idea || {};
      if (!idea.title && !idea.hook) return json({ ok: false, error: "Pick an idea first." }, 400);
      const minutes = mode === "long" ? Math.min(20, Math.max(4, Number(body.minutes) || 8)) : 0;

      const shape = mode === "short"
        ? `SHORT-FORM script, 30-50 seconds spoken. Structure it as 4-6 short blocks with second-by-second timings. Every sentence must earn the next one. Cut anything a viewer would swipe past. Write it the way he'd actually talk, contractions and all.`
        : `LONG-FORM script for a roughly ${minutes}-minute video. Use 5-8 blocks with minute ranges. It does not need to be word-for-word throughout. Write the hook and the close verbatim, and give tight talking points for the middle so he sounds natural rather than read. Include what to show on screen.`;

      const { data, model } = await runTool({
        tool: SCRIPT_TOOL,
        maxTokens: 2600,
        system: `You are a scriptwriter who writes for the speaker's mouth, not the page.\n\n${BUSINESS}\n\n${GROUND_RULES}`,
        prompt: `Write the full script for this video.\n\nTITLE: ${idea.title || "(untitled)"}\nHOOK HE LIKED: ${idea.hook || "(none given)"}\n`
          + (idea.beats && idea.beats.length ? `PLANNED BEATS:\n${idea.beats.map((b) => `- ${b}`).join("\n")}\n` : "")
          + (idea.audience ? `AUDIENCE: ${idea.audience}\n` : "")
          + (body.notes ? `\nHIS NOTES: ${String(body.notes).slice(0, 500)}\n` : "")
          + `\n${shape}\n\nHe is shooting this alone on a phone. Do not call for footage, locations, guests or graphics he would have to source.`,
      });
      return json({ ok: true, action, mode, script: data, model });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = String((err && err.message) || err);
    console.error("content-studio failed:", msg);
    // Credit exhaustion is the single most common cause here and reads like a
    // generic 400 — name it, because a whole afternoon was lost to that once.
    const friendly = /credit|balance|quota|insufficient/i.test(msg)
      ? "The Anthropic account is out of credits — top it up at console.anthropic.com and try again."
      : /timeout|timed out|ETIMEDOUT|task timed out/i.test(msg)
        ? "That took too long to generate. Try again — if it keeps happening, tell Claude and the generator needs moving to a background job."
        : msg;
    return json({ ok: false, error: friendly }, 502);
  }
};
