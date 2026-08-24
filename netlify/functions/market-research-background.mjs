// Market Research, automated. The step that had no artifact now has one.
//
// Bryson, 2026-08-22: "Can you automate that so that way the bots research my own
// competitors (same thing for clients for the future) and then also ads what makes me
// different". Both fields already feed everything the OS writes, they were just empty:
// `brandVoice.competitors` and `brandVoice.differentiator` go into `brief()` for every
// Google and Meta ad, into `generate-landing`, and onto the rendered landing page.
//
// Runs as a Netlify BACKGROUND function (name ends in "-background" → 202 immediately,
// up to 15 minutes). Places lookups plus web search plus synthesis is a minute or two,
// far past the ~10s synchronous limit.
//
// THREE SOURCES, TWO OF THEM MEASURED:
//   1. Google Places — real businesses in the niche and area, with their real ratings
//      and review counts. Facts, not opinions. Needs GOOGLE_PLACES_API_KEY; without it
//      this step is skipped and SAID to be skipped, never quietly dropped.
//   2. Their websites, read directly — whether each competitor is actually running
//      Google or Meta ads, from the tags on their own homepage. A competitor already
//      buying ads is bidding against you today, which is the single most useful fact
//      in the whole report.
//   3. Claude with web search — what they claim, what their reviews say, how they price.
//
// 🔴 IT WRITES A PROPOSAL, NOT AN ANSWER. Nothing here touches `brandVoice`. It stores
// `data.marketResearch` and a person clicks Use in the OS. A differentiator is a promise
// made in a paid ad; a model that invents "24 hour response" for a business that does not
// offer it has not written bad copy, it has made a promise to customers with money behind
// it. The mechanical gates are in market-research-shared.mjs.
//
// RESULT STORAGE: on the CLIENT RECORD at `data.marketResearch`, following adGenJob
// rather than deal_briefs — a new table means a migration, and a migration nobody ran is
// what made Lead Scout hang silently. The OS already live-refreshes the clients table, so
// the card fills in on its own with no polling endpoint.
//
// POST { clientId } with the owner's session.
// Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, optional GOOGLE_PLACES_API_KEY.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { placesSearch, inspectAdTech } from "../lib/scout-providers.mjs";
import {
  MR_TOOL, mrSystem, mrPrompt, cleanResearch, rankCompetitors, researchArea, researchAreas,
  researchNiche, sellsNationally,
} from "../lib/market-research-shared.mjs";

const anthropic = new Anthropic();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// How many competitor sites to actually open. Each is a real HTTP fetch with a timeout,
// so this is the knob between a thorough report and a slow one.
const INSPECT_MAX = 6;

// Read, merge, write. Only `marketResearch` is touched so a concurrent edit elsewhere on
// the record is not clobbered.
async function write(supabase, clientId, patch) {
  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  const prev = (row && row.data) || {};
  const next = { ...prev, marketResearch: { ...(prev.marketResearch || {}), ...patch } };
  const { error } = await supabase.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", clientId);
  if (error) console.error("market-research: could not store:", error.message);
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
  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
  const runId = String(body.runId || Date.now());

  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  const cl = (row && row.data) || null;
  if (!cl) return json({ ok: false, error: "Client not found" }, 404);

  const isAgency = !!cl.internal;
  const niche = researchNiche(cl) || (isAgency ? "marketing agency" : "");
  // 🔴 ONE CITY IS NOT ALWAYS THE MARKET. Bryson, 2026-08-22: "don't just search only in
  // Gilbert search in other places as well because marketing agencies can be anywhere".
  // A roofer's competitors are the roofers a customer could actually call, so one metro
  // IS the whole market. BoldLine works remotely and nationally, so its competitors are
  // every agency a business owner could hire, wherever they sit. Searching one suburb
  // returned a handful of small shops and called that the market.
  const national = sellsNationally(cl);
  const areas = researchAreas(cl);
  // What the model is told it is researching. For a national business its own town is
  // not the answer and never was, so saying "Gilbert, Arizona" here would frame the whole
  // report around a suburb it is not even searching any more.
  const area = national ? "the United States" : researchArea(cl);
  // Without anywhere to look the search returns businesses in the wrong place, and every
  // conclusion drawn from them is wrong. Stopping is the honest outcome.
  if (!areas.length) {
    await write(supabase, clientId, { runId, status: "error", ranAt: new Date().toISOString(),
      error: "No service area is set, so there is nowhere to look. Add one in Edit and run this again." });
    return json({ ok: false, error: "no area" }, 200);
  }

  await write(supabase, clientId, { runId, status: "running", startedAt: new Date().toISOString(), area, areas, national, niche, error: "" });

  try {
    // ── 1. Real businesses, from Google's own listings, in every market ───────
    // In parallel: each is an independent lookup, and doing them one after another turned
    // a national search into a minute of waiting for nothing.
    const searches = await Promise.all(areas.map((a) =>
      placesSearch({ niche: niche || "business", area: a, maxResults: 20 })
        .then((r) => ({ ...r, area: a }))
        .catch(() => ({ ok: false, results: [], area: a }))));
    const placesOff = searches.some((r) => r.off);
    // Measured across ALL the markets, because a national run does several lookups and one
    // failing city does not mean the listings are down. (This used to read a variable that
    // no longer existed after the search went parallel, which threw at the very END of a
    // successful run and reported "The research could not finish" after two minutes of
    // real work. See the end-to-end test.)
    const placesOk = searches.some((r) => r.ok);
    // Every market's results pooled, then deduped and ranked together, so the strongest
    // competitors win on merit rather than on which city happened to be searched first.
    const pooled = searches.flatMap((r) => (r.results || []).map((x) => ({ ...x, foundIn: r.area })));
    let competitors = rankCompetitors(pooled, cl, INSPECT_MAX + 4);

    // ── 2. Are they actually buying ads? Read it off their own homepage ───────
    const inspected = await Promise.all(competitors.slice(0, INSPECT_MAX).map(async (c) => {
      if (!c.website) return { ...c, runningAds: null, adsNote: "no website listed" };
      try {
        const t = await inspectAdTech(c.website);
        if (!t || t.reachable === false) return { ...c, runningAds: null, adsNote: (t && t.note) || "site unreadable" };
        const g = String(t.googleAds || "").toLowerCase() === "yes";
        const m = String(t.metaAds || "").toLowerCase() === "yes";
        return { ...c, runningAds: g || m,
          adsNote: [g ? "Google" : "", m ? "Meta" : ""].filter(Boolean).join(" + ") || "no ad tags found" };
      } catch { return { ...c, runningAds: null, adsNote: "could not check" }; }
    }));
    competitors = rankCompetitors(inspected.concat(competitors.slice(INSPECT_MAX)), cl, INSPECT_MAX);

    // ── 3. What they say, and what this business could own instead ────────────
    const cs = cl.campaignSetup || {};
    const system = mrSystem({
      isAgency, name: cl.name, niche, area,
      offer: cs.mainOffer, avgTicket: cs.avgTicket, site: cl.website,
    });
    const res = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 5 },
        MR_TOOL,
      ],
      messages: [{ role: "user", content: mrPrompt({ competitors, area, areas, niche, placesOff, national }) }],
    });

    const call = (res.content || []).find((c) => c.type === "tool_use" && c.name === MR_TOOL.name);
    if (!call) {
      await write(supabase, clientId, { runId, status: "error", ranAt: new Date().toISOString(),
        error: "The research came back without a usable report. Try running it again." });
      return json({ ok: false, error: "no tool call" }, 200);
    }

    const clean = cleanResearch(call.input, cl);
    await write(supabase, clientId, {
      runId, status: "done", ranAt: new Date().toISOString(), area, areas, national, niche, error: "",
      // Kept so the card can show WHERE each fact came from, and so a thin report is
      // visibly thin rather than looking like the market is empty.
      sources: {
        places: placesOff ? "off" : (placesOk ? "ok" : "failed"),
        placesNote: placesOff ? "Google Places is not connected, so the competitor list came from web search only." : "",
        found: competitors.length,
        markets: areas.length,
      },
      competitors: competitors.map((c) => ({
        name: c.name, website: c.website || "", rating: c.rating || "",
        reviewCount: Number(c.reviewCount || 0), city: c.city || c.foundIn || "",
        runningAds: c.runningAds === true ? true : c.runningAds === false ? false : null,
        adsNote: c.adsNote || "",
      })),
      ...clean,
    });

    console.log(`market-research: ${cl.name} \u2014 ${areas.length} market(s), ${competitors.length} competitor(s), ${clean.differentiators.length} proposal(s).`);
    return json({ ok: true, competitors: competitors.length, differentiators: clean.differentiators.length });
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("market-research failed:", msg);
    await write(supabase, clientId, { runId, status: "error", ranAt: new Date().toISOString(),
      error: /overloaded|rate/i.test(msg) ? "The research service was busy. Try again in a minute."
             : /credit|balance/i.test(msg) ? "The AI account is out of credit."
             : "The research could not finish. Try again." });
    return json({ ok: false, error: msg }, 200);
  }
};
