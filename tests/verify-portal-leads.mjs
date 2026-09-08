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
  // 🔴 LEADS AND REPORTS ARE TWO TABS, NOT ONE, and that was a reversal the same day.
  // Leads first took over the Reports tab, because five buttons measured 384px in a 360px
  // strip. Bryson, 2026-09-08: *"i dont want the reports and lead pages combined into a
  // leads tab i want them seperate so a seperate leads and report tab between review and
  // account"*. He is right about the priority: a client on per-lead pricing opens his leads
  // daily and reads the written report weekly, so stacking them buried the daily one. The
  // overflow got fixed in CSS instead (verify-portal-upgrades pins that rule).
  ok("the tab is labelled Leads, which is the word clients use",
    />Leads<\/button>/.test(empty));
  ok("and Reports kept its own tab rather than being swallowed",
    />Reports<\/button>/.test(empty));
  const tabOrder = [...empty.matchAll(/onclick="show\('([a-z]+)'/g)].map(m=>m[1]);
  ok("there are five tabs and no more",
    [...new Set(tabOrder)].length === 5,
    `got ${[...new Set(tabOrder)].join(", ")}`);
  ok("🔴 with Leads and Reports sitting between Review and Account, which is where he asked",
    tabOrder.slice(0,5).join(",") === "status,approvals,leads,reports,account",
    `tab order is ${tabOrder.slice(0,5).join(",")}`);
  ok("and the two panels are separate, so the report is not stacked under the leads",
    /id="t-leads"/.test(empty) && /id="t-reports"/.test(empty)
      && empty.indexOf('id="t-leads"') < empty.indexOf('id="t-reports"'));
  ok("with nothing yet it explains what will appear, rather than looking broken",
    /will appear here/.test(empty));

  const withLeads = render({ leadsLog: [
    { name: "Maria Whitfield", phone: "(541) 555-0142", email: "maria@x.org", receivedAt: "2026-09-07T17:20:00Z", qualified: true, message: "120 hoodies" },
    { name: "Dan Rivera", phone: "541-555-0188", receivedAt: "2026-09-06T15:02:00Z" },
  ] });
  ok("🔴 the written performance report is still reachable, on its own tab",
    /Performance Report/.test(withLeads.slice(withLeads.indexOf('id="t-reports"'))),
    "splitting the tabs must not quietly lose the report");
  ok("and the leads panel holds the leads, not the report",
    /Your Leads/.test(withLeads.slice(withLeads.indexOf('id="t-leads"'), withLeads.indexOf('id="t-reports"'))));
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

// 🔴 A SAFETY GUARD MUST NOT REPORT ITSELF AS A BUG.
// The owner's preview rejects every write on purpose (KB `preview-safety`), so pressing Save
// there showed "Save failed. Try again" and Bryson reasonably read it as broken. A guard that
// looks like a defect is one somebody eventually "fixes".
{
  const src = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
  ok("🔴 in the preview, a blocked save says it was blocked, not that it failed",
    /BL_PREVIEW\?'Preview only, nothing saved':'Save failed\. Try again'/.test(src),
    "the preview blocks writes deliberately; calling that a failure invites someone to undo the guard");
  ok("and the real portal still reports a genuine failure honestly",
    /'Save failed\. Try again'/.test(src));
  ok("the owner-side copy says the same thing",
    /BL_PREVIEW\?'Preview only, nothing saved'/.test(OS),
    "two portal copies, one behaviour");
}

// ── 5. The client has somewhere to put a card ────────────────────────────────
// Bryson, 2026-09-08: *"in the os he doesnt have a place to add a payment method for when i
// bill him"*. The only route to a card was Bryson pressing a button in the OS and emailing
// the resulting Stripe link by hand, so a client who lost that email had nowhere to go. On a
// results-only deal, which is what our first client is on, no card means no way to invoice a
// lead already delivered.
{
  const none = render({ billingPerLead: 50 });
  ok("a client with no link yet is told one is coming, not left staring at nothing",
    /Your account manager will send you a secure link/.test(none));
  ok("and there is no dead button when there is nothing to press",
    !/Add My Payment Method/.test(none));

  const offered = render({ billingPerLead: 50, billingCheckoutUrl: "https://checkout.stripe.com/c/pay/abc" });
  ok("with a link issued, the client can add a card himself",
    /Add My Payment Method/.test(offered)
    && /href="https:\/\/checkout\.stripe\.com\/c\/pay\/abc"/.test(offered));
  ok("🔴 it says plainly that nothing is charged today",
    /Nothing is charged today/.test(offered),
    "a payment page with no warning reads as a bill, and a client who fears a charge does not click");
  ok("🔴 and it quotes HIS agreed rate, not the niche default",
    /billed \$50 per qualified lead/.test(offered),
    "a per-lead price in the portal that is not the price in the contract looks authoritative and is wrong");
  ok("the card opens in a new tab rather than taking over the portal",
    /target="_blank" rel="noopener"/.test(offered));
  ok("🔴 and in a preview it goes nowhere at all",
    /onclick="return blPay\(this\)"/.test(offered) && /function blPay\(a\)\{if\(BL_PREVIEW\)/.test(offered),
    "a preview must never navigate to a real payment page: standing rule after the CTA that walked into the OS");

  const saved = render({ billingPerLead: 50, billingStatus: "card_on_file" });
  ok("once a card is saved it says so instead of asking again",
    /Payment method saved/.test(saved) && !/Add My Payment Method/.test(saved));
  // 🔴 IT LIVES INSIDE "YOUR INFORMATION", not in a section of its own. Bryson, 2026-09-08:
  // *"put the connect payment option under the your information section under the account
  // tab"*. Its own tap-to-open section meant a client had to know to open it; Your
  // Information is the section a new client already opens to fill everything else in.
  {
    const info = offered.indexOf("Everything we build your ads from");
    const nextSection = offered.indexOf('<details class="acc"', info);
    const inside = offered.slice(info, nextSection);
    ok("🔴 the payment card sits inside Your Information, not in a section of its own",
      inside.includes("Payment Method") && !/<div class="at">Payment Method/.test(offered),
      "a section a client has to know to open is a section he does not open");
    ok("and it sits directly under the card where he connects his ad account",
      inside.indexOf("Connect Your Google Ads") < inside.indexOf("Payment Method"),
      "connect the account, then the card that pays for the leads it brings: one trip");
  }
  ok("an unfinished payment card is marked so it is not scrolled past",
    /border-color:rgba\(200,168,75,\.4\)[^"]*"><div class="lbl" style="color:#C8A84B[^>]*>Payment Method/.test(offered)
    && !/border-color:rgba\(200,168,75,\.4\)[^"]*"><div class="lbl" style="color:#C8A84B[^>]*>Payment Method/.test(saved));
  ok("🔴 a spent link is never offered again even if the field lingers",
    !/Add My Payment Method/.test(render({ billingStatus: "card_on_file", billingCheckoutUrl: "https://checkout.stripe.com/c/pay/abc" })),
    "Stripe clears the field, but a stale record must not send a client to a dead checkout");
  ok("we never claim to hold the card number ourselves",
    /never see or store the number/.test(saved));
}

// ── 6. A saved card counts as a saved card ───────────────────────────────────
// A results-only deal has no monthly, so nothing subscribes: a Stripe setup session leaves
// behind a billing status and no subscription id. Two places assumed the id.
{
  const WEBHOOK = readFileSync(join(ROOT, "netlify/functions/stripe-webhook.mjs"), "utf8");
  ok("🔴 a setup checkout is recorded as a card on file, not as active billing",
    /billingStatus: obj\.mode === "setup" \? "card_on_file" : "active"/.test(WEBHOOK),
    "stamping active on a client with no subscription shows Billing Active next to a launch step that says no card");

  const LC = readFileSync(join(ROOT, "netlify/lib/launch-checklist.mjs"), "utf8");
  const step = LC.slice(LC.indexOf('id: "card"'), LC.indexOf('id: "adaccount"'));
  ok("🔴 the launch checklist ticks the card step for a results-only client too",
    /billingStatus === "card_on_file"/.test(step),
    "our first client is on exactly this deal; the step would have told Bryson to chase a card already on file");
  ok("and the OS copy of the checklist agrees",
    /done:lcHas\(c\.stripeSubscriptionId\)\|\|c\.billingStatus==="card_on_file"/.test(OS),
    "the checklist lives in two files; changing one and not the other is the standing trap here");
  ok("it names where the Billing card actually is, since he could not find it",
    /Contract tab and scroll to the Billing card/.test(step));
}

// ── 7. The agreed rate is settable where he looks for it ─────────────────────
// Bryson, 2026-09-08: *"there is no place to put 50 in the edit tab but it is on the contract
// that his price per qualified lead is $50"*. It existed only on the Billing card at the
// bottom of the Contract tab, a different screen behind a different tab, so the one number
// the whole invoice is built from was hidden behind the document it appears in.
{
  const card = OS.slice(OS.indexOf("What You Bill Them"), OS.indexOf("What You Bill Them") + 2200);
  ok("the Edit screen has a per-qualified-lead field",
    /Per qualified lead \(\$\)/.test(card) && /set\("billingPerLead"/.test(card));
  ok("and the monthly minimum beside it, so a results-only deal can be set in one place",
    /Monthly minimum \(\$\)/.test(card) && /set\("billingMonthly"/.test(card));
  // Both fields have to READ the record as well as write it, or they show blank over a real
  // number and the next save quietly wipes the rate that is in the signed agreement.
  ok("🔴 and both fields show what is already stored rather than starting empty",
    /value=\{form\.billingPerLead\?\?""\}/.test(card) && /value=\{form\.billingMonthly\?\?""\}/.test(card),
    "a field that shows blank over a real number invites a save that wipes it");
  ok("🔴 it stores a number, not the text of a number",
    /set\("billingPerLead",e\.target\.value===""\?null:Number\(e\.target\.value\)\)/.test(card),
    "everything downstream multiplies this, and \"50\" times a lead count is not 50 times a lead count");
  ok("🔴 and blank clears it rather than storing an empty rate",
    /\?null:Number/.test(card) && !/\?"":Number/.test(card),
    "an empty string is not null, and it would read as a real rate of nothing");
  ok("it says what blank falls back to instead of leaving him guessing",
    /Blank uses the standard \$\{form\.niche\} rate/.test(card));
  ok("it is hidden on the house account, which bills nobody",
    /\{!client\.internal&&<Card>\s*\n\s*<Label>What You Bill Them<\/Label>/.test(OS));
}

console.log(`verify-portal-leads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
