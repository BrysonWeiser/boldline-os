// Every page of every client website, decided by the address it was asked for (KB website-builder). The
// same renderer, payment gate, preview key and visitor count as the OS, from netlify/functions/site.mjs.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../../netlify/lib/supabase-url.mjs";
import { serveWebsiteOnDomain } from "../../netlify/functions/site.mjs";
import { normalizeHost } from "../../netlify/lib/client-domain.mjs";

const plain = (status, msg) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${msg}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F3F3F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-align:center;padding:24px"><h1 style="font-size:28px;margin:0">${msg}</h1></body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export default async (req) => {
  const url = new URL(req.url);
  const host = normalizeHost(req.headers.get("x-forwarded-host") || req.headers.get("host") || url.hostname);
  // The health check the OS's daily check and uptime watch read. Says nothing about any client.
  if (url.pathname === "/__health") return new Response(JSON.stringify({ ok: true, service: "client-websites" }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "Not allowed");
  // This site's own netlify.app address is not anybody's website.
  if (!host || host.endsWith(".netlify.app")) return plain(404, "Page not found");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return plain(503, "Temporarily unavailable");
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const res = await serveWebsiteOnDomain(supabase, host, url.pathname, url);
    return res || plain(404, "Page not found");
  } catch (e) {
    console.error("client website failed:", host, e.message);
    return plain(500, "Something went wrong. Please try again in a moment.");
  }
};
export const config = { path: "/*", excludedPath: ["/lead", "/site-hit", "/.netlify/*"] };
