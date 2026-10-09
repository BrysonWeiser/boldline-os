// Unsubscribe from a business's "how did we do" and "time for another" emails (KB `business-emails`).
// GET shows a button and changes nothing (mail apps open links to scan them); the button POSTs. The link is
// signed per business and address, so nobody can take someone else off a list. The page speaks for the
// business, never for BoldLine.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { isOwned } from "../lib/owned.mjs";
import { optOutCheck, EMAIL_RE } from "../lib/biz-email.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (title, msg, form = "") => new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title>
<style>body{margin:0;background:#F4F5F7;color:#111827;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}div{max-width:440px;text-align:center}h1{font-size:21px;margin:0 0 8px}p{margin:0 0 18px;color:#6B7280}button{font:inherit;font-weight:700;padding:13px 22px;border-radius:10px;border:0;background:#111827;color:#fff;cursor:pointer}</style></head>
<body><div><h1>${esc(title)}</h1><p>${esc(msg)}</p>${form}</div></body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export default async (req) => {
  const u = new URL(req.url);
  const b = String(u.searchParams.get("b") || ""), e = String(u.searchParams.get("e") || "").trim().toLowerCase(), s = String(u.searchParams.get("s") || "");
  const key = process.env.OPTOUT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!b || !EMAIL_RE.test(e) || !optOutCheck(key, b, e, s)) return page("This link doesn't work", "It may have been copied incompletely. Reply to any of our emails and we'll take you off the list.");
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows } = await db.from("clients").select("id, data").eq("id", b).limit(1);
  const row = (rows || [])[0];
  if (!row || !isOwned(row.data)) return page("This link doesn't work", "Reply to any of our emails and we'll take you off the list.");
  const name = row.data.name || "us";
  if (req.method !== "POST") return page(`Unsubscribe from ${name}`, `Stop review requests and "book again" emails to ${e}? You'll still get confirmations and reminders for anything you book.`, `<form method="POST"><button type="submit">Unsubscribe</button></form>`);
  const list = (row.data.emailOptOut || []).map((x) => String(x).toLowerCase());
  if (!list.includes(e)) {
    const { error } = await db.from("clients").update({ data: { ...row.data, emailOptOut: [...list, e].slice(-5000) }, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) return page("That didn't go through", "Please try again in a minute, or reply to any of our emails.");
  }
  return page("You're unsubscribed", `${name} won't send ${e} any more of these emails.`);
};
