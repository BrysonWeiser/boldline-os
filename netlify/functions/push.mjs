// Push subscription + VAPID-key endpoint for the OS PWA (Phase 2). Modern-runtime
// function (export default → no 4KB AWS-Lambda env-var cap; see netlify-lambda-4kb-limit).
//
// The browser flow: GET ?action=key to fetch the public VAPID key, subscribe via the
// service worker, then POST ?action=subscribe with the subscription to store it.
// ?action=test lets the owner verify delivery from the OS UI once configured.

import { getVapidPublicKey, pushConfigured, saveSubscription, deleteSubscription, sendPushToAll, listSubscriptions } from "../lib/push-shared.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const action = new URL(req.url).searchParams.get("action") || "";

  // Public VAPID key for pushManager.subscribe(). Non-secret by design; served at
  // runtime so no VAPID value is ever committed to the repo.
  if (req.method === "GET" && action === "key") {
    if (!pushConfigured()) return json({ ok: true, configured: false });
    return json({ ok: true, configured: true, publicKey: getVapidPublicKey() });
  }

  // Non-sensitive diagnostic: how many devices are subscribed + which push service
  // + whether each has encryption keys. No endpoint token or key values are exposed.
  if (req.method === "GET" && action === "debug") {
    if (!pushConfigured()) return json({ ok: false, error: "not configured" });
    try {
      const subs = await listSubscriptions();
      const info = subs.map((r) => {
        const s = r.subscription || {};
        let host = "?", tail = "";
        try { host = new URL(s.endpoint).host; tail = String(s.endpoint).slice(-8); } catch {}
        return { host, tail, hasKeys: !!(s.keys && s.keys.p256dh && s.keys.auth), exp: s.expirationTime || null };
      });
      return json({ ok: true, count: subs.length, subs: info });
    } catch (e) { return json({ ok: false, error: String((e && e.message) || e) }); }
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

    if (action === "subscribe") {
      if (!pushConfigured()) return json({ ok: false, error: "push not configured (missing VAPID env vars)" }, 503);
      try { await saveSubscription(body && body.subscription); return json({ ok: true }); }
      catch (e) { return json({ ok: false, error: String((e && e.message) || e) }, 500); }
    }

    if (action === "unsubscribe") {
      try { await deleteSubscription(body && body.endpoint); return json({ ok: true }); }
      catch (e) { return json({ ok: false, error: String((e && e.message) || e) }, 500); }
    }

    if (action === "test") {
      if (!pushConfigured()) return json({ ok: false, error: "push not configured" }, 503);
      const result = await sendPushToAll({
        title: "BoldLine OS test 🔔",
        body: "Push is working — you'll get OS alerts here.",
        severity: "yellow",
        url: "/",
      });
      const delivered = (result.sent || 0) > 0;
      return json({ ok: delivered, result, ...(delivered ? {} : { error: result.skipped === "no subscriptions" ? "This device isn't subscribed yet." : "No notification was delivered." }) });
    }
  }

  return json({ ok: false, error: "unknown action" }, 400);
};
