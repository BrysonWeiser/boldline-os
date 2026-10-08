// Online booking on a client's own domain: passed straight to the OS, which is the only writer (see
// netlify/functions/book.mjs). If the OS does not answer, the page says to call instead.
import { OS_BASE } from "../../netlify/lib/lead-relay.mjs";

export default async (req) => {
  const u = new URL(req.url);
  const base = process.env.OS_BASE_URL || OS_BASE;
  try {
    const r = await fetch(`${base}/book${u.search}`, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: req.method === "POST" ? await req.text() : undefined,
    });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Online booking is down for a moment. Please call us." }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
};
export const config = { path: "/book" };
