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
  normName, normDomain, dedupeKeyFor, areaMatches, tierFor, getNicheLeadFee, PACKAGES,
} from "../lib/scout-shared.mjs";
import { assessAffordability, buildScore } from "../lib/scout-scoring.mjs";
import { providerStatus, placesSearch, enrichFromProviders } from "../lib/scout-providers.mjs";

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

// Last 10 digits — the comparison key for "is this the same number".
const phoneKey = (v) => { const d = digits(v); return d.length > 10 ? d.slice(-10) : d; };

// Verified provider records are added FIRST so they own the slot; the model's
// findings only fill numbers the providers didn't already supply.
const mergeContacts = (providerRows, aiRows, keyOf, cap) => {
  const out = [], seen = new Set();
  const add = (r) => {
    const k = keyOf(r);
    if (!k || seen.has(k)) return;
    seen.add(k); out.push(r);
  };
  providerRows.forEach(add); aiRows.forEach(add);
  return out.slice(0, cap);
};

const sanitize = (p, ctx) => {
  const { verified = {}, providerPhones = [], providerEmails = [], nicheGroup = "", kind = "service", providerSources = [] } = ctx || {};
  const tri = (v) => (["yes", "no", "unknown"].includes(String(v)) ? String(v) : "unknown");
  const conf = (v) => (["high", "medium", "low"].includes(String(v)) ? String(v) : "medium");

  // ── Contact block ────────────────────────────────────────────────────────
  const aiPhones = (Array.isArray(p.phones) ? p.phones : []).map((x) => ({
    number: clean(x && x.number),
    kind: ["main", "direct", "mobile", "secondary", "toll_free", "unknown"].includes(String(x && x.kind)) ? String(x.kind) : "unknown",
    whose: ["business", "owner", "unknown"].includes(String(x && x.whose)) ? String(x.whose) : "unknown",
    label: clean(x && x.label),
    source: clean(x && x.source) || "AI research",
    confidence: conf(x && x.confidence),
  })).filter((x) => phoneKey(x.number).length >= 7);

  const aiEmails = (Array.isArray(p.emails) ? p.emails : []).map((x) => ({
    address: clean(x && x.address).toLowerCase(),
    whose: ["business", "owner", "unknown"].includes(String(x && x.whose)) ? String(x.whose) : "unknown",
    source: clean(x && x.source) || "AI research",
    confidence: conf(x && x.confidence),
  })).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.address));

  const phones = mergeContacts(
    providerPhones.map((x) => ({ ...x, label: x.label || (x.whose === "owner" ? "owner" : "main office") })),
    aiPhones, (r) => phoneKey(r.number), 6);
  const emails = mergeContacts(providerEmails, aiEmails, (r) => r.address, 4);

  // The primary business line is what Bryson dials first, so it gets its own field.
  const businessPhone = (phones.find((x) => x.whose === "business" && x.kind === "main")
    || phones.find((x) => x.whose === "business")
    || phones.find((x) => x.whose === "unknown") || null);
  const bizKey = businessPhone ? phoneKey(businessPhone.number) : "";
  // A "direct owner line" identical to the switchboard is not a direct owner line —
  // this is the single most common way a record gets padded to look complete.
  const ownerPhoneRow = phones.find((x) => x.whose === "owner" && phoneKey(x.number) !== bizKey) || null;
  const businessEmail = emails.find((x) => x.whose === "business") || emails.find((x) => x.whose === "unknown") || null;
  const ownerEmailRow = emails.find((x) => x.whose === "owner") || null;

  // ── Verified provider values override the model everywhere they exist ────
  const pick = (v, ai) => (v !== undefined && v !== null && v !== "" ? v : ai);
  const ratingRaw = pick(verified.rating, clean(p.rating));
  const ratingNum = Number(ratingRaw);
  const rating = ratingRaw && !Number.isNaN(ratingNum) && ratingNum > 0 && ratingNum <= 5 ? String(ratingNum) : "";
  const employeesEstimate = Math.max(0, Math.round(Number(pick(verified.employeesEstimate, p.employees_estimate)) || 0));
  const revenueEstimate = pick(verified.revenueEstimate, clean(p.revenue_estimate));
  const websiteRaw = pick(verified.website, clean(p.website));

  const out = {
    name: clean(p.name),
    dba: clean(p.dba),
    city: pick(verified.city, clean(p.city)),
    state: pick(verified.state, clean(p.state)),
    postal: pick(verified.postal, clean(p.postal)),
    address: pick(verified.address, clean(p.address)),
    area_match: clean(p.area_match),
    website: normDomain(websiteRaw),
    websiteRaw,
    mapsUrl: verified.mapsUrl || "",

    phones, emails,
    phone: businessPhone ? businessPhone.number : "",
    phoneLabel: businessPhone ? businessPhone.label : "",
    phoneSource: businessPhone ? businessPhone.source : "",
    ownerPhone: ownerPhoneRow ? ownerPhoneRow.number : "",
    ownerPhoneKind: ownerPhoneRow ? ownerPhoneRow.kind : "",
    ownerPhoneSource: ownerPhoneRow ? ownerPhoneRow.source : "",
    email: businessEmail ? businessEmail.address : "",
    ownerEmail: ownerEmailRow ? ownerEmailRow.address : "",

    ownerName: pick(verified.ownerName, clean(p.owner_name)),
    ownerTitle: pick(verified.ownerTitle, clean(p.owner_title)),
    ownerLinkedin: verified.ownerLinkedin || "",
    companyLinkedin: verified.companyLinkedin || "",
    ownerSource: verified.ownerName ? "Apollo" : clean(p.owner_source),
    contactConfidence: ["high", "medium", "low", "none"].includes(String(p.contact_confidence)) ? String(p.contact_confidence) : "none",

    employees: clean(p.employees) || (employeesEstimate ? String(employeesEstimate) : ""),
    employeesEstimate,
    yearsInBusiness: clean(p.years_in_business) || (verified.founded ? `since ${verified.founded}` : ""),
    revenueEstimate,
    rating,
    reviewCount: Math.max(0, Math.round(Number(pick(verified.reviewCount, p.review_count)) || 0)),
    reviewSource: rating ? (verified.rating ? "Google" : clean(p.review_source)) : "",

    googleAds: tri(p.google_ads),
    metaAds: tri(p.meta_ads),
    adsEvidence: clean(p.ads_evidence),
    seoNote: clean(p.seo_note),
    websiteQuality: ["none", "poor", "dated", "decent", "strong", "unknown"].includes(String(p.website_quality)) ? String(p.website_quality) : "unknown",
    services: list(p.services, 6),
    gaps: list(p.gaps, 4),

    verdict: clean(p.verdict),
    whyContact: list(p.why_contact, 4),
    whyNot: list(p.why_not, 3),
    bestHook: clean(p.best_hook),
    recommendedPackageId: clean(p.recommended_package_id).toLowerCase(),
    dataNotes: clean(p.data_notes),
    sources: list(p.sources, 6),
    verifiedBy: providerSources,
  };

  // ── The money math + the score, computed here rather than guessed ────────
  const aff = assessAffordability({ employeesEstimate: out.employeesEstimate, revenueEstimate: out.revenueEstimate, nicheGroup, kind });
  const scored = buildScore(p.score_factors, aff);
  out.affordability = aff;
  out.scoreFactors = scored.factors;
  out.scoreSubtotal = scored.subtotal;
  out.scoreCappedFrom = scored.cappedFrom;
  out.capReason = scored.capReason;
  out.score = scored.score;
  out.tier = tierFor(scored.score).id;

  // Never let him pitch above what the math says they can carry.
  if (aff.known && aff.affordableId && out.recommendedPackageId) {
    const rec = PACKAGES.find((x) => x.id === out.recommendedPackageId);
    const afford = PACKAGES.find((x) => x.id === aff.affordableId);
    if (rec && afford && rec.price > afford.price) {
      out.packageDowngradedFrom = rec.id;
      out.recommendedPackageId = afford.id;
    }
  }

  // How much of the "need to know" set actually came back — shown in the UI so a thin
  // record looks thin instead of quietly looking complete.
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
  const prov = providerStatus();
  const providerNotes = [];
  await setProgress({ stage: "searching", message: prov.places ? `Pulling ${niche} businesses from Google Places…` : `Searching for ${niche} businesses…`, found: 0, enriched: 0, total: 0 });

  let rawCandidates = [];
  let coverageNote = "";

  // Google Places first when it's configured: it returns real addresses and real
  // phone numbers, which makes both the area filter and the main business line
  // authoritative instead of a model's best guess.
  if (prov.places && (areas || []).length) {
    for (const area of areas) {
      const res = await placesSearch({ niche, area, maxResults: 20 });
      if (!res.ok) { if (!res.off) providerNotes.push(`Google Places failed for ${area}: ${res.error}`); continue; }
      res.results.forEach((r) => rawCandidates.push({ ...r, area_match: area, evidence: `Google Places listing (${r.category || niche})` }));
    }
    if (rawCandidates.length) coverageNote = `${rawCandidates.length} businesses pulled from Google Places across ${areas.length} area${areas.length === 1 ? "" : "s"}.`;
  }

  // AI discovery fills in when Places is off, can't be used (online brands have no
  // storefront to find), or came back thin.
  if (rawCandidates.length < count) {
    await setProgress({ stage: "searching", message: `Searching the web for more ${niche} businesses…`, found: rawCandidates.length, enriched: 0, total: 0 });
    const already = rawCandidates.map((c) => `${c.name} (${c.city})`);
    const discovery = await runToolCall({
      system: discoverySystem({ niche, nicheGroup, kind: nicheKind, areas, count: count - rawCandidates.length, exclude: excludeNames.concat(already), filters }),
      userText: `Find up to ${count - rawCandidates.length} ${niche} businesses${(areas || []).length ? ` in: ${areas.join(" | ")}` : " (online brands, any location)"}.${notes ? `\n\nExtra context from Bryson: ${notes}` : ""}\n\nSearch the web now, then call emit_candidates.`,
      tool: CANDIDATE_TOOL, maxUses: 14, maxTokens: 20000,
    });
    (Array.isArray(discovery.candidates) ? discovery.candidates : []).forEach((c) => rawCandidates.push(c));
    coverageNote = [coverageNote, clean(discovery.coverage_note)].filter(Boolean).join(" ");
  }

  // Dedupe + strict area enforcement happen HERE, in code, before we spend money
  // enriching anything.
  const stats = { found: rawCandidates.length, duplicates: 0, outOfArea: 0 };
  const seenThisRun = new Set();
  const candidates = [];
  for (const c of rawCandidates) {
    const name = clean(c.name);
    if (!name) continue;
    const cand = { name, city: clean(c.city), state: clean(c.state), postal: clean(c.postal), address: clean(c.address),
      area_match: clean(c.area_match), website: clean(c.website), phone: clean(c.phone),
      placeId: c.placeId || "", rating: c.rating || "", reviewCount: c.reviewCount || 0, mapsUrl: c.mapsUrl || "", source: c.source || "" };
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
      prospects: [], stats, coverageNote, providers: prov, providerNotes,
      message: stats.found
        ? `Found ${stats.found} businesses but none were new and inside your areas (${stats.duplicates} already on your list, ${stats.outOfArea} outside the areas). Try different areas or a wider niche.`
        : "No businesses matched. Try a broader niche or a larger area.",
    };
  }

  // ── Phase 1.5: verified provider data ──────────────────────────────────────
  // Apollo gives the decision-maker + headcount + revenue; Places already gave the
  // real phone and address. This runs BEFORE the AI so the model is handed facts to
  // build on instead of numbers to guess at.
  if (prov.places || prov.apollo) {
    await setProgress({ stage: "enriching", message: `Pulling verified contact data for ${candidates.length} businesses…`, found: candidates.length, enriched: 0, total: candidates.length });
    const enrichments = await pool(candidates, 4, (c) => enrichFromProviders(c));
    candidates.forEach((c, i) => {
      const e = enrichments[i];
      c.provider = (e && !e.__error) ? e : { phones: [], emails: [], sources: [], verified: {} };
    });
  } else {
    candidates.forEach((c) => { c.provider = { phones: [], emails: [], sources: [], verified: {} }; });
  }

  // ── Phase 2: AI enrichment, in small batches ───────────────────────────────
  const batches = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) batches.push(candidates.slice(i, i + BATCH_SIZE));

  await setProgress({ stage: "enriching", message: `Found ${candidates.length} new businesses — researching each one…`, found: candidates.length, enriched: 0, total: candidates.length });

  // What the providers already proved, handed to the model as ground truth.
  const verifiedBlock = (c) => {
    const v = (c.provider && c.provider.verified) || {};
    const rows = [
      c.phone ? `main phone ${c.phone}` : "",
      v.address ? `address ${v.address}` : "",
      v.ownerName ? `owner ${v.ownerName}${v.ownerTitle ? `, ${v.ownerTitle}` : ""}` : "",
      v.employeesEstimate ? `~${v.employeesEstimate} employees` : "",
      v.revenueEstimate ? `revenue ${v.revenueEstimate}` : "",
      v.rating ? `${v.rating}★ from ${v.reviewCount || "?"} reviews` : "",
      v.founded ? `founded ${v.founded}` : "",
      (c.provider.phones || []).filter((p) => p.whose === "owner").map((p) => `owner ${p.kind} ${p.number}`).join(", "),
      (c.provider.emails || []).map((e) => `${e.whose} email ${e.address}`).join(", "),
    ].filter(Boolean);
    return rows.length ? `\n   VERIFIED FACTS (${(c.provider.sources || []).join(" + ") || "provider"}) — treat as ground truth: ${rows.join("; ")}` : "";
  };

  let enrichedCount = 0;
  const results = await pool(batches, CONCURRENCY, async (batch) => {
    const userText = `Research these ${batch.length} businesses and return one record each, in this order:\n\n${batch
      .map((c, i) => `${i + 1}. ${c.name} — ${[c.city, c.state].filter(Boolean).join(", ")}${c.website ? ` — ${c.website}` : ""}${c.phone ? ` — ${c.phone}` : ""}\n   (found in requested area: ${c.area_match || c.city})${verifiedBlock(c)}`)
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
      const fp = fallback.provider || { phones: [], emails: [], sources: [], verified: {} };
      const p = sanitize(
        { ...raw, name: clean(raw.name) || fallback.name, city: clean(raw.city) || fallback.city },
        { verified: fp.verified, providerPhones: fp.phones, providerEmails: fp.emails, providerSources: fp.sources, nicheGroup, kind: nicheKind });
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
    coverageNote, providers: prov, providerNotes,
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
