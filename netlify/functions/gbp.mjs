// The Google listing card's server (KB google-listing). Owner only: every action needs Bryson's OS session.
//   status       is Google connected, and as whom
//   start        the address to send Bryson to, to connect (Google sends him back to /gbp-connect/done)
//   disconnect   forget the connection (and tell Google to drop the key)
//   locations    every profile the connected account can manage
//   link/unlink  which profile is this business's own
//   overview     the profile's reviews, numbers and the drafts waiting
//   draftReply / draftPost   write a draft for Bryson to read (nothing public). A post draft is scheduled for the next
//                            Monday 8am Phoenix, when gbp-post-run puts it up unless it is held.
//   savePost                 keep his edits to the post draft (words, button, hold), still nothing public
//   reply / post             PUBLISH, with the exact words Bryson saw. The only two actions that change anything public.
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { OS_BASE } from "../lib/lead-relay.mjs";
import { addOnPlan, startAddOn } from "../lib/addon-billing.mjs";
import { stripe, ensureCustomer, resolvePaymentMethod } from "../lib/stripe-shared.mjs";
import { gbpReady, makeState, authorizeUrl, loadConn, dropConn, revoke, accessToken, listLocations, listReviews, replyReview,
  createPost, fetchMetrics, cleanPublic, replyPrompt, postPrompt, draft, waiting, REPLY_MAX, POST_MAX, CTAS, nextPostSlot } from "../lib/gbp.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const osBase = () => (process.env.OS_BASE_URL || OS_BASE).replace(/\/$/, "");
export const redirectUri = () => `${osBase()}/gbp-connect/done`;
const httpsUrl = (u) => { const t = String(u || "").trim(); try { const x = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return x.protocol === "https:" ? x.href : ""; } catch (e) { return ""; } };
const phx = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not signed in" }, 401);
  const { data: u, error: ae } = await db.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
  let body = {}; try { body = await req.json(); } catch (e) {}
  const action = String(body.action || "");

  if (action === "status") {
    const conn = gbpReady() ? await loadConn(db) : null;
    return json({ ok: true, ready: gbpReady(), connected: !!(conn && conn.refresh), email: (conn && conn.email) || "", connectedAt: (conn && conn.connectedAt) || "" });
  }
  if (!gbpReady()) return json({ ok: false, error: "Google Business Profile isn't set up in Netlify yet (GBP_CLIENT_ID and GBP_CLIENT_SECRET)." });
  if (action === "start") return json({ ok: true, url: authorizeUrl({ state: makeState(), redirectUri: redirectUri() }) });
  if (action === "disconnect") { const c = await loadConn(db); if (c) await revoke(c); await dropConn(db); return json({ ok: true }); }

  try {
    const tok = await accessToken(db);
    if (action === "locations") return json({ ok: true, locations: await listLocations(tok) });

    const { data: row } = await db.from("clients").select("id, data").eq("id", String(body.clientId || "")).maybeSingle();
    if (!row || !row.data) return json({ ok: false, error: "That business could not be found." }, 404);
    const write = async (fn) => {
      const { data: fresh } = await db.from("clients").select("data").eq("id", row.id).maybeSingle();
      const next = fn((fresh && fresh.data) || row.data);
      const { error } = await db.from("clients").update({ data: next, updated_at: new Date().toISOString() }).eq("id", row.id);
      if (error) throw new Error(error.message);
      return next;
    };
    const cl = row.data;

    if (action === "link") {
      const all = await listLocations(tok);
      const pick = all.find((l) => l.location === body.location && l.account === body.account);
      if (!pick) return json({ ok: false, error: "That profile isn't one this Google account manages." });
      // A profile belongs to one business only.
      const { data: others } = await db.from("clients").select("id, data").eq("data->gbp->>location", pick.location);
      if ((others || []).some((o) => o.id !== row.id)) return json({ ok: false, error: "That profile is already linked to another business in the OS." });
      const gbp = { ...pick, linkedAt: new Date().toISOString() };
      const linked = await write((d) => ({ ...d, gbp, gbpDrafts: {} }));
      // Linking the profile is the day the service starts, so a signed Google profile care add-on starts billing
      // now (KB addon-billing). Best effort: if Stripe is unreachable, billing-watch starts it tomorrow morning.
      let billing = null, billingNote = "";
      if (process.env.STRIPE_SECRET_KEY && addOnPlan({ ...linked, id: row.id }, "gbp_care").state === "ready") {
        try {
          const res = await startAddOn({ ...linked, id: row.id }, "gbp_care", { stripe, ensureCustomer, resolvePaymentMethod });
          billing = res.billing;
          await write((d) => ({ ...d, addOnBilling: { ...(d.addOnBilling || {}), gbp_care: res.billing } }));
        } catch (e) { console.error("gbp link: add-on billing did not start:", e.message); billingNote = "Billing didn't start just now. It will start by itself tomorrow morning."; }
      }
      return json({ ok: true, gbp, billing, billingNote });
    }
    if (action === "unlink") { await write((d) => { const n = { ...d }; delete n.gbp; delete n.gbpDrafts; return n; }); return json({ ok: true }); }

    const link = cl.gbp;
    if (!link || !link.location) return json({ ok: false, error: "Pick this business's Google profile first." });

    if (action === "overview") {
      const [rv, metrics] = await Promise.all([listReviews(tok, link), fetchMetrics(tok, link).catch((e) => ({ error: e.message }))]);
      return json({ ok: true, reviews: rv.reviews, average: rv.average, total: rv.total, waiting: waiting(rv.reviews).length, metrics, drafts: cl.gbpDrafts || {}, log: (cl.gbpLog || []).slice(0, 10) });
    }

    const anthropic = () => { if (!process.env.ANTHROPIC_API_KEY) throw new Error("Missing ANTHROPIC_API_KEY in Netlify."); return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }); };
    if (action === "draftReply") {
      const { reviews } = await listReviews(tok, link);
      const rv = reviews.find((r) => r.id === body.reviewId);
      if (!rv) return json({ ok: false, error: "That review is gone. Refresh the card." });
      const text = cleanPublic(await draft(anthropic(), replyPrompt(cl, rv)), REPLY_MAX);
      const next = await write((d) => ({ ...d, gbpDrafts: { ...(d.gbpDrafts || {}), replies: { ...((d.gbpDrafts || {}).replies || {}), [rv.id]: { text, at: new Date().toISOString(), stars: rv.stars, reviewer: rv.reviewer } } } }));
      return json({ ok: true, text, drafts: next.gbpDrafts });
    }
    if (action === "draftPost") {
      const recent = (cl.gbpLog || []).filter((x) => x.type === "post").slice(0, 6).map((x) => x.text);
      const text = cleanPublic(await draft(anthropic(), postPrompt(cl, recent, String(body.idea || "").slice(0, 300))), POST_MAX);
      // On demand, any time: it takes the coming Monday's slot (or keeps the one the draft it replaces had).
      const next = await write((d) => { const old = (d.gbpDrafts || {}).post || {};
        return { ...d, gbpDrafts: { ...(d.gbpDrafts || {}), post: { text, cta: old.cta || "BOOK", at: new Date().toISOString(), scheduledFor: old.scheduledFor || nextPostSlot(), held: !!old.held } } }; });
      return json({ ok: true, text, drafts: next.gbpDrafts });
    }
    if (action === "savePost") {   // his edits: words, button, hold. Nothing goes to Google here.
      const text = cleanPublic(body.text, POST_MAX);
      if (text.length < 20) return json({ ok: false, error: "The post is too short." });
      const cta = CTAS[body.cta] ? body.cta : "";
      const next = await write((d) => { const old = (d.gbpDrafts || {}).post || {};
        return { ...d, gbpDrafts: { ...(d.gbpDrafts || {}), post: { ...old, text, cta, held: body.held === true, scheduledFor: old.scheduledFor || nextPostSlot(), editedAt: new Date().toISOString(), at: old.at || new Date().toISOString() } } }; });
      return json({ ok: true, text, drafts: next.gbpDrafts });
    }

    // ── Publishing. Only ever the exact words Bryson approved, cleaned the same way the drafts were. ──
    if (action === "reply") {
      const text = cleanPublic(body.text, REPLY_MAX);
      if (text.length < 2) return json({ ok: false, error: "The reply is empty." });
      await replyReview(tok, link, String(body.reviewId || ""), text);
      const at = new Date().toISOString();
      await write((d) => { const dr = { ...(d.gbpDrafts || {}) }; const rp = { ...(dr.replies || {}) }; delete rp[body.reviewId]; dr.replies = rp;
        return { ...d, gbpDrafts: dr, gbpLog: [{ type: "reply", reviewId: body.reviewId, text, at }, ...(d.gbpLog || [])].slice(0, 100),
          commLog: [{ date: phx(at), note: `Replied to a Google review on ${d.name}'s profile.`, cat: "update", ts: Date.now() }, ...(d.commLog || [])].slice(0, 200) }; });
      return json({ ok: true, text });
    }
    if (action === "post") {
      const text = cleanPublic(body.text, POST_MAX);
      if (text.length < 20) return json({ ok: false, error: "The post is too short." });
      const cta = CTAS[body.cta] ? body.cta : "";
      const url = cta && cta !== "CALL" ? httpsUrl(body.url || link.website) : "";
      if (cta && cta !== "CALL" && !url) return json({ ok: false, error: "That button needs the business's website address." });
      if (/boldline/i.test(url)) return json({ ok: false, error: "The button can't point at BoldLine. Use the business's own website." });
      await createPost(tok, link, { text, cta, url });
      const at = new Date().toISOString();
      // Posting early fills that week's Monday slot, so the job doesn't write another one for the same Monday.
      await write((d) => { const dr = { ...(d.gbpDrafts || {}) }; const forSlot = (dr.post && dr.post.scheduledFor) || ""; delete dr.post;
        return { ...d, gbpDrafts: dr, gbpLog: [{ type: "post", text, cta, at, ...(forSlot ? { forSlot } : {}) }, ...(d.gbpLog || [])].slice(0, 100),
          commLog: [{ date: phx(at), note: `Posted an update on ${d.name}'s Google profile.`, cat: "update", ts: Date.now() }, ...(d.commLog || [])].slice(0, 200) }; });
      return json({ ok: true, text });
    }
    if (action === "dismiss") {   // throw a draft away without publishing it
      await write((d) => { const dr = { ...(d.gbpDrafts || {}) }; if (body.reviewId) { const rp = { ...(dr.replies || {}) }; delete rp[body.reviewId]; dr.replies = rp; } else delete dr.post; return { ...d, gbpDrafts: dr }; });
      return json({ ok: true });
    }
    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    console.error("gbp:", action, e && e.message, e && e.detail ? JSON.stringify(e.detail).slice(0, 400) : "");
    return json({ ok: false, error: (e && e.message) || "Something went wrong." });
  }
};
