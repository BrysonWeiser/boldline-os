// AI Lead Scout — finds and scores cold-call prospects, then feeds them to Deal Prep.
//
// Runs as a Netlify BACKGROUND function (filename ends in "-background" -> async,
// returns 202, up to 15 min). A run does live web research and takes 2-6 minutes,
// far past the ~10s synchronous limit, so it writes progress + results into Supabase
// and the OS polls lead-scout (get) until it flips to done.
//
// TWO PHASES, on purpose:
//   1. DISCOVERY  — one call finds up to N real businesses in the chosen niche + areas,
//                   explicitly told which ones Bryson already has so it hunts NEW ones.
//   2. ENRICHMENT — the new ones are researched in small batches (4 at a time, 3 batches
//                   in flight) so each business gets real focused searching for the owner's
//                   name, headcount, and whether they're running ads. One giant call that
//                   "finds and researches 20 businesses" reliably produces shallow, half-
//                   invented records; small batches don't.
//
// POST body: { id, niche, nicheGroup, nicheKind, areas[], count, filters{}, notes }
//   id = a client-generated run id the OS also polls on.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import {
  CANDIDATE_TOOL, PROSPECT_TOOL, discoverySystem, enrichSystem,
  normName, normDomain, dedupeKeyFor, areaMatches, tierFor, getNicheLeadFee,
} from "../lib/scout-shared.mjs";

const anthropic = new Anthropic();
const MODEL = "claude-opus-5";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const BATCH_SIZE = 4;   // businesses researched per enrichment call
const CONCURRENCY = 3;  // enrichment calls in flight at once
const MAX_COUNT = 30;

// ─── Anthropic call with the web-search server tool + a strict emit tool ─────
// The server-side search loop can return pause_turn when it hits its internal cap;
// resume by re-sending with the assistant turn appended. We stream because the
// output is large and non-streaming requests hit SDK HTTP timeouts above ~16k.
const runToolCall = async ({ system, userText, tool, maxUses, maxTokens }) => {
  let messages = [{ role: "user", content: userText }];
  let response = null;

  for (let i = 0; i < 6; i++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: maxUses },
        tool,
      ],
      messages,
    });
    response = await stream.finalMessage();

    if (response.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: response.content }];
      continue;
    }
    break;
  }

  if (response && response.stop_reason === "refusal") {
    throw new Error("The research model declined this request. Try a different niche or wording.");
  }
  const block = (response && response.content || []).find((b) => b.type === "tool_use" && b.name === tool.name);
  if (!block) {
    const text = ((response && response.content) || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    throw new Error(`The model finished without returning structured results${text ? `: ${text.slice(0, 240)}` : "."}`);
  }
  return block.input;
};

// ─── Sanitisation ────────────────────────────────────────────────────────────
// The schema guarantees the SHAPE; this guarantees the CONTENT is honest. Mostly it
// exists to stop two specific failure modes that would burn Bryson on a live call:
// a fabricated owner cell (usually the main line copied across) and a fabricated
// rating with no source.
const BLANK = /^(unknown|n\/a|na|none|null|not found|tbd|-|—|\s*)$/i;
const clean = (v) => { const s = String(v == null ? "" : v).trim(); return BLANK.test(s) ? "" : s; };
const digits = (v) => String(v || "").replace(/\D/g, "");
const list = (v, n) => (Array.isArray(v) ? v.map(clean).filter(Boolean).slice(0, n) : []);

const sanitize = (p) => {
  const phone = clean(p.phone);
  let ownerPhone = clean(p.owner_phone);
  // A "direct owner line" identical to the switchboard is not a direct owner line.
  if (ownerPhone && digits(ownerPhone) === digits(phone)) ownerPhone = "";

  const rating = clean(p.rating);
  const ratingNum = Number(rating);
  const validRating = rating && !Number.isNaN(ratingNum) && ratingNum > 0 && ratingNum <= 5 ? String(ratingNum) : "";

  const score = Math.max(0, Math.min(100, Math.round(Number(p.score) || 0)));
  const tri = (v) => (["yes", "no", "unknown"].includes(String(v)) ? String(v) : "unknown");

  const out = {
    name: clean(p.name),
    dba: clean(p.dba),
    city: clean(p.city),
    state: clean(p.state),
    postal: clean(p.postal),
    address: clean(p.address),
    area_match: clean(p.area_match),
    website: normDomain(p.website),
    websiteRaw: clean(p.website),
    phone,
    email: clean(p.email),
    ownerName: clean(p.owner_name),
    ownerTitle: clean(p.owner_title),
    ownerPhone,
    ownerEmail: clean(p.owner_email),
    ownerSource: clean(p.owner_source),
    contactConfidence: ["high", "medium", "low", "none"].includes(String(p.contact_confidence)) ? String(p.contact_confidence) : "none",
    employees: clean(p.employees),
    employeesEstimate: Math.max(0, Math.round(Number(p.employees_estimate) || 0)),
    yearsInBusiness: clean(p.years_in_business),
    revenueEstimate: clean(p.revenue_estimate),
    rating: validRating,
    reviewCount: Math.max(0, Math.round(Number(p.review_count) || 0)),
    reviewSource: validRating ? clean(p.review_source) : "",
    googleAds: tri(p.google_ads),
    metaAds: tri(p.meta_ads),
    adsEvidence: clean(p.ads_evidence),
    seoNote: clean(p.seo_note),
    websiteQuality: ["none", "poor", "dated", "decent", "strong", "unknown"].includes(String(p.website_quality)) ? String(p.website_quality) : "unknown",
    services: list(p.services, 6),
    gaps: list(p.gaps, 4),
    score,
    tier: tierFor(score).id,
    verdict: clean(p.verdict),
    whyContact: list(p.why_contact, 4),
    whyNot: list(p.why_not, 3),
    bestHook: clean(p.best_hook),
    recommendedPackageId: clean(p.recommended_package_id).toLowerCase(),
    dataNotes: clean(p.data_notes),
    sources: list(p.sources, 6),
  };

  // How much of the "need to know" set actually came back verified — shown in the UI
  // so a thin record is visibly thin instead of quietly looking complete.
  const wanted = [out.ownerName, out.phone, out.website, out.employees, out.rating,
    out.googleAds !== "unknown" ? "y" : "", out.yearsInBusiness, out.ownerPhone || out.ownerEmail || out.email];
  out.completeness = Math.round((wanted.filter(Boolean).length / wanted.length) * 100);
  return out;
};

// ─── Small promise pool ──────────────────────────────────────────────────────
const pool = async (items, limit, worker) => {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { out[i] = await worker(items[i], i); }
      catch (e) { out[i] = { __error: String((e && e.message) || e) }; }
    }
  });
  await Promise.all(runners);
  return out;
};

// ─── The run ─────────────────────────────────────────────────────────────────
const doRun = async (supabase, id, input) => {
  const { niche, nicheGroup, nicheKind, areas, count, filters, notes } = input;
  const leadFee = getNicheLeadFee(niche);
  const setProgress = (progress) =>
    supabase.from("scout_runs").update({ progress, updated_at: new Date().toISOString() }).eq("id", id);

  // What Bryson already has, so we never hand him the same business twice.
  const { data: known } = await supabase
    .from("scout_prospects").select("dedupe_key, domain, name, city").limit(4000);
  const knownKeys = new Set((known || []).map((r) => r.dedupe_key).filter(Boolean));
  const knownDomains = new Set((known || []).map((r) => r.domain).filter(Boolean));
  const excludeNames = (known || [])
    .filter((r) => areaMatches({ city: r.city, area_match: "" }, areas))
    .map((r) => (r.city ? `${r.name} (${r.city})` : r.name));

  // ── Phase 1: discovery ─────────────────────────────────────────────────────
  await setProgress({ stage: "searching", message: `Searching for ${niche} businesses…`, found: 0, enriched: 0, total: 0 });

  const discovery = await runToolCall({
    system: discoverySystem({ niche, nicheGroup, kind: nicheKind, areas, count, exclude: excludeNames, filters }),
    userText: `Find up to ${count} ${niche} businesses${(areas || []).length ? ` in: ${areas.join(" | ")}` : " (online brands, any location)"}.${notes ? `\n\nExtra context from Bryson: ${notes}` : ""}\n\nSearch the web now, then call emit_candidates.`,
    tool: CANDIDATE_TOOL,
    maxUses: 14,
    maxTokens: 20000,
  });

  const rawCandidates = Array.isArray(discovery.candidates) ? discovery.candidates : [];

  // Dedupe + strict area enforcement happen HERE, in code, before we spend money
  // enriching anything.
  const stats = { found: rawCandidates.length, duplicates: 0, outOfArea: 0 };
  const seenThisRun = new Set();
  const candidates = [];
  for (const c of rawCandidates) {
    const name = clean(c.name);
    if (!name) continue;
    const cand = { name, city: clean(c.city), state: clean(c.state), area_match: clean(c.area_match), website: clean(c.website), phone: clean(c.phone) };
    if (!areaMatches(cand, areas)) { stats.outOfArea++; continue; }
    const key = dedupeKeyFor(cand);
    const domain = normDomain(cand.website);
    if (!key || seenThisRun.has(key) || knownKeys.has(key) || (domain && knownDomains.has(domain))) { stats.duplicates++; continue; }
    seenThisRun.add(key);
    if (domain) knownDomains.add(domain);
    candidates.push(cand);
  }

  if (!candidates.length) {
    return {
      prospects: [], stats,
      coverageNote: clean(discovery.coverage_note),
      message: stats.found
        ? `Found ${stats.found} businesses but none were new and inside your areas (${stats.duplicates} already on your list, ${stats.outOfArea} outside the areas). Try different areas or a wider niche.`
        : "No businesses matched. Try a broader niche or a larger area.",
    };
  }

  // ── Phase 2: enrichment, in small batches ──────────────────────────────────
  const batches = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) batches.push(candidates.slice(i, i + BATCH_SIZE));

  await setProgress({ stage: "enriching", message: `Found ${candidates.length} new businesses — researching each one…`, found: candidates.length, enriched: 0, total: candidates.length });

  let enrichedCount = 0;
  const results = await pool(batches, CONCURRENCY, async (batch) => {
    const userText = `Research these ${batch.length} businesses and return one record each, in this order:\n\n${batch
      .map((c, i) => `${i + 1}. ${c.name} — ${[c.city, c.state].filter(Boolean).join(", ")}${c.website ? ` — ${c.website}` : ""}${c.phone ? ` — ${c.phone}` : ""}\n   (found in requested area: ${c.area_match || c.city})`)
      .join("\n")}\n\nSearch the web for each one now, then call emit_prospects.`;

    const out = await runToolCall({
      system: enrichSystem({ niche, kind: nicheKind, leadFee, areas }),
      userText,
      tool: PROSPECT_TOOL,
      maxUses: 6 * batch.length,
      maxTokens: 32000,
    });

    enrichedCount += batch.length;
    await setProgress({ stage: "enriching", message: `Researching businesses… ${Math.min(enrichedCount, candidates.length)} of ${candidates.length}`, found: candidates.length, enriched: Math.min(enrichedCount, candidates.length), total: candidates.length });
    return { batch, prospects: Array.isArray(out.prospects) ? out.prospects : [] };
  });

  const prospects = [];
  const errors = [];
  for (const r of results) {
    if (!r) continue;
    if (r.__error) { errors.push(r.__error); continue; }
    r.prospects.forEach((raw, i) => {
      const fallback = r.batch[i] || {};
      const p = sanitize({ ...raw, name: clean(raw.name) || fallback.name, city: clean(raw.city) || fallback.city });
      if (!p.name) return;
      // Re-check the area after enrichment — the deep research often corrects the city.
      if (!areaMatches({ city: p.city, state: p.state, postal: p.postal, area_match: p.area_match }, areas)) { stats.outOfArea++; return; }
      const key = dedupeKeyFor(p);
      if (!key || knownKeys.has(key)) { stats.duplicates++; return; }
      knownKeys.add(key);
      prospects.push({ key, data: p });
    });
  }

  prospects.sort((a, b) => b.data.score - a.data.score);

  // Persist. onConflict on the unique dedupe_key means a race or a re-run can never
  // create a second copy of a business — the insert is simply skipped.
  if (prospects.length) {
    const rows = prospects.map((p) => ({
      run_id: id,
      dedupe_key: p.key,
      name: p.data.name,
      domain: p.data.website || null,
      niche,
      area: p.data.area_match || [p.data.city, p.data.state].filter(Boolean).join(", "),
      score: p.data.score,
      tier: p.data.tier,
      status: "new",
      data: p.data,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("scout_prospects").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return {
    prospects: prospects.map((p) => p.data),
    stats: { ...stats, kept: prospects.length },
    coverageNote: clean(discovery.coverage_note),
    errors: errors.slice(0, 3),
    message: prospects.length
      ? `${prospects.length} new prospect${prospects.length === 1 ? "" : "s"} added to your list.`
      : "Everything found was either a duplicate or outside your areas.",
  };
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
  const niche = String(body.niche || "").trim();
  if (!id || !niche) return json({ ok: false, error: "id and niche are required" }, 400);

  const areas = Array.isArray(body.areas)
    ? [...new Set(body.areas.map((a) => String(a || "").trim()).filter(Boolean))].slice(0, 12)
    : [];
  const input = {
    niche,
    nicheGroup: String(body.nicheGroup || "").trim(),
    nicheKind: body.nicheKind === "ecom" ? "ecom" : "service",
    areas,
    count: Math.max(3, Math.min(MAX_COUNT, Math.round(Number(body.count) || 12))),
    notes: String(body.notes || "").trim().slice(0, 800),
    filters: {
      websiteState: ["any", "has", "none"].includes(body.filters && body.filters.websiteState) ? body.filters.websiteState : "any",
      adsState: ["any", "running", "not"].includes(body.filters && body.filters.adsState) ? body.filters.adsState : "any",
      minEmployees: Math.max(0, Math.min(500, Math.round(Number(body.filters && body.filters.minEmployees) || 0))),
    },
  };

  await supabase.from("scout_runs").upsert({
    id, status: "running", niche: input.niche, niche_group: input.nicheGroup,
    areas: input.areas, options: { count: input.count, filters: input.filters, nicheKind: input.nicheKind, notes: input.notes },
    progress: { stage: "starting", message: "Starting the search…" },
    result: null, error: null, updated_at: new Date().toISOString(),
  });

  try {
    const result = await doRun(supabase, id, input);
    await supabase.from("scout_runs").update({
      status: "done", result,
      progress: { stage: "done", message: result.message, found: result.stats.found, enriched: result.stats.kept || 0, total: result.stats.found },
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    return json({ ok: true, id });
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("lead-scout failed:", msg);
    await supabase.from("scout_runs").update({ status: "error", error: msg, updated_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: false, error: msg }, 500);
  }
};
