// The contact form on a client's website, when the website is served from its own Netlify site (KB
// `website-builder`, "Client websites have their own home").
//
// 🔴 A LEAD MUST NEVER BE LOST BECAUSE THE OS IS DOWN. The form posts to /lead on the client's own address.
// The websites site passes it to the OS's lead intake (where the click id, the alerts, the auto-reply and
// the CRM forward all live). If the OS does not answer, or answers with a server error, the enquiry is
// written to a private storage queue and the visitor still sees "thanks"; the OS's lead-queue-sweep
// delivers it the moment the OS is back. A 4xx (a bad token) is the OS's real answer and is passed back.
//
// Pure apart from what is passed in, so the relay and the queue are both testable.

export const QUEUE_BUCKET = "lead-queue";
export const OS_BASE = "https://os.boldlinemedia.com";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "Content-Type" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

// A private Supabase storage folder as { write, read, list, remove }.
export const queueStore = (supabase) => ({
  async write(path, obj) {
    await supabase.storage.createBucket(QUEUE_BUCKET, { public: false }).catch(() => {});
    const { error } = await supabase.storage.from(QUEUE_BUCKET).upload(path, Buffer.from(JSON.stringify(obj)), { contentType: "application/json", upsert: true });
    if (error) throw new Error(error.message);
  },
  async read(path) {
    const { data, error } = await supabase.storage.from(QUEUE_BUCKET).download(path);
    if (error || !data) return null;
    try { return JSON.parse(await data.text()); } catch { return null; }
  },
  async list(dir) {
    const { data, error } = await supabase.storage.from(QUEUE_BUCKET).list(dir, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(error.message);
    return (data || []).filter((f) => f && f.name && f.name.endsWith(".json")).map((f) => `${dir}/${f.name}`);
  },
  async remove(path) { await supabase.storage.from(QUEUE_BUCKET).remove([path]); },
});

export async function relayLead(req, { fetchFn, store, osBase = OS_BASE, now = () => new Date() }) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const token = String(new URL(req.url).searchParams.get("token") || "");
  if (!/^[A-Za-z0-9-]{8,100}$/.test(token)) return json({ ok: false, error: "Missing token" }, 400);
  const body = (await req.text()).slice(0, 20000);
  const contentType = req.headers.get("content-type") || "application/json";
  try {
    const r = await fetchFn(`${osBase}/lead?token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "content-type": contentType }, body, signal: AbortSignal.timeout(9000),
    });
    // The OS answered for real (saved it, or rejected it for a reason a retry would not fix).
    if (r.status < 500) return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });
  } catch { /* no answer: keep it below */ }
  const at = now();
  const id = `${at.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    await store.write(`queue/${id}.json`, { token, body, contentType, at: at.toISOString(), attempts: 0 });
  } catch (e) {
    console.error("lead relay: could not queue a lead:", e.message);
    return json({ ok: false, error: "Something went wrong. Please try again in a minute." }, 503);
  }
  return json({ ok: true, queued: true });
}

// The OS side: deliver queued enquiries through the real lead intake. `deliver(entry)` returns the
// intake's status code (or throws). Delivered and genuinely-rejected ones leave the queue; one that keeps
// failing is set aside after three tries and Bryson is told, with the enquiry in the alert so nothing is lost.
export const MAX_TRIES = 3;
export async function sweepQueue({ store, deliver, alert }) {
  const out = { delivered: 0, rejected: 0, retry: 0, parked: 0 };
  for (const path of await store.list("queue")) {
    const e = await store.read(path);
    if (!e) { await store.remove(path); continue; }
    let status = 0;
    try { status = await deliver(e); } catch (err) { status = 0; }
    if (status >= 200 && status < 300) { await store.remove(path); out.delivered++; continue; }
    if (status >= 400 && status < 500) {
      await store.write(path.replace(/^queue\//, "failed/"), { ...e, status }); await store.remove(path); out.rejected++;
      await alert({ severity: "yellow", title: "A website enquiry was refused", body: `An enquiry kept while the OS was down was refused when delivered (status ${status}). It is saved, here it is:\n\n${String(e.body).slice(0, 1500)}`, smsText: "A queued website enquiry was refused. Check your alerts." }).catch(() => {});
      continue;
    }
    const attempts = (e.attempts || 0) + 1;
    if (attempts >= MAX_TRIES) {
      await store.write(path.replace(/^queue\//, "failed/"), { ...e, attempts }); await store.remove(path); out.parked++;
      await alert({ severity: "red", title: "A website enquiry could not be delivered", body: `A client's website enquiry from ${e.at} could not be delivered after ${attempts} tries. It is saved, here it is, so nobody is lost:\n\n${String(e.body).slice(0, 1500)}`, smsText: "A website enquiry could not be delivered. Check your alerts now." }).catch(() => {});
    } else { await store.write(path, { ...e, attempts }); out.retry++; }
  }
  return out;
}
