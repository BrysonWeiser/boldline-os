// Where Google sends Bryson back after he lets BoldLine OS manage his Business Profiles (KB google-listing).
// GET /gbp-connect/done?code=...&state=...   (or ?error=...). The key is stored sealed; the OS shows the result.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { OS_BASE } from "../lib/lead-relay.mjs";
import { readState, exchangeCode, saveConn, loadConn, revoke } from "../lib/gbp.mjs";

const osBase = () => (process.env.OS_BASE_URL || OS_BASE).replace(/\/$/, "");
const go = (result) => new Response(null, { status: 303, headers: { location: `${osBase()}/?gbp=${result}`, "cache-control": "no-store" } });

export default async (req) => {
  const u = new URL(req.url);
  if (!readState(u.searchParams.get("state"))) return go("expired");
  const code = u.searchParams.get("code");
  if (!code || u.searchParams.get("error")) return go("cancelled");
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    const conn = await exchangeCode(code, `${osBase()}/gbp-connect/done`);
    const prev = await loadConn(db);
    if (prev && prev.refresh && prev.refresh !== conn.refresh) await revoke(prev);   // one connection at a time
    await saveConn(db, conn);
  } catch (e) { console.error("gbp connect failed:", e && e.message); return go("failed"); }
  return go("connected");
};
