// Demo websites (KB demo-sites), served HERE and never on the OS's address (Bryson, 2026-11-05: "make sure that when I
// send the link that there is no way for the person with the link to be able to access the os"). This host has no OS
// on it: only client websites and these demos. Read-only: GET and HEAD, nothing else.
//
// "They opened it" (the page's one ping, `<demo>/__seen`) is passed straight on to the OS, which records it and sends
// Bryson the push. The OS's address appears only here, server to server, never in anything the visitor receives.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../../netlify/lib/supabase-url.mjs";
import { serveDemoPage, parseDemoPath } from "../../netlify/lib/demo-page.mjs";
import { validToken } from "../../netlify/lib/demo-site.mjs";
import { OS_BASE } from "../../netlify/lib/lead-relay.mjs";

const plain = (status, msg) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${msg}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0C0E;color:#F3F3F1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;text-align:center;padding:24px"><h1 style="font-size:28px;margin:0">${msg}</h1></body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });

export default async (req, { fetchFn = fetch } = {}) => {
  if (req.method !== "GET" && req.method !== "HEAD") return plain(405, "Not allowed");
  const url = new URL(req.url);
  const { token, seg } = parseDemoPath(url);
  if (seg === "__seen") {
    if (validToken(token)) {
      try {
        await fetchFn(`${process.env.OS_BASE_URL || OS_BASE}/.netlify/functions/demo-site?token=${encodeURIComponent(token)}&page=__seen`,
          { headers: { "user-agent": req.headers.get("user-agent") || "" } });
      } catch (e) { console.error("demo open not passed on:", e.message); }
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return plain(503, "Temporarily unavailable");
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const host = String(req.headers.get("x-forwarded-host") || url.host || "").split(",")[0].trim().toLowerCase();
    return await serveDemoPage(supabase, url, host || undefined);
  } catch (e) {
    console.error("demo page failed:", e.message);
    return plain(500, "Something went wrong. Please try again in a moment.");
  }
};
export const config = { path: "/demo/*" };
