// The unsubscribe link at the bottom of every review-request email. Public: the customer is not
// logged in to anything, the secret token in the link is the only key.
//
// GET shows a page with one button; POST does it. Email security scanners open every link in a
// message, so a GET that unsubscribed would quietly opt people out who never asked. Gmail's one
// tap unsubscribe (RFC 8058) arrives as a POST, which this also handles.
//
// 🔴 AN OPT-OUT COVERS THE ADDRESS FOR THAT CLIENT, NOT JUST THE ONE EMAIL: every waiting or sent
// row for the same person stops, and the add rules refuse them from then on.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { senderName } from "../lib/review-requests.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (title, body, status = 200) => new Response(
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>`
  + `<body style="margin:0;background:#F5F5F4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1F2937">`
  + `<div style="max-width:460px;margin:12vh auto 0;padding:0 18px"><div style="background:#fff;border:1px solid #E7E5E4;border-radius:12px;padding:26px 22px">`
  + `<h1 style="font-size:19px;margin:0 0 10px">${esc(title)}</h1>${body}</div></div></body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

export const handleOptOut = async (req, db, now = Date.now()) => {
  const token = new URL(req.url).searchParams.get("t") || "";
  const row = /^[a-f0-9]{16,64}$/.test(token) ? await db.findByToken(token) : null;
  if (!row) return page("This link is no longer valid", `<p style="font-size:14px;line-height:1.6;margin:0">If you keep getting emails you don't want, reply to one and ask to be removed.</p>`, 404);
  const brand = senderName((await db.client(row.client_id)) || {});
  if (req.method === "POST") {
    await db.optOut(row.client_id, row.email, new Date(now).toISOString());
    return page("You're unsubscribed", `<p style="font-size:14px;line-height:1.6;margin:0">${esc(brand)} won't email you about reviews again.</p>`);
  }
  return page(`Stop review emails from ${brand}?`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 16px">You won't get any more emails from ${esc(brand)} asking for a review.</p>`
    + `<form method="post"><button type="submit" style="padding:11px 20px;border-radius:8px;border:0;background:#1F2937;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Unsubscribe</button></form>`);
};

export default async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return page("Something went wrong", "<p>Please try again later.</p>", 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return handleOptOut(req, {
    findByToken: async (t) => {
      const { data } = await supabase.from("review_requests").select("id, client_id, email").eq("token", t).maybeSingle();
      return data || null;
    },
    client: async (id) => {
      const { data } = await supabase.from("clients").select("data").eq("id", id).maybeSingle();
      return data ? data.data : null;
    },
    optOut: async (clientId, email, at) => {
      // Waiting or sent ones stop outright; the rest just carry the mark the add rules check.
      const a = await supabase.from("review_requests").update({ status: "opted_out", opted_out_at: at })
        .eq("client_id", clientId).eq("email", email).in("status", ["queued", "sent"]);
      const b = await supabase.from("review_requests").update({ opted_out_at: at })
        .eq("client_id", clientId).eq("email", email).is("opted_out_at", null);
      if (a.error || b.error) throw new Error((a.error || b.error).message);
    },
  });
};
