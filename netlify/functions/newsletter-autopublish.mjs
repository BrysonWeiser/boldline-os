// Scheduled newsletter pipeline (mirrors blog-autopublish). Every run:
//   1. Ensures the newest blog post has a companion email draft awaiting review
//      (so there's always one queued, self-healing if you delete it).
//   2. Sends any scheduled emails whose time has arrived — DORMANT until
//      NEWSLETTER_SENDING_ENABLED=1 (they just wait, queued, until then).
// ?test=1 reports what it WOULD do without generating or sending.

import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { getSupabase, ensureCompanionDraft, sendDueNewsletters } from "../lib/newsletter-shared.mjs";

export default withFailureAlert("newsletter-autopublish", async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("newsletter-autopublish aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const supabase = getSupabase();

  if (testMode) {
    const nowISO = new Date().toISOString();
    const { data: due } = await supabase.from("newsletter_emails").select("id").eq("status", "scheduled").lte("scheduled_for", nowISO);
    const { data: drafts } = await supabase.from("newsletter_emails").select("id").eq("status", "scheduled");
    return new Response(JSON.stringify({
      ok: true, test: true,
      sendingEnabled: process.env.NEWSLETTER_SENDING_ENABLED === "1",
      dueNow: (due || []).length, scheduledTotal: (drafts || []).length,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  let created = null;
  try { created = await ensureCompanionDraft(supabase); }
  catch (e) { console.error("newsletter-autopublish: ensureCompanionDraft failed:", e.message); }

  const sendResult = await sendDueNewsletters(supabase);

  console.log(`newsletter-autopublish: created=${created ? created.post_slug : "none"} send=`, sendResult);
  return new Response(JSON.stringify({ ok: true, created: created ? created.post_slug : null, ...sendResult }), { status: 200, headers: { "content-type": "application/json" } });
});
