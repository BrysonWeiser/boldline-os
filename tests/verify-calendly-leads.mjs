// A booked call must become a lead, exactly once.
// Run: node tests/verify-calendly-leads.mjs
//
// Bryson, 2026-08-20: "i dont get a lead in the os from a calendly sign up".
//
// 🔴 WHY THIS MATTERED MORE THAN IT LOOKED. "Book a Call" is the PRIMARY button on the
// landing page; the contact form under it is the fallback, and Bryson noted it is "not the
// noticable button compared to book a call". So the BETTER the prospect — ready to take a
// meeting rather than leave details — the less likely they were to exist in the OS at all.
// Only the weaker half of the funnel was recorded.
//
// No network: the source is read and the pure helpers are exercised directly.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let n = 0; const fails = [];
const t = (name, fn) => { try { fn(); n++; } catch (e) { fails.push(`${name}: ${e.message}`); } };

const src = readFileSync(new URL("../netlify/functions/calendly-leads.mjs", import.meta.url), "utf8");
const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");

// ── 🔴 DEDUPE IS THE CORRECTNESS ARGUMENT ─────────────────────────────────
// This runs on a schedule over an OVERLAPPING window, so it sees the same booking again
// and again. Without a check keyed on Calendly's own event id, one booking becomes a lead
// every fifteen minutes forever.
t("every insert is checked against the Calendly event id first", () => {
  assert.ok(/\.eq\("payload->>calendlyEventUri", uri\)/.test(src),
    "no dedupe: a repeating schedule would duplicate every booking");
  assert.ok(/calendlyEventUri: uri/.test(src), "the id must be stored, or nothing can match it next time");
  const iCheck = src.indexOf('payload->>calendlyEventUri');
  const iInsert = src.indexOf('.insert({');
  assert.ok(iCheck > 0 && iCheck < iInsert, "the dedupe check must come BEFORE the insert");
});

t("a failed dedupe read skips rather than inserting", () => {
  assert.ok(/if \(seenErr\) \{ failed\+\+;[\s\S]{0,120}continue; \}/.test(src),
    "treating a failed lookup as 'not seen' would duplicate on every database blip");
});

// ── The lead has to be worth having ───────────────────────────────────────
t("a booking with no email is skipped, not inserted blank", () => {
  assert.ok(/if \(!email\) \{ skipped\+\+; continue; \}/.test(src),
    "a lead with no way to reply is worse than no lead");
});

t("a booked call starts further along than a form fill", () => {
  assert.ok(/status: cancelled \? "new" : "meeting"/.test(src),
    "someone who booked a call is not at the same stage as someone who left their details");
});

t("cancellations are still recorded", () => {
  assert.ok(/cancelled[\s\S]{0,200}CANCELLED a call/.test(src),
    "someone who booked and cancelled is still a lead, arguably one worth calling");
  assert.ok(!/status: "active"/.test(src), "filtering to active only would hide cancellations entirely");
});

t("the reschedule and cancel links are kept", () => {
  assert.ok(/rescheduleUrl: clean\(invitee\.reschedule_url\)/.test(src));
  assert.ok(/cancelUrl: clean\(invitee\.cancel_url\)/.test(src));
});

// ── The booking answers are what Bryson actually reads ────────────────────
{
  const from = src.indexOf("const answersToText");
  const to = src.indexOf("export default");
  const { answersToText, businessFrom } = new Function(
    src.slice(src.indexOf("const clean ="), to) + "\nreturn { answersToText, businessFrom };")();

  t("the questions and answers become readable text", () => {
    const out = answersToText([
      { question: "What's your business?", answer: "Acme Roofing" },
      { question: "Ad budget?", answer: "$500 to $2,000" },
    ]);
    assert.ok(out.includes("What's your business?\nAcme Roofing"));
    assert.ok(out.includes("Ad budget?\n$500 to $2,000"));
  });

  t("unanswered questions are dropped", () => {
    assert.equal(answersToText([{ question: "Website?", answer: "" }, { question: "", answer: "x" }]), "");
    assert.equal(answersToText(null), "");
    assert.equal(answersToText(undefined), "");
  });

  t("the business name is lifted from whichever question asked for it", () => {
    assert.equal(businessFrom([{ question: "What is your company name?", answer: "Acme Roofing" }]), "Acme Roofing");
    assert.equal(businessFrom([{ question: "Your business", answer: " Acme " }]), "Acme");
  });

  t("and is left empty rather than guessed", () => {
    assert.equal(businessFrom([{ question: "What do you need help with?", answer: "leads" }]), null);
    assert.equal(businessFrom([]), null);
    assert.equal(businessFrom(null), null);
  });
}

// ── Never break the calendar or the OS when unconfigured ──────────────────
t("no Calendly token is not an error", () => {
  assert.ok(/if \(!token\) return json\(\{ ok: true, configured: false/.test(src),
    "an unconfigured integration must not look like a failure");
});

t("a Calendly outage never throws", () => {
  assert.ok(/catch \(e\) \{[\s\S]{0,200}console\.error\("calendly-leads failed/.test(src));
  assert.ok(/ok: true, configured: true, added: 0, error/.test(src),
    "a bad hour at Calendly must not take the scheduled run down");
});

// ── Wiring ────────────────────────────────────────────────────────────────
t("it runs on a schedule", () => {
  assert.ok(/\[functions\."calendly-leads"\][\s\S]{0,80}schedule = "\*\/15 \* \* \* \*"/.test(toml),
    "a poller that never runs imports nothing");
});

t("it writes to the same table the website form uses", () => {
  assert.ok(/from\("website_leads"\)/.test(src),
    "a separate table would mean a second Leads screen to look at");
  assert.ok(/form: "calendly"/.test(src));
});

t("the Leads screen tells a booked call apart from a form fill", () => {
  assert.ok(/const isCall = lead\.form==="calendly";/.test(os));
  assert.ok(/isCall\?"Booked call"/.test(os), "the strongest lead type needs to be visible at a glance");
  assert.ok(/isCall\?C\.green/.test(os));
});

t("and offers the reschedule and cancel links", () => {
  assert.ok(/cal\.rescheduleUrl/.test(os) && /cal\.cancelUrl/.test(os));
  assert.ok(/cal\s*=\s*\(lead\.payload&&lead\.payload\.source==="calendly-poll"\)/.test(os),
    "the links must only render for leads that actually came from a booking");
});

console.log(fails.length ? `✕ ${fails.length} failed, ${n} passed\n  ` + fails.join("\n  ")
  : `✓ verify-calendly-leads: ${n} checks passed`);
process.exit(fails.length ? 1 : 0);
