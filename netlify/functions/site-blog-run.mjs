// Daily: which clients are owed a blog article, and start the writer for each (KB `website-builder`).
//
// Scheduled functions may only run for a short time, and writing an article takes longer, so this job
// only DECIDES and then hands each client to site-blog-write-background, which has fifteen minutes.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { blogActive, nextDue, loadIndex, supabaseStore, internalKey } from "../lib/site-blog.mjs";

// Pure: from the clients and their article lists, the ones to write for now.
export function dueClients(rows, indexes, now = Date.now()) {
  return (rows || []).map((r) => ({ id: r.id, cl: { ...(r.data || {}), id: r.id } }))
    .filter(({ cl }) => blogActive(cl))
    .filter(({ id, cl }) => nextDue(cl, indexes[id] || [], now).due)
    .map(({ id, cl }) => ({ id, name: cl.name || id }));
}

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 200 });
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const rows = await loadAllClients(supabase, "site-blog-run");
  const store = supabaseStore(supabase);
  const indexes = {};
  for (const r of rows) { const cl = { ...(r.data || {}), id: r.id }; if (blogActive(cl)) indexes[r.id] = await loadIndex(store, r.id); }
  const due = dueClients(rows, indexes);
  const base = String(process.env.URL || "").replace(/\/$/, "");
  let started = 0;
  for (const d of due) {
    try {
      const r = await fetch(`${base}/.netlify/functions/site-blog-write-background`, { method: "POST", headers: { "content-type": "application/json", "x-site-blog-key": internalKey() }, body: JSON.stringify({ clientId: d.id }) });
      if (r.status === 202 || r.ok) started++;
    } catch (e) { console.error("site-blog-run: could not start writer for", d.name, e.message); }
  }
  const line = `site-blog-run: ${due.length} due, ${started} started`;
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("site-blog-run", handler);
