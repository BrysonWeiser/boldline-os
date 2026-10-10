// Where Stripe and Square send the business back after it approves (or declines) connecting its account.
// GET /pay-connect/done?code=...&state=...   (or ?error=...&state=...)   KB `payments-connect`.
// The signed state says which business and where to send them back: its portal, or the OS.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { OS_BASE } from "../lib/lead-relay.mjs";
import { payKey, readState, cleanPayments } from "../lib/payments.mjs";
import { stripeConnect, squareConnect, saveSquare, loadSquare, squareDisconnect, dropSquare, stripeDisconnect } from "../lib/payments-api.mjs";

const osBase = () => (process.env.OS_BASE_URL || OS_BASE).replace(/\/$/, "");
const redirectUri = () => `${osBase()}/pay-connect/done`;
const go = (url) => new Response(null, { status: 303, headers: { location: url, "cache-control": "no-store" } });

export default async (req) => {
  const u = new URL(req.url);
  const st = readState(payKey(), u.searchParams.get("state"));
  if (!st) return go(`${osBase()}/?pay=expired`);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: row } = await db.from("clients").select("id, data").eq("id", st.clientId).maybeSingle();
  if (!row || !row.data) return go(`${osBase()}/?pay=missing`);
  const back = (result) => st.from === "portal" && row.data.portalToken
    ? `${osBase()}/portal?token=${encodeURIComponent(row.data.portalToken)}&pay=${result}`
    : `${osBase()}/?pay=${result}&client=${encodeURIComponent(row.id)}`;
  const code = u.searchParams.get("code");
  if (!code || u.searchParams.get("error")) return go(back("cancelled"));

  let conn;
  try {
    if (st.provider === "stripe") conn = await stripeConnect(code);
    else { const r = await squareConnect(code, redirectUri()); await saveSquare(db, row.id, r.tokens); conn = { account: r.account, name: r.name, live: r.live }; }
  } catch (e) { console.error("pay connect failed:", e && e.message); return go(back("failed")); }

  // A different account connected before is let go first, so only one can ever take payments.
  const prev = row.data.payConnect;
  try {
    if (prev && prev.provider === "square" && st.provider !== "square") { await squareDisconnect(await loadSquare(db, row.id)); await dropSquare(db, row.id); }
    if (prev && prev.provider === "stripe" && (st.provider !== "stripe" || prev.account !== conn.account)) await stripeDisconnect(prev.account);
  } catch (e) { console.error("old connection:", e && e.message); }

  const { data: fresh } = await db.from("clients").select("data").eq("id", row.id).maybeSingle();
  const d = (fresh && fresh.data) || row.data;
  // Card payments now go through this account; the business's payment links and in person stay as they were.
  const payments = cleanPayments({ card: st.provider }, d.payments || {});
  const { error } = await db.from("clients").update({ data: { ...d, payments,
    payConnect: { provider: st.provider, account: conn.account, name: conn.name || "", live: !!conn.live, connectedAt: new Date().toISOString() } },
    updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) return go(back("failed"));
  return go(back("connected"));
};
