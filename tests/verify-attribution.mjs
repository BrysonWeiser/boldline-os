// Where a lead came from, and the one distinction the whole thing turns on.
//
// Shaun Smith, who runs Stencil & Thread's site, 2026-08-26: *"include the gclid and UTM
// fields alongside the contact info. I'll store them on the contact record in the CRM."*
// Easy to agree to, and easy to get subtly wrong, which is why this suite exists.
//
// 🔴 THE INVARIANT: A UTM TAG IS NOT A CLICK ID AND MUST NEVER BE TREATED AS ONE.
// A click id (gclid, wbraid, gbraid) is Google's own receipt for a paid click and the only
// thing an offline conversion upload can match on. A UTM tag is a label WE put on our own
// link. Google never reads one back. If a UTM ever gets to stand in for a click id, the
// scorecard reports revenue Google cannot see, the per-qualified-lead billing counts leads
// that were never attributable, and nobody finds out for months.
//
// The landing page's capture code is not re-described here. It is sliced out of the file
// that ships it and EXECUTED against a fake browser, because the last time a rule was only
// asserted about rather than run, the feature was broken on every single run and 144
// passing checks said otherwise (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CLICK_KEYS, UTM_KEYS, ATTRIBUTION_KEYS, pickAttribution, utmFields, hasClickId,
} from "../netlify/lib/attribution.mjs";
import { crmPayload } from "../netlify/lib/crm-forward.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANDING = readFileSync(join(ROOT, "netlify/functions/landing.mjs"), "utf8");
const INTAKE = readFileSync(join(ROOT, "netlify/functions/lead-intake.mjs"), "utf8");
// The comment trap: every one of these files explains itself at length, so a prose mention
// of a rule would satisfy a check that the rule is implemented. Strip comment lines first.
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const INTAKE_CODE = strip(INTAKE);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const DAY = 864e5;

// ── The real browser code, lifted out of the page that ships it ───────────────
// Not a copy. The template literal is read from source and evaluated with the same two
// key lists the function interpolates, so what runs below is byte for byte what a visitor
// executes. If somebody renames the block or hardcodes the keys again, this throws rather
// than quietly testing nothing.
const tplMatch = LANDING.match(/const clickJS = `([\s\S]*?)`;\n/);
if (!tplMatch) {
  console.error("  FAIL  could not find the landing page's capture code to execute");
  console.log("verify-attribution: 0 passed, 1 failed");
  process.exit(1);
}
const BROWSER_JS = new Function("CLICK_KEYS", "UTM_KEYS", "JSON", "return `" + tplMatch[1] + "`;")(CLICK_KEYS, UTM_KEYS, JSON);

// A fake browser. `store` is localStorage and survives between visits, which is the whole
// point of the 90 day recall.
function visit(search, store = {}) {
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const fn = new Function(
    "localStorage", "location", "URLSearchParams", "Date", "JSON",
    BROWSER_JS + "\nreturn clickIds();",
  );
  return { out: fn(localStorage, { search }, URLSearchParams, Date, JSON), store };
}
const remembered = (store, key) => { try { return JSON.parse(store["bl_" + key] || "null"); } catch { return null; } };

// ── 1. The lists themselves ───────────────────────────────────────────────────
{
  ok("all three of Google's click identifiers are first class",
    CLICK_KEYS.includes("gclid") && CLICK_KEYS.includes("wbraid") && CLICK_KEYS.includes("gbraid"));
  // wbraid and gbraid are what Google sends INSTEAD of gclid when the browser blocks it,
  // which is most iPhone traffic. Dropping them loses roughly half the attribution.
  eq("and there are exactly three of them", CLICK_KEYS.length, 3);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    ok(`the standard tag ${k} is carried`, UTM_KEYS.includes(k));
  }
  eq("five tags, no invented ones", UTM_KEYS.length, 5);
  ok("🔴 and the two lists never overlap, so nothing is both",
    CLICK_KEYS.every((k) => !UTM_KEYS.includes(k)));
  eq("the allow list is the two lists and nothing else", ATTRIBUTION_KEYS.length, CLICK_KEYS.length + UTM_KEYS.length);
}

// ── 2. Arriving from an ad ────────────────────────────────────────────────────
{
  const { out, store } = visit("?gclid=ABC123&utm_source=google&utm_campaign=spring");
  eq("the click id is read off the URL", out.gclid, "ABC123");
  eq("the campaign label comes with it", out.utm_campaign, "spring");
  eq("and the source", out.utm_source, "google");
  ok("the moment of the click is stamped", !!out.clickAt && !Number.isNaN(Date.parse(out.clickAt)));
  ok("a tag that was not on the URL is simply absent", !("utm_term" in out));
  ok("the click id is kept for the return visit", (remembered(store, "gclid") || {}).v === "ABC123");
  ok("and so is the campaign", (remembered(store, "utm_campaign") || {}).v === "spring");
}

// ── 3. 🔴 A UTM TAG ALONE PROVES NOTHING ABOUT A GOOGLE CLICK ─────────────────
// This is the check the whole file is built around. `clickAt` decides whether an outcome
// is still inside Google's 90 day matching window at upload time. A lead that arrived with
// only a UTM was never matchable, so stamping that clock would age a lead Google is never
// going to recognise and make an unattributable lead look attributable.
{
  const { out } = visit("?utm_source=newsletter&utm_medium=email&utm_campaign=august");
  eq("the tags are still captured, because a human wants to read them", out.utm_source, "newsletter");
  eq("and the campaign", out.utm_campaign, "august");
  ok("🔴 but no click timestamp is stamped", !("clickAt" in out));
  ok("🔴 and no click id is invented", CLICK_KEYS.every((k) => !(k in out)));
  ok("so the OS does not think this came from an ad", !hasClickId(out));
}
{
  // The iPhone case, which is the majority of Google traffic and the one most likely to be
  // dropped by an implementation that only remembers gclid.
  const { out } = visit("?wbraid=WB_9&utm_source=google");
  eq("an iPhone click id is captured just as well", out.wbraid, "WB_9");
  ok("and it counts as coming from an ad", hasClickId(out));
  ok("with a click timestamp", !!out.clickAt);
}

// ── 4. Coming back later ──────────────────────────────────────────────────────
{
  const first = visit("?gclid=RETURN1&utm_campaign=spring");
  const second = visit("", first.store);      // typed the address in this time
  eq("the click id survives a later visit with a clean URL", second.out.gclid, "RETURN1");
  eq("and so does the campaign that brought them", second.out.utm_campaign, "spring");
  ok("the timestamp still points at the ORIGINAL click, not at today",
    Math.abs(Date.parse(second.out.clickAt) - Date.parse(first.out.clickAt)) < 2000,
    `${second.out.clickAt} vs ${first.out.clickAt}`);
}
{
  // Google will not match a click older than 90 days, so holding one past that would
  // produce uploads that are silently rejected and a scorecard that overstates.
  const stale = { "bl_gclid": JSON.stringify({ v: "OLD", t: Date.now() - 91 * DAY }) };
  const { out } = visit("", stale);
  ok("🔴 a click id older than Google's 90 day window is dropped", !("gclid" in out));
  ok("and nothing is stamped for it", !("clickAt" in out));
}
{
  const fresh = { "bl_gclid": JSON.stringify({ v: "STILLGOOD", t: Date.now() - 89 * DAY }) };
  eq("one inside the window is still used", visit("", fresh).out.gclid, "STILLGOOD");
}
{
  // Last touch wins. Somebody who clicks a second ad is now attributable to the second ad,
  // and the stored value has to move with them.
  const first = visit("?gclid=FIRST&utm_campaign=january");
  const second = visit("?gclid=SECOND&utm_campaign=february", first.store);
  eq("a newer click replaces the remembered one", second.out.gclid, "SECOND");
  eq("and the newer campaign replaces the old label", second.out.utm_campaign, "february");
}
{
  const { out } = visit("");
  eq("a visitor with no history and no tags carries nothing", Object.keys(out).length, 0);
}

// ── 5. The intake endpoint is public, so it takes only what it knows ──────────
{
  const got = pickAttribution({
    gclid: "G1", utm_source: "google", utm_term: "custom hoodies",
    // Everything below is what an attacker, or a careless integration, would send.
    status: "won", leads: 999, name: "not this way", isAdmin: true, __proto__x: "x",
  });
  eq("a known click id is taken", got.gclid, "G1");
  eq("a known tag is taken", got.utm_source, "google");
  eq("and another", got.utm_term, "custom hoodies");
  ok("🔴 a field that could rewrite the client record is dropped", !("status" in got) && !("leads" in got));
  ok("🔴 and so is anything else not on the list", !("isAdmin" in got) && !("name" in got));
  eq("nothing extra came along at all", Object.keys(got).length, 3);
}
{
  eq("blank values are not stored as empty strings", Object.keys(pickAttribution({ gclid: "", utm_source: "   " })).length, 0);
  eq("surrounding spaces are trimmed off", pickAttribution({ gclid: "  G2  " }).gclid, "G2");
  eq("an absurdly long value is cut rather than stored whole", pickAttribution({ utm_campaign: "x".repeat(5000) }).utm_campaign.length, 200);
  eq("a number is coerced to text like everything else", pickAttribution({ utm_content: 42 }).utm_content, "42");
  eq("nothing at all is handled", Object.keys(pickAttribution(null)).length, 0);
}
{
  // The endpoint must actually USE the shared list rather than keeping its own copy, which
  // is exactly how the click ids and the CRM payload drifted apart the first time.
  ok("the intake endpoint picks attribution through the shared list", /pickAttribution\(body\)/.test(INTAKE_CODE));
  ok("🔴 and no longer carries a hardcoded key list of its own",
    !/\["gclid",\s*"wbraid",\s*"gbraid"\]/.test(INTAKE_CODE));
  ok("every lead is minted with its own id for the receiving end to dedupe on",
    /leadId:\s*crypto\.randomUUID\(\)/.test(INTAKE_CODE));
}

// ── 6. What the client's CRM actually receives ────────────────────────────────
const CLIENT = { name: "Stencil & Thread", campaignSetup: { crmWebhook: "https://crm.example.com/hook" } };
{
  const lead = {
    name: "Dana Cole", email: "d@co.com", phone: "555-0100", message: "40 hoodies",
    source: "landing_page", receivedAt: "2026-08-26T17:00:00.000Z", leadId: "lead-uuid-1",
    gclid: "G9", clickAt: "2026-08-20T09:00:00.000Z",
    utm_source: "google", utm_medium: "cpc", utm_campaign: "hoodies", utm_term: "screen printing phoenix",
  };
  const p = crmPayload(CLIENT, lead);
  eq("the contact details go over", p.lead.email, "d@co.com");
  eq("the click id goes with them", p.attribution.gclid, "G9");
  eq("so does the campaign", p.attribution.utm_campaign, "hoodies");
  eq("and the search that produced it", p.attribution.utm_term, "screen printing phoenix");
  eq("this one is flagged as coming from an ad", p.attribution.fromAd, true);
  eq("and carries its dedupe key", p.leadId, "lead-uuid-1");
  // A receiving system that has to branch on "is this field even here" will get it wrong
  // once, so the shape never changes between leads.
  for (const k of UTM_KEYS) ok(`${k} is always present in the payload`, k in p.attribution);
  eq("a tag nobody set arrives empty rather than missing", p.attribution.utm_content, "");
}
{
  // The dangerous lead: labelled by us, never recognised by Google.
  const p = crmPayload(CLIENT, { receivedAt: "2026-08-26T17:00:00.000Z", utm_source: "newsletter", utm_campaign: "august" });
  eq("its tags are reported", p.attribution.utm_source, "newsletter");
  eq("🔴 but it is NOT reported as coming from an ad", p.attribution.fromAd, false);
  eq("and it carries no click id", p.attribution.gclid, "");
  eq("nor a click time", p.attribution.clickAt, "");
}
{
  const p = crmPayload(CLIENT, { receivedAt: "2026-08-26T17:00:00.000Z", wbraid: "WB1" });
  eq("🔴 an iPhone click id alone still counts as an ad lead", p.attribution.fromAd, true);
  const g = crmPayload(CLIENT, { receivedAt: "2026-08-26T17:00:00.000Z", gbraid: "GB1" });
  eq("and so does the other one", g.attribution.fromAd, true);
}
{
  // Leads stored before the id existed still have to be dedupable, and the timestamp they
  // arrived at is unique to the millisecond.
  const p = crmPayload(CLIENT, { receivedAt: "2026-08-01T12:00:00.123Z" });
  eq("an older lead falls back to its arrival time as the dedupe key", p.leadId, "2026-08-01T12:00:00.123Z");
  ok("which is never blank", !!p.leadId);
}
{
  const f = utmFields({ utm_source: "google" });
  eq("the flat tag view always has five keys", Object.keys(f).length, 5);
  eq("filled where known", f.utm_source, "google");
  eq("and empty, not missing, where not", f.utm_medium, "");
  eq("nothing at all still gives the full shape", Object.keys(utmFields(null)).length, 5);
}
{
  ok("a lead with nothing is not from an ad", !hasClickId({}));
  ok("nor is one with only tags", !hasClickId({ utm_source: "google", utm_medium: "cpc" }));
  ok("a blank click id does not count either", !hasClickId({ gclid: "   " }));
  ok("but a real one does", hasClickId({ gclid: "G1" }));
}

console.log(`verify-attribution: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
