// The view-only business portal for one of Bryson's own businesses (see ../lib/biz-portal.mjs).
// GET /biz?t=<token>          the page
// GET /biz?t=<token>&data=1   the same data as JSON, for the page's own refresh
// 🔴 GET ONLY. There is no write path here at all, which is what makes the page view only: hiding buttons
// would not stop someone holding the link from sending a request, a missing handler does.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { portalOn, portalData, renderBizPortal, portalOffPage } from "../lib/biz-portal.mjs";
import { withPayStatus } from "../lib/payments.mjs";

const HEAD = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "referrer-policy": "no-referrer" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...HEAD } });
const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...HEAD } });
const TOKEN_RE = /^[0-9a-f-]{32,64}$/i;

export default async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return json({ ok: false, error: "This page is view only." }, 405);
  const url = new URL(req.url);
  const token = String(url.searchParams.get("t") || "");
  const wantData = url.searchParams.get("data") === "1";
  const off = () => (wantData ? json({ ok: false, error: "This link is turned off." }, 404) : html(portalOffPage(), 404));
  if (!TOKEN_RE.test(token)) return off();
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from("clients").select("id, data").eq("data->portal->>token", token).limit(2);
  if (error) return wantData ? json({ ok: false, error: "Could not load. Try again in a minute." }, 500) : html(portalOffPage(), 500);
  const row = (data || []).find((r) => r && r.data && r.data.portal && r.data.portal.token === token);
  if (!row || !portalOn(row.data)) return off();
  const base = process.env.URL || url.origin;
  // Deposits paid online through the business's own Stripe or Square show as paid (KB payments-connect).
  const cl = withPayStatus(row.data);
  return wantData ? json({ ok: true, data: portalData(cl, { base }) }) : html(renderBizPortal(cl, { token, base }));
};
