// Handover Pack — the deliverable that makes "Launch & Hand Off" an actual product
// rather than an abandoned campaign.
//
// Bryson, 2026-08-18: "how will I build it and give it to them and then track if they
// come back as a recurring client within 6 months?"
//
// WHAT THIS SOLVES. A hand-off client gets the same build as a managed client and then
// nobody is watching it. Without a written playbook, one of two things happens: they
// never touch it and it slowly stops working, or they touch the wrong thing and it stops
// working immediately. Either way BoldLine's name is on a campaign that failed, and the
// 6-month conversion window closes with a bad taste rather than a warm lead.
//
// So the pack is not paperwork. It is the difference between a customer who comes back
// and a customer who tells people it did not work.
//
// WHY IT IS WRITTEN PER CLIENT. A generic "how to use Google Ads" PDF is worthless and
// obviously so. This is written against what was actually built for THEM: their ad
// groups, their landing page, their tracking, their budget, their trade. The weekly
// checklist names their own numbers.
//
// WHY IT IS HONEST ABOUT WHAT NOT TO DO. The most valuable section is "leave this
// alone". An owner who pauses the wrong keyword or edits the conversion action can undo
// the whole build in a minute, and they will never know that is what happened.
//
// SYNCHRONOUS: one tool call, no web search. Answers inline.
//
// POST { clientId }
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL, findPkg } from "../lib/report-shared.mjs";
import { humanizeDeep } from "../lib/humanize.mjs";

const MODELS = ["claude-sonnet-5", "claude-opus-4-8"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const TOOL = {
  name: "handover_pack",
  description: "Write the handover playbook for a client who bought a one-time build.",
  input_schema: {
    type: "object",
    properties: {
      intro: { type: "string", description: "2-3 sentences to the business owner: what they now own, and that it is theirs to run. Warm, plain, no jargon." },
      whatYouOwn: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 8,
        description: "What was built and handed over, one item per line, each written as something they OWN (the account, the campaign, the page, the tracking). Concrete, not marketing." },
      weekly: { type: "array", items: { type: "object", additionalProperties: false,
          properties: { task: { type: "string" }, why: { type: "string" }, howLong: { type: "string" } },
          required: ["task", "why", "howLong"] },
        minItems: 3, maxItems: 6,
        description: "The weekly routine. Each task needs a one-sentence why and a realistic time (e.g. '5 minutes'). Keep the whole routine under 30 minutes a week or they will not do it." },
      monthly: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5,
        description: "What to check once a month. Slower-moving things: budget, seasonality, whether the offer still matches." },
      leaveAlone: { type: "array", items: { type: "object", additionalProperties: false,
          properties: { thing: { type: "string" }, why: { type: "string" } }, required: ["thing", "why"] },
        minItems: 3, maxItems: 6,
        description: "The things that will quietly break the campaign if changed, and why. This is the most valuable section in the document." },
      warningSigns: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5,
        description: "Specific, checkable signs something has gone wrong, with the number to look at where possible." },
      callUsIf: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4,
        description: "When to get BoldLine back involved. Honest triggers, not sales bait." },
    },
    required: ["intro", "whatYouOwn", "weekly", "monthly", "leaveAlone", "warningSigns", "callUsIf"],
  },
};

const SYSTEM = `You are writing the handover playbook that BoldLine Media gives a client who bought "Launch & Hand Off": a one-time build with no ongoing management. BoldLine built the campaign and the landing page inside the client's own account, ran two optimization passes over the first 30 days, and is now finished. The client runs it from here.

WHO IS READING THIS. A business owner, not a marketer. They may never have opened Google Ads before. They are busy and they will read this once. Every instruction has to survive being read once by someone who is not interested in advertising, only in their phone ringing.

THE STAKES, WHICH SHAPE EVERYTHING. If this document is vague, one of two things happens. They never touch the campaign and it slowly decays. Or they touch the wrong thing and it stops working the same day, and they will never know that is what happened. Both end with BoldLine's name on a campaign that failed. So: be specific, name the actual thing to click, and be blunt about what not to touch.

WRITING RULES.
- Plain English. Short sentences. No jargon without a plain-English gloss right beside it.
- NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, and a plain hyphen with spaces around it. All three read as machine-written, and the spaced hyphen is the most common tell of all. Write two sentences, or use a comma. Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour.
- No "unlock", "leverage", "seamless", "robust", "game-changer", "in today's world".
- Write how a person talks. Use contractions.
- Be honest, including about limits. Do not imply BoldLine is still watching, because it is not.
- No emojis anywhere. This is a client-facing document.
- Do not invent specifics you were not given. If you do not know their exact ad group names, say "your ad groups" rather than making names up.

THEY HOST THE LANDING PAGE THEMSELVES. Treat it as something they own and must keep online, not something that is looked after for them. In "what you now own" say plainly that the page is a file on their own hosting and that lead enquiries go to their own inbox. In "warning signs" include checking that the page still loads and that a test enquiry still arrives, because a page that quietly goes down costs them every click they pay for after that.

THE MOST IMPORTANT SECTION is "leave this alone". Think hard about what an untrained owner would plausibly change that would do real damage: pausing keywords that look expensive but convert, editing or deleting the conversion action, changing the landing page URL, turning on automatic recommendations, raising the budget too fast, editing headlines that are winning. Explain the consequence in terms of their money, not in terms of the platform.`;

const buildPrompt = (cl, pkg) => {
  const L = [];
  L.push(`Business: ${cl.name || "the client"}`);
  if (cl.niche) L.push(`Trade: ${cl.niche}`);
  if (cl.targetLocations || cl.location) L.push(`Service area: ${cl.targetLocations || cl.location}`);
  if (cl.adBudget) L.push(`Their monthly ad budget: ${cl.adBudget}`);
  L.push(`Platform built on: ${(pkg && pkg.platform) || "Google Ads"}`);
  if (cl.googleAdsCustomerId) L.push(`They own the Google Ads account (BoldLine's access is being removed at handover).`);
  if (cl.landingPage && cl.landingPage.url) L.push(`Landing page built for them: ${cl.landingPage.url}`);
  // The client HOSTS THE PAGE THEMSELVES after handover (Bryson, 2026-08-19). The pack
  // has to say so, because "your landing page" means something different once nobody is
  // hosting it for them: it is a file they own and are responsible for keeping online.
  L.push("IMPORTANT: they host the landing page themselves from now on. It was handed over as a single file with a separate step-by-step guide for putting it online (Netlify), turning on lead emails, and repointing their ads at the new address. The form on it submits to their own host, not to us.");
  if (cl.callTrackingNumber) L.push(`Call tracking number in use: ${cl.callTrackingNumber}`);
  if (cl.cpl > 0) L.push(`Cost per lead during the settle-in period: $${cl.cpl}`);
  if (cl.leads > 0) L.push(`Leads delivered during settle-in: ${cl.leads}`);
  if (cl.services) L.push(`Services they sell: ${cl.services}`);
  if (cl.notes) L.push(`Notes from BoldLine:\n${cl.notes}`);
  L.push("", "Write their handover playbook.");
  return L.join("\n");
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
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

  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);

  const { data: row, error } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!row || !row.data) return json({ ok: false, error: "Client not found." }, 404);
  const cl = row.data;
  const pkg = findPkg(cl.packageId);

  let out, lastErr;
  const anthropic = new Anthropic();
  for (const model of MODELS) {
    try {
      const msg = await anthropic.messages.create({
        model, max_tokens: 3000, system: SYSTEM,
        tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: buildPrompt(cl, pkg) }],
      });
      const use = (msg.content || []).find((x) => x.type === "tool_use");
      if (!use) throw new Error("The model replied without using the tool.");
      out = use.input; break;
    } catch (e) {
      lastErr = e;
      if (!/model|not_found|404|does not exist|unsupported/i.test(String((e && e.message) || e))) {
        return json({ ok: false, error: "Could not write the handover pack just now. Try again in a moment." }, 502);
      }
    }
  }
  if (!out) {
    console.error("handover-pack: no model available", lastErr);
    return json({ ok: false, error: "Could not write the handover pack just now. Try again in a moment." }, 502);
  }

  // Em dashes are banned in every client-facing surface (KB ad-copy-voice). The prompt
  // says so and the model usually complies; this makes it true regardless, because a
  // handover document is read once and judged on how human it sounds.
  const clean = (v) => humanizeDeep(v, { join: ", " });

  const pack = { ...clean(out), generatedAt: new Date().toISOString(), clientName: cl.name || "" };

  const { error: saveErr } = await supabase.from("clients")
    .update({ data: { ...cl, handoverPack: pack } }).eq("id", clientId);
  if (saveErr) return json({ ok: false, error: saveErr.message }, 500);

  return json({ ok: true, pack });
};
