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
import { EMAIL_TYPES, renderClientEmail, emailAutoPatch } from "../netlify/lib/client-emails-shared.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
const same = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  ok(name, a === b, a === b ? "" : `got ${a}, wanted ${b}`);
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

// ── 🔴 A HAND-SENT EMAIL MUST COUNT AS SENT ──────────────────────────────────
//
// Found 2026-08-30, on Bryson's first real client, on day one. He sent the welcome email
// by hand from the Emails tab the morning Sebastian signed. That path wrote a comm-log
// line and NOTHING onto `emailAuto`, which meant two live bugs at once:
//   1. The Stripe webhook fires `welcome` on checkout.session.completed unless
//      `emailAuto.welcome` is set. Sebastian would have received a SECOND welcome email
//      the moment he paid.
//   2. client-nurture gates the ad-account request and the day 2 / day 5 intake nudges on
//      `emailAuto.welcome`, and measures the delay from `welcomeAt`. With a manual welcome
//      both stayed unset, so the whole onboarding sequence would never have started.
//
// Neither would have shown up anywhere. The first looks like an eager robot, the second
// looks like silence.
{
  const c = { contractEnd: "2026-11-30" };
  const iso = "2026-08-30T12:00:00.000Z";

  // Defaulted to {} so removing the entry entirely FAILS this block rather than throwing
  // and taking the remaining suites with it. A crash is a worse signal than a failure.
  const w = emailAutoPatch("welcome", c, iso) || {};
  ok("🔴 a hand-sent welcome records that it went out", w.welcome === true,
    "without this the Stripe webhook sends the client a second welcome when they pay");
  eq("and when, which is what the nudge schedule counts from", w.welcomeAt, iso);

  ok("a hand-sent ad-account request records itself too",
    (emailAutoPatch("onboarding_access", c, iso) || {}).access === true);

  // Keyed to the term, exactly as billing-watch does it, so NEXT term still gets a nudge.
  eq("a hand-sent renewal is keyed to the term it belongs to",
    (emailAutoPatch("renewal", c, iso) || {}).renewalForEnd, "2026-11-30");
  eq("and records nothing when there is no term to key it to",
    emailAutoPatch("renewal", {}, iso), null);

  // 🔴 THE ABSENCES ARE THE DELIBERATE PART, so they are asserted rather than assumed.
  // These dedupe on a specific Stripe invoice id, or on which nudge step it was. A manual
  // send does not know any of those, and inventing a value would SUPPRESS a real later
  // send for a different invoice, which is worse than recording nothing.
  for (const t of ["receipt", "past_due", "onboarding_nudge"]) {
    eq(`${t} records nothing, because a manual send cannot know its key`,
      emailAutoPatch(t, c, iso), null);
  }
  // A type with no automatic counterpart at all must not invent one either.
  eq("contract_signed records nothing", emailAutoPatch("contract_signed", c, iso), null);

  // Every flag this writes has to be one the senders actually read, or it is a no-op that
  // looks like a fix. Checked against the real source of both robots.
  const hookSrc = readFileSync(join(ROOT, "netlify/functions/stripe-webhook.mjs"), "utf8");
  const nurtureSrc = readFileSync(join(ROOT, "netlify/functions/client-nurture.mjs"), "utf8");
  const watchSrc = readFileSync(join(ROOT, "netlify/functions/billing-watch.mjs"), "utf8");
  const all = hookSrc + nurtureSrc + watchSrc;
  for (const key of ["welcome", "welcomeAt", "access", "renewalForEnd"]) {
    ok(`the senders actually read emailAuto.${key}`, new RegExp(`\\b${key}\\b`).test(all),
      "this flag is written by a manual send but nothing reads it, so it suppresses nothing");
  }

  // ── And the OS carries its own copy, which is how the last one of these hid ──
  // The launch checklist had the identical shape: two copies, an equivalence test, and a
  // field the fixtures never varied. So this compares the real OS copy, evaluated.
  const osSrc = readFileSync(join(ROOT, "index.html"), "utf8");
  const i = osSrc.indexOf("const EMAIL_AUTO_FLAGS =");
  const j = osSrc.indexOf("\nconst lcHas", i);
  ok("the OS copy of the flag map was found", i > 0 && j > i);
  const osPatch = new Function(osSrc.slice(i, j) + "\nreturn emailAutoPatch;")();
  for (const t of ["welcome", "onboarding_access", "renewal", "receipt", "past_due",
                   "onboarding_nudge", "contract_signed"]) {
    same(`🔴 both copies agree on ${t}`, osPatch(t, c, iso), emailAutoPatch(t, c, iso));
  }
}


// ── 🔴 "AUTOMATIC" MUST NOT BE A LIE ─────────────────────────────────────────
//
// Bryson, 2026-08-30, after sending by hand an email that sends itself: *"set in the emails
// tab which ones are automatic (but I can still view or send manually) and the ones I have
// to send myself"*. Eight of the ten send themselves, so without the label the tab reads as
// ten jobs waiting on him.
//
// A WRONG label is worse than none, in both directions: "Automatic" on something no job
// sends means a client silently never gets it, and "You send this" on something automatic
// is how the duplicate welcome happened in the first place. So the flag is checked against
// the REAL senders rather than trusted.
{
  const senderSrc = ["stripe-webhook", "billing-watch", "client-nurture", "docusign-watch"]
    .map((f) => readFileSync(join(ROOT, `netlify/functions/${f}.mjs`), "utf8")).join("\n")
    // docusign-watch names its email in the decision module, not at the call site.
    + readFileSync(join(ROOT, "netlify/lib/docusign-status.mjs"), "utf8");

  // Every type a sender actually names, discovered from source rather than listed by hand,
  // so an email that becomes automatic later is caught instead of quietly mislabelled.
  const namedByASender = new Set(
    [...senderSrc.matchAll(/autoSendClientEmail\([^,]+,\s*"([a-z_]+)"/g)].map((m) => m[1])
      .concat([...senderSrc.matchAll(/email:\s*"([a-z_]+)"/g)].map((m) => m[1])),
  );
  ok("the senders were actually found", namedByASender.size >= 7, [...namedByASender].join(", "));

  for (const t of EMAIL_TYPES) {
    if (t.auto) {
      ok(`🔴 ${t.id} is labelled Automatic and a job really does send it`,
        namedByASender.has(t.id),
        "the tab promises this sends itself and nothing sends it, so the client never gets it");
      ok(`and ${t.id} says WHEN, which is the useful half`,
        typeof t.auto === "string" && t.auto.length > 6, JSON.stringify(t.auto));
    } else {
      ok(`🔴 ${t.id} is labelled as his to send and no job sends it`,
        !namedByASender.has(t.id),
        "the tab says he must send this, but a job also sends it, so the client gets it twice");
    }
  }

  // The two he genuinely owns, pinned by name. If either ever becomes automatic this fails
  // and forces the label to be updated rather than left behind.
  const mine = EMAIL_TYPES.filter((t) => !t.auto).map((t) => t.id).sort();
  same("exactly the invoice and the thank-you are his to send", mine, ["invoice", "thank_you"]);
}


console.log(`verify-client-emails: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
