// Writes the first message to a cold prospect. It does NOT send it.
//
// Bryson, 2026-09-21, building the cold outreach section: *"build everything but what you flagged
// we shouldnt do"*.
//
// 🔴 WHAT WAS DELIBERATELY NOT BUILT, AND WHY IT MATTERS HERE. This function composes and the OS
// logs; the sending happens in his own email client, Instagram or LinkedIn, by hand.
//
//   • NO COLD EMAIL SENDER. Cold email at volume earns spam complaints, and complaints poison the
//     sending domain. That is the same domain client reports and INVOICES go out on, so a stranger
//     marking an outreach email as spam could land a client's invoice in their junk folder. Proper
//     cold email needs a separate warmed domain and a dedicated tool, which is a deliberate
//     decision with a real cost, not a feature to bolt onto this.
//   • NO AUTOMATED DMs. Instagram and LinkedIn both ban accounts for automated messaging, and that
//     account carries his name and his audience. Writing and logging a DM is fine. Pressing send
//     from here is how the account is lost.
//
// So this endpoint returns TEXT. Anything that makes it send is a change to that decision, not a
// small addition, and `tests/verify-outreach.mjs` fails if a sender is wired in.

import Anthropic from "@anthropic-ai/sdk";
import { humanizeDeep } from "../lib/humanize.mjs";

const MODELS = ["claude-sonnet-5", "claude-opus-4-8"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);

const TOOL = {
  name: "write_outreach",
  description: "Write cold outreach openers for one specific business.",
  input_schema: {
    type: "object",
    properties: {
      drafts: {
        type: "array",
        description: "Three different openers. Genuinely different angles, not three rewrites of one.",
        items: {
          type: "object",
          properties: {
            angle: { type: "string", description: "What this one leads with, in three or four words, for picking between them." },
            subject: { type: "string", description: "Email subject. Lower case, looks typed by a person, no colons. Empty string for a DM or a text." },
            body: { type: "string", description: "The message itself." },
          },
          required: ["angle", "subject", "body"],
        },
      },
    },
    required: ["drafts"],
  },
};

const LENGTH = {
  email: "Under 90 words. Short enough to read on a phone without scrolling.",
  dm:    "Under 45 words. A DM longer than that does not get read.",
  text:  "Under 35 words, and it must read like a person typed it on a phone.",
};

const buildSystem = (channel) => `You write cold outreach for Bryson Weiser, who owns BoldLine Media. BoldLine plans, builds and runs Google and Meta ad campaigns for businesses, plus the landing pages behind them. The client keeps and pays for their own ad account; BoldLine never holds or fronts ad spend.

You are writing a FIRST message to somebody who has never heard of him. ${LENGTH[channel] || LENGTH.email}

WHAT MAKES THESE WORK:
- Lead with something true and specific about THEIR business that proves this is not a blast. The research below is real; use it.
- One clear, small ask. A reply, or a short call. Never a hard pitch and never a calendar link dump.
- Sound like one person messaging another, because that is what it is.

NEVER:
- NEVER use a dash to join or interrupt a sentence. Not the em dash, not the en dash, not a spaced hyphen. All three read as machine written. Write two sentences, or use a comma. Hyphens inside a word are fine: done-for-you, no-obligation.
- No emojis anywhere.
- Never say "local business". He works with businesses nationally and remotely.
- No invented numbers, no fake results, no "I noticed you're crushing it". BoldLine is early and has almost no clients, so never imply a roster, case studies or testimonials that do not exist.
- No "I hope this finds you well", no "just circling back", no "quick question" as the opener, no flattery the writer cannot back up.
- Do not promise a specific result, a number of leads, or a price.`;

const buildPrompt = (p, channel) => {
  const d = (p && p.data) || {};
  const L = [];
  const add = (k, v) => { if (v && String(v).trim()) L.push(`${k}: ${clip(v, 300)}`); };
  add("Business", p && p.name);
  add("Owner", d.ownerName || d.owner);
  add("Industry", p && p.niche);
  add("Area", p && p.area);
  add("Website", d.website || p.domain);
  add("Employees", d.employees || d.headcount);
  add("Reviews", d.reviews || d.rating);
  add("Already running ads", d.runningAds != null ? String(d.runningAds) : (d.ads || ""));
  add("What our research says about them", d.summary || d.reason || d.why);
  add("Why they scored well", Array.isArray(d.scoreFactors)
    ? d.scoreFactors.map((f) => (f && (f.reason || f.label)) || "").filter(Boolean).join("; ")
    : "");
  return `Write three ${channel === "email" ? "cold emails" : channel === "dm" ? "cold DMs" : "cold texts"} to this business.

${L.join("\n") || "No research available, so keep it general and do not invent specifics."}

🔴 If the research above is thin, say less rather than inventing detail. A short honest message beats a specific wrong one, and a wrong detail about their own business ends the conversation on the first line.`;
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "ANTHROPIC_API_KEY is not set in Netlify." }, 500);

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "Not authenticated" }, 401);
  const { createClient } = await import("@supabase/supabase-js");
  const { SUPABASE_URL } = await import("../lib/report-shared.mjs");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader.slice(7));
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const channel = ["email", "dm", "text"].includes(body.channel) ? body.channel : "email";
  const prospect = body.prospect || {};
  if (!prospect.name) return json({ ok: false, error: "prospect required" }, 400);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let lastErr = null;
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 1600,
        system: buildSystem(channel),
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: buildPrompt(prospect, channel) }],
      });
      const use = (msg.content || []).find((b) => b.type === "tool_use");
      if (!use) throw new Error("The writer replied without using the tool.");
      // 🔴 THE DASH RULE IS ENFORCED, NOT ASKED FOR. The prompt bans it and `humanizeDeep` strips
      // it from every string anyway, because a prompt is guidance and this is a guarantee.
      const data = humanizeDeep(use.input);
      const drafts = (data.drafts || []).filter((d) => d && d.body).slice(0, 3);
      if (!drafts.length) throw new Error("The writer came back with nothing usable.");
      return json({ ok: true, channel, drafts, model });
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      if (!/model|not_found|overloaded|capacity|529|404/i.test(m)) break;
    }
  }
  return json({ ok: false, error: (lastErr && lastErr.message) || "Could not write the drafts." }, 500);
};
