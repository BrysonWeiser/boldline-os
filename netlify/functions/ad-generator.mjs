// Ad Generator — real campaign structure written by a model, not string templates.
//
// What it replaces: `agencySeed()` / `kwSeed` in index.html produced 6-7 keywords in
// one undifferentiated bucket, 8 of Google's 15 headlines, 3 of 4 descriptions, and
// a SINGLE ad group — byte-identical on every press. One ad group serving every
// keyword is the biggest quality killer in a Search campaign: the ad can't speak to
// the search, so Quality Score and CTR both suffer and the click costs more.
//
// POST { action, ... } with the owner's Supabase session:
//   "google"    -> themed ad groups, each with its own intent-tiered keywords and a
//                  full 15-headline / 4-description responsive search ad, plus
//                  campaign-level negatives.
//   "meta"      -> headline + primary-text variants written per awareness stage.
//   "creatives" -> creative angles for the Ad Creative Studio, built from the real
//                  niche rather than the five fixed templates.
//
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const MODELS = ["claude-sonnet-5", "claude-opus-4-8"];

// Google's real limits. Anything over is rejected by the API, so the model is told
// them AND the output is trimmed/filtered below — a prompt is guidance, not a
// guarantee, and a 31-character headline fails the whole campaign build.
export const LIMITS = { headline: 30, description: 90, keyword: 80, keywordWords: 10, path: 15 };

// The voice rules are enforced on the way out too (humanizeAdCopy in the OS), but a
// model mirrors the style of its prompt, so this is written the way the ads should
// read: plain, short sentences, no dashes.
const VOICE = `HOW THE COPY MUST READ:
- NEVER use an em dash or en dash. Write two sentences, or use a comma. This is the single biggest tell that copy was machine-written.
- No "unlock", "elevate", "leverage", "seamless", "robust", "game-changer", "supercharge", "in today's world", "it's not just X, it's Y".
- Write how a person talks. Contractions are good. Vary sentence length.
- No emojis anywhere.
- Specific beats clever. "Roof leak fixed today" beats "Excellence in roofing".`;

const HONESTY = `WHAT YOU MAY NOT CLAIM:
- No invented statistics, review counts, years in business, awards, certifications, guarantees, or customer numbers. If you were not given it, you do not have it.
- No "#1", "best in town", "top rated" or any superlative that would need proof. Google can disapprove these and they are unverifiable.
- No competitor brand names.
- Do not promise a price, a discount, or a timeframe unless it was supplied in the brief.`;

const GOOGLE_TOOL = {
  name: "google_search_campaign",
  description: "A complete Google Search campaign structure: themed ad groups with intent-tiered keywords and full responsive search ads.",
  input_schema: {
    type: "object",
    properties: {
      adGroups: {
        type: "array",
        description: "3 to 5 tightly themed ad groups. Each must cover ONE search intent so its ad can speak directly to that search.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short internal name, e.g. 'Emergency Repair' or 'Near Me'." },
            theme: { type: "string", description: "One sentence: which searcher this group is for and what they want right now." },
            intent: { type: "string", enum: ["high", "medium", "research", "local", "emergency", "competitor"], description: "The dominant intent tier of this group." },
            keywords: {
              type: "array",
              description: "8 to 15 keywords for THIS theme only. No keyword may appear in two ad groups.",
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "The keyword, lowercase, no brackets or quotes." },
                  matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"], description: "EXACT for proven buyer terms, PHRASE for most, BROAD only where discovery is genuinely wanted." },
                },
                required: ["text", "matchType"],
              },
            },
            headlines: { type: "array", description: "Exactly 15 headlines, each 30 characters or fewer. Cover distinct angles: the service, the location, urgency, the offer, trust, and a call to action. Do not write 15 rewordings of one idea.", items: { type: "string" } },
            descriptions: { type: "array", description: "Exactly 4 descriptions, each 90 characters or fewer.", items: { type: "string" } },
          },
          required: ["name", "theme", "intent", "keywords", "headlines", "descriptions"],
        },
      },
      negativeKeywords: { type: "array", description: "15 to 30 negatives specific to THIS business, beyond the obvious (free, jobs, salary). Think about who searches these words but could never buy.", items: { type: "string" } },
      notes: { type: "string", description: "One short paragraph for the operator: what this structure is betting on and what to watch in the first two weeks." },
    },
    required: ["adGroups", "negativeKeywords", "notes"],
  },
};

const META_TOOL = {
  name: "meta_campaign_copy",
  description: "Meta ad copy written per awareness stage.",
  input_schema: {
    type: "object",
    properties: {
      variants: {
        type: "array",
        description: "3 to 4 complete ad variants, each aimed at a different awareness stage.",
        items: {
          type: "object",
          properties: {
            awareness: { type: "string", enum: ["unaware", "problem-aware", "solution-aware", "most-aware"] },
            angle: { type: "string", description: "One sentence: the argument this ad makes." },
            headline: { type: "string", description: "40 characters or fewer." },
            primaryText: { type: "string", description: "The body. First sentence must stop the scroll on its own, because Meta truncates after roughly 125 characters." },
            description: { type: "string", description: "30 characters or fewer, shown under the headline." },
          },
          required: ["awareness", "angle", "headline", "primaryText", "description"],
        },
      },
    },
    required: ["variants"],
  },
};

const CREATIVE_TOOL = {
  name: "creative_angles",
  description: "Angles for image creatives, built from this specific business.",
  input_schema: {
    type: "object",
    properties: {
      angles: {
        type: "array",
        description: "5 to 7 angles, each making a genuinely different argument.",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "short-slug" },
            label: { type: "string", description: "Name for the picker, 2-4 words." },
            kicker: { type: "string", description: "Small line above the headline. 30 characters or fewer." },
            head: { type: "array", description: "2 or 3 lines of headline. Each 24 characters or fewer so it fits the canvas.", items: { type: "string" } },
            accent: { type: "integer", description: "0-based index of the headline line to paint in the brand gold." },
            sub: { type: "string", description: "One supporting sentence, 90 characters or fewer." },
            why: { type: "string", description: "One sentence: who this stops and why." },
          },
          required: ["id", "label", "kicker", "head", "accent", "sub", "why"],
        },
      },
    },
    required: ["angles"],
  },
};

async function runTool({ system, prompt, tool, maxTokens }) {
  const client = new Anthropic();
  let lastErr;
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({
        model, max_tokens: maxTokens, system,
        tools: [tool], tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: prompt }],
      });
      const use = (msg.content || []).find((b) => b.type === "tool_use");
      if (!use) throw new Error("The model replied without using the tool.");
      return { data: use.input, model };
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      if (!/model|not_found|404|does not exist|unsupported/i.test(m)) throw e;
      console.warn(`ad-generator: ${model} rejected (${m}) — trying next`);
    }
  }
  throw lastErr || new Error("No model available");
}

// ── Output cleaning ──────────────────────────────────────────────────────────
// The prompt asks for limits; this enforces them. A single over-length headline
// fails the entire googleAds:mutate, so nothing over-length may reach the API.
const stripDashes = (s) => String(s == null ? "" : s)
  .replace(/\s*[—–]\s*$/, "").replace(/^\s*[—–]\s*/, "")
  .replace(/\s*[—–]\s*/g, ". ").replace(/\s*\.\s*\.\s*/g, ". ")
  .replace(/([.!?])\s+([a-z])/g, (m, p, c) => p + " " + c.toUpperCase())
  .replace(/\s{2,}/g, " ").trim();

const fitAll = (arr, max) => (Array.isArray(arr) ? arr : [])
  .map(stripDashes).filter(Boolean)
  .filter((t) => t.length <= max)
  .filter((t, i, a) => a.indexOf(t) === i);

const cleanKeyword = (k) => {
  const text = String((k && k.text) || "").toLowerCase().replace(/["\[\]+]/g, "").replace(/\s{2,}/g, " ").trim();
  const mt = String((k && k.matchType) || "PHRASE").toUpperCase();
  if (!text || text.length > LIMITS.keyword) return null;
  if (text.split(/\s+/).length > LIMITS.keywordWords) return null;
  return { text, matchType: ["EXACT", "PHRASE", "BROAD"].includes(mt) ? mt : "PHRASE" };
};

export function cleanGoogle(data) {
  const seenKw = new Set();
  const adGroups = (Array.isArray(data && data.adGroups) ? data.adGroups : []).map((g) => {
    const keywords = (Array.isArray(g.keywords) ? g.keywords : [])
      .map(cleanKeyword).filter(Boolean)
      // The same keyword in two ad groups makes them bid against each other, so the
      // first group to claim a term keeps it.
      .filter((k) => (seenKw.has(k.text) ? false : (seenKw.add(k.text), true)));
    return {
      name: stripDashes(g.name).slice(0, 120) || "Ad Group",
      theme: stripDashes(g.theme),
      intent: String(g.intent || "medium"),
      keywords,
      headlines: fitAll(g.headlines, LIMITS.headline).slice(0, 15),
      descriptions: fitAll(g.descriptions, LIMITS.description).slice(0, 4),
    };
  }).filter((g) => g.keywords.length && g.headlines.length >= 3 && g.descriptions.length >= 2);

  const negativeKeywords = (Array.isArray(data && data.negativeKeywords) ? data.negativeKeywords : [])
    .map((n) => String(n || "").toLowerCase().replace(/["\[\]+]/g, "").trim())
    .filter((n) => n && n.length <= LIMITS.keyword)
    .filter((n, i, a) => a.indexOf(n) === i)
    .slice(0, 50);

  return { adGroups, negativeKeywords, notes: stripDashes(data && data.notes) };
}

const brief = (b) => {
  const L = [];
  const push = (label, v) => { if (v && String(v).trim()) L.push(`${label}: ${String(v).trim().slice(0, 300)}`); };
  push("Business", b.name);
  push("What they sell", b.offer);
  push("Industry / niche", b.niche);
  push("Service area", b.locations);
  push("Average job value", b.avgTicket);
  push("What makes them different", b.differentiator);
  push("Landing page the ad points at", b.landingUrl);
  push("Things to avoid mentioning", b.avoid);
  return L.length ? L.join("\n") : "No details supplied.";
};

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

  const action = String(body.action || "google");
  const isAgency = !!body.agency;   // BoldLine advertising ITSELF to win a niche as a client
  const B = brief(body);

  // Two genuinely different jobs: selling BoldLine's service to a business owner, or
  // selling a client's service to their customer. Same prompt for both produced the
  // bland copy this replaces.
  const WHO = isAgency
    ? `You are writing ads for BoldLine Media, a marketing agency that runs Google and Meta ads for other businesses and builds the landing pages behind them. THE SEARCHER IS A BUSINESS OWNER looking for help getting customers. BoldLine has NO CLIENTS YET, so there are no results, testimonials or case studies to reference, and inventing any would be a lie. The honest differentiators you MAY use: the client owns and is billed for their own ad account so nothing is held hostage, every campaign gets a purpose-built landing page instead of pointing at a homepage, and the whole operation is run by software rather than a big retainer team. BoldLine works with businesses remotely and nationally, so NEVER say "local businesses".`
    : `You are writing ads for a business that hires customers directly. THE SEARCHER IS THAT BUSINESS'S CUSTOMER, looking for the service right now. Write to that person's actual problem, not to the business.`;

  const SYSTEM = `You are a paid search specialist who builds campaigns that have to make money on a small budget. You are not a copywriter writing brand slogans.

${WHO}

${HONESTY}

${VOICE}`;

  try {
    if (action === "google") {
      const { data, model } = await runTool({
        tool: GOOGLE_TOOL, maxTokens: 8000, system: SYSTEM,
        prompt: `Build a Google Search campaign.

THE BRIEF:
${B}

STRUCTURE THIS PROPERLY. The campaign this replaces had ONE ad group holding every keyword, which means the ad could never match the search. Instead:
- Split into 3 to 5 ad groups, each covering ONE search intent. Typical splits are emergency/urgent, "near me" and location terms, the specific service by name, price or quote shoppers, and research-stage searches. Pick the splits that actually fit this business, not a generic list.
- Give each group 8 to 15 keywords that belong ONLY to that theme. A keyword must never appear in two groups.
- Match types: EXACT for the terms a ready buyer types, PHRASE for most, BROAD only where discovery genuinely helps. Do not make everything BROAD, it wastes a small budget fastest.
- Every group needs a FULL ad: exactly 15 headlines at 30 characters or fewer, and exactly 4 descriptions at 90 characters or fewer. Count the characters. A headline at 31 characters is rejected by Google and fails the whole build.
- The 15 headlines must cover different angles, not 15 rewordings. Include the service, the area, urgency, the offer, a trust line, and a clear call to action.
- Write 15 to 30 negative keywords SPECIFIC to this business. "free" and "jobs" are already handled, give me the ones only someone who knows this industry would think of.

Then write the operator note: what this structure bets on, and what to watch in week one and two.`,
      });
      const out = cleanGoogle(data);
      if (!out.adGroups.length) return json({ ok: false, error: "The model returned no usable ad groups. Try again." }, 502);
      return json({ ok: true, model, ...out, totals: {
        adGroups: out.adGroups.length,
        keywords: out.adGroups.reduce((n, g) => n + g.keywords.length, 0),
        headlines: out.adGroups.reduce((n, g) => n + g.headlines.length, 0),
        negatives: out.negativeKeywords.length,
      } });
    }

    if (action === "meta") {
      const { data, model } = await runTool({
        tool: META_TOOL, maxTokens: 3000, system: SYSTEM,
        prompt: `Write Meta (Facebook and Instagram) ad copy.

THE BRIEF:
${B}

Meta is interruption, not search. Nobody asked to see this, so the first line has to earn the second. Write 3 to 4 complete variants, each aimed at a DIFFERENT awareness stage, because the same words cannot work on someone who has never thought about the problem and someone already comparing providers.

Headline 40 characters or fewer. Description 30 or fewer. Primary text can run longer but Meta truncates around 125 characters, so the hook must land before that.`,
      });
      const variants = (Array.isArray(data && data.variants) ? data.variants : []).map((v) => ({
        awareness: String(v.awareness || ""), angle: stripDashes(v.angle),
        headline: stripDashes(v.headline).slice(0, 40),
        primaryText: stripDashes(v.primaryText),
        description: stripDashes(v.description).slice(0, 30),
      })).filter((v) => v.headline && v.primaryText);
      if (!variants.length) return json({ ok: false, error: "The model returned no usable variants. Try again." }, 502);
      return json({ ok: true, model, variants });
    }

    if (action === "creatives") {
      const { data, model } = await runTool({
        tool: CREATIVE_TOOL, maxTokens: 3000, system: SYSTEM,
        prompt: `Write angles for image ad creatives.

THE BRIEF:
${B}

Each angle is a static image: a small kicker line, 2 or 3 short headline lines, and one supporting sentence. The image carries the argument. There is NO button drawn on it, because a painted-on button cannot be tapped and Meta prohibits fake interface elements, so never write a call to action that implies clicking the image itself.

Give me 5 to 7 angles that make genuinely different arguments. Not one idea reworded. Headline lines must be 24 characters or fewer each or they will not fit the canvas.`,
      });
      const angles = (Array.isArray(data && data.angles) ? data.angles : []).map((a, i) => {
        const head = fitAll(a.head, 24).slice(0, 3);
        return {
          id: String(a.id || `angle-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40),
          label: stripDashes(a.label).slice(0, 40) || `Angle ${i + 1}`,
          kicker: stripDashes(a.kicker).slice(0, 30),
          head,
          accent: Math.max(0, Math.min(head.length - 1, Number(a.accent) || 0)),
          sub: stripDashes(a.sub).slice(0, 90),
          why: stripDashes(a.why),
        };
      }).filter((a) => a.head.length >= 2);
      if (!angles.length) return json({ ok: false, error: "The model returned no usable angles. Try again." }, 502);
      return json({ ok: true, model, angles });
    }

    return json({ ok: false, error: `Unknown action "${action}"` }, 400);
  } catch (e) {
    const m = String((e && e.message) || e);
    const friendly =
      /credit|balance|quota|insufficient/i.test(m) ? "The Anthropic account is out of credits. Top it up at console.anthropic.com and try again."
      : /timeout|timed out|ETIMEDOUT/i.test(m) ? "That took too long to generate. Try again, and if it keeps happening this needs moving to a background job."
      : /rate.?limit|429/i.test(m) ? "Rate limited by Anthropic. Wait a minute and try again."
      : m;
    console.error("ad-generator failed:", m);
    return json({ ok: false, error: friendly }, 500);
  }
};
