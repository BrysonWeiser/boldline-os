// The client portal now shows the client their own leads, and the Connect card saves.
//
// Both found on a live call, 2026-09-08, with BoldLine's first client on the phone:
//   1. Sebastian pasted his Google Ads Customer ID and nothing happened. The shared Save
//      button exists but sits five cards further down the tab, so the card looked broken.
//   2. He asked where he sees his leads. The honest answer was NOWHERE. The portal showed
//      the written performance report and no leads at all, so a client paying per qualified
//      lead could not see the leads he is paying for.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { _internal } = await import("../netlify/functions/portal.mjs");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OS = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

const base = { name: "Stencil & Thread", contactName: "Sebastian", email: "c@x.com",
  packageId: "g-launch", contractStatus: "active", portalToken: "tok" };
const pkg = _internal.findPkg("g-launch");
const render = (extra) => _internal.makePortalHTML({ ...base, ...extra }, pkg);

// ── 1. The Connect card can be saved from where the client is looking ────────
{
  const html = render({});
  const from = html.indexOf('data-key="googleAdsCustomerId"');
  const card = from < 0 ? "" : html.slice(from, from + 700);
  ok("🔴 the Google connect card has its own Save button",
    /onclick="saveInfo\(this\)"/.test(card),
    "the shared Save sits five cards below, so pasting an ID looked like nothing happened");
  ok("and it says what saving covers, so the button is not a mystery",
    /Saving here saves everything on this tab/.test(card));
  ok("🔴 the owner-side preview copy got the same button",
    (OS.match(/onclick="saveInfo\(this\)"/g) || []).length >= 2,
    "the portal lives in two files; changing one and not the other is the standing trap here");
}

// ── 2. The client can see their leads ────────────────────────────────────────
{
  const empty = render({ leadsLog: [] });
  // 🔴 Leads take OVER the Reports tab rather than adding a fifth. Five tabs overflow the
  // strip at 360px, the same failure that pushed Contract off-screen at six on 2026-08-31.
  ok("the tab is labelled Leads, which is the word clients use",
    />Leads<\/button>/.test(empty) && !/>Reports<\/button>/.test(empty));
  ok("and it did not add a fifth tab",
    [...new Set([...empty.matchAll(/onclick="show\('([a-z]+)'/g)].map(m=>m[1]))].length === 4,
    "five tabs overflow a 360px phone, which is the bug this portal already had once");
  ok("with nothing yet it explains what will appear, rather than looking broken",
    /will appear here/.test(empty));

  const withLeads = render({ leadsLog: [
    { name: "Maria Whitfield", phone: "(541) 555-0142", email: "maria@x.org", receivedAt: "2026-09-07T17:20:00Z", qualified: true, message: "120 hoodies" },
    { name: "Dan Rivera", phone: "541-555-0188", receivedAt: "2026-09-06T15:02:00Z" },
  ] });
  ok("🔴 the written performance report is still reachable, below the leads",
    /Performance Report/.test(withLeads.slice(withLeads.indexOf('id="t-reports"'))),
    "moving leads in must not quietly lose the report that used to live here");
  ok("real leads are listed with their names", /Maria Whitfield/.test(withLeads) && /Dan Rivera/.test(withLeads));
  ok("🔴 the phone number is tap to call",
    /href="tel:5415550142"/.test(withLeads),
    "the client reads this on a phone and speed is the whole product");
  ok("and the email is tap to send", /href="mailto:maria@x\.org"/.test(withLeads));
  ok("what they wrote comes through", /120 hoodies/.test(withLeads));
  ok("it shows how many were counted as qualified",
    /Counted as qualified/.test(withLeads) && /Qualified<\/span>/.test(withLeads),
    "that count is the number his invoice is built from, so hiding it would be worse than showing it");
  ok("and says plainly what qualified means and how to dispute one",
    /worth quoting/.test(withLeads) && /invoice is based on/.test(withLeads));

  // 🔴 BoldLine grades the leads, not the client (decided 2026-08-25). A client-facing
  // "mark qualified" screen was deliberately never built and this must not sneak one in.
  const start = withLeads.indexOf('id="t-reports"');
  const panel = withLeads.slice(start, withLeads.indexOf('id="t-account"', start));
  ok("🔴 the leads panel is display only, with no way for the client to grade anything",
    !/<button/.test(panel) && !/<input/.test(panel),
    "grading is BoldLine's call; a control here would quietly reverse that decision");

  // Standing client-facing rules.
  const text = panel.replace(/<[^>]*>/g, " ");
  ok("🔴 no emojis anywhere in it", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text));
  ok("🔴 no em dashes", !/[—–]/.test(text));

  // Escaping: a lead's name comes from a public form, so it is untrusted input.
  const nasty = render({ leadsLog: [{ name: '<img src=x onerror=alert(1)>', receivedAt: "2026-09-07T17:20:00Z" }] });
  ok("🔴 a lead's own text cannot inject markup into the client's portal",
    !/<img src=x/.test(nasty) && /&lt;img/.test(nasty),
    "lead names arrive from a public form; anyone could have typed that");
}

console.log(`verify-portal-leads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
