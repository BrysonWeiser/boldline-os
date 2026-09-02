// Scheduled newsletter pipeline (mirrors blog-autopublish). Every run:
//   1. Ensures the newest blog post has a companion email draft awaiting review
//      (so there's always one queued, self-healing if you delete it).
//   2. Retires any scheduled email more than STALE_AFTER_HOURS past its send time,
//      whether or not sending is on. A weeks-old "read this week's post" email is not
//      news, and without this the whole backlog fires the moment sending is enabled.
//   3. Sends any scheduled email whose time has arrived and is still fresh — DORMANT
//      until NEWSLETTER_SENDING_ENABLED=1 (fresh ones wait, queued, until then).
// ?test=1 reports what it WOULD do without generating or sending.

import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { getSupabase, ensureCompanionDraft, sendDueNewsletters, STALE_AFTER_HOURS } from "../lib/newsletter-shared.mjs";

export default withFailureAlert("newsletter-autopublish", async (req) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("newsletter-autopublish aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const supabase = getSupabase();

  if (testMode) {
    const nowISO = new Date().toISOString();
    const { data: due } = await supabase.from("newsletter_emails").select("id, scheduled_for").eq("status", "scheduled").lte("scheduled_for", nowISO);
    const { data: drafts } = await supabase.from("newsletter_emails").select("id").eq("status", "scheduled");
    // Split what is due into what would actually GO OUT and what is too old to be news.
    // Reporting one "dueNow" number hid the thing worth knowing: how much of the queue is
    // backlog that would fire the moment sending is switched on.
    const cutoff = Date.now() - STALE_AFTER_HOURS * 3600 * 1000;
    const staleCount = (due || []).filter((e) => { const t = Date.parse(e.scheduled_for); return Number.isFinite(t) && t < cutoff; }).length;
    return new Response(JSON.stringify({
      ok: true, test: true,
      sendingEnabled: process.env.NEWSLETTER_SENDING_ENABLED === "1",
      dueNow: (due || []).length, scheduledTotal: (drafts || []).length,
      wouldSend: (due || []).length - staleCount, wouldRetire: staleCount, staleAfterHours: STALE_AFTER_HOURS,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  let created = null;
  try { created = await ensureCompanionDraft(supabase); }
  catch (e) { console.error("newsletter-autopublish: ensureCompanionDraft failed:", e.message); }

  const sendResult = await sendDueNewsletters(supabase);

  // 🔴 RETIRING IS NEVER SILENT, BECAUSE IT MEANS SOMETHING DID NOT GO OUT.
  //
  // The staleness rule was written on 2026-09-02 believing sending was switched OFF, so
  // retiring meant clearing a deliberately dormant backlog and there was nothing to report.
  // Bryson then checked Netlify and NEWSLETTER_SENDING_ENABLED was already "1". Sending has
  // been live all along, which turns the same code into something quite different: with a
  // working sender, an email can only reach 48 hours past its send time if sending has been
  // FAILING for two days. Send errors inside sendDueNewsletters are caught and logged, and
  // withFailureAlert only fires when the whole run throws, so nothing would have said so.
  //
  // The pile of unsent emails used to be the only visible evidence of that. Retiring them
  // quietly would have swept away the evidence and left a broken sender looking healthy,
  // which is worse than the backlog it was meant to prevent. So a retire raises an alert.
  if (sendResult && sendResult.retired > 0) {
    try {
      await dispatchAlert({
        title: `Newsletter: ${sendResult.retired} email${sendResult.retired === 1 ? "" : "s"} retired unsent`,
        body: `${sendResult.retired} scheduled newsletter${sendResult.retired === 1 ? " was" : "s were"} more than 48 hours past ${sendResult.retired === 1 ? "its" : "their"} send time, so ${sendResult.retired === 1 ? "it was" : "they were"} retired instead of sent. Sending is currently ${sendResult.enabled ? "ON" : "OFF"}. If sending is ON this means the sender has been failing, which nothing else reports. Check the Newsletter card on the Website tab and the function logs.`,
        severity: "amber",
      });
    } catch (e) { console.error("newsletter-autopublish: retire alert failed:", e.message); }
  }

  console.log(`newsletter-autopublish: created=${created ? created.post_slug : "none"} send=`, sendResult);
  return new Response(JSON.stringify({ ok: true, created: created ? created.post_slug : null, ...sendResult }), { status: 200, headers: { "content-type": "application/json" } });
});
