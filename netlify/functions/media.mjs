import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const BUCKET = "client-media";

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const sanitizeFilename = (name) => String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token) return json({ ok: false, error: "Missing token" }, 400);
  if (action !== "sign" && action !== "confirm" && action !== "delete") return json({ ok: false, error: "Invalid action" }, 400);

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
  if (!path.startsWith(`${data.id}/`)) return json({ ok: false, error: "Invalid path" }, 400);

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
