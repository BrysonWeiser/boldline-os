import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { gbpReady, loadConn, accessToken, addPhoto, photoAllowed, PHOTO_CATS } from "../lib/gbp.mjs";
import { dispatchAlert } from "../lib/alerts-shared.mjs";

const BUCKET = "client-media";

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const sanitizeFilename = (name) => String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token) return json({ ok: false, error: "Missing token" }, 400);
  if (action !== "sign" && action !== "confirm" && action !== "delete" && action !== "google") return json({ ok: false, error: "Invalid action" }, 400);

  let body;
  try {
    body = JSON.parse(await req.text() || "{}");
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>portalToken", token).maybeSingle();
  if (error) {
    console.error("Media lookup failed:", error);
    return json({ ok: false, error: "lookup failed" }, 500);
  }
  if (!data) return json({ ok: false, error: "Invalid token" }, 404);

  const category = String(body.category || "photo").slice(0, 30);

  if (action === "sign") {
    const filename = sanitizeFilename(body.filename);
    const path = `${data.id}/${category}/${Date.now()}-${filename}`;

    await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const { data: signed, error: signError } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signError) {
      console.error("Media sign failed:", signError);
      return json({ ok: false, error: "sign failed" }, 500);
    }
    return json({ ok: true, signedUrl: signed.signedUrl, path }, 200);
  }

  // "confirm" and "delete" both operate on a path scoped to this client
  const path = String(body.path || "");
  // A photo that came with their demo (KB demo-sites, "their own photos") lives under demo/, not their folder. It is
  // theirs to remove only when it is in THEIR library, so no path elsewhere can be named.
  const fromTheirDemo = path.startsWith("demo/") && !path.includes("..") && ((data.data && data.data.mediaLibrary) || []).some((m) => m && m.path === path);
  if (!path.startsWith(`${data.id}/`) && !fromTheirDemo) return json({ ok: false, error: "Invalid path" }, 400);

  // ── 🔴 A CLIENT PUTS ONE OF THEIR OWN PHOTOS ON THEIR GOOGLE PROFILE (Bryson, 2026-11-25: "make sure it works for clients
  // too so if they want to add a photo to their google profile they can through our bot/system"). Only a photo already in
  // THEIR library, only when their profile is linked in the OS, ten a day at most, and Bryson is told each time.
  // The portal preview can never reach this: its fetch wrapper refuses every POST (KB preview-safety). KB google-listing.
  if (action === "google") {
    const cl = data.data || {};
    const entry = (cl.mediaLibrary || []).find((m) => m && m.path === path);
    if (!entry) return json({ ok: false, error: "That photo isn't in your library." }, 400);
    if (!cl.gbp || !cl.gbp.location) return json({ ok: false, error: "Your Google profile isn't connected with us yet. Ask us and we'll set it up." }, 400);
    if (!photoAllowed(cl, entry.url)) return json({ ok: false, error: "Google takes JPG or PNG photos. Upload it as one of those and try again." }, 400);
    if ((cl.gbpLog || []).some((x) => x && x.type === "photo" && x.url === entry.url)) return json({ ok: true, already: true });
    const today = (cl.gbpLog || []).filter((x) => x && x.type === "photo" && x.by === "client" && Date.now() - Date.parse(x.at || 0) < 864e5).length;
    if (today >= 10) return json({ ok: false, error: "That's ten photos today. Add more tomorrow." }, 429);
    if (!gbpReady()) return json({ ok: false, error: "Google isn't switched on for us yet. Try again later." }, 503);
    if (!(await loadConn(supabaseAdmin))) return json({ ok: false, error: "Our Google connection needs a quick fix. We've been told." }, 503);
    const category = /logo/i.test(String(entry.category || "")) ? "LOGO" : "ADDITIONAL";
    try { await addPhoto(await accessToken(supabaseAdmin), cl.gbp, { url: entry.url, category }); }
    catch (e) { console.error("media google:", e.message); return json({ ok: false, error: "Google didn't take that photo. Try a different one, or ask us." }, 502); }
    const at = new Date().toISOString();
    const { data: fresh } = await supabaseAdmin.from("clients").select("data").eq("id", data.id).maybeSingle();
    const d = (fresh && fresh.data) || cl;
    const phxDate = new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
    await supabaseAdmin.from("clients").update({ data: { ...d,
      gbpLog: [{ type: "photo", url: entry.url, category, at, by: "client" }, ...(d.gbpLog || [])].slice(0, 100),
      commLog: [{ date: phxDate, note: `${d.name} added a photo (${PHOTO_CATS[category]}) to their Google profile from their portal.`, cat: "update", ts: Date.now() }, ...(d.commLog || [])].slice(0, 200) },
      updated_at: at }).eq("id", data.id);
    try { await dispatchAlert({ severity: "blue", title: `${d.name} added a photo to their Google profile`, body: `${d.name} sent "${entry.label || "a photo"}" to their Google profile from their portal. It shows on Google within about a day.\n\n${entry.url}` }); } catch (e) {}
    return json({ ok: true }, 200);
  }

  if (action === "delete") {
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    if (removeError) console.error("Media storage remove failed (entry still unlinked):", removeError);
    const client = data.data;
    const nextData = { ...client, mediaLibrary: (client.mediaLibrary || []).filter((m) => m.path !== path) };
    const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updateError) {
      console.error("Media delete save failed:", updateError);
      return json({ ok: false, error: "save failed" }, 500);
    }
    return json({ ok: true, mediaLibrary: nextData.mediaLibrary }, 200);
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const entry = {
    url: pub.publicUrl,
    path,
    category,
    label: String(body.label || "file").slice(0, 200),
    uploadedAt: new Date().toISOString(),
    // 🔴 WHICH SET THIS FILE BELONGS TO. The Creative Studio saves one design at four
    // placement sizes in a single press, and without this the only thing an ad could say was
    // "newest", so a second angle made later silently took over a running ad. Optional: an
    // uploaded photo has no set and simply omits it.
    ...(body.group ? { group: String(body.group).slice(0, 120) } : {}),
    ...(body.groupLabel ? { groupLabel: String(body.groupLabel).slice(0, 120) } : {}),
    // The pixel size, so the sizes in a set can be ordered without parsing the filename.
    ...(Number(body.w) > 0 ? { w: Number(body.w) } : {}),
    ...(Number(body.h) > 0 ? { h: Number(body.h) } : {}),
  };

  const client = data.data;
  const nextData = { ...client, mediaLibrary: [entry, ...(client.mediaLibrary || [])] };
  const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
  if (updateError) {
    console.error("Media save failed:", updateError);
    return json({ ok: false, error: "save failed" }, 500);
  }

  return json({ ok: true, mediaLibrary: nextData.mediaLibrary }, 200);
};
