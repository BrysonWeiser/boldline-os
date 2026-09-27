// Daily billing enforcement for BoldLine Media — runs on a Netlify schedule.
//
// Automates the payment terms of the client Agreement (§3.4):
//   1. Syncs each billed client's subscription + oldest unpaid invoice from
//      Stripe (webhook-independent truth) and stores days-late on the client.
//   2. Applies the late-payment terms THIS CLIENT SIGNED (late-payment.mjs decides which):
//      • terms v6+: 3 days past due → ONE $50 late fee (pending invoice item) and a PAUSE:
//        their live campaigns are paused and their landing page goes offline. Nothing is ever
//        deleted, and exactly what was paused is recorded so paying switches back on that and
//        only that. 10 days past due → Bryson is told he MAY end the contract. Never automatic.
//      • terms v1-v5: after 10 days past due, late interest at 1.5%/month (pro-rated daily) as
//        ONE pending Stripe invoice item per overdue invoice, which Stripe adds to the client's
//        next monthly invoice, exactly as those Agreements authorize. No pause, no fee.
//   3. Emails the owner on state changes: payment newly late, interest started
//      accruing, and payment recovered. The OS alert system (getAlerts) reads
//      the stored billingLate data for the in-app red/yellow alerts.
//   4. Refreshes each active client's next-invoice date (billingNextCharge) and,
//      once per cycle, fires a review reminder ~7 days before the invoice
//      auto-charges IF there are undecided leads to review (so the good ones ride
//      that same bundled monthly invoice). Fires via dispatchAlert (push + email).
//   5. Auto-sends the CLIENT the branded Renewal Reminder email once, ~30 days
//      before contractEnd (idempotent via cl.emailAuto.renewalForEnd).
//
// Charges the management fee side ONLY — never ad spend (hard business rule).
//
// Required env vars (already on the OS site): STRIPE_SECRET_KEY,
// SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, REPORTS_FROM_EMAIL, OWNER_EMAIL.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, sendSMS } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { autoSendClientEmail } from "../lib/client-email-auto.mjs";
import { latePolicyFor, interestFor, lateStage, isBillingPaused } from "../lib/late-payment.mjs";
import { pauseClientAds, resumeClientAds } from "../lib/billing-pause.mjs";

const SK = process.env.STRIPE_SECRET_KEY;
// Interest starts after day 10 past due on v1-v5 agreements (Agreement §3.4). BILLING_GRACE_DAYS
// exists ONLY so test mode can shorten that wait (set 0, test, then REMOVE it). It does not
// touch the v6 three-day pause, which is a contract term and not a tuning knob.
const GRACE_DAYS = process.env.BILLING_GRACE_DAYS != null ? Number(process.env.BILLING_GRACE_DAYS) : 10;

async function stripe(path, { method = "POST", body } = {}) {
  const opts = { method, headers: { authorization: `Bearer ${SK}` } };
  if (body) {
    opts.headers["content-type"] = "application/x-www-form-urlencoded";
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) if (v !== undefined && v !== null) p.append(k, String(v));
    opts.body = p.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data.error && data.error.message) || `Stripe ${res.status}`);
    e.detail = data.error || data;
    throw e;
  }
  return data;
}

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const ownerEmail = async (subject, lines) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) return;
  try {
    await sendEmail({
      to: process.env.OWNER_EMAIL,
      subject,
      html: `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#111">${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join("")}<p style="margin-top:14px;font-size:11px;color:#888">Automated billing watch — BoldLine OS. Open the client's Contract tab for actions.</p></div>`,
    });
  } catch (e) { console.error("billing-watch: owner email failed:", e.message); }
};

export default withFailureAlert("billing-watch", async () => {
  if (!SK || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("billing-watch aborted: STRIPE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing config", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await supabase.from("clients").select("id, data");
  if (error) { console.error("billing-watch: clients load failed:", error.message); return new Response("db error", { status: 200 }); }

  let checked = 0, updated = 0;
  for (const row of rows || []) {
    const cl = row.data || {};
    // 🔴 "card_on_file" BELONGS HERE. A results-only client has no subscription, but they
    // absolutely have invoices — one per approved batch of qualified leads — and leaving
    // them out meant an unpaid lead invoice was never noticed, never chased and never
    // charged interest. Their money is no less real for arriving without a subscription.
    if (!cl.stripeCustomerId || !["active", "card_on_file", "past_due", "awaiting_payment"].includes(cl.billingStatus || "")) continue;
    checked++;
    const prevStatus = cl.billingStatus;
    const policy = latePolicyFor(cl, { legacyGrace: GRACE_DAYS });
    const patch = {};
    try {
      // Oldest unpaid (open) invoice = the overdue anchor.
      const inv = await stripe(`invoices?customer=${encodeURIComponent(cl.stripeCustomerId)}&status=open&limit=10`, { method: "GET" });
      const open = (inv.data || []).sort((a, b) => (a.due_date || a.created) - (b.due_date || b.created));
      const oldest = open[0] || null;
      const prev = cl.billingLate || {};
      let next = null;

      if (oldest) {
        const dueTs = (oldest.due_date || oldest.created) * 1000;
        const daysLate = Math.max(0, Math.floor((Date.now() - dueTs) / 864e5));
        const overdue = (oldest.amount_remaining != null ? oldest.amount_remaining : oldest.amount_due) / 100;
        // Interest only on the old terms (1.5%/mo after their grace). Zero under v6.
        const interest = interestFor(policy, overdue, daysLate);
        const stage = lateStage(policy, daysLate);
        const sameInv = prev.invoiceId === oldest.id;

        next = { days: daysLate, amountDue: overdue, interest, invoiceId: oldest.id, itemId: sameInv ? prev.itemId : null,
          policy: policy.kind, termsVersion: policy.version, pauseAfter: policy.pauseAfter, endAfter: policy.endAfter,
          lateFee: sameInv ? (prev.lateFee || 0) : 0, lateFeeItemId: sameInv ? (prev.lateFeeItemId || null) : null,
          canEnd: stage.canEnd };

        // ── v6: ONE flat late fee per overdue invoice, on day three ──
        // Once, never daily: the clause says "applies once to each amount". Recorded against the
        // invoice id so a second overdue invoice can carry its own, and a re-run cannot add two.
        if (stage.fee && !next.lateFeeItemId) {
          const item = await stripe("invoiceitems", { body: { customer: cl.stripeCustomerId, amount: Math.round(policy.lateFee * 100), currency: "usd",
            description: `Late fee on ${money(overdue)} unpaid ${daysLate} days (Agreement section 3.4(b))` } });
          next.lateFeeItemId = item.id;
          next.lateFee = policy.lateFee;
        }

        // ── v6: PAUSE on day three. Campaigns paused, landing page offline, nothing deleted ──
        if (stage.pause && !isBillingPaused(cl) && !cl.internal) {
          const r = await pauseClientAds(cl);
          patch.billingPause = { at: new Date().toISOString(), invoiceId: oldest.id, paused: r.paused, failed: r.failed };
          await dispatchAlert({
            title: `${cl.name}: paused for non-payment (${daysLate} days late)`,
            body: `${cl.name} has ${money(overdue)} unpaid, ${daysLate} days past due. Under their contract their service is now paused: `
              + `${r.paused.length} campaign${r.paused.length !== 1 ? "s" : ""} paused and their landing page taken offline. Nothing was deleted. `
              + `A ${money(policy.lateFee)} late fee rides their next invoice. The moment they pay, it all switches back on by itself.`
              + (r.failed.length ? `\n\nCould NOT pause: ${r.failed.map((f) => f.name || f.p).join(", ")} (${r.failed[0].error}). Pause those by hand so their money stops spending on a page that is offline.` : ""),
            severity: "red",
            smsText: `BoldLine: ${cl.name} paused for non-payment (${money(overdue)}, ${daysLate}d late).${r.failed.length ? ` ${r.failed.length} campaign(s) need pausing by hand.` : ""}`,
          });
        }

        // ── v6: day ten. Tell Bryson he MAY end it. Nothing here ends it ──
        if (stage.canEnd && !prev.canEnd) {
          await dispatchAlert({
            title: `${cl.name}: ${daysLate} days unpaid, you can end the contract`,
            body: `${cl.name} still owes ${money(overdue)}, now ${daysLate} days past due. Their contract lets you end it for non-payment, and everything they owe becomes due. `
              + `Nothing happens unless you do it: open ${cl.name} in the OS, Contract tab, Early termination. If you would rather give them more time, do nothing and they stay paused.`,
            severity: "red",
            smsText: `BoldLine: ${cl.name} is ${daysLate} days unpaid. You can now end the contract (Contract tab). Nothing happens unless you do.`,
          });
        }

        // Maintain ONE pending invoice item carrying the accrued interest; it is
        // swept into the client's next invoice by Stripe automatically (§3.4).
        if (interest > 0) {
          const desc = `Late payment interest — 1.5%/mo on ${money(overdue)} overdue (${daysLate} days late, Agreement Fees and Payment section)`;
          if (next.itemId) {
            try { await stripe(`invoiceitems/${encodeURIComponent(next.itemId)}`, { body: { amount: Math.round(interest * 100), description: desc } }); }
            catch { next.itemId = null; } // item consumed by an invoice — recreate below
          }
          if (!next.itemId) {
            const item = await stripe("invoiceitems", { body: { customer: cl.stripeCustomerId, amount: Math.round(interest * 100), currency: "usd", description: desc } });
            next.itemId = item.id;
          }
        }

        // Owner notifications on state transitions only (no daily spam).
        // Payment failure is a "major issue" — also fire an SMS (in-app is
        // already covered by getAlerts reading billingLate).
        if (!prev.days && daysLate > 0) {
          await ownerEmail(`⚠️ ${cl.name}: payment failed — ${money(overdue)} overdue`,
            [`<strong>${cl.name}</strong> has an unpaid invoice of <strong>${money(overdue)}</strong>, now ${daysLate} day(s) past due.`,
             policy.kind === "pause"
               ? `Stripe retries automatically, and they have been emailed. If it is still unpaid on day ${policy.pauseAfter}, their campaigns pause, their landing page goes offline and a ${money(policy.lateFee)} late fee is added, all automatically. Paying switches it back on.`
               : `Stripe retries automatically. Interest (1.5%/mo) starts after day ${GRACE_DAYS}, and services may be suspended per the Agreement (their contract predates the three-day pause, so nothing pauses automatically).`]);
          try { await sendSMS({ to: process.env.OWNER_PHONE, body: `BoldLine ALERT — ${cl.name}: payment failed, ${money(overdue)} overdue (${daysLate}d late).` }); }
          catch (e) { console.error("billing-watch: SMS failed:", e.message); }
        } else if ((prev.interest || 0) === 0 && interest > 0) {
          await ownerEmail(`🔴 ${cl.name}: late interest now accruing (${money(overdue)} overdue, ${daysLate} days)`,
            [`<strong>${cl.name}</strong> is past the ${GRACE_DAYS}-day grace period. Late interest of <strong>${money(interest)}</strong> has been added as a pending line on their next invoice and will keep accruing daily.`,
             `Consider pausing campaigns per the suspension clause if this continues.`]);
        }
        if (cl.billingStatus !== "past_due") cl.billingStatus = "past_due";
      } else {
        // Nothing unpaid. Lift a late-payment pause the webhook has not already lifted, switching
        // back on exactly the campaigns the pause recorded and nothing else.
        if (isBillingPaused(cl)) {
          const r = await resumeClientAds(cl, cl.billingPause);
          patch.billingPause = { ...cl.billingPause, resumedAt: new Date().toISOString(), resumed: r.resumed.length, resumeFailed: r.failed };
          if (r.failed.length) await dispatchAlert({
            title: `${cl.name}: paid, but some campaigns did not switch back on`,
            body: `${cl.name} is paid up and their landing page is back, but these could not be switched back on: ${r.failed.map((f) => f.name || f.p).join(", ")}. Turn them on by hand.`,
            severity: "red", smsText: `BoldLine: ${cl.name} paid, ${r.failed.length} campaign(s) need switching back on by hand.`,
          });
        }
        // If they WERE late, report the recovery and clear state.
        if (prev.days > 0) {
          await ownerEmail(`✅ ${cl.name}: payment recovered`,
            [`<strong>${cl.name}</strong> has no unpaid invoices anymore${prev.interest ? ` (accrued late interest of ${money(prev.interest)} rides their next invoice)` : ""}. Billing is back to normal.`]);
        }
        // Recovering must restore what they actually ARE. Flipping everyone to "active"
        // would tell the OS a results-only client has a subscription, and every surface
        // that reads that status would then offer to manage, re-rate or cancel one that
        // does not exist.
        if (cl.billingStatus === "past_due") cl.billingStatus = cl.stripeSubscriptionId ? "active" : "card_on_file";
      }

      // ── Next-invoice date refresh + pre-invoice lead-review reminder ─────────
      // Auto-charge is review-gated (Bryson, 2026-08-02): a week before the
      // invoice auto-charges, nudge the owner to review that cycle's leads so the
      // good ones ride the same bundled bill. Once per cycle, active clients only.
      try {
        const subs = await stripe(`subscriptions?customer=${encodeURIComponent(cl.stripeCustomerId)}&limit=1&status=active`, { method: "GET" });
        const sub = subs.data && subs.data[0];
        const periodEndIso = sub && sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        if (periodEndIso && periodEndIso !== cl.billingNextCharge) patch.billingNextCharge = periodEndIso;
        if (cl.billingStatus === "active" && periodEndIso) {
          const dLeft = Math.ceil((new Date(periodEndIso).getTime() - Date.now()) / 864e5);
          const undecided = (cl.leadsLog || []).filter((l) => !l.billed && !l.notBillable).length;
          if (dLeft >= 0 && dLeft <= 7 && undecided > 0 && cl.invoiceReminderSent !== periodEndIso) {
            let totalStr = "";
            try {
              const up = await stripe(`invoices/upcoming?customer=${encodeURIComponent(cl.stripeCustomerId)}`, { method: "GET" });
              if (up && up.total != null) totalStr = ` (~${money(up.total / 100)})`;
            } catch { /* preview is optional */ }
            await dispatchAlert({
              title: `${cl.name}: invoice in ${dLeft} day${dLeft !== 1 ? "s" : ""}`,
              body: `${cl.name}'s monthly invoice${totalStr} auto-charges on ${new Date(periodEndIso).toLocaleDateString()}. You have ${undecided} lead${undecided !== 1 ? "s" : ""} to review — open the client's Contract tab, approve the good ones so they ride this invoice, and exclude any junk.`,
              severity: "yellow",
              smsText: `BoldLine: ${cl.name} invoice in ${dLeft}d — review ${undecided} lead(s) before it auto-charges.`,
            });
            patch.invoiceReminderSent = periodEndIso;
          }
        }
      } catch (e) { console.error(`billing-watch: ${cl.name || row.id} invoice-reminder check failed:`, e.message); }

      // ── Renewal reminder email — auto-sent to the CLIENT once, ~30 days out ──
      try {
        if (!cl.internal && cl.email && cl.contractStatus === "active" && cl.contractEnd) {
          const dEnd = Math.ceil((new Date(cl.contractEnd).getTime() - Date.now()) / 864e5);
          const ea = cl.emailAuto || {};
          if (dEnd >= 0 && dEnd <= 30 && ea.renewalForEnd !== cl.contractEnd) {
            const r = await autoSendClientEmail(cl, "renewal");
            if (r.sent) {
              patch.emailAuto = { ...ea, renewalForEnd: cl.contractEnd };
              patch.commLog = [r.logEntry, ...(cl.commLog || [])];
            }
          }
        }
      } catch (e) { console.error(`billing-watch: ${cl.name || row.id} renewal-email check failed:`, e.message); }

      const changed = JSON.stringify(next) !== JSON.stringify(cl.billingLate || null) || (prevStatus !== cl.billingStatus) || Object.keys(patch).length > 0;
      if (changed) {
        const nextData = { ...cl, ...patch, billingLate: next };
        if (!next) delete nextData.billingLate;
        await supabase.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
        updated++;
      }
    } catch (e) {
      console.error(`billing-watch: ${cl.name || row.id} failed:`, e.message);
    }
  }
  console.log(`billing-watch: checked ${checked} billed client(s), updated ${updated}.`);
  return new Response(JSON.stringify({ ok: true, checked, updated }), { status: 200 });
});
