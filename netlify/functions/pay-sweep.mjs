// Every 15 minutes: checks the online payments still waiting on a business's own Stripe or Square, so a deposit
// shows as paid even when the customer closed the page before coming back, and keeps each Square connection's
// key fresh (Square's last 30 days). Writes only `payLog` (server-owned). KB `payments-connect`.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { payOf } from "../lib/payments.mjs";
import { checkPaid, freshSquare } from "../lib/payments-api.mjs";

export default async () => {
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await db.from("clients").select("id, data").not("data->payConnect", "is", null);
  if (error) { console.error("pay-sweep:", error.message); return new Response("error", { status: 500 }); }
  let checked = 0, paid = 0;
  for (const row of rows || []) {
    const cl = { ...row.data, id: row.id }, P = payOf(cl);
    if (!P.conn) continue;
    try { if (P.conn.provider === "square") await freshSquare(db, row.id); } catch (e) { console.error("square refresh:", row.id, e && e.message); }
    const since = Date.now() - 14 * 864e5;
    const open = Object.entries(cl.payLog || {}).filter(([, e]) => e && e.status === "open" && e.provider === P.conn.provider && Date.parse(e.createdAt || "") > since);
    for (const [bookingId] of open.slice(0, 40)) {
      checked++;
      try { if (await checkPaid(db, cl, row.id, bookingId)) paid++; } catch (e) { console.error("pay-sweep check:", row.id, bookingId, e && e.message); }
    }
  }
  return new Response(JSON.stringify({ ok: true, checked, paid }), { headers: { "content-type": "application/json" } });
};
