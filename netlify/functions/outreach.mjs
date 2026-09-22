// The cold-outreach endpoint: the working queue, the attempt log, and the numbers.
//
// Owner-JWT gated and service-role backed, exactly like lead-scout.mjs, because these rows are
// BoldLine's own prospect list and no client ever sees them.
//
// 🔴 EVERY RULE LIVES IN `netlify/lib/outreach.mjs`, NOT HERE. What an attempt means, when to come
// back, who is blocked and how the counters are computed are all pure functions there, so the
// screen and the server cannot disagree about who is due today.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { applyTouch, dueQueue, rollup, rollupByChannel, outcomeById, isBlocked, buildManualProspect, manualAddVerdict, QUEUE_SKIP_STATUS } from "../lib/outreach.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const PROSPECT_COLS = "id, name, domain, niche, area, score, tier, status, data, notes, step, last_touch_at, next_due_at, meeting_at, blocked_at, created_at";

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "queue";
  const id = url.searchParams.get("id") || "";

  // ── Who to work, right now ─────────────────────────────────────────────────
  //
  // 🔴 THE BLOCKED FILTER IS IN THE QUERY *AND* IN `dueQueue`. Belt and braces on purpose: this is
  // the one list where a row slipping through is a legal problem rather than a bug, and the two
  // guards fail independently.
  if (action === "queue") {
    const limit = Math.max(1, Math.min(400, Number(url.searchParams.get("limit") || 200)));
    const niche = url.searchParams.get("niche") || "";
    let q = supabase.from("scout_prospects").select(PROSPECT_COLS)
      .is("blocked_at", null)
      // A prospect marked "Not a fit" or already won is not somebody to cold call. Filtered here
      // AND in `dueQueue`, the same belt-and-braces as the blocked check above.
      .not("status", "in", `(${QUEUE_SKIP_STATUS.join(",")})`)
      .limit(limit * 2);
    if (niche) q = q.eq("niche", niche);
    const { data, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    const queue = dueQueue(data || [], Date.now()).slice(0, limit);
    // Everything not due yet, so the screen can say when the list refills instead of looking empty.
    const later = (data || [])
      .filter((p) => !isBlocked(p) && p.next_due_at && new Date(p.next_due_at).getTime() > Date.now())
      .sort((a, b) => new Date(a.next_due_at) - new Date(b.next_due_at));
    return json({
      ok: true,
      queue,
      waiting: later.length,
      nextAt: later.length ? later[0].next_due_at : null,
    });
  }

  // ── Everything that has happened, for the numbers ──────────────────────────
  if (action === "touches") {
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    let q = supabase.from("outreach_touches").select("*").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(4000);
    if (id) q = supabase.from("outreach_touches").select("*").eq("prospect_id", id)
      .order("created_at", { ascending: false }).limit(200);
    const { data, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    const touches = data || [];
    return json({ ok: true, touches, stats: rollup(touches), byChannel: rollupByChannel(touches) });
  }

  // ── Log one attempt ────────────────────────────────────────────────────────
  if (action === "touch") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "id required" }, 400);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

    const o = outcomeById(body.outcome);
    if (!o) return json({ ok: false, error: "unknown outcome" }, 400);
    const channel = String(body.channel || "call");
    if (!o.channels.includes(channel)) return json({ ok: false, error: `${o.label} is not something that happens on a ${channel}` }, 400);

    const { data: rows, error: readErr } = await supabase.from("scout_prospects").select(PROSPECT_COLS).eq("id", id).limit(1);
    if (readErr) return json({ ok: false, error: readErr.message }, 500);
    const prospect = (rows || [])[0];
    if (!prospect) return json({ ok: false, error: "prospect not found" }, 404);
    // 🔴 A BLOCKED PROSPECT CANNOT BE TOUCHED AGAIN, EVEN BY A DIRECT REQUEST. The screen hides
    // them, and this refuses them, so a stale tab or a replayed request cannot contact someone who
    // asked not to be.
    if (isBlocked(prospect)) return json({ ok: false, error: "This prospect asked not to be contacted." }, 409);

    const applied = applyTouch(prospect, { outcome: o.id, when: body.when }, Date.now());
    if (applied.error) return json({ ok: false, error: applied.error }, 400);

    const { error: insErr } = await supabase.from("outreach_touches").insert({
      prospect_id: id,
      channel,
      outcome: o.id,
      note: String(body.note || "").slice(0, 2000) || null,
      meeting_at: applied.patch.meeting_at || null,
    });
    if (insErr) return json({ ok: false, error: insErr.message }, 500);

    const { error: updErr } = await supabase.from("scout_prospects").update(applied.patch).eq("id", id);
    if (updErr) return json({ ok: false, error: updErr.message }, 500);
    return json({ ok: true, patch: applied.patch, step: applied.step, dueAt: applied.dueAt });
  }

  // ── Add one company by hand ────────────────────────────────────────────────
  //
  // The other door into the list, for a referral or a name off a van. Everything about the row it
  // writes is decided in `buildManualProspect`; this part is only the three database questions.
  //
  // 🔴 A HAND ADD MUST NEVER BRING BACK SOMEBODY WHO ASKED NOT TO BE CONTACTED. That is the whole
  // reason this checks before it inserts: without it, typing the name of a company that once said
  // "take me off your list" would hand them straight back to the top of the queue, and the guards
  // on the working screen would never see it because the block lives on a row this would sit beside.
  // Refusing is the only correct answer, and it says why.
  if (action === "add") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

    const built = buildManualProspect(body);
    if (built.error) return json({ ok: false, error: built.error }, 400);

    // Same name and town, or the same website: the two ways the scout itself calls something a
    // duplicate. Checked together so a company found last week cannot be typed in again today.
    const domain = built.row.domain;
    const orFilter = domain ? `dedupe_key.eq.${built.dedupeKey},domain.eq.${domain}` : `dedupe_key.eq.${built.dedupeKey}`;
    const { data: clash, error: clashErr } = await supabase
      .from("scout_prospects").select("id, name, status, blocked_at").or(orFilter).limit(1);
    if (clashErr) return json({ ok: false, error: clashErr.message }, 500);

    // 🔴 THE DECISION IS NOT MADE HERE. `manualAddVerdict` owns it, so a test can run it rather
    // than read it, and so the blocked case cannot be lost by an edit to this endpoint.
    const existing = (clash || [])[0] || null;
    const verdict = manualAddVerdict(existing);
    if (verdict.verdict === "blocked") {
      return json({ ok: false, blocked: true, error: verdict.message }, verdict.status);
    }
    if (verdict.verdict === "duplicate") {
      return json({ ok: true, duplicate: true, id: existing.id, name: existing.name, message: verdict.message });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("scout_prospects").insert(built.row).select(PROSPECT_COLS).limit(1);
    if (insErr) {
      // The unique index on dedupe_key is the real guarantee; two taps in the same second land here
      // rather than creating a second copy.
      if (/duplicate key|23505/i.test(insErr.message || "")) {
        return json({ ok: true, duplicate: true, name: built.row.name, message: `${built.row.name} is already on your list.` });
      }
      return json({ ok: false, error: insErr.message }, 500);
    }
    return json({ ok: true, prospect: (inserted || [])[0] || null });
  }

  // ── Did they turn up? ──────────────────────────────────────────────────────
  //
  // 🔴 ITS OWN ACTION, ANSWERED LATER, BECAUSE A BOOKING IS NOT A SHOW. This is the number a setter
  // would be paid on, so it is recorded by somebody saying so after the meeting time, never
  // inferred from the booking existing.
  if (action === "showed") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "touch id required" }, 400);
    let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
    if (typeof body.showed !== "boolean") return json({ ok: false, error: "showed must be true or false" }, 400);
    const { error } = await supabase.from("outreach_touches").update({ showed: body.showed }).eq("id", id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Undo the last attempt on a prospect ────────────────────────────────────
  //
  // A mis-tap on a screen built for speed is inevitable, and without this the only fix is a wrong
  // number in the counters for ever. It removes the touch and rebuilds the prospect's queue state
  // from what is left, rather than guessing it back.
  if (action === "undo") {
    if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
    if (!id) return json({ ok: false, error: "id required" }, 400);
    const { data: hist, error: hErr } = await supabase.from("outreach_touches")
      .select("*").eq("prospect_id", id).order("created_at", { ascending: false }).limit(50);
    if (hErr) return json({ ok: false, error: hErr.message }, 500);
    const last = (hist || [])[0];
    if (!last) return json({ ok: false, error: "nothing to undo" }, 404);
    const { error: delErr } = await supabase.from("outreach_touches").delete().eq("id", last.id);
    if (delErr) return json({ ok: false, error: delErr.message }, 500);

    const rest = (hist || []).slice(1);
    const prev = rest[0] || null;
    const patch = {
      step: rest.length,
      last_touch_at: prev ? prev.created_at : null,
      meeting_at: (rest.find((t) => t.meeting_at) || {}).meeting_at || null,
      // 🔴 REBUILT FROM THE REMAINING HISTORY. If an earlier attempt was a do-not-contact, undoing
      // a later one must not un-block them.
      blocked_at: (() => {
        const b = rest.find((t) => { const o = outcomeById(t.outcome); return o && o.blocks; });
        return b ? b.created_at : null;
      })(),
      next_due_at: prev
        ? applyTouch({ step: rest.length - 1 }, { outcome: prev.outcome, when: prev.meeting_at }, new Date(prev.created_at).getTime()).patch.next_due_at
        : null,
      updated_at: new Date().toISOString(),
    };
    const { error: updErr } = await supabase.from("scout_prospects").update(patch).eq("id", id);
    if (updErr) return json({ ok: false, error: updErr.message }, 500);
    return json({ ok: true, patch });
  }

  // ── The script ─────────────────────────────────────────────────────────────
  // One row, because it belongs to the business rather than to a browser. The moment a setter is
  // hired they read the same words, and a script in local storage is one cleared cache from gone.
  if (action === "settings") {
    if (req.method === "POST") {
      let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
      const { error } = await supabase.from("outreach_settings")
        .upsert({ id: 1, script: String(body.script || "").slice(0, 20000), updated_at: new Date().toISOString() });
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true });
    }
    const { data, error } = await supabase.from("outreach_settings").select("script, updated_at").eq("id", 1).limit(1);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, script: ((data || [])[0] || {}).script || "" });
  }

  return json({ ok: false, error: `unknown action: ${action}` }, 400);
};
