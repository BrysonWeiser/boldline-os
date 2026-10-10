// Connecting a business's own Stripe or Square, from the OS (signed in) or from the client's portal (its token).
// KB `payments-connect`.
//   POST {action:"ready"}                                   which providers BoldLine has switched on
//   POST {action:"start", provider, clientId | token}       the provider's own approval page to send them to
//   POST {action:"disconnect", clientId | token}            cut the connection (on the provider's side too)
//   POST {action:"save", token, card, links, inperson, charge}   the portal saving the ways the business takes payment
// 🔴 Only `payConnect` (server-owned) and `payments` are ever written, each against the record as it is now.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { OS_BASE } from "../lib/lead-relay.mjs";
import { CONNECTABLE, payKey, makeState, authorizeUrl, providersReady, cleanPayments } from "../lib/payments.mjs";
import { stripeDisconnect, squareDisconnect, loadSquare, dropSquare } from "../lib/payments-api.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const httpsUrl = (u) => { const t = String(u || "").trim(); if (!/^https:\/\/[^\s"'<>]+$/i.test(t)) return ""; try { return new URL(t).href; } catch (e) { return ""; } };
const redirectUri = () => `${(process.env.OS_BASE_URL || OS_BASE).replace(/\/$/, "")}/pay-connect/done`;

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  let body = {}; try { body = await req.json(); } catch (e) {}
  if (body.action === "ready") return json({ ok: true, ready: providersReady() });
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Who is asking: Bryson signed in to the OS, or the business through its own portal link.
  let row = null, from = "os";
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (body.token) {
    const t = String(body.token);
    if (t.length < 10 || t.length > 120) return json({ ok: false, error: "That link doesn't work." }, 404);
    ({ data: row } = await db.from("clients").select("id, data").eq("data->>portalToken", t).maybeSingle());
    from = "portal";
  } else if (jwt) {
    const { data: u, error } = await db.auth.getUser(jwt);
    if (error || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
    ({ data: row } = await db.from("clients").select("id, data").eq("id", String(body.clientId || "")).maybeSingle());
  } else return json({ ok: false, error: "Not signed in" }, 401);
  if (!row || !row.data) return json({ ok: false, error: "That business could not be found." }, 404);

  const write = async (fn) => {
    const { data: fresh } = await db.from("clients").select("data").eq("id", row.id).maybeSingle();
    if (!fresh || !fresh.data) throw new Error("gone");
    const { error } = await db.from("clients").update({ data: fn(fresh.data), updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw new Error(error.message);
  };

  if (body.action === "start") {
    const provider = String(body.provider || "");
    if (!CONNECTABLE.includes(provider)) return json({ ok: false, error: "Pick Stripe or Square." }, 400);
    if (!providersReady()[provider]) return json({ ok: false, error: `${provider === "stripe" ? "Stripe" : "Square"} connections aren't switched on yet. Use a payment link for now.` });
    const state = makeState(payKey(), { clientId: row.id, provider, from });
    return json({ ok: true, url: authorizeUrl(provider, { state, redirectUri: redirectUri() }) });
  }

  if (body.action === "disconnect") {
    const c = row.data.payConnect;
    try {
      if (c && c.provider === "stripe") await stripeDisconnect(c.account);
      if (c && c.provider === "square") { await squareDisconnect(await loadSquare(db, row.id)); await dropSquare(db, row.id); }
    } catch (e) { console.error("disconnect:", e && e.message); return json({ ok: false, error: "That didn't go through. Try again in a minute." }); }
    await write((d) => { const n = { ...d }; delete n.payConnect; return n; });
    return json({ ok: true });
  }

  if (body.action === "save" && from === "portal") {
    // Several ways at once: a card through its own account, up to three payment links, and in person.
    const bad = (Array.isArray(body.links) ? body.links : []).some((l) => l && String(l.url || "").trim() && !httpsUrl(l.url));
    if (bad) return json({ ok: false, error: "Each payment link needs the full address, starting with https://" });
    const next = cleanPayments({ card: body.card, links: body.links, inperson: body.inperson === true, charge: body.charge });
    await write((d) => ({ ...d, payments: next }));
    return json({ ok: true, payments: next });
  }
  return json({ ok: false, error: "Unknown action" }, 400);
};
