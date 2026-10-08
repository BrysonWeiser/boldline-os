// Results from Bryson's own businesses for boldlinemedia.com (see ../lib/showcase.mjs). Public on
// purpose: aggregates only, only for businesses he switched on, only once they clear the minimums.
// The website asks for this and shows nothing at all when the list is empty.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { showcaseItems } from "../lib/showcase.mjs";

const HEAD = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "public, max-age=900" };

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...HEAD, "access-control-allow-methods": "GET" } });
  try {
    const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await db.from("clients").select("data").eq("data->>owned", "true").limit(50);
    if (error) throw new Error(error.message);
    return new Response(JSON.stringify({ ok: true, items: showcaseItems(data || []) }), { status: 200, headers: HEAD });
  } catch (e) {
    // Nothing to show is the safe failure: the website section stays hidden.
    return new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { ...HEAD, "cache-control": "no-store" } });
  }
};
