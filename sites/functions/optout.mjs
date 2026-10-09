// Unsubscribe on a business's own domain: passed straight to the OS, the only writer (netlify/functions/optout.mjs).
import { OS_BASE } from "../../netlify/lib/lead-relay.mjs";

export default async (req) => {
  const u = new URL(req.url);
  const base = process.env.OS_BASE_URL || OS_BASE;
  try {
    const r = await fetch(`${base}/optout${u.search}`, { method: req.method === "POST" ? "POST" : "GET" });
    return new Response(await r.text(), { status: r.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return new Response("Please try again in a minute, or reply to any of our emails and we'll take you off the list.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
};
export const config = { path: "/optout" };
