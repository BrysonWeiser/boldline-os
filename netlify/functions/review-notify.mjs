// Phone-push alert for a new website review. The review form lives on the
// marketing site, but the Web Push system lives here on the OS site — so
// review-submit.mjs (marketing) fires a best-effort, secret-gated POST here and
// this pushes to Bryson's installed app / subscribed devices. Reuses the shared
// AUDIT_TRIGGER_SECRET (set on both sites for the Lead-Leak bot) — no new env var.
// Fail-soft: no VAPID / no subscriptions -> harmless no-op (the email alert from
// review-submit still goes out regardless).

import { sendPushToAll } from "../lib/push-shared.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const secret = process.env.AUDIT_TRIGGER_SECRET;
  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
  if (!secret || String(body.secret || "") !== secret) return json({ ok: false, error: "Unauthorized" }, 401);

  const who = [body.name, body.business].filter((v) => v && String(v).trim()).join(" · ") || "Someone";
  const rating = Math.max(0, Math.min(5, Math.round(Number(body.rating) || 0)));

  const push = await sendPushToAll({
    title: "New review to approve",
    body: `${who} left a ${rating ? rating + "-star " : ""}review — approve it in the OS Website tab.`,
    severity: "yellow",
    url: "/",
  });
  return json({ ok: true, push });
};
