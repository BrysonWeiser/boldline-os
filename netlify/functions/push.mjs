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

    // TEMPORARY one-shot cleanup: wipe every stored subscription so the owner can
    // re-subscribe once from the installed app for a single clean device. Remove after use.
    if (action === "reset") {
      try {
        const subs = await listSubscriptions();
        for (const r of subs) await deleteSubscription(r.subscription && r.subscription.endpoint);
        return json({ ok: true, deleted: subs.length });
      } catch (e) { return json({ ok: false, error: String((e && e.message) || e) }, 500); }
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
