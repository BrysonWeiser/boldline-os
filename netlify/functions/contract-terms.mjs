// Turn a note Bryson types into properly worded contract clauses.
//
// Bryson, 2026-09-02: *"I need a way for the ai to edit the contracts on the go before I
// send them. So what I mean is I want there to be a section where I input the agreed upon
// price or any other details i want and the ai will add them to the contract"*.
//
// The PRICE half already worked: monthly, setup fee, term length and the per-lead rate all
// merge into the agreement from the client record. What had nowhere to go was everything
// else he agrees to on a call. A first month at half price. A free logo refresh. Sixty
// days' notice instead of thirty. Those were being remembered in his head, which is the
// worst place for a contract term to live.
//
// ═══ 🔴 THE SAFETY MODEL, WHICH IS THE POINT OF THIS FILE ═══════════════════════
//
// THIS NEVER EDITS THE AGREEMENT. It writes ADDITIONAL clauses that land in one bounded
// "Special Terms" section at the end, and it has no other way to touch the document.
//
// That is not caution for its own sake. A model with a free hand over contract text could
// quietly weaken the limitation of liability, move the governing law, or undo the
// arbitration clause, and a signed contract is the last place on earth where a silent
// change should be possible. Nobody would notice until it mattered. It also keeps an
// attorney review of the base document meaningful: the base never moves, and everything
// negotiated sits in one place to read.
//
// Nothing here writes to the client record either. It returns clauses; the OS shows them to
// Bryson, he edits them, and HE saves. A contract term that appeared without a person
// reading it would be the same bug wearing a friendlier face.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { humanizeDeep, NO_DASH_RULE } from "../lib/humanize.mjs";

const MODEL = "claude-sonnet-5";

// 🔴 Topics where a clause Bryson did not think hard about can cost him the business.
// These are NOT blocked: he is entitled to negotiate any of them, and a tool that refuses
// to write what he agreed is a tool he stops using. They are FLAGGED, so the one clause
// that deserves a second read is the one wearing a warning.
const RISKY = [
  { id: "liability", label: "limits on what BoldLine can be held liable for", re: /\b(liabilit|indemnif|hold harmless|damages|warrant)/i },
  { id: "law", label: "which state's law applies or how disputes are settled", re: /\b(governing law|jurisdiction|arbitrat|venue|court|class action|jury)/i },
  { id: "ip", label: "who owns the work", re: /\b(intellectual property|ownership|copyright|licen[cs]e|work[- ]made[- ]for[- ]hire)/i },
  { id: "spend", label: "who pays for the ads", re: /\b(ad spend|advertising spend|media spend|fund|front|reimburs|on our card|on behalf of)/i },
  { id: "term", label: "how the agreement ends", re: /\b(terminat|cancel|notice period|auto[- ]renew|refund)/i },
  { id: "exclusive", label: "an exclusivity or non-compete promise", re: /\b(exclusiv|non[- ]compete|sole provider|will not work with)/i },
];

export const flagRisky = (clauses) => {
  const hits = [];
  for (const c of clauses || []) {
    const blob = `${(c && c.heading) || ""} ${(c && c.text) || ""}`;
    for (const r of RISKY) if (r.re.test(blob) && !hits.includes(r.label)) hits.push(r.label);
  }
  return hits;
};

export const SYSTEM = `You draft ADDITIONAL contract clauses for BoldLine Media, a US advertising agency in Arizona. Their standard service agreement already exists and you never see it, never rewrite it, and never restate it.

WHAT YOU PRODUCE
Short, plain, enforceable clauses covering ONLY what the note actually agrees. One clause per idea. Each has a short heading and one to three sentences.

🔴 HARD RULES
- Write ONLY what the note says was agreed. Invent nothing. No numbers, dates, percentages, names or deliverables that are not in the note or the client details.
- If the note is too vague to write a clause from, say so in the "problems" field instead of guessing. A vague clause is worse than no clause, because it looks settled and is not.
- Never write a clause that has BoldLine paying for, fronting, holding, or being billed for the client's advertising spend. The client pays the ad platforms directly on their own card, always, with no exception. If the note asks for this, refuse it in "problems" and write no clause for it.
- Do not restate anything a standard agreement already covers (confidentiality, governing law, e-signature, entire agreement) unless the note specifically changes it.
- No defined terms in capitals, no "WHEREAS", no cross-references to section numbers you cannot see.
- ${NO_DASH_RULE}
- Plain contract English. A small business owner should understand it on one read.

STYLE
"Agency" is BoldLine Media. "Client" is the other party. Write in the present tense. Say who does what by when.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const TOOL = {
  name: "special_terms",
  description: "Additional contract clauses drafted from what was agreed.",
  input_schema: {
    type: "object",
    properties: {
      clauses: {
        type: "array",
        description: "One clause per agreed idea. Empty if the note agrees nothing that can be written.",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "Two to five words naming the clause, e.g. 'First Month Discount'." },
            text: { type: "string", description: "One to three sentences. Says who does what, by when, and for how much." },
          },
          required: ["heading", "text"],
        },
      },
      problems: {
        type: "array",
        description: "Anything in the note you could NOT write a clause for, and why. Too vague, contradictory, or something the agency must not agree to. One short sentence each.",
        items: { type: "string" },
      },
    },
    required: ["clauses", "problems"],
  },
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing ANTHROPIC_API_KEY in Netlify." }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const note = String(body.note == null ? "" : body.note).trim().slice(0, 4000);
  if (!note) return json({ ok: false, error: "Type what you agreed first." }, 400);

  // 🔴 A SIGNED AGREEMENT IS FROZEN. Changing the terms after signature would silently
  // rewrite the document the client already put their name to: the OS renders the contract
  // fresh every time, so the copy in the portal would quietly stop matching the copy they
  // signed. That is not an edge case, it is the single worst thing this feature could do.
  // A change after signing is an amendment, and an amendment is a new signed document.
  if (body.clientId) {
    const { data: row } = await supabase.from("clients").select("data").eq("id", String(body.clientId)).maybeSingle();
    if (row && row.data && row.data.contractSigned) {
      return json({ ok: false, error: "This agreement is already signed, so its terms cannot be changed. Anything new has to go in a written amendment both of you sign." }, 409);
    }
  }

  const ctx = [
    body.clientName ? `Client: ${String(body.clientName).slice(0, 120)}` : "",
    body.packageName ? `Package: ${String(body.packageName).slice(0, 120)}` : "",
    body.monthly ? `Monthly minimum already in the agreement: $${Number(body.monthly)}` : "",
    body.setup != null ? `Setup fee already in the agreement: $${Number(body.setup)}` : "",
    body.termMonths ? `Committed term already in the agreement: ${Number(body.termMonths)} months` : "",
  ].filter(Boolean).join("\n");

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 2000, system: SYSTEM,
      tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content:
        `${ctx ? `WHAT IS ALREADY IN THE AGREEMENT, so you do not repeat it:\n${ctx}\n\n` : ""}WHAT WAS AGREED, in Bryson's words:\n${note}` }],
    });
    const use = (resp.content || []).find((c) => c.type === "tool_use");
    if (!use) return json({ ok: false, error: "Nothing came back. Try again." }, 502);

    // Dashes stripped on the way out, same as every other written surface. A contract is
    // read by the client, so the voice rule applies to it too.
    const out = humanizeDeep(use.input || {}, { join: ". " });
    const clauses = (Array.isArray(out.clauses) ? out.clauses : [])
      .map((c) => ({ heading: String((c && c.heading) || "").trim().slice(0, 80), text: String((c && c.text) || "").trim().slice(0, 1200) }))
      .filter((c) => c.text);
    const problems = (Array.isArray(out.problems) ? out.problems : []).map((p) => String(p || "").trim()).filter(Boolean);
    return json({ ok: true, clauses, problems, risky: flagRisky(clauses) });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error("contract-terms failed:", m);
    return json({ ok: false, error: /credit|balance|quota|insufficient/i.test(m) ? "The Anthropic account is out of credits." : "Could not draft that. Try again." }, 500);
  }
};
