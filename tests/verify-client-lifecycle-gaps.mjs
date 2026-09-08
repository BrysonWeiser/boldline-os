// Four gaps found in the sweep Bryson asked for on 2026-09-07, all of them about the same
// thing: what the OS does for a client between signing and their ads actually running.
//
// Every one of them was invisible. Nothing was erroring, nothing was red on a screen, and
// each would have surfaced only as a client relationship quietly going wrong.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasAdActivity } from "../netlify/lib/report-shared.mjs";
import { EMAIL_TYPES, renderClientEmail } from "../netlify/lib/client-emails-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const NURTURE = code(read("netlify/functions/client-nurture.mjs"));
const ALERTS = code(read("netlify/functions/alerts-watch.mjs"));
const REPORT = code(read("netlify/lib/report-shared.mjs"));

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => {
  if (cond) { pass++; } else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); }
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── 1. NO PERFORMANCE REPORT FOR ADS THAT NEVER RAN ──────────────────────────
// Stencil & Thread signed 30 Aug with ads that never started. dueForMonthly counts 30 days
// from contractStart, so on 29 Sep the first client was going to be emailed a report about
// a campaign that did not exist, with a copy to Bryson, two days before the honest
// conversation he had already scheduled for the 30th.
eq("ads running counts as activity",
  hasAdActivity({ adPerf: { syncedAt: "2026-09-01", totals: { impressions: 1200, spend30d: 340 } } }), true);
eq("spend alone counts, even with no impressions recorded yet",
  hasAdActivity({ adPerf: { syncedAt: "2026-09-01", totals: { spend30d: 12 } } }), true);
eq("a live campaign counts before any spend lands",
  hasAdActivity({ adPerf: { syncedAt: "2026-09-01", totals: { liveCampaigns: 1 } } }), true);
eq("🔴 an account linked but never spending is NOT activity",
  hasAdActivity({ adPerf: { syncedAt: "2026-09-01", totals: { impressions: 0, spend30d: 0, liveCampaigns: 0 } } }), false);
eq("🔴 never linked at all is NOT activity",
  hasAdActivity({}), false);
// 🔴 THE ONE THAT MATTERS MOST. Stencil & Thread's leadsLog held two FAKE test leads used to
// debug the client's text-back. If leads counted as activity the guard would pass and the
// report would describe leads that were never real.
eq("🔴 fake leads in the log do NOT make it look like the ads ran",
  hasAdActivity({ leadsLog: [{ name: "test lead 1" }, { name: "test lead 2" }], leads: 2 }), false);

ok("the client-facing report is gated on real ad activity",
  /isReportable = \(client, pkg\) =>[\s\S]{0,220}hasAdActivity\(client\)/.test(REPORT),
  "a report with nothing in it tells the client nobody is watching their money");
ok("🔴 but Bryson's OWNER briefing is NOT gated on it",
  !/isOwnerBriefable[\s\S]{0,300}hasAdActivity/.test(REPORT),
  "the week a client's ads have not started is the week he most needs telling");
ok("and the monthly run says WHY it skipped, not just that it did",
  /skipped: "ads have never run/.test(REPORT));

// ── 2 + 3. ONBOARDING STARTS AT SIGNING, NOT AT PAYMENT ──────────────────────
// Bryson, 2026-09-07: "Signing that way nothing is blocked and doesn't send even if payment
// isn't processed". Founding terms are results-only with no monthly minimum, so a client can
// be fully signed and correctly owe nothing for weeks. Stencil & Thread signed 30 Aug and
// received NOTHING automatic for eight days, including the ad-account-access email that
// chases the exact thing blocking their launch.
ok("🔴 the welcome fires on a signed contract, not on a Stripe payment",
  /!ea\.welcome && \(cl\.contractSigned \|\| cl\.contractStatus === "active"\)/.test(NURTURE),
  "gating onboarding on payment means a results-only client never gets onboarded at all");
ok("it still sets the same flag Stripe sets, so whichever happens first wins",
  /ea\.welcome = true/.test(NURTURE) && /ea\.welcomeAt = /.test(NURTURE),
  "two senders and one flag is what stops a client getting two welcomes");
ok("and it is checked before sending, so a re-run is a no-op",
  /if \(!ea\.welcome &&/.test(NURTURE));
ok("the OS no longer tells Bryson the welcome is sent 'when they pay'",
  !/auto: "when they pay"/.test(read("netlify/lib/client-emails-shared.mjs")),
  "a label that says the wrong trigger is worse than no label, he would stop watching for it");

// ── 4. SOMETHING FINALLY ASKS FOR A REVIEW ───────────────────────────────────
// The review system was fully built (form, approval, display, live Google link) and nothing
// anywhere ever asked anybody. A review wall nobody is invited to fill in stays empty.
ok("a review request template exists", typeof renderClientEmail === "function"
  && !!EMAIL_TYPES.find((t) => t.id === "review_request"));
ok("and the daily job actually sends it",
  /autoSendClientEmail\(cl, "review_request"\)/.test(NURTURE),
  "a template nothing sends is the exact gap this was written to close");
ok("🔴 it asks once per client, ever",
  /!ea\.reviewAsked/.test(NURTURE) && /ea\.reviewAsked = true/.test(NURTURE),
  "chasing a favour is how a favour becomes an imposition");
ok("it will not ask a client whose ads never ran",
  /reviewAsked[\s\S]{0,400}hasAdActivity\(cl\)/.test(NURTURE));
ok("it waits for real delivered leads and real elapsed time",
  /leads >= REVIEW_MIN_LEADS/.test(NURTURE) && /contractAgeDays >= REVIEW_MIN_DAYS/.test(NURTURE));
ok("🔴 and never lands in the same run as a celebration email",
  /!crossedMilestone/.test(NURTURE),
  "two of ours in one morning reads as automated, which is the one thing it must not");
{
  const r = renderClientEmail("review_request", { contactName: "Weston Zellers", businessName: "Scottsdale Roofing", portalUrl: "https://x.test/p" });
  const body = String((r && (r.html || r.bodyHtml)) || "");
  ok("the review email renders with the client's name in it", /Weston/.test(body), body.slice(0, 120));
  // Standing rule (Bryson, 2026-08-14): nothing client-facing may read as AI-written, and
  // the em dash is the tell he named. Standing rule (2026-08-03): no emojis to a client.
  ok("🔴 no em dash in it", !/[—–]/.test(body));
  ok("🔴 no emoji in it", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body.replace(/&[a-z]+;/g, "")));
  ok("it offers a way to complain instead, which is the honest version of asking",
    /rather fix it/i.test(body));
}

// ── AND THE ALERT THAT WOULD HAVE CAUGHT ALL OF THIS ON DAY SEVEN ────────────
// Eight days of the first and only client going nowhere, and nothing in the OS said so.
ok("🔴 a signed client whose ads never started raises an alert",
  /neverLaunched: live != null && live >= NEVER_LAUNCHED_DAYS && !hasAdActivity\(cl\)/.test(ALERTS)
  && /neverLaunched: \(cl\) =>/.test(ALERTS),
  "a client who signs and never launches burns the case-study window the offer exists to buy");
ok("it is in the tracked key list, so it alerts on the transition and not every day",
  /"neverLaunched"\]/.test(ALERTS) || /neverLaunched"\s*\]/.test(ALERTS));
ok("its state is persisted with the others",
  /nextState = \{[^}]*neverLaunched/.test(ALERTS));
ok("🔴 and 'no leads' no longer fires at a campaign that never existed",
  /noLeads: !!cl\.adBudget && hasAdActivity\(cl\)/.test(ALERTS),
  "telling him to check targeting on a campaign that was never built is the wrong diagnosis");

console.log(`verify-client-lifecycle-gaps: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
