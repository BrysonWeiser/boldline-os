// The ten branded emails a client actually receives, checked by RENDERING them.
//
// Bryson, 2026-08-26, before sending the first one to a real client: *"just to double check
// that all the buttons actually work for the branded emails."* Nine of ten were fine. The
// tenth was invoicing people wrongly.
//
// 🔴 THE BUG THIS SUITE EXISTS TO STOP: AN INVOICE THAT CONTRADICTS THE SIGNED AGREEMENT.
// Section 4.1 of every managed contract reads "THE TWO ARE NEVER CHARGED TOGETHER" — the
// fee for a month is the GREATER of the monthly minimum or the performance fee, never their
// sum. The invoice template was ADDING them, so a client on a $700 minimum who produced $900
// of qualified leads was billed $1,600 of fees instead of $900. An overcharge of exactly the
// minimum, every month, on the one document a client reads most carefully.
//
// Rendered and read, never pattern-matched: an email is generated text and the only way to
// check generated text is to produce it and look at the words (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EMAIL_TYPES, renderClientEmail } from "../netlify/lib/client-emails-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();

const PORTAL = "https://boldlinemedia.com/portal?token=abc-123";
const BASE = {
  businessName: "Stencil & Thread", contactName: "Sebastian Perrin",
  packageName: "Launch System", portalUrl: PORTAL, date: "Aug 26, 2026",
};

// ── 1. Every template renders, and every button goes somewhere real ───────────
{
  ok("there are templates to check", EMAIL_TYPES.length >= 8, `found ${EMAIL_TYPES.length}`);
  for (const t of EMAIL_TYPES) {
    const r = renderClientEmail(t.id, { ...BASE, monthly: 400, setup: 750, leadCount: 3, leadRate: 50, leadTotal: 150 });
    ok(`${t.label} renders`, !!(r && r.html && r.subject));
    if (!r || !r.html) continue;
    ok(`${t.label} has a usable subject line`,
      r.subject.length > 8 && r.subject.length <= 78 && !/\$\{|undefined|null/.test(r.subject),
      `${r.subject.length} chars: ${r.subject}`);
    // 🔴 Every button falls back to the bare marketing site when the portal link is
    // missing, which LOOKS like it worked. A client clicking "Open Your Client Portal"
    // and landing on a homepage is worse than a broken link, because nobody reports it.
    const links = [...r.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith("mailto:"));
    const stranded = links.filter((u) => !u.includes("token=") && !u.includes("stripe"));
    ok(`🔴 ${t.label} has no button silently falling back to the plain site`, stranded.length === 0,
      stranded.join(", "));
    ok(`${t.label} leaves no unfilled placeholder`, !/\$\{|undefined|\[object/i.test(text(r.html)),
      text(r.html).slice(0, 120));
  }
}

// ── 2. 🔴 The invoice obeys the contract it bills under ───────────────────────
const inv = (o) => {
  const r = renderClientEmail("invoice", { ...BASE, ...o });
  return { subject: r.subject, body: text(r.html) };
};
{
  // The exact shape that was being overcharged.
  const r = inv({ monthly: 700, setup: 0, leadCount: 12, leadRate: 75, leadTotal: 900 });
  ok("🔴 leads beating the minimum bills the leads alone", r.subject.includes("$900 due"), r.subject);
  ok("🔴 and NOT the sum of both", !r.subject.includes("$1,600"), "that was an overcharge of exactly the minimum");
  ok("the client is told where their minimum went", r.body.includes("is included in the above, not added"));
}
{
  const r = inv({ monthly: 700, setup: 0, leadCount: 5, leadRate: 75, leadTotal: 375 });
  ok("leads under the minimum bills the minimum", r.subject.includes("$700 due"), r.subject);
  ok("and never the sum", !r.subject.includes("$1,075"));
  ok("the leads are still acknowledged rather than hidden", r.body.includes("counted toward the minimum, not added"));
}
{
  const r = inv({ monthly: 700, setup: 1500, leadCount: 12, leadRate: 75, leadTotal: 900 });
  ok("a first month adds the setup fee on top of the greater-of", r.subject.includes("$2,400 due"), r.subject);
  ok("the setup fee is itemised", r.body.includes("One-time setup"));
}
{
  // A founding client: no floor at all.
  const r = inv({ monthly: 0, setup: 0, leadCount: 3, leadRate: 50, leadTotal: 150 });
  ok("a results-only client is billed for their leads", r.subject.includes("$150 due"), r.subject);
  ok("🔴 with no $0 minimum line cluttering the invoice", !r.body.includes("$0"));
  ok("and no mention of a minimum they do not have", !r.body.includes("monthly minimum"));
}
{
  // The month that proves the promise.
  const r = inv({ monthly: 0, setup: 0, leadCount: 0, leadRate: 50, leadTotal: 0 });
  ok("🔴 a results-only client with no leads gets no invoice", !r.subject.includes("Invoice"), r.subject);
  ok("they are told plainly that nothing is owed", r.body.includes("there is nothing owed"));
  ok("and it does not read as a bill for zero", !r.subject.includes("$0 due"));
}
{
  // Equal is not a special case, but it must not double.
  const r = inv({ monthly: 400, setup: 0, leadCount: 8, leadRate: 50, leadTotal: 400 });
  ok("leads exactly equal to the minimum bills that amount once", r.subject.includes("$400 due"), r.subject);
  ok("and never twice", !r.subject.includes("$800"));
}

// ── 3. The phrase the first client rejected in writing ────────────────────────
// He turned the old model down because it billed a management fee AND a per-lead fee. The
// word surviving anywhere a client can read it undermines the whole rewrite.
{
  for (const t of EMAIL_TYPES) {
    const r = renderClientEmail(t.id, { ...BASE, monthly: 400, setup: 750, leadCount: 3, leadRate: 50, leadTotal: 150 });
    ok(`🔴 ${t.label} never says "management fee"`, !/management fee/i.test(text(r.html)));
  }
}

// ── 4. Ad spend is never confused with fees ───────────────────────────────────
// The hard business rule: BoldLine never holds or fronts client ad spend. Every money
// email has to keep that distinction visible.
{
  const r = inv({ monthly: 700, setup: 0, leadCount: 12, leadRate: 75, leadTotal: 900 });
  ok("🔴 the invoice says ad spend is billed separately by the platforms",
    /ad spend is billed separately/i.test(r.body));
}


// ── 5. 🔴 THE AUTO-SENT EMAILS, THROUGH THE PATH THAT ACTUALLY SENDS THEM ─────
// Section 1 renders every template with a hand-built context, which is exactly the harness
// mistake that let the useMemo crash ship: a context assembled from what the template needs
// rather than from what the server really passes. These render through `buildClientCtx`,
// the real server-side builder, for the client shapes that really exist.
//
// It found one. The past-due email printed `c.monthly`, which that builder defaults to 0
// unless a client carries an explicit override, and the Stripe webhook that fires it passed
// only a pay link. So every client whose payment bounced was told a payment of $0 had
// failed — on the one email whose entire job is getting paid.
{
  const { buildClientCtx } = await import("../netlify/lib/client-email-auto.mjs");
  const AUTO = ["welcome", "renewal", "past_due", "onboarding_access", "onboarding_nudge", "lead_milestone", "receipt"];
  const SHAPES = [
    ["a standard client with no override", { name: "Apex Roofing", contactName: "Mike", email: "m@a.com", packageId: "g-growth", portalToken: "t" }],
    ["a founding client with the minimum waived", { name: "Stencil & Thread", contactName: "Sebastian", email: "s@s.com", packageId: "g-launch", billingMonthly: 0, billingSetup: 0, billingPerLead: 50, portalToken: "t" }],
  ];
  for (const [who, cl] of SHAPES) {
    for (const t of AUTO) {
      const ctx = buildClientCtx(cl, t === "receipt" ? { amount: 700 } : t === "lead_milestone" ? { milestone: 10 } : {});
      const r = renderClientEmail(t, ctx);
      const body = text(r.html);
      ok(`${t} renders for ${who}`, !!(r && r.html));
      // 🔴 The actual bug: a money figure of exactly zero, invented because nothing supplied
      // a real one. Never correct in a client-facing email.
      ok(`🔴 ${t} shows no $0 to ${who}`, !/\$0(?![.\d])/.test(body),
        "a zero here means the template printed a number nobody gave it");
      ok(`${t} leaves no placeholder for ${who}`, !/\$\{|undefined|NaN/.test(body));
    }
  }
  // And the fixed behaviour, both ways round.
  const cl = { name: "Apex", contactName: "Mike", email: "m@a.com", packageId: "g-growth", portalToken: "t" };
  const withAmt = text(renderClientEmail("past_due", buildClientCtx(cl, { amount: 700 })).html);
  const without = text(renderClientEmail("past_due", buildClientCtx(cl, {})).html);
  ok("🔴 past-due states the real failed amount when Stripe supplies it", withAmt.includes("payment of $700"));
  ok("🔴 and says nothing about an amount when it does not", /most recent payment didn't go through/.test(without));
  ok("either way it still gives them a way to fix it", withAmt.includes("Update Payment Method") && without.includes("Update Payment Method"));

  // The webhook must actually pass that amount, or the template's good behaviour is moot.
  const hook = readFileSync(join(ROOT, "netlify/functions/stripe-webhook.mjs"), "utf8");
  ok("🔴 the webhook passes the real failed amount to the email",
    /past_due", \{ amount: failedAmt/.test(hook),
    "without this the template correctly says nothing, which is better but still not the number");
  ok("and prefers what is still outstanding over the invoice total",
    /amount_remaining != null \? obj\.amount_remaining : obj\.amount_due/.test(hook));
}

console.log(`verify-client-emails: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
