// Niche photo search for ad backgrounds.
//
// Bryson, 2026-09-02: *"what if we can open a real gallery based on whatever niche I put
// of images that would be good backgrounds for the ads and to be able to visually see
// them before I select them"*. The Background photo dropdown only ever listed files
// already in the client's media library, which for the house account is empty, so the
// option existed and had nothing in it.
//
// Two actions:
//   search — ask Pexels for photos matching a niche, hand back thumbnails to look at.
//   save   — copy ONE chosen photo into this client's own media library.
//
// 🔴 WHY "save" COPIES RATHER THAN LINKING, WHICH IS THE WHOLE DESIGN. The creative is
// drawn on a <canvas> and then read back with toBlob(). Drawing an image from another
// origin TAINTS that canvas, and the read back throws a SecurityError — the ad would
// preview perfectly and then fail to download, which is the worst possible place to find
// out. Copying the bytes into our own Supabase bucket makes a chosen photo indistinguishable
// from one Bryson uploaded himself: same bucket, same public URL, same mediaLibrary entry,
// same delete button, and it keeps working if Pexels ever moves the file.
//
// 🔴 THE HOST ALLOW LIST IS A SECURITY CONTROL, NOT TIDINESS. "save" makes this server
// fetch a URL the browser handed it. Without a check on where that URL points, anyone with
// a session could aim it at an internal address and read the response back out of the
// media library. Only Pexels' own image host is accepted, and it is checked on the parsed
// hostname, never with a substring match that "evil.com/images.pexels.com" would satisfy.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const BUCKET = "client-media";
const API = "https://api.pexels.com/v1/search";

// Exact hosts. Checked against url.hostname after parsing, so no path or query can spoof it.
const ALLOWED_HOSTS = new Set(["images.pexels.com"]);

// Pexels caps at 80. 24 fills a phone screen a few times over without a slow first paint.
const PER_PAGE = 24;
const MAX_BYTES = 12 * 1024 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// What actually reads well behind a headline: real work, real hands, real sites. The words
// added here matter more than the niche does — "roofing" alone returns diagrams and stock
// icons, "roofing contractor working" returns photographs of a job in progress.
export const searchTerms = (niche) => {
  const n = String(niche == null ? "" : niche).replace(/\s+/g, " ").trim().toLowerCase();
  if (!n) return "small business owner working";
  // A trade already reads as a person; a product niche does not, so it gets a scene.
  return `${n} professional at work`;
};

export const isAllowedPhotoUrl = (u) => {
  let parsed;
  try { parsed = new URL(String(u || "")); } catch { return false; }
  if (parsed.protocol !== "https:") return false;
  return ALLOWED_HOSTS.has(parsed.hostname);
};

// Pexels hands back a set of pre-rendered sizes. `large2x` is 1880px wide, which is plenty
// for a 1080px creative and a fraction of the original file.
export const shapePhotos = (data) =>
  (Array.isArray(data && data.photos) ? data.photos : [])
    .map((p) => ({
      id: String(p.id || ""),
      thumb: String((p.src && (p.src.medium || p.src.small)) || ""),
      full: String((p.src && (p.src.large2x || p.src.large || p.src.original)) || ""),
      // Pexels' alt text is written by a person and is the only description available, so it
      // is what a screen reader and the saved label both get.
      alt: String(p.alt || "").slice(0, 200),
      credit: String((p.photographer || "")).slice(0, 120),
    }))
    .filter((p) => p.id && p.thumb && isAllowedPhotoUrl(p.full));

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

  const key = process.env.PEXELS_API_KEY;
  // Said in the words Bryson would need, because this message is the entire instruction he
  // gets when the key is missing.
  if (!key) return json({ ok: false, error: "Photo search is not switched on yet. It needs a free Pexels key added in Netlify." }, 400);

  const action = String(body.action || "search");

  if (action === "search") {
    const query = searchTerms(body.niche);
    try {
      const r = await fetch(`${API}?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}&orientation=landscape&size=large`, {
        headers: { Authorization: key },
      });
      if (r.status === 401) return json({ ok: false, error: "Pexels rejected the key. Check it was pasted in full." }, 400);
      if (r.status === 429) return json({ ok: false, error: "Pexels is rate limiting us. Wait a minute and try again." }, 429);
      if (!r.ok) return json({ ok: false, error: `Photo search failed (${r.status}).` }, 502);
      const photos = shapePhotos(await r.json());
      if (!photos.length) return json({ ok: false, error: `No photos came back for "${query}". Try a plainer word.` }, 404);
      return json({ ok: true, query, photos });
    } catch (e) {
      console.error("stock-photos search failed:", String((e && e.message) || e));
      return json({ ok: false, error: "Could not reach the photo library. Try again." }, 502);
    }
  }

  if (action === "save") {
    const clientId = String(body.clientId || "");
    const photoUrl = String(body.photoUrl || "");
    if (!clientId) return json({ ok: false, error: "clientId required" }, 400);
    // 🔴 Checked here, on the value about to be fetched. Validating it anywhere else would
    // be validating a different string than the one that gets used.
    if (!isAllowedPhotoUrl(photoUrl)) return json({ ok: false, error: "That photo address is not one we accept." }, 400);

    const { data: row, error: readErr } = await supabase.from("clients").select("id, data").eq("id", clientId).maybeSingle();
    if (readErr) return json({ ok: false, error: readErr.message }, 500);
    if (!row) return json({ ok: false, error: "No such client." }, 404);

    let bytes, contentType;
    try {
      const img = await fetch(photoUrl);
      if (!img.ok) return json({ ok: false, error: `Could not download that photo (${img.status}).` }, 502);
      contentType = String(img.headers.get("content-type") || "image/jpeg");
      if (!contentType.startsWith("image/")) return json({ ok: false, error: "That address did not return a picture." }, 400);
      bytes = new Uint8Array(await img.arrayBuffer());
    } catch (e) {
      console.error("stock-photos download failed:", String((e && e.message) || e));
      return json({ ok: false, error: "Could not download that photo. Try another." }, 502);
    }
    if (!bytes.length || bytes.length > MAX_BYTES) return json({ ok: false, error: "That photo is too large to save." }, 400);

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const path = `${row.id}/photo/${Date.now()}-stock.${ext}`;
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (upErr) {
      console.error("stock-photos upload failed:", upErr);
      return json({ ok: false, error: "Could not save that photo. Try again." }, 500);
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const entry = {
      url: pub.publicUrl,
      path,
      // 🔴 "photo", the same category an uploaded picture gets. The launch card, the landing
      // page renderer and the Creative Studio all filter on it, so anything else would save
      // the file into a library that nothing can see.
      category: "photo",
      label: (String(body.label || "").trim() || "Stock photo").slice(0, 200),
      uploadedAt: new Date().toISOString(),
      // Kept so a saved photo can be told apart from one of the client's own later.
      source: "pexels",
      credit: String(body.credit || "").slice(0, 120),
    };
    const nextData = { ...row.data, mediaLibrary: [entry, ...((row.data && row.data.mediaLibrary) || [])] };
    const { error: saveErr } = await supabase.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (saveErr) {
      console.error("stock-photos save failed:", saveErr);
      return json({ ok: false, error: "Could not save that photo. Try again." }, 500);
    }
    return json({ ok: true, entry, mediaLibrary: nextData.mediaLibrary });
  }

  return json({ ok: false, error: `Unknown action "${action}"` }, 400);
};
