// Deal Prep research — runs as a Netlify BACKGROUND function (name ends in
// "-background" → async, returns 202, up to 15 min). Web-search research + Claude
// synthesis takes 30-90s, well past the ~10s synchronous limit, so this does the work
// and writes the result to the `deal_briefs` Supabase table; the OS polls deal-research
// (get) until status flips to done. Same owner-JWT auth as blog-write-background.
//
// POST body: { id, companyName, niche, website?, location?, notes? }
//   id = a client-generated brief id the OS also polls on.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { getNicheLeadFee, packagesPromptBlock } from "../lib/pricing-shared.mjs";

const anthropic = new Anthropic();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const buildSystem = (leadFee) => `You are a sharp B2B sales-intelligence analyst preparing Bryson Weiser, owner of BoldLine Media, for a sales call with a prospective client. BoldLine is a digital-marketing agency that runs managed Google Ads and builds custom landing pages for local/service businesses, priced as a monthly management fee + a one-time setup fee + a per-qualified-lead fee. The CLIENT always pays their own ad spend directly — BoldLine never fronts or holds ad spend.

Your job: research the specific prospect using web search, then write a tight, honest pre-call briefing that helps Bryson build rapport, diagnose their gaps, recommend the right package, and close.

BoldLine's packages (recommend ONE by id):
${packagesPromptBlock(leadFee)}

For this prospect's industry, BoldLine's per-qualified-lead fee is about $${leadFee} (service packages only; e-commerce uses a ROAS bonus instead).

RESEARCH with web search: what the company does, size, years in business, service area, reputation (Google/Yelp reviews + rating), and their current digital presence — do they have a website, is it any good, are they visibly running Google or Meta ads, how's their SEO/reviews, any recent news or expansion. Look up typical customer/job value in their industry to ground the ROI math.

ACCURACY RULES — read carefully. Bryson sometimes personally knows these owners and will instantly lose trust if the brief states anything wrong:
- Use ONLY facts you actually found via web search this run. Do NOT guess, infer from the industry, or fill gaps with what's "typical" — if you didn't find it, write "couldn't confirm."
- NEVER invent specifics: owner or staff names, review counts or star ratings, years in business, address, phone, or whether they're running ads. Every specific fact must trace to a source you actually saw.
- Prefer RECENT sources and account for staleness: if the strongest info you find looks old (an outdated-looking site, a years-old article or review), say so and mark it "(may be outdated)" instead of presenting it as current.
- Mark anything you are not fully sure of with "(unconfirmed)" so Bryson knows to verify it live.
- Treat the "What Bryson already knows" notes as GROUND TRUTH — build on them and never contradict or overwrite them with a guess (if he gives the owner's name, use exactly that; never substitute a different name you found).
- Keep company FACTS (which must be sourced) separate from your ANALYSIS — the package fit, ROI math, and objection handling are your reasoning and are expected.

OUTPUT — respond with EXACTLY this, nothing before it:
First line, alone: RECOMMENDED: <one package id from the list above>
Then a blank line, then the briefing in this markdown (bold section headers, "- " bullets, short paragraphs):

**Company Snapshot**
2-3 sentences: what they do, size/scale, location, years, and reputation (cite the review rating/count if found).

**Digital Presence & Gaps**
- Website: quality + whether it's built to convert (or missing)
- Ads: are they running Google/Meta ads now? (say what you found)
- Reviews/SEO: rating, volume, and how they show up
- The 1-2 biggest gaps BoldLine can fix

**Why They Need BoldLine**
2-4 bullets tying real findings to how managed Google Ads + a custom landing page gets them more customers.

**Talking Points to Open & Build Rapport**
- 3-4 specific, personalized hooks Bryson can say on the call (reference real details you found — owner name if known, a recent review theme, a visible gap). Make them natural, not salesy.

**Recommended Package & the Money Math**
Name the recommended package and WHY it fits their size/goals. Then the lead math in plain numbers: at ~$${leadFee}/lead and a realistic monthly lead volume for their spend range, what that costs vs. the value of a customer in their industry — show the ROI case Bryson can say out loud.

**Likely Objections & How to Handle Them**
- 2-3 objections this specific prospect is likely to raise, each with a 1-2 sentence response.

Be specific and concrete. Bryson is reading this right before dialing — make every line useful on the call.`;

const runResearch = async (input) => {
  const leadFee = getNicheLeadFee(input.niche);
  const userLines = [
    `Prospect company: ${input.companyName}`,
    `Industry / niche: ${input.niche}`,
    input.website ? `Website: ${input.website}` : null,
    input.location ? `Location / service area: ${input.location}` : null,
    input.notes ? `What Bryson already knows: ${input.notes}` : null,
    "",
    "Research this company with web search, then write the pre-call briefing exactly as specified.",
  ].filter((l) => l !== null);

  let messages = [{ role: "user", content: userLines.join("\n") }];
  let response;
  // Web search runs a server-side loop; if it hits the internal cap it returns
  // pause_turn — re-send with the assistant turn appended to resume. Keep max_uses
  // modest so a run reliably finishes inside the OS's polling window.
  for (let i = 0; i < 4; i++) {
    response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      system: buildSystem(leadFee),
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: response.content }];
      continue;
    }
    break;
  }

  const text = (response.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  let recommendedPackageId = null;
  let brief = text;
  const m = text.match(/^\s*RECOMMENDED:\s*([a-z][a-z-]*)\s*/i);
  if (m) { recommendedPackageId = m[1].trim().toLowerCase(); brief = text.slice(m[0].length).replace(/^\s+/, ""); }
  return { brief, recommendedPackageId, nicheLeadFee: leadFee };
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

  const id = String(body.id || "").trim();
  const companyName = String(body.companyName || "").trim();
  const niche = String(body.niche || "").trim();
  if (!id || !companyName || !niche) return json({ ok: false, error: "id, companyName and niche are required" }, 400);
  const input = { companyName, niche, website: String(body.website || "").trim(), location: String(body.location || "").trim(), notes: String(body.notes || "").trim() };

  // Mark pending so the poller shows progress immediately.
  await supabase.from("deal_briefs").upsert({ id, status: "pending", input, result: null, error: null, updated_at: new Date().toISOString() });

  try {
    const result = await runResearch(input);
    await supabase.from("deal_briefs").update({ status: "done", result, updated_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: true, id });
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("deal-research failed:", msg);
    await supabase.from("deal_briefs").update({ status: "error", error: msg, updated_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: false, error: msg }, 500);
  }
};
