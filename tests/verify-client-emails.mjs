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

import { EMAIL_TYPES, renderClientEmail } from "../netlify/lib/client-emails-shared.mjs";

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

console.log(`verify-client-emails: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
