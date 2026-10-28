// Every morning (8:41am Phoenix): for each business with a Google profile linked, draft a reply to every new review
// (published only when Bryson approves it in the Google listing card) and, from Tuesday on, next Monday's post. That post
// goes up by itself on Monday at 8am (gbp-post-run) unless he edits, holds or throws it away first. Same clock as the
// blog and newsletter (Bryson, 2026-10-28). This job itself publishes nothing. KB google-listing.
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { gbpReady, loadConn, accessToken, listReviews, waiting, draft, replyPrompt, postPrompt, cleanPublic, REPLY_MAX, POST_MAX, nextPostSlot, phxDay } from "../lib/gbp.mjs";

export const MAX_REPLY_DRAFTS = 5;   // per business per run: a flood of old reviews should not run up the bill in one morning

// Pure: what this run should draft for one business.
export function plan(cl, reviews, now = Date.now()) {
  const dr = cl.gbpDrafts || {}, have = dr.replies || {};
  const since = Date.parse((cl.gbp && cl.gbp.linkedAt) || 0) - 30 * 864e5;   // reviews older than a month before linking are history, not news
  const replies = waiting(reviews).filter((r) => !have[r.id] && Date.parse(r.at || 0) >= since).slice(0, MAX_REPLY_DRAFTS);
  // Next Monday's post, written from Tuesday on (Monday is the day the last one goes up), unless one is already
  // waiting or that Monday's slot was already filled ("Post now" early counts).
  const slot = nextPostSlot(now);
  const post = phxDay(now) !== 1 && !dr.post && !(cl.gbpLog || []).some((x) => x.type === "post" && x.forSlot === slot);
  const low = replies.filter((r) => r.stars && r.stars <= 2);
  return { replies, post, low, slot };
}

export async function runWatch(db, rows, { anthropic, tok, now = Date.now(), alert = dispatchAlert } = {}) {
  const lines = []; let drafted = 0;
  for (const r of rows) {
    const cl = r.data || {};
    if (!cl.gbp || !cl.gbp.location) continue;
    let reviews;
    try { reviews = (await listReviews(tok, cl.gbp)).reviews; } catch (e) { lines.push(`${cl.name}: could not read reviews (${e.message})`); continue; }
    const p = plan(cl, reviews, now);
    if (!p.replies.length && !p.post) continue;
    const replies = {}; let post = null;
    for (const rv of p.replies) {
      try { replies[rv.id] = { text: cleanPublic(await draft(anthropic, replyPrompt(cl, rv)), REPLY_MAX), at: new Date(now).toISOString(), stars: rv.stars, reviewer: rv.reviewer }; } catch (e) { console.error("gbp-watch reply draft:", e.message); }
    }
    if (p.post) {
      const recent = (cl.gbpLog || []).filter((x) => x.type === "post").slice(0, 6).map((x) => x.text);
      try { post = { text: cleanPublic(await draft(anthropic, postPrompt(cl, recent)), POST_MAX), cta: "BOOK", at: new Date(now).toISOString(), scheduledFor: p.slot, held: false }; } catch (e) { console.error("gbp-watch post draft:", e.message); }
    }
    if (!Object.keys(replies).length && !post) continue;
    const { data: fresh } = await db.from("clients").select("data").eq("id", r.id).maybeSingle();
    const d = (fresh && fresh.data) || cl, dr = d.gbpDrafts || {};
    await db.from("clients").update({ data: { ...d, gbpDrafts: { ...dr, replies: { ...(dr.replies || {}), ...replies }, ...(post && !dr.post ? { post } : {}) } }, updated_at: new Date(now).toISOString() }).eq("id", r.id);
    const n = Object.keys(replies).length; drafted += n + (post ? 1 : 0);
    const when = post ? new Date(post.scheduledFor).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Phoenix" }) : "";
    lines.push(`${cl.name}: ${[n && `${n} review ${n === 1 ? "reply" : "replies"} ready to approve`, post && `next week's post written, goes up ${when} at 8am unless you change it`].filter(Boolean).join(", and ")}${p.low.length ? ` (${p.low.length} low rating${p.low.length === 1 ? "" : "s"}: read it first)` : ""}.`);
  }
  if (drafted) {
    const low = lines.some((l) => /low rating/.test(l));
    try { await alert({ severity: low ? "amber" : "blue", title: low ? "A low Google review needs a reply" : "Google listing drafts ready", body: `${lines.join("\n")}\n\nOpen the business in the OS: the Google listing card has them. Review replies wait for you. The post goes up by itself on Monday unless you edit it, hold it or throw it away.`, smsText: lines[0] }); } catch (e) {}
  }
  return { drafted, lines };
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !gbpReady() || !process.env.ANTHROPIC_API_KEY) return new Response("not configured", { status: 200 });
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!(await loadConn(db))) return new Response("gbp-watch: Google not connected", { status: 200 });
  const rows = (await loadAllClients(db, "gbp-watch")).filter((r) => r.data && r.data.gbp);
  if (!rows.length) return new Response("gbp-watch: no profiles linked", { status: 200 });
  const res = await runWatch(db, rows, { anthropic: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), tok: await accessToken(db) });
  const line = `gbp-watch: ${res.drafted} draft(s). ${res.lines.join(" | ")}`; console.log(line);
  return new Response(line, { status: 200 });
};
export default withFailureAlert("gbp-watch", handler);
