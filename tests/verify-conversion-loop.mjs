// Guards the conversion loop: what Google is told to chase, and what it is told to ignore.
//
// Built 2026-08-24 for BoldLine's first real client, whose own analysis named the problem
// exactly: "Don't have Google optimize around someone simply submitting Contact Us."
//
// 🔴 WHY THIS IS THE HIGHEST-STAKES THING IN THE ADS CODE. A conversion action is not a
// report, it is an INSTRUCTION. Whatever is marked primary is what Smart Bidding spends
// the client's money chasing. Mark a plain form fill primary and Google will faithfully
// buy more people who fill in forms and never buy anything, spend the whole budget doing
// it, and show a healthy conversion count the entire time. The account looks like it is
// working right up until someone counts the customers.
//
// So the assertions here are all really one question: does the money chase the RIGHT
// thing, and can a lead ever be counted twice or credited to the wrong click.
//
// The rules are imported and executed, never re-implemented (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONVERSION_ACTIONS, ACTION_KEYS, byKey, conversionActionPayload, createOperations,
  parseConversionLabel, mapConversionRows, gadsDateTime, clickIdOf, clickAgeDays,
  uploadPlan, leadIsAtStage, CLICK_MAX_DAYS,
} from "../netlify/lib/gads-conversions.mjs";
import { CLICK_KEYS, pickAttribution } from "../netlify/lib/attribution.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI      = readFileSync(join(ROOT, "index.html"), "utf8");
const GADS    = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
const LANDING = readFileSync(join(ROOT, "netlify/functions/landing.mjs"), "utf8");
const INTAKE  = readFileSync(join(ROOT, "netlify/functions/lead-intake.mjs"), "utf8");
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const UI_CODE = strip(UI), GADS_CODE = strip(GADS), LANDING_CODE = strip(LANDING), INTAKE_CODE = strip(INTAKE);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── 1. 🔴 THE MONEY MUST CHASE CUSTOMERS, NOT FORM FILLS ──────────────────────
{
  const form = byKey("form"), qual = byKey("qualified"), won = byKey("won");
  ok("all three actions exist", !!form && !!qual && !!won);

  eq("a plain form fill is NEVER what bidding chases", form.primary, false);
  eq("a qualified lead is", qual.primary, true);
  eq("and so is a closed customer", won.primary, true);

  // The payload is what Google actually receives. The flag above means nothing if it
  // does not survive into the request.
  eq("and the form action really is sent as secondary", conversionActionPayload(form).primaryForGoal, false);
  eq("while the qualified one is sent as primary", conversionActionPayload(qual).primaryForGoal, true);

  // Google's own lead-funnel categories, so the account reads as a funnel in the UI
  // rather than three anonymous custom actions nobody can interpret later.
  eq("the form uses Google's lead-form category", form.category, "SUBMIT_LEAD_FORM");
  eq("qualified uses the qualified-lead category", qual.category, "QUALIFIED_LEAD");
  eq("won uses the converted-lead category", won.category, "CONVERTED_LEAD");

  // A form fill happens on the page; the other two are judged days later by a person.
  eq("the form fires from the page", form.type, "WEBPAGE");
  eq("qualified is uploaded later", qual.type, "UPLOAD_CLICKS");
  eq("so is won", won.type, "UPLOAD_CLICKS");

  // One lead is one lead. Counting a repeat submission twice inflates every number
  // downstream, including the one the client is billed on.
  ok("every action counts once per click",
    CONVERSION_ACTIONS.every((a) => conversionActionPayload(a).countingType === "ONE_PER_CLICK"));
  ok("and all three are created in one go", createOperations().length === 3);
}

// ── 2. Value: a default, never a replacement for the real number ──────────────
{
  const withValue = conversionActionPayload(byKey("won"), { leadValue: 375 });
  eq("a lead value is carried as the default", withValue.valueSettings.defaultValue, 375);
  // 🔴 If this were true, a real $4,000 order would be reported to Google as the average
  // instead, and bidding would never learn which searches bring the big jobs.
  eq("but a real order value always wins", withValue.valueSettings.alwaysUseDefaultValue, false);
  eq("in dollars", withValue.valueSettings.defaultCurrencyCode, "USD");

  // Zero is not a value, it is a claim that the lead was worthless. Sending nothing is
  // honest; sending zero teaches Google the wrong lesson.
  ok("no value at all is sent when none is known", !conversionActionPayload(byKey("won")).valueSettings);
  ok("and a zero is treated as none", !conversionActionPayload(byKey("won"), { leadValue: 0 }).valueSettings);
  ok("as is nonsense", !conversionActionPayload(byKey("won"), { leadValue: "abc" }).valueSettings);
  // The secondary action never carries a value: it is not bid on, so a value on it would
  // only muddy the reporting.
  ok("the form action never carries a value", !conversionActionPayload(byKey("form"), { leadValue: 375 }).valueSettings);
}

// ── 3. Reading the tag back out of Google ─────────────────────────────────────
{
  const snip = `<script>gtag('event', 'conversion', {'send_to': 'AW-123456789/AbC-dEfGh'});</script>`;
  const p = parseConversionLabel(snip);
  eq("the account tag is read off the snippet", p.conversionId, "AW-123456789");
  eq("and so is the label", p.label, "AbC-dEfGh");
  ok("a snippet with no send_to gives nothing rather than a guess", parseConversionLabel("<script>nope</script>") === null);
  ok("and so does an empty one", parseConversionLabel("") === null);

  const rows = [
    { conversionAction: { name: "BoldLine Form Submission", id: "1", resourceName: "customers/1/conversionActions/1",
                          tagSnippets: [{ eventSnippet: snip }] } },
    { conversionAction: { name: "BoldLine Qualified Lead", id: "2", resourceName: "customers/1/conversionActions/2" } },
    // 🔴 A client may already have their own conversion actions. Adopting one would
    // change what their account bids on without anyone deciding to.
    { conversionAction: { name: "Someone Else's Purchase", id: "9", resourceName: "customers/1/conversionActions/9" } },
  ];
  const mapped = mapConversionRows(rows);
  eq("our actions are recognised by name", Object.keys(mapped).sort().join(","), "form,qualified");
  eq("with the resource name the upload needs", mapped.qualified.resourceName, "customers/1/conversionActions/2");
  eq("and the label the page needs", mapped.form.label, "AbC-dEfGh");
  ok("a conversion action we did not create is left alone",
    !Object.values(mapped).some((a) => /Someone Else/.test(a.name)));
  ok("nothing breaks on an empty read", Object.keys(mapConversionRows([])).length === 0);
  ok("or a malformed one", Object.keys(mapConversionRows(null)).length === 0);
}

// ── 4. The date format Google actually accepts ────────────────────────────────
{
  const s = gadsDateTime(new Date("2026-08-24T16:05:09Z"));
  eq("dates go out in Google's format, not ISO", s, "2026-08-24 16:05:09+00:00");
  ok("with no T in the middle", !/T/.test(s));
  ok("and always an explicit offset, so it cannot land on the wrong day", /\+00:00$/.test(s));
  ok("a bad date returns nothing rather than a wrong one", gadsDateTime("not a date") === null);
}

// ── 5. 🔴 THE CLICK ID, WITHOUT WHICH NONE OF THIS WORKS ──────────────────────
{
  // 🔴 READ THIS BEFORE SIMPLIFYING IT BACK. The first draft wrote `clickIdOf({...}).kind`
  // directly. Dropping iPhone support then made the function return null, and the test
  // died on a TypeError instead of reporting a failure, which killed every assertion
  // after it. A guard that crashes is not a guard that reports.
  const kindOf = (lead) => (clickIdOf(lead) || {}).kind || null;
  eq("a normal click is found", kindOf({ gclid: "abc" }), "gclid");
  // Google sends these instead when the browser blocks the usual one, mostly on iPhones.
  // Ignoring them would silently drop a large share of real leads.
  eq("an iPhone click is found too", kindOf({ wbraid: "wb1" }), "wbraid");
  eq("and the other iPhone kind", kindOf({ gbraid: "gb1" }), "gbraid");
  eq("the normal one wins when several are present", kindOf({ gbraid: "g", gclid: "c" }), "gclid");
  ok("a lead with none says so", clickIdOf({ name: "Bob" }) === null);
  ok("and blank strings do not count as one", clickIdOf({ gclid: "   " }) === null);
}

// ── 6. A won lead is a qualified lead ─────────────────────────────────────────
// Without this rule a lead that jumps straight to won never reports as qualified, and
// the primary conversion the whole account bids on quietly under-counts.
{
  ok("a won lead counts as won", leadIsAtStage({ status: "won" }, "won"));
  ok("and also as qualified", leadIsAtStage({ status: "won" }, "qualified"));
  ok("a qualified lead counts as qualified", leadIsAtStage({ qualified: true }, "qualified"));
  ok("but NOT as won", !leadIsAtStage({ qualified: true }, "won"));
  ok("an ungraded lead counts as neither", !leadIsAtStage({ status: "new" }, "qualified"));
  ok("and a lost one does not sneak through", !leadIsAtStage({ status: "lost" }, "qualified"));
}

// ── 7. The upload plan: what is sent, what is skipped, and why ────────────────
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const CLIENT = {
  conversionActions: {
    qualified: { resourceName: "customers/1/conversionActions/2" },
    won:       { resourceName: "customers/1/conversionActions/3" },
  },
  leadsLog: [
    { name: "Good",      qualified: true, qualifiedAt: ago(2), gclid: "c1", receivedAt: ago(3) },
    { name: "Ungraded",  gclid: "c2", receivedAt: ago(3) },
    { name: "No click",  qualified: true, receivedAt: ago(3) },
    { name: "Already",   qualified: true, gclid: "c4", receivedAt: ago(3), gadsUploaded: { qualified: ago(1) } },
    { name: "Ancient",   qualified: true, gclid: "c5", receivedAt: ago(200), clickAt: ago(200) },
    { name: "Customer",  status: "won", wonAt: ago(1), orderValue: 4200, gclid: "c6", receivedAt: ago(5) },
  ],
};
{
  const p = uploadPlan(CLIENT, { stage: "qualified" });
  ok("the plan is usable", p.ok);
  eq("only the leads Google can actually count are sent", p.rows.length, 2);   // Good + Customer
  const names = p.rows.map((r) => CLIENT.leadsLog[r.index].name).sort().join(",");
  eq("and they are the right ones", names, "Customer,Good");

  // 🔴 EVERY SKIP CARRIES A REASON. A silent skip looks exactly like a working upload
  // that Google ignored, which is a bug nobody finds for months.
  const why = Object.fromEntries(p.skipped.map((s) => [CLIENT.leadsLog[s.index].name, s.reason]));
  ok("a lead already sent is not sent twice", /already sent/.test(why["Already"] || ""));
  ok("a lead with no click says exactly that", /no click id/.test(why["No click"] || ""));
  ok("and an expired click says how old it is", /past Google's 90 day limit/.test(why["Ancient"] || ""));
  ok("an ungraded lead is not in the plan at all", !("Ungraded" in why) && !names.includes("Ungraded"));

  const row = p.rows.find((r) => CLIENT.leadsLog[r.index].name === "Good").row;
  eq("the click id goes on the row", row.gclid, "c1");
  eq("pointed at the right conversion action", row.conversionAction, "customers/1/conversionActions/2");
  ok("with a Google-formatted date", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+00:00$/.test(row.conversionDateTime));
  // A qualified lead's worth is an average, and the average already sits on the
  // conversion action. Sending it per row is the same estimate wearing a disguise.
  ok("a qualified lead carries no invented value", row.conversionValue === undefined);
}

{
  const p = uploadPlan(CLIENT, { stage: "won" });
  eq("only actual customers are sent as customers", p.rows.length, 1);
  const row = p.rows[0].row;
  eq("and the real order value goes with it", row.conversionValue, 4200);
  eq("in dollars", row.currencyCode, "USD");
  eq("against the customer conversion action", row.conversionAction, "customers/1/conversionActions/3");
}

// ── 8. It refuses to run rather than sending something wrong ──────────────────
{
  const nothing = uploadPlan({ leadsLog: [{ qualified: true, gclid: "x" }] }, { stage: "qualified" });
  ok("with no conversion action set up, it stops", !nothing.ok);
  ok("and says why in plain words", /has not been created in the ad account/.test(nothing.error), nothing.error);

  const bogus = uploadPlan(CLIENT, { stage: "banana" });
  ok("an unknown stage is refused", !bogus.ok);
  // The form action is fired by the page, so uploading it would double-count every
  // single lead: once from the tag, once from here.
  const formStage = uploadPlan(CLIENT, { stage: "form" });
  ok("the page-fired action can never be uploaded", !formStage.ok);

  ok("an empty client does not throw", uploadPlan({}, { stage: "qualified" }).rows.length === 0);
  ok("nor does nothing at all", uploadPlan(null, { stage: "qualified" }).rows.length === 0);
}

// ── 9. Wiring: the click is captured, and only what Google took is marked sent ─
{
  // The capture has to happen on the page, at the visit. By the time anyone knows the
  // lead was good, the query string is long gone.
  ok("the landing page reads the click id from the URL", /new URLSearchParams\(location\.search\)/.test(LANDING_CODE));
  // All three kinds. The page interpolates the shared list rather than hardcoding it, so
  // this checks the list it interpolates. The capture code is EXECUTED against a fake
  // browser in verify-attribution; this is only the wiring.
  ok("all three kinds", /var CK=\$\{JSON\.stringify\(CLICK_KEYS\)\}/.test(LANDING_CODE)
    && CLICK_KEYS.length === 3 && ["gclid", "wbraid", "gbraid"].every((k) => CLICK_KEYS.includes(k)));
  ok("it survives a visitor who comes back later", /localStorage\.setItem\('bl_'\+k/.test(LANDING_CODE));
  ok("but not past Google's matching window", /90\*864e5/.test(LANDING_CODE));
  ok("and it is sent with the form", /var ids=clickIds\(\)/.test(LANDING_CODE));
  ok("the form conversion fires on success, not on click",
    /lf-thanks'\)\.style\.display='block';\$\{formConversion\}/.test(LANDING) || /formConversion\}/.test(LANDING));

  ok("the intake stores the click id", /Object\.assign\(lead, pickAttribution\(body\)\)/.test(INTAKE_CODE));
  // This endpoint is public, so it takes only the fields it knows about. Run rather than
  // matched: the allow list is the actual protection, and a regex on its shape would pass
  // just as happily if the loop below it copied everything.
  ok("and only those, since the endpoint is public",
    !("status" in pickAttribution({ gclid: "G1", status: "won" }))
    && pickAttribution({ gclid: "G1", status: "won" }).gclid === "G1");
  // A visitor's clock cannot be trusted, and a future date would make an expired click
  // look fresh enough to upload.
  ok("a click date in the future is refused", /clickAt <= Date\.now\(\)/.test(INTAKE_CODE));

  // 🔴 MARKING A REJECTED ROW AS SENT WOULD HIDE IT FOREVER.
  ok("only rows Google accepted are marked as sent", /if \(rejected\.has\(i\)\) return;/.test(GADS_CODE));
  ok("partial failures are read row by row", /partialFailureError/.test(GADS_CODE));
  ok("and the upload asks for them", /partialFailure: true/.test(GADS_CODE));
  ok("it is not a dry run", /validateOnly: false/.test(GADS_CODE));

  // Creating these twice would split the conversion history across duplicates, which is
  // worse than having none: bidding then sees half the evidence.
  ok("setup reads what exists before creating anything", /const existing = await readConversionActions/.test(GADS_CODE));
  ok("and only creates what is missing", /const missing = CONVERSION_ACTIONS\.filter\(\(a\) => !existing\[a\.key\]\)/.test(GADS_CODE));
  ok("then re-reads, because the create call carries no tag snippet",
    /const actions = await readConversionActions/.test(GADS_CODE));
}

// ── 10. The OS surface tells the truth about what it knows ────────────────────
{
  ok("the conversion card exists", /function ConversionLoopCard/.test(UI_CODE));
  ok("and is only shown for an account that can actually use it",
    /if\(!client\.googleAdsCustomerId\) return null;/.test(UI_CODE));
  ok("a lead can be graded", /patchLead\(idx,\{qualified:!lead\.qualified\}\)/.test(UI_CODE));
  ok("and a won one records what it was worth", /patchLead\(idx,\{orderValue:v\}\)/.test(UI_CODE));
  // Google refuses a conversion dated before its click, so the moment is recorded when it
  // happens rather than guessed at later.
  ok("grading stamps the time it happened", /if \(patch\.status === "won" && !out\.wonAt\) out\.wonAt = now;/.test(UI_CODE));
  ok("a won lead is marked qualified too", /if \(patch\.status === "won" && !out\.qualified\)/.test(UI_CODE));
  ok("a lead with no click says so on the row", /No ad click on this lead/.test(UI));

  ok("the scorecard exists", /function ScorecardCard/.test(UI_CODE));
  // Same rule as the cost-per-lead fix: a zero is a claim, an empty field is the truth.
  ok("an unmeasurable figure reads as not measured, never zero", /\{v\|\|"Not measured"\}/.test(UI_CODE));
  ok("and the profit margin it needs is a real field in Edit",
    /k:"grossMarginPct"/.test(UI_CODE) && /campaignSetup\|\|\{\}\)\.grossMarginPct/.test(UI_CODE));
}


// ── 🔴 THE ADS LANDING PAGE ACTUALLY CAPTURES A LEAD ──────────────────────────
// 2026-08-28: the Meta campaign had 4,360 impressions, 101 clicks, 88 landing page views
// and ZERO leads. The form worked; the ASK was wrong. Every button on /get-started wanted a
// 30-minute phone call from someone who had been scrolling Facebook ninety seconds earlier.
// The free Lead-Leak Check, an automated audit that costs the visitor ten seconds and
// BoldLine nothing, existed the whole time on the homepage and was absent from the one page
// paid traffic lands on.
//
// This pins the PLUMBING, not the wording. Bryson should be free to rewrite the copy without
// a test arguing with him; what must not silently break is the path from a submit to a lead.
{
  const gs = readFileSync(new URL("../marketing-site/get-started/index.html", import.meta.url), "utf8");

  ok("🔴 the ads landing page offers something that is not a phone call",
    /id="leakForm"/.test(gs) && /id="lk-website"/.test(gs) && /id="lk-email"/.test(gs),
    "paid social traffic did not come looking for you, and a 30-minute call is too big a first ask");
  ok("it posts to the audit endpoint that writes the lead and sends the report",
    /fetch\('\/\.netlify\/functions\/audit'/.test(gs));
  // 🔴 Without this every audit lead looks like it came from the homepage, and the one
  // number that says whether the ad spend is working becomes unreadable.
  ok("🔴 and tags itself so ad leads are tellable apart from homepage leads",
    /source:\s*'get-started'/.test(gs));
  // 🔴 THE PAGE HAS ONE TRACKER AND EVERY LEAD PATH MUST GO THROUGH IT.
  // `blConversion` reports to GA4, to Google Ads AND to Meta, and dedupes. The first version
  // of the audit form called fbq('track','Lead') directly, which told Meta and told GA4 and
  // Google Ads nothing at all. Caught 2026-08-28 by Bryson asking whether tracking still
  // worked. A second implementation of one thing is how half of it silently stops happening.
  ok("🔴 the audit form reports through the page's own tracker, not a hand-rolled call",
    /blConversion\('audit'\)/.test(gs),
    "a raw fbq call reaches Meta only, so GA4 and Google Ads never hear about the lead");
  // 🔴 Comments stripped first. The comment EXPLAINING why the hand-rolled call was wrong
  // quotes the hand-rolled call, and the naive check matched it. KB `repo-tests` records
  // this exact trap; it has now caught me five times.
  const gsCode = gs.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("and it does not bypass it with a direct pixel call",
    !/fbq\('track','Lead'\)/.test(gsCode),
    "the only fbq lead call on the page should be the one inside blConversion");
  ok("the shared tracker still reaches all three, or routing to it buys nothing",
    /gtag\('event', 'generate_lead'/.test(gs) && /send_to: T\.googleAdsId/.test(gs) && /fbq\('track', kind/.test(gs));
  ok("and it still refuses to count the same visitor twice", /if\(fired\[kind\]\) return;/.test(gs));
  ok("the honeypot came across with it, or the audit inbox fills with bots",
    /name="company"[^>]*tabindex="-1"/.test(gs));

  // Fewer fields, more submissions. Three is the floor that still identifies a person.
  const fields = (gs.match(/<input(?![^>]*type="hidden")(?![^>]*tabindex="-1")|<textarea/g) || []).length;
  ok("the page is not asking for more than it needs", fields <= 6, `${fields} visible fields`);
  ok("🔴 the call-back form still takes a name, a business and an email",
    /name="name"[^>]*required/.test(gs) && /name="business"[^>]*required/.test(gs) && /name="email"[^>]*required/.test(gs),
    "trimming fields must not cost the three that make a lead worth having");
}

console.log(`verify-conversion-loop: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
