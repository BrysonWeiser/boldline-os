// Writes one blog article for a client's website (KB `website-builder`, add-ons).
//
// A `-background` function, because a good 700-word article takes longer than a normal function may run.
// Started two ways: by the daily site-blog-run job (with the internal key) when an article is due, or by
// Bryson's "Write one now" in the OS (with his session). The article is published REVIEW_HOURS after it
// is written, so he gets an alert and has two days to read it or hold it.
//
// POST { clientId }   headers: Authorization: Bearer <owner jwt>  OR  x-site-blog-key: <internal key>

import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { dispatchAlert } from "../lib/alerts-shared.mjs";
import { blogActive, nextDue, loadIndex, savePost, uniqueSlug, writePost, supabaseStore, internalKey, REVIEW_HOURS } from "../lib/site-blog.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const when = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Phoenix" });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: "Missing configuration" }, 500);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  let allowed = same(req.headers.get("x-site-blog-key"), internalKey());
  if (!allowed) {
    const a = req.headers.get("authorization") || "";
    const jwt = a.startsWith("Bearer ") ? a.slice(7) : "";
    if (jwt) { const { data, error } = await supabase.auth.getUser(jwt); allowed = !error && !!(data && data.user); }
  }
  if (!allowed) return json({ ok: false, error: "Not authenticated" }, 401);

  let body; try { body = JSON.parse((await req.text()) || "{}"); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  const clientId = String(body.clientId || "");
  const { data: row } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (!row || !row.data) return json({ ok: false, error: "Client not found" }, 404);
  const cl = { ...row.data, id: clientId };
  // 🔴 Only for a client who is paying for a blog on a live site. A button pressed on a stale screen, or a
  // job run twice, never writes for someone who has not bought it or has cancelled.
  if (!blogActive(cl)) return json({ ok: false, error: "This client doesn't have an active blog." }, 409);

  const store = supabaseStore(supabase);
  try {
    const index = await loadIndex(store, clientId);
    const art = await writePost(cl, index.map((p) => p.title), new Anthropic());
    const publishAt = nextDue(cl, index).publishAt;
    const post = { ...art, slug: uniqueSlug(art.title, index), publishAt, held: false, writtenAt: new Date().toISOString() };
    await savePost(store, clientId, post);
    await dispatchAlert({
      severity: "blue",
      title: `New article for ${cl.name}: "${post.title}"`,
      body: `A new blog article for ${cl.name} goes live ${when(publishAt)}. Read it on their Website tab and hold it if anything is off. It publishes by itself otherwise (${REVIEW_HOURS} hours after writing).`,
      smsText: `New article for ${cl.name} goes live ${when(publishAt)}. Check it in the Website tab.`,
    }).catch(() => {});
    return json({ ok: true, slug: post.slug, publishAt });
  } catch (e) {
    console.error("site-blog-write failed:", cl.name, e.message);
    await dispatchAlert({ severity: "yellow", title: `Couldn't write ${cl.name}'s blog article`, body: `The article writer failed: ${String(e.message).slice(0, 200)}. It will try again tomorrow, or press "Write one now" on their Website tab.`, smsText: `Blog article for ${cl.name} failed. Will retry.` }).catch(() => {});
    return json({ ok: false, error: String(e.message || e) }, 500);
  }
};
