// AI Lead Scout — read/write endpoint. The OS polls this while a run is going,
// then uses it to browse, re-status, and prune the saved prospect list.
// Owner-JWT auth; reads/writes the service-role-only scout_* tables.
//
// GET  ?action=run&id=            -> one run's status + progress + result
// GET  ?action=runs               -> the last 20 runs (for the history strip)
// GET  ?action=prospects&...      -> the saved list, filterable (niche/area/status/minScore/q)
// GET  ?action=facets             -> distinct niches + areas + status counts, for the filter UI
// POST ?action=status&id=         -> { status, notes? } update one prospect
// POST ?action=delete&id=         -> remove one prospect (frees its dedupe key)
// POST ?action=delete-run&id=     -> remove a run record (prospects are kept)

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { providerStatus, inspectAdTech, adLibraryUrl } from "../lib/scout-providers.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const STATUSES = ["new", "contacted", "meeting", "client", "dead"];

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "prospects";
  const id = url.searchParams.get("id") || "";

  // Which real-data providers are wired up, so the UI can say what it's working with
  // (and what Bryson is missing) before he spends a run finding out.
  if (action === "providers") return json({ ok: true, providers: providerStatus() });

  // ── Poll one run ───────────────────────────────────────────────────────────
  if (action === "run") {
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { data, error } = await supabase
      .from("scout_runs").select("id, status, progress, result, error, niche, areas, created_at")
      .eq("id", id).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: true, status: "unknown" });
    return json({ ok: true, status: data.status, progress: data.progress || null, result: data.result || null, error: data.error || null, niche: data.niche, areas: data.areas || [] });
  }

  if (action === "runs") {
    const { data, error } = await supabase
      .from("scout_runs").select("id, status, niche, areas, progress, created_at")
      .order("created_at", { ascending: false }).limit(20);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, runs: data || [] });
  }

  // ── The saved prospect list ────────────────────────────────────────────────
  if (action === "prospects") {
    const niche = url.searchParams.get("niche") || "";
    const area = url.searchParams.get("area") || "";
    const status = url.searchParams.get("status") || "";
    const runId = url.searchParams.get("runId") || "";
    const minScore = Number(url.searchParams.get("minScore") || 0) || 0;
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 200)));

    let query = supabase
      .from("scout_prospects")
      .select("id, run_id, name, domain, niche, area, score, tier, status, data, notes, created_at")
      .order("score", { ascending: false })
      .limit(limit);

    if (niche) query = query.eq("niche", niche);
    if (area) query = query.eq("area", area);
    if (status) query = query.eq("status", status);
    if (runId) query = query.eq("run_id", runId);
    if (minScore > 0) query = query.gte("score", minScore);
    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error } = await query;
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, prospects: data || [] });
  }

  // ── Filter options, computed server-side so the UI never guesses ───────────
  if (action === "facets") {
    const { data, error } = await supabase.from("scout_prospects").select("niche, area, status").limit(4000);
    if (error) return json({ ok: false, error: error.message }, 500);
    const rows = data || [];
    const counts = (key) => {
      const m = new Map();
      rows.forEach((r) => { const v = r[key]; if (v) m.set(v, (m.get(v) || 0) + 1); });
      return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
    };
    return json({ ok: true, total: rows.length, niches: counts("niche"), areas: counts("area"), statuses: counts("status") });
  }

  // ── Writes ─────────────────────────────────────────────────────────────────
  if (action === "status") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "id required" }, 400);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    const patch = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return json({ ok: false, error: "unknown status" }, 400);
      patch.status = body.status;
    }
    if (body.notes !== undefined) patch.notes = String(body.notes || "").slice(0, 2000);
    const { error } = await supabase.from("scout_prospects").update(patch).eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "delete") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { error } = await supabase.from("scout_prospects").delete().eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  // Re-check advertising tags on already-saved prospects. This only fetches public
  // homepages — no AI, no credits — so backfilling the whole list is free. Added
  // because the first ad-tech build shipped with a bot user-agent that WAFs blocked,
  // and re-running the full research just to fix that would have cost real money.
  if (action === "recheck-ads") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    let q = supabase.from("scout_prospects").select("id, name, data").limit(300);
    if (id) q = q.eq("id", id);
    const { data, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);

    const rows = data || [];
    let updated = 0, found = 0;
    // Small concurrency so a list of 300 doesn't open 300 sockets at once.
    const queue = rows.slice();
    const worker = async () => {
      while (queue.length) {
        const row = queue.shift();
        const d = row.data || {};
        const tech = await inspectAdTech(d.websiteRaw || d.website).catch(() => null);
        if (!tech) continue;
        const keep = (ai, tag) => (ai === "yes" || ai === "no" ? ai : (tag === "likely" ? "likely" : ai || "unknown"));
        const next = {
          ...d,
          googleAds: keep(d.googleAds, tech.googleAds),
          metaAds: keep(d.metaAds, tech.metaAds),
          adTechNote: tech.note || "",
          adLibraryUrl: d.adLibraryUrl || adLibraryUrl(row.name),
          adsEvidence: [String(d.adsEvidence || "").replace(/\s*·?\s*Site tags:.*$/, "").trim(),
            (tech.reachable && tech.evidence.length) ? `Site tags: ${tech.evidence.join("; ")}` : ""].filter(Boolean).join(" · "),
        };
        if (next.googleAds === "likely" || next.metaAds === "likely") found++;
        const { error: upErr } = await supabase.from("scout_prospects")
          .update({ data: next, updated_at: new Date().toISOString() }).eq("id", row.id);
        if (!upErr) updated++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, rows.length) }, worker));
    return json({ ok: true, checked: rows.length, updated, found });
  }

  if (action === "delete-run") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { error } = await supabase.from("scout_runs").delete().eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "unknown action" }, 400);
};
