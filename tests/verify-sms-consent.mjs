// SMS consent, and the second CRM wire format that carries it.
//
// Two things shipped together because they are the same promise. Shaun Smith (Stencil &
// Thread's developer), 2026-08-29: *"If the form doesn't carry a consent checkbox, the lead
// still lands in the CRM and Sebastian still sees it, but it gets no text. The one-minute
// response that makes ad leads convert never happens, and the campaign quietly loses the
// thing we both want from it."* A grep for consent across the repo returned nothing, so the
// form collected none, the intake stored none, the payload sent none, and the auto-reply
// texted everyone regardless.
//
// 🔴 WHAT THIS SUITE IS REALLY FOR. Two failure directions, and they are not symmetric:
//   TEXTING SOMEONE WHO DECLINED is the one that matters legally and is unrecoverable.
//   NOT TEXTING SOMEONE WHO NEVER SAW A CHECKBOX would silently switch off speed-to-lead for
//   every existing client and every lead from Calendly or the marketing site, and would look
//   exactly like "no leads today".
// So the three-way rule (yes / no / never asked) is the centre of the whole thing, and a
// two-way reading of it passes a careless test while breaking one of those directions.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const { consentYes, pickConsent, consentField, mayTextLead, CONSENT_KEYS } =
  await import("../netlify/lib/sms-consent.mjs");
const { crmFormat, crmFormPayload, crmBody, crmPayload, forwardLead, signBody } =
  await import("../netlify/lib/crm-forward.mjs");
const { renderLandingPage } = await import("../netlify/functions/landing.mjs");

// ── 1. Reading a checkbox, from every shape it actually arrives in ───────────
{
  // A plain HTML form sends "on". Our JSON post sends a real boolean. A hand-rolled request
  // could send anything. All three reach the same function.
  ok("a ticked HTML checkbox is yes", consentYes("on"));
  ok("a real boolean is yes", consentYes(true));
  ok("the literal yes is yes", consentYes("yes"));
  ok("and so are true, 1 and checked", consentYes("true") && consentYes("1") && consentYes("checked"));
  ok("casing and padding do not matter", consentYes("  YES  ") && consentYes("On"));

  // 🔴 The direction that matters. Guessing yes is the mistake that texts a stranger.
  ok("🔴 absent is NOT consent", !consentYes(undefined) && !consentYes(null));
  ok("🔴 an empty string is NOT consent", !consentYes(""));
  ok("🔴 false and 'no' and 'off' are not consent",
    !consentYes(false) && !consentYes("no") && !consentYes("off") && !consentYes("0"));
  ok("🔴 and neither is anything unrecognised", !consentYes("maybe") && !consentYes("sure") && !consentYes({}),
    "an allow list, not a deny list: an unknown value must never be read as agreement");
}

// ── 2. 🔴 THE THREE-WAY RULE. This is the whole feature ──────────────────────
{
  ok("🔴 ticked the box, we may text", mayTextLead({ smsConsentTransactional: true }));
  ok("🔴 was asked and declined, we may NOT text", !mayTextLead({ smsConsentTransactional: false }),
    "this is the entire point of asking, and the one direction that is legally unrecoverable");
  ok("🔴 was never asked at all, we may text, exactly as before",
    mayTextLead({ name: "Dana", phone: "+16025550100" }),
    "leads predating the checkbox, and leads from Calendly or the marketing site, carry no "
    + "such field. Gating on absence would switch off every client's speed-to-lead reply as "
    + "a side effect of shipping this, and would look identical to no leads arriving");

  // The distinction only survives because the key is WRITTEN even when false. If the intake
  // dropped falsey values, "declined" would decay into "never asked" and start texting them.
  const declined = pickConsent({ smsConsentTransactional: "", smsConsentMarketing: "" });
  ok("🔴 declining is recorded as a present false, not an absent key",
    Object.prototype.hasOwnProperty.call(declined, "smsConsentTransactional")
      && declined.smsConsentTransactional === false);
  ok("🔴 and that recorded decline is honoured", !mayTextLead(declined),
    "the round trip is the test: a lead who unticked the box must still be un-textable after "
    + "being stored and read back");
  ok("an empty lead or no lead is treated as never asked", mayTextLead({}) && mayTextLead(null));
}

// ── 3. What the intake stores ────────────────────────────────────────────────
{
  const both = pickConsent({ smsConsentTransactional: "on", smsConsentMarketing: "on" });
  ok("both consents are read independently", both.smsConsentTransactional === true && both.smsConsentMarketing === true);

  const onlyTx = pickConsent({ smsConsentTransactional: true });
  ok("🔴 agreeing to be texted is not agreeing to marketing",
    onlyTx.smsConsentTransactional === true && onlyTx.smsConsentMarketing === false,
    "conflating them means the record cannot prove which one was given");

  const none = pickConsent({});
  eq("every key is always written", Object.keys(none).sort().join(","), CONSENT_KEYS.slice().sort().join(","));
  ok("and all default to false", none.smsConsentTransactional === false && none.smsConsentMarketing === false);
}

// ── 4. The form the visitor actually sees ────────────────────────────────────
// Rendered by the real page builder, both variants, because a checkbox that exists only in
// the managed form leaves the hand-off pages collecting nothing.
{
  const cl = {
    name: "Stencil & Thread", landingSlug: "stencil", leadToken: "TOK",
    campaignSetup: { serviceArea: "Eugene, OR" },
    landingPage: { headline: "Custom shirts, fast.", subheadline: "25 pieces or more.", ctaText: "Get a quote", published: true },
  };
  const managed = renderLandingPage(cl);
  const ho = renderLandingPage(cl, { handoff: { phone: "(541) 555-0100" } });

  for (const [label, html] of [["managed", managed], ["hand-off", ho]]) {
    ok(`the ${label} form has a transactional consent box`, html.includes('name="smsConsentTransactional"'));
    ok(`the ${label} form has a separate marketing consent box`, html.includes('name="smsConsentMarketing"'));

    // 🔴 A pre-ticked box is not consent, it is the appearance of consent.
    const boxes = html.match(/<input type="checkbox"[^>]*>/g) || [];
    ok(`🔴 no consent box in the ${label} form is pre-ticked`,
      boxes.length >= 2 && boxes.every((b) => !/\bchecked\b/.test(b)),
      "express consent cannot be given by a box the visitor never touched");
    ok(`🔴 and none of them blocks the form`,
      boxes.every((b) => !/\brequired\b/.test(b)),
      "marketing consent must never be a condition of submitting, and a lead who declines "
      + "must still reach the client");

    // The disclosure has to say who is texting and how to stop.
    ok(`the ${label} disclosure names the business, not BoldLine`,
      html.includes("Stencil &amp; Thread may send you text messages"),
      "the reader is on the client's own domain and has never heard of BoldLine");
    ok(`the ${label} disclosure covers rates and opting out`,
      /Message and data rates may apply/.test(html) && /Reply STOP/.test(html));
  }

  // 🔴 The managed form posts JSON, so the boxes existing in the markup proves nothing on
  // its own. The submit handler has to read them and send them.
  ok("🔴 the managed submit sends both consents", /payload\.smsConsentTransactional=/.test(managed)
    && /payload\.smsConsentMarketing=/.test(managed),
    "checkboxes the JSON post ignores would collect consent into thin air");
  ok("🔴 and sends them even when unticked", /!!\(sc&&sc\.checked\)/.test(managed),
    "sending only when true would make a decline indistinguishable from never being asked, "
    + "which is exactly the case the auto-reply gate turns on");
  ok("the managed submit sends the page it was filled in on", /payload\.page=location\.href/.test(managed));
}

// ── 5. Which wire format a client gets ───────────────────────────────────────
{
  eq("json by default", crmFormat({}), "json");
  eq("json when nothing is configured at all", crmFormat(null), "json");
  eq("form when the client asks for it", crmFormat({ campaignSetup: { crmFormat: "form" } }), "form");
  eq("casing does not matter", crmFormat({ campaignSetup: { crmFormat: "FORM" } }), "form");
  eq("a record written before it moved into campaignSetup still works", crmFormat({ crmFormat: "form" }), "form");
  // 🔴 Unknown values fall back rather than inventing a third behaviour.
  eq("🔴 an unrecognised format is json, not an error and not form",
    crmFormat({ campaignSetup: { crmFormat: "xml" } }), "json");
}

// ── 6. 🔴 SHAUN'S PAYLOAD, FIELD BY FIELD ────────────────────────────────────
{
  const client = { name: "Stencil & Thread", campaignSetup: { crmFormat: "form", crmWebhook: "https://stencilandthread.com/api/ad-lead" } };
  const lead = {
    leadId: "lead-uuid-1", receivedAt: "2026-09-01T00:00:00.000Z",
    name: "Dana Reyes", email: "dana@example.com", phone: "+15415550123",
    message: "Need 60 shirts for a church retreat", page: "https://quote.stencilandthread.com/",
    source: "landing_page",
    gclid: "GCL-1", wbraid: "WB-1", gbraid: "GB-1", clickAt: "2026-08-31T20:00:00.000Z",
    utm_source: "google", utm_medium: "cpc", utm_campaign: "search",
    smsConsentTransactional: true, smsConsentMarketing: false,
  };
  const p = crmFormPayload(client, lead);

  eq("the enquiry text is his field name", p.details, "Need 60 shirts for a church retreat");
  eq("the dedupe key is his field name", p.lead_id, "lead-uuid-1");
  eq("the click time is his field name", p.click_timestamp, "2026-08-31T20:00:00.000Z");
  eq("the page comes through", p.page, "https://quote.stencilandthread.com/");
  eq("a first name is derived when we were not given one", p.first_name, "Dana");
  eq("but a real one wins", crmFormPayload(client, { ...lead, firstName: "Dee" }).first_name, "Dee");

  eq("consent is his literal yes", p.sms_consent_transactional, "yes");
  eq("and his literal no", p.sms_consent_marketing, "no");
  // 🔴 The absent case. His endpoint gates the text on this, so a lead we never asked must
  // arrive as "no" rather than as an empty field he might read as anything.
  const noConsentField = crmFormPayload(client, { name: "Sam", receivedAt: "2026-09-01T00:00:00.000Z" });
  eq("🔴 a lead who was never asked arrives as no, not blank",
    noConsentField.sms_consent_transactional, "no");

  // 🔴 The two he explicitly told us to stop sending.
  ok("🔴 source is absent", !("source" in p), "Shaun sets it server-side so everything feeding the CRM keeps one shape");
  ok("🔴 business is absent", !("business" in p));

  // Every UTM key present even when empty, so his mapping never branches on a vanishing field.
  const sparse = crmFormPayload(client, { name: "Sam", receivedAt: "2026-09-01T00:00:00.000Z" });
  ok("every utm key is present even when unknown",
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].every((k) => k in sparse));
  eq("the dedupe key falls back to the arrival time for older leads", sparse.lead_id, "2026-09-01T00:00:00.000Z");
}

// ── 7. The bytes on the wire, and the signature over them ───────────────────
{
  const formClient = { name: "Stencil & Thread", campaignSetup: { crmFormat: "form", crmWebhook: "https://stencilandthread.com/api/ad-lead", crmWebhookSecret: "shh" } };
  const jsonClient = { name: "Other Co", campaignSetup: { crmWebhook: "https://other.example.com/hook", crmWebhookSecret: "shh" } };
  const lead = { leadId: "L1", receivedAt: "2026-09-01T00:00:00.000Z", name: "Dana Reyes", phone: "+15415550123", message: "hi", smsConsentTransactional: true };

  const f = crmBody(formClient, lead);
  eq("a form client sends form-urlencoded", f.contentType, "application/x-www-form-urlencoded");
  ok("and the body is flat, one level, parseable as a query string",
    !f.text.includes("{") && new URLSearchParams(f.text).get("details") === "hi");
  eq("with his key names on the wire", new URLSearchParams(f.text).get("lead_id"), "L1");
  eq("and the consent string", new URLSearchParams(f.text).get("sms_consent_transactional"), "yes");

  const j = crmBody(jsonClient, lead);
  eq("🔴 every other client is untouched", j.contentType, "application/json");
  eq("byte for byte the payload they had before", j.text, JSON.stringify(crmPayload(jsonClient, lead)));

  // 🔴 The real forwardLead, with a fake fetch, because the format is only useful if the
  // request actually carries it. crmBody returning the right thing while the sender ignores
  // it is exactly the shape of bug this catches.
  const sent = [];
  const fakeFetch = async (url, init) => { sent.push({ url, init }); return { ok: true, status: 200 }; };
  const res = await forwardLead(formClient, lead, { fetchImpl: fakeFetch });
  ok("the forward succeeds", res && res.ok === true);
  eq("🔴 and it really sent form-urlencoded", sent[0].init.headers["content-type"], "application/x-www-form-urlencoded");
  eq("🔴 carrying the flat body", sent[0].init.body, f.text);
  ok("🔴 the signature covers the exact bytes that were sent",
    sent[0].init.headers["x-boldline-signature"] === await signBody(sent[0].init.body, "shh"),
    "signing a different serialisation than the one transmitted fails on his side with no "
    + "useful error, and the format change is exactly when that breaks");

  // The JSON client keeps sending JSON through the same code path.
  sent.length = 0;
  await forwardLead(jsonClient, lead, { fetchImpl: fakeFetch });
  eq("🔴 and a json client still sends json", sent[0].init.headers["content-type"], "application/json");
}

// ── 8. The auto-reply gate is wired into the intake, not just available ─────
// A pure function nothing calls is not a feature. The intake is the only place the text is
// sent from, so the call site is checked in the shipping source.
{
  const src = readFileSync(join(ROOT, "netlify/functions/lead-intake.mjs"), "utf8");
  const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  ok("🔴 the auto-reply text is gated on consent", /if \(lead\.phone && mayTextLead\(lead\)\)/.test(body),
    "collecting consent and then texting regardless is worse than never asking");
  ok("the intake records both consents onto the lead", /pickConsent\(body\)/.test(body));
  ok("and the page the form was filled in on", /page: String\(body\.page/.test(body));
  ok("🔴 the email auto-reply is NOT gated on SMS consent",
    body.indexOf("mayTextLead") < body.indexOf("if (lead.email)"),
    "an SMS checkbox says nothing about email, and someone who declined a text still asked "
    + "to be contacted");
}

console.log(`verify-sms-consent: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
