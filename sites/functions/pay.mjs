// A customer paying for a booking on a business's own domain: passed straight to the OS, which talks to the
// business's own Stripe or Square (netlify/functions/pay.mjs). The checkout redirect is handed back as it is,
// so the customer goes from the business's own address straight to its payment page.
import { OS_BASE } from "../../netlify/lib/lead-relay.mjs";

export default async (req) => {
  const u = new URL(req.url);
  const base = process.env.OS_BASE_URL || OS_BASE;
  try {
    const r = await fetch(`${base}/pay${u.search}`, { method: req.method === "POST" ? "POST" : "GET", redirect: "manual" });
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) return new Response(null, { status: 303, headers: { location: loc, "cache-control": "no-store" } });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  } catch (e) {
    return new Response("The payment page is down for a moment. Please try again in a minute.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
};
export const config = { path: "/pay" };
