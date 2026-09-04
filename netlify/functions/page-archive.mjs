// Keep a copy of a client's landing page exactly as it went live.
//
// Bryson, 2026-09-04: *"What if we have aria take screenshots of published landing pages...
// that way we can use it for content and case studies and examples of our work"* and then
// *"make sure there is a way for me to access the saved page and delete them when I want"*.
//
// 🔴 THE REASON THIS MATTERS MORE THAN A SCREENSHOT: THERE IS NO COPY OF A LANDING PAGE.
// `landing.mjs` rebuilds every page from Supabase on every single request. That is why an
// edit is live the instant it is saved, with no publish step and no cache. It also means the
// page that worked exists ONLY as long as the record behind it is untouched. A client edits
// their headline next month, or churns and the record is cleared, and the version that
// actually produced leads is gone. Not archived. Not recoverable. Gone.
//
// A screenshot is a low-resolution picture of that. The page itself is the thing, and an
// image can always be made from it later.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 AN ARCHIVE IS A PREVIEW, AND A PREVIEW MUST NEVER CHANGE ANYTHING REAL.
//
// This is the standing rule in CLAUDE.md and it bites hard here, because a landing page is
// not inert. The live page carries a submit script pointing at
// `lead-intake?token=<the client's real lead token>`. Archive it verbatim, open it months
// later to show somebody, tap the form to demonstrate it, and a REAL LEAD lands on that
// client's record and is forwarded to their CRM, from a page nobody is running.
//
// So the stored copy is NEUTRALISED at the moment it is written, not at the moment it is
// shown. Neutralising on display would mean the dangerous version is what sits in storage,
// one careless direct link away from being live again. Both ends are covered anyway: the
// viewer also sandboxes the frame.
//
// The visual record is untouched by this. Every pixel is preserved; only the plumbing is cut.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { renderLandingPage } from "./landing.mjs";
import { neutraliseArchive, archiveEntry, ARCHIVE_BUCKET, archivePath } from "../lib/page-archive-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const action = String(body.action || "save");
  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);

  const { data: row, error } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!row) return json({ ok: false, error: "No such client." }, 404);
  const client = row.data || {};
  const archives = Array.isArray(client.pageArchives) ? client.pageArchives : [];

  // ── DELETE ─────────────────────────────────────────────────────────────────
  // 🔴 Bryson asked for this in the same breath as the saving, and it is the half that makes
  // the feature acceptable to a client: whatever we keep, he can remove. The stored file goes
  // FIRST. Clearing the record first and failing on the file would leave a page sitting in
  // storage with nothing in the OS pointing at it, which is the one outcome nobody can find
  // again to fix.
  if (action === "delete") {
    const id = String(body.archiveId || "");
    const hit = archives.find((a) => a && a.id === id);
    if (!hit) return json({ ok: false, error: "That saved page is not there any more." }, 404);
    const { error: rmErr } = await supabase.storage.from(ARCHIVE_BUCKET).remove([hit.path]);
    if (rmErr) return json({ ok: false, error: `Could not delete the saved page: ${rmErr.message}` }, 500);
    const next = { ...client, pageArchives: archives.filter((a) => a && a.id !== id) };
    const { error: wErr } = await supabase.from("clients").update({ data: next }).eq("id", clientId);
    if (wErr) return json({ ok: false, error: wErr.message }, 500);
    return json({ ok: true, archives: next.pageArchives });
  }

  // ── SAVE ───────────────────────────────────────────────────────────────────
  const lp = client.landingPage || {};
  if (!lp.published || !lp.headline) {
    return json({ ok: false, error: "There is nothing to save yet. The page has to be published first." }, 400);
  }

  // 🔴 RENDERED BY THE REAL RENDERER, not a copy of it. A second renderer would drift, and an
  // archive that does not match what the visitor saw is worse than no archive at all.
  let html;
  try { html = renderLandingPage(client); }
  catch (e) { return json({ ok: false, error: `The page could not be built: ${(e && e.message) || e}` }, 500); }

  const entry = archiveEntry({ label: body.label, headline: lp.headline, clientId });
  const safe = neutraliseArchive(html, entry);

  await supabase.storage.createBucket(ARCHIVE_BUCKET, { public: true }).catch(() => {});
  const { error: upErr } = await supabase.storage.from(ARCHIVE_BUCKET)
    .upload(entry.path, new Blob([safe], { type: "text/html" }), { contentType: "text/html", upsert: false });
  if (upErr) return json({ ok: false, error: `Could not save the page: ${upErr.message}` }, 500);

  const { data: pub } = supabase.storage.from(ARCHIVE_BUCKET).getPublicUrl(entry.path);
  const saved = { ...entry, url: (pub && pub.publicUrl) || "", bytes: safe.length };
  // Newest first, so the list reads the way anybody expects a history to read.
  const next = { ...client, pageArchives: [saved, ...archives] };
  const { error: wErr } = await supabase.from("clients").update({ data: next }).eq("id", clientId);
  if (wErr) {
    // The file is written but the record is not. Remove the orphan rather than leave a file
    // nothing points at.
    await supabase.storage.from(ARCHIVE_BUCKET).remove([entry.path]).catch(() => {});
    return json({ ok: false, error: wErr.message }, 500);
  }
  return json({ ok: true, archive: saved, archives: next.pageArchives });
};
