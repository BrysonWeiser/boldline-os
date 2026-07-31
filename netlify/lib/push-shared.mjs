// Web Push channel for BoldLine OS alerts — Phase 2 of the PWA (Bryson wants OS
// alerts to hit his phone like a native app). This is the SEND side: browser push
// subscriptions are stored in Supabase, and encrypted Web Push messages are
// delivered to every subscribed device. It's wired into dispatchAlert as a third
// fail-soft channel alongside email + SMS, so EVERY major-issue alert reaches the
// phone automatically — no per-caller changes needed.
//
// Config: VAPID keys live in Netlify env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
// The public key is served to the browser at runtime by the push function (never
// committed). Subscriptions live in the service-role-only `push_subscriptions`
// table (RLS on, no policies → no anon access; only these functions touch it).

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./report-shared.mjs";

// The VAPID "subject" is a required contact the push service can use to reach the
// sender. The public OS site URL is fine and stable (no secret, no extra env var).
const VAPID_SUBJECT = "https://boldlinemedia.netlify.app";

export const pushConfigured = () =>
  !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Env values sometimes arrive with the key NAME accidentally pasted in front of the
// value (Netlify's value field), or with surrounding whitespace/quotes. Normalize so
// a "VAPID_PUBLIC_KEY BAbSh…" paste still yields the real key: drop a leading label,
// strip quotes, and take the trailing token (VAPID keys never contain whitespace).
const cleanKey = (v, name) => {
  if (!v) return "";
  let s = String(v).trim().replace(/^['"]|['"]$/g, "").trim();
  s = s.replace(new RegExp("^" + name + "\\s*[=:]?\\s*", "i"), "").trim();
  const parts = s.split(/\s+/);
  return parts[parts.length - 1].replace(/^['"]|['"]$/g, "");
};

export const getVapidPublicKey = () => cleanKey(process.env.VAPID_PUBLIC_KEY, "VAPID_PUBLIC_KEY");

let vapidReady = false;
const ensureVapid = () => {
  if (vapidReady) return;
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    cleanKey(process.env.VAPID_PUBLIC_KEY, "VAPID_PUBLIC_KEY"),
    cleanKey(process.env.VAPID_PRIVATE_KEY, "VAPID_PRIVATE_KEY"),
  );
  vapidReady = true;
};

const admin = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Store (or refresh) a browser subscription, keyed by its unique endpoint so a
// re-subscribe from the same device updates in place instead of duplicating.
export const saveSubscription = async (subscription) => {
  if (!subscription || !subscription.endpoint) throw new Error("invalid subscription");
  const { error } = await admin()
    .from("push_subscriptions")
    .upsert({ endpoint: subscription.endpoint, subscription, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) throw error;
};

export const deleteSubscription = async (endpoint) => {
  if (!endpoint) return;
  await admin().from("push_subscriptions").delete().eq("endpoint", endpoint);
};

export const listSubscriptions = async () => {
  const { data, error } = await admin().from("push_subscriptions").select("endpoint, subscription");
  if (error) throw error;
  return data || [];
};

// Send one Web Push to every subscribed device. Fail-soft: a single bad endpoint
// never blocks the others; expired ones (404/410 from the push service) are pruned
// so the list self-cleans. Returns { sent, pruned, failed } counts; never throws.
export const sendPushToAll = async ({ title, body = "", severity = "red", url = "/" }) => {
  const out = { sent: 0, pruned: 0, failed: 0 };
  if (!pushConfigured()) { out.skipped = "push not configured"; return out; }

  let subs;
  try { ensureVapid(); subs = await listSubscriptions(); }
  catch (e) { console.error("sendPushToAll: setup/load failed:", e.message); out.error = e.message; return out; }
  if (!subs.length) { out.skipped = "no subscriptions"; return out; }

  const payload = JSON.stringify({ title, body, severity, url });
  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload, { TTL: 3600 });
      out.sent++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        out.pruned++;
        try { await deleteSubscription(row.endpoint); } catch {}
      } else {
        out.failed++;
        console.error("sendPushToAll: send failed:", code, e && e.message);
      }
    }
  }));
  return out;
};
