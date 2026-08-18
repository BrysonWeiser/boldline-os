// Per-Lead Fee Finder — Bryson types a niche (and optionally a specific company) and
// gets back a defensible per-qualified-lead price, with the arithmetic shown.
//
// Bryson, 2026-08-18: "I want to build something where I can put in the niche and or
// details about a specific company and I quickly get a per lead fee generated."
//
// WHY THIS IS NOT JUST A LOOKUP. `getNicheLeadFee` already returns a number for ~90
// keywords, and that number is a good ANCHOR — but it cannot know that this particular
// roofer only does commercial re-roofs at $80,000 a job, or that this med spa's whole
// business is $200 facials. The fee has to move with the value of a customer, or it is
// either leaving money on the table or pricing the deal out of existence.
//
// WHY IT SHOWS ITS WORKING. A per-lead fee is the single number Bryson quotes out loud
// on a call, and he has to be able to defend it in the next breath. So the tool returns
// the job value, the close rate, what a lead is therefore worth, and the fee as a share
// of that — the same chain he says on the call. A bare number he cannot explain is worse
// than no number.
//
// WHY IT ENDS ON THE MONTHLY BILL. Under the 2026-08-18 pricing model the per-lead fee
// only matters in combination with the package's monthly minimum ("whichever is higher").
// A fee that never clears the minimum means the client is effectively on a flat rate and
// the performance pitch is fiction — so the tool projects the month and says so.
//
// SYNCHRONOUS on purpose: no web search, one small tool call, so it answers inline in a
// few seconds rather than needing a polling table like Deal Prep does.
//
// POST { niche, company?, website?, location?, notes?, adBudget?, packageId? }
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import {
  PACKAGES, getNicheLeadFee, DEFAULT_LEAD_FEE, calcMonthlyBill, MIN_AD_BUDGET, packageForBudget,
} from "../lib/pricing-shared.mjs";

const MODELS = ["claude-sonnet-5", "claude-opus-4-8"];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const TOOL = {
  name: "per_lead_fee",
  description: "Recommend a per-qualified-lead fee for a prospect, showing the arithmetic behind it.",
  input_schema: {
    type: "object",
    properties: {
      jobValue: { type: "number", description: "Typical revenue from ONE closed customer in this niche, in whole dollars. For a repeat-purchase business use the realistic first-year value, not a single transaction." },
      jobValueBasis: { type: "string", description: "One short sentence on where that figure comes from and what it assumes." },
      closeRate: { type: "number", description: "Realistic share of QUALIFIED LEADS this business converts to paying customers, as a percentage 1-100. Be conservative: most service businesses land 15-30." },
      cpl: { type: "number", description: "Typical cost per qualified lead the CLIENT will pay the ad platform in this niche and market, in whole dollars. This is their ad spend, not BoldLine's fee." },
      fee: { type: "integer", description: "The recommended BoldLine fee per qualified lead, in whole dollars. Round to a sellable number (5s and 10s, not 47)." },
      feeLow: { type: "integer", description: "The lowest defensible fee for this prospect." },
      feeHigh: { type: "integer", description: "The highest fee this prospect would still say yes to." },
      rationale: { type: "string", description: "2-4 sentences Bryson can say out loud on the call to justify the fee, in plain language, using the numbers above. No jargon, no em dashes." },
      cautions: { type: "array", items: { type: "string" }, description: "0-3 short warnings: what would make this fee wrong, or what to verify on the call.", maxItems: 3 },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "How sure you are, given how specific the input was." },
    },
    required: ["jobValue", "jobValueBasis", "closeRate", "cpl", "fee", "feeLow", "feeHigh", "rationale", "cautions", "confidence"],
  },
};

const SYSTEM = ({ anchor, isDefault }) => `You price leads for BoldLine Media, a digital marketing agency that runs managed Google and Meta ads for service businesses. Bryson, the owner, is about to quote a per-qualified-lead fee on a sales call and needs a number he can defend in the next sentence.

HOW BOLDLINE CHARGES (2026-08-18 model). One setup fee, then each month the client pays either the package's monthly MINIMUM or the per-qualified-lead fee times the qualified leads delivered, WHICHEVER IS HIGHER. Never both added together. The client pays their own ad spend directly to Google or Meta; BoldLine never holds it or marks it up. So the per-lead fee you are setting is BoldLine's entire upside in a good month.

A "qualified lead" is a form fill, a tracked call over 30 seconds, or a chat or text conversation. It is NOT a closed customer. Bryson gets paid for the lead whether or not the business closes it, which is exactly why the fee must be a small share of what a lead is worth rather than a share of a sale.

HOW TO SET THE NUMBER. Work the chain, in this order, and let the arithmetic lead:
1. What is one closed customer actually worth to this business in revenue? Use the FIRST-YEAR value for anything with repeat purchase, because a $40 car wash that comes back monthly is not a $40 customer.
2. What share of qualified leads do they realistically close? Be conservative. Most service businesses are 15-30%. A business with slow follow-up is worse.
3. Multiply: that is what one qualified lead is worth to them in expected revenue.
4. BoldLine's fee should land at roughly 2 to 5 percent of that lead value. Higher inside that band for high-ticket, low-volume trades where every lead matters; lower for high-volume, low-ticket work.

THREE HARD SANITY CHECKS, applied after the arithmetic:
- The fee must be WELL below the cost per lead the client would pay the ad platform anyway. If BoldLine's fee approaches their CPL, the total cost per lead roughly doubles and no owner signs that.
- The fee must be small enough that a good month is still obviously profitable for the client. Run it: at their likely lead volume, does the maths still look like a bargain against the revenue?
- Never go below $10. Below that the fee cannot clear any monthly minimum and the performance pricing becomes fiction.

THE ANCHOR. BoldLine's existing table suggests about $${anchor} per lead for this kind of business${isDefault ? " (this is the generic fallback, not a niche-specific figure, so weight it lightly)" : ""}. Treat it as a sanity check, not an instruction. Move away from it when the specific details justify it, and say why in the rationale. If the details are thin, stay near it.

WRITING RULES. Bryson does not read jargon and reads every line out loud on calls. Short sentences. No em dashes or en dashes anywhere, use two sentences or a comma instead. No "unlock", "leverage", "seamless", "game-changer". Write how a person talks.

Use ONLY what you were told plus your general knowledge of what these businesses charge. Do not invent facts about this specific company. If the input is just a niche with no company detail, price the niche and set confidence to medium or low.`;

const buildPrompt = (b) => {
  const lines = [`Niche or trade: ${b.niche || "(not given)"}`];
  if (b.company) lines.push(`Company: ${b.company}`);
  if (b.website) lines.push(`Website: ${b.website}`);
  if (b.location) lines.push(`Market / service area: ${b.location}`);
  if (b.adBudget) lines.push(`Their monthly ad budget: ${b.adBudget}`);
  if (b.notes) lines.push(`What Bryson knows about them:\n${b.notes}`);
  lines.push("", "Set the per-qualified-lead fee. Show the arithmetic.");
  return lines.join("\n");
};

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
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

  const niche = String(body.niche || "").trim();
  const company = String(body.company || "").trim();
  if (!niche && !company) return json({ ok: false, error: "Type a niche or a company name first." }, 400);

  const anchor = getNicheLeadFee(niche || company);
  const isDefault = anchor === DEFAULT_LEAD_FEE;

  let out, usedModel, lastErr;
  const client = new Anthropic();
  for (const model of MODELS) {
    try {
      const msg = await client.messages.create({
        model, max_tokens: 1500,
        system: SYSTEM({ anchor, isDefault }),
        tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: buildPrompt({ ...body, niche, company }) }],
      });
      const use = (msg.content || []).find((x) => x.type === "tool_use");
      if (!use) throw new Error("The model replied without using the tool.");
      out = use.input; usedModel = model; break;
    } catch (e) {
      lastErr = e;
      const m = String((e && e.message) || e);
      if (!/model|not_found|404|does not exist|unsupported/i.test(m)) {
        return json({ ok: false, error: "Could not work out a fee just now. Try again in a moment." }, 502);
      }
      console.warn(`lead-fee: ${model} rejected (${m}) — trying next`);
    }
  }
  if (!out) {
    console.error("lead-fee: no model available", lastErr);
    return json({ ok: false, error: "Could not work out a fee just now. Try again in a moment." }, 502);
  }

  // ── Guard rails on the model's numbers ──────────────────────────────────────
  // The floor is enforced here rather than trusted to the prompt, because a fee under
  // $10 can never clear a monthly minimum and would quietly turn performance pricing
  // into a flat rate. The ordering fix matters too: a range that reads "$90 to $60"
  // gets quoted wrong on a call.
  const fee = clampInt(out.fee, 10, 5000, anchor);
  let feeLow = clampInt(out.feeLow, 10, 5000, Math.round(fee * 0.7));
  let feeHigh = clampInt(out.feeHigh, 10, 5000, Math.round(fee * 1.4));
  if (feeLow > feeHigh) [feeLow, feeHigh] = [feeHigh, feeLow];
  feeLow = Math.min(feeLow, fee);
  feeHigh = Math.max(feeHigh, fee);

  const jobValue = clampInt(out.jobValue, 1, 10000000, 0);
  const closeRate = clampInt(out.closeRate, 1, 100, 20);
  const cpl = clampInt(out.cpl, 1, 100000, 0);
  const leadValue = Math.round(jobValue * (closeRate / 100));
  const sharePct = leadValue > 0 ? Math.round((fee / leadValue) * 1000) / 10 : null;
  // If BoldLine's fee is a large slice of what the client already pays the platform for
  // the same lead, their all-in cost per lead roughly doubles. That is the objection
  // that loses the deal, so surface it rather than leaving Bryson to discover it live.
  const vsCpl = cpl > 0 ? Math.round((fee / cpl) * 100) : null;

  // ── Project the month, because the fee alone does not decide what they pay ──
  const budget = Number(String(body.adBudget || "").replace(/[^\d.]/g, "")) || 0;
  // Their budget decides the tier, so the projection uses the same resolver the rest
  // of the system does rather than guessing a package here.
  const pkg = PACKAGES.find((p) => p.id === body.packageId) || packageForBudget(budget, "g");
  let month = null;
  if (pkg && budget > 0 && cpl > 0) {
    const leads = Math.max(0, Math.round(budget / cpl));
    const b = calcMonthlyBill(pkg, { qualifiedLeads: leads, perLeadFee: fee });
    month = {
      packageId: pkg.id, packageName: pkg.name, adBudget: budget, leads,
      floor: b.floor, earned: b.earned, billed: b.billed, atFloor: b.atFloor,
      pctOfSpend: Math.round((b.billed / budget) * 100),
    };
  }

  return json({
    ok: true, model: usedModel,
    fee, feeLow, feeHigh, anchor, anchorIsDefault: isDefault,
    jobValue, jobValueBasis: String(out.jobValueBasis || ""), closeRate, cpl,
    leadValue, sharePct, vsCpl,
    rationale: String(out.rationale || ""),
    cautions: Array.isArray(out.cautions) ? out.cautions.slice(0, 3).map(String) : [],
    confidence: ["high", "medium", "low"].includes(out.confidence) ? out.confidence : "medium",
    month, minAdBudget: MIN_AD_BUDGET,
  });
};
