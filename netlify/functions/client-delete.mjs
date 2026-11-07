// POST { id }: delete a client, cancelling any agreement still waiting for their signature first.
// Owner only. The rules and why the order matters: netlify/lib/client-delete.mjs.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { DS, getAccessToken, dsGet, isConfigured } from "../lib/docusign-auth.mjs";
import { deleteClientWithAgreements } from "../lib/client-delete.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not signed in" }, 401);
  const { data: u, error: ae } = await db.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
  let body = {}; try { body = await req.json(); } catch (e) {}
  const id = String(body.id || "");
  if (!id) return json({ ok: false, error: "id required" }, 400);
  const { data: row, error } = await db.from("clients").select("id, data").eq("id", id).maybeSingle();
  if (error) return json({ ok: false, error: "Couldn't load that client. Try again." }, 500);
  if (!row) return json({ ok: true, voided: 0, gone: true });   // already deleted: nothing to do

  const r = await deleteClientWithAgreements(row, {
    configured: isConfigured(),
    // DocuSign answers 404 for an envelope it no longer has: nothing left to sign.
    getStatus: async (envId) => {
      try { return (await dsGet(`/envelopes/${encodeURIComponent(envId)}`)).status || ""; }
      catch (e) { if (/docusign 404/.test(String(e && e.message))) return null; throw e; }
    },
    voidEnvelope: async (envId, reason) => {
      const token = await getAccessToken();
      const resp = await fetch(`${DS.basePath}/restapi/v2.1/accounts/${DS.accountId}/envelopes/${encodeURIComponent(envId)}`, {
        method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status: "voided", voidedReason: reason }),
      });
      if (!resp.ok) { const d = await resp.json().catch(() => ({})); throw new Error(`docusign ${resp.status}: ${d.message || d.errorCode || "void refused"}`); }
    },
    deleteRow: async (cid) => { const { error: de } = await db.from("clients").delete().eq("id", cid); if (de) throw new Error(de.message); },
  });
  if (!r.ok) console.error("client-delete:", id, r.error);
  return json(r, r.ok ? 200 : 409);
};
