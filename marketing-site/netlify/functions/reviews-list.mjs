// Serves APPROVED reviews to the public marketing site (the #reviews section
// fetches this on load and renders the testimonials). Service-role read that
// returns only status='approved' — the pending/rejected ones and the reviewer's
// email are never exposed. Fail-soft: any error -> empty list, so the section just
// hides rather than breaking the page. Short cache so approvals show up quickly.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });

export default async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: true, reviews: [] });
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("reviews")
      .select("name,business,rating,body,created_at")
      .eq("status", "approved")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return json({ ok: true, reviews: data || [] });
  } catch (e) {
    console.error("reviews-list failed:", e && e.message);
    return json({ ok: true, reviews: [] });
  }
};
