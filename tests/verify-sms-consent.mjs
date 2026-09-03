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

const { consentYes, consentGranted, pickConsent, consentField, mayTextLead, weSendTheText, CONSENT_IMPLIED, CONSENT_KEYS } =
  await import("../netlify/lib/sms-consent.mjs");
const { crmFormat, crmFormPayload, crmBody, crmPayload, forwardLead, signBody, signFields, canonicalFields } =
  await import("../netlify/lib/crm-forward.mjs");

// Independent HMAC, so the test does not prove the code correct by calling the code.
const hmacCheck = async (msg, secret) => {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(msg).digest("hex");
};
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

  // 🔴 THE LEGACY FOURTH CASE. Nothing produces "implied" any anymore (the tick box came back
  // the same day it left), but leads captured in that window carry it. A lead that genuinely
  // consented must not become un-textable because we changed the mechanism afterwards.
  ok("🔴 a lead stored during the disclosure window is still textable",
    mayTextLead({ smsConsentTransactional: CONSENT_IMPLIED }),
    "changing the mechanism must not retroactively revoke a real person's consent");
  ok("and casing or padding on the way back does not break it",
    mayTextLead({ smsConsentTransactional: "  Implied " }));

  // 🔴 AND IT MUST NOT LEAK INTO THE STRICT TEST. `consentYes` is what marketing turns on,
  // and marketing is the direction where a wrong yes is unrecoverable.
  ok("🔴 implied is NOT an affirmative tick", !consentYes(CONSENT_IMPLIED),
    "widening consentYes would have quietly made every lead a marketing opt-in");
  ok("but it is a basis to send the reply", consentGranted(CONSENT_IMPLIED));
  ok("and consentGranted is still strict about everything else",
    !consentGranted("maybe") && !consentGranted("") && !consentGranted(undefined) && !consentGranted(false));
}

// ── 2b. 🔴 WHO SENDS THE FIRST TEXT ──────────────────────────────────────────
// Two systems both texting a new lead is the failure that looks like success: neither can
// see the other, the lead gets two near-identical texts from two numbers, and nothing errors.
{
  const withCrm = (smsSender) => ({ campaignSetup: { crmWebhook: "https://crm.example.com/in", smsSender } });

  ok("🔴 by default WE send it", weSendTheText({}) && weSendTheText(withCrm("")) && weSendTheText(null),
    "a default that handed the text away would silently switch off every existing client's "
    + "speed-to-lead reply, which is a worse bug than the one this prevents");
  ok("🔴 set to their system, we stay quiet", !weSendTheText(withCrm("their")),
    "otherwise the lead gets two texts from two different numbers seconds apart");
  ok("and the obvious spellings all work",
    !weSendTheText(withCrm("Theirs")) && !weSendTheText(withCrm(" THEM "))
      && !weSendTheText(withCrm("client")),
    "a setting that only accepts one exact word is a setting that silently does nothing");

  // 🔴 The guard that stops a typo turning speed-to-lead off entirely.
  ok("🔴 but handing it to a system we do not forward to is ignored",
    weSendTheText({ campaignSetup: { smsSender: "their" } }),
    "with no address to forward to, nobody texts at all, which is the same silence as a "
    + "broken integration and no more visible");
  ok("an unrecognised value falls back to us", weSendTheText(withCrm("shaun")),
    "guessing that an unknown word means them is guessing in the direction of silence");
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

  // 🔴 THE RECORD KEEPS *HOW* CONSENT WAS GIVEN, not just that it was.
  const implied = pickConsent({
    smsConsentTransactional: "implied",
    consentDisclosure: "By submitting this form you agree that Stencil & Thread may text you about your quote.",
  });
  eq("🔴 a legacy implied value round-trips as itself", implied.smsConsentTransactional, CONSENT_IMPLIED);
  ok("🔴 and the exact wording shown is stored with it",
    /may text you about your quote/.test(implied.consentDisclosure || ""),
    "otherwise the record proves consent was given but not to what, and page copy changes");
  const ticked = pickConsent({
    smsConsentTransactional: "on",
    consentDisclosure: "Text me updates about my quote and order from Stencil & Thread. Optional, not required to get a quote.",
  });
  ok("a ticked box stores the label that was beside it",
    ticked.smsConsentTransactional === true && /Optional, not required/.test(ticked.consentDisclosure || ""));
  ok("🔴 there is no implied MARKETING consent, ever",
    pickConsent({ smsConsentMarketing: "implied" }).smsConsentMarketing === false,
    "offers later need a real tick and no wording on a page can stand in for one");
  ok("no disclosure key is invented when none was sent",
    !Object.prototype.hasOwnProperty.call(none, "consentDisclosure"));
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

    // 🔴 THE WORDS AND THE MECHANISM HAVE TO AGREE. This is the whole reason the tick box came
    // back on 2026-09-03 after a few hours as small print under the button. The registered
    // wording contains "Optional, not required to get a quote". A sentence saying "optional"
    // above a mechanism with no way to decline is not a weaker record, it is a FALSE one: the
    // reader is told they have a choice and is then recorded as having made it.
    // 🔴 Matched loosely on purpose. Pinning the whole tag made a PRE-TICKED box fail here
    // instead of on the pre-ticked check below, which is a guard reporting its neighbour's
    // problem: one edit away from failing for no reason at all.
    ok(`🔴 the ${label} consent is a box the visitor ticks, not a hidden field`,
      /<input type="checkbox" id="lf-sms" name="smsConsentTransactional"/.test(html)
        && !/id="lf-tx"/.test(html) && !/value="implied"/.test(html),
      "the wording says optional, so there has to be a way to decline it");

    // 🔴 A pre-ticked box is not consent, it is the appearance of consent.
    const boxes = html.match(/<input type="checkbox"[^>]*>/g) || [];
    ok(`🔴 no consent box in the ${label} form is pre-ticked`,
      boxes.length >= 2 && boxes.every((b) => !/\bchecked\b/.test(b)),
      "express consent cannot be given by a box the visitor never touched");
    ok(`🔴 and none of them blocks the form`,
      boxes.every((b) => !/\brequired\b/.test(b)),
      "marketing consent must never be a condition of submitting, and a lead who declines "
      + "must still reach the client");

    // 🔴 THE REGISTERED WORDING, WORD FOR WORD. Shaun Smith, 2026-09-03: the carriers audit
    // the live page against what the business filed, so every clause here is load-bearing and
    // the two we had written ourselves out of existence are named separately below.
    ok(`the ${label} consent line is the registered wording`,
      html.includes("Text me updates about my quote and order from Stencil &amp; Thread."),
      "wording we tidied ourselves is wording that no longer matches the filing");
    ok(`🔴 and it says the texting is OPTIONAL`,
      /Optional, not required to get a quote\./.test(html),
      "without this the page makes being texted a condition of getting a quote, which is the "
      + "opposite of what was filed");
    ok(`🔴 the ${label} line keeps the message frequency statement`,
      /Msg frequency varies/.test(html), "dropped by the wording we wrote ourselves");
    ok(`🔴 and the HELP keyword, not only STOP`,
      /Reply STOP to opt out, HELP for help\./.test(html), "also dropped by our own wording");
    ok(`the ${label} consent names the business, not BoldLine`,
      html.includes("from Stencil &amp; Thread"),
      "the reader is on the client's own domain and has never heard of BoldLine");

    // 🔴 Shaun, 2026-09-01: the box that gates the instant text must not look like the
    // optional one beside it.
    ok(`the ${label} form makes the texting box the prominent one`,
      /class="cons cons-main"/.test(html) && /\.cons-main label\{font-size:13px/.test(html));
  }

  // 🔴 THE WORDING IS NOT OURS TO WORD. Every business files its own, and the page has to
  // carry THAT one. Without this the next client whose filing reads differently is a code
  // change, which is how a live page drifts from a filing in the first place.
  const ownWording = renderLandingPage({
    ...cl,
    campaignSetup: { ...cl.campaignSetup, smsConsentText: "Txt me about my order from Acme Co. Optional. Reply STOP to quit." },
  });
  ok("🔴 a client's own filed wording is shown word for word",
    ownWording.includes("Txt me about my order from Acme Co. Optional. Reply STOP to quit."),
    "a business whose filing differs from our standard line cannot be launched at all");
  ok("and it replaces the standard line rather than joining it",
    !/Msg frequency varies/.test(ownWording),
    "two consent sentences in one label is worse than either alone");

  // 🔴 THE THREE LINKS. Shaun, same spec: A2P registration is checked against a privacy
  // policy, a terms page and a text-consent page linked from the consent language itself,
  // *"exactly as written"* including the .html, because the extensionless versions do not
  // resolve. A checkbox without them collects consent the carrier will not honour, which
  // fails in exactly the invisible way this whole feature exists to prevent.
  const withLinks = renderLandingPage({
    ...cl,
    campaignSetup: {
      ...cl.campaignSetup,
      privacyUrl: "https://stencilandthread.com/privacy.html",
      termsUrl: "https://stencilandthread.com/terms.html",
      smsOptInUrl: "https://stencilandthread.com/sms-opt-in.html",
    },
  });
  for (const u of ["privacy.html", "terms.html", "sms-opt-in.html"]) {
    ok(`🔴 the consent line links ${u}`, withLinks.includes(`https://stencilandthread.com/${u}"`),
      "a carrier requirement, not a nicety");
  }
  ok("🔴 the .html is preserved exactly as given", !/stencilandthread\.com\/privacy"/.test(withLinks),
    "Shaun: the extensionless versions will not resolve, so link them exactly as written");
  ok("the links sit inside the consent label, not loose on the page",
    /<label for="lf-sms">[\s\S]*?privacy\.html[\s\S]*?<\/label>/.test(withLinks));
  ok("and they open in a new tab so the form is not lost",
    /privacy\.html" target="_blank" rel="noopener"/.test(withLinks),
    "a visitor who taps Privacy mid-form must not lose what they typed");

  // 🔴 A client who does not text their leads leaves these blank. A dead link on a live page
  // is worse than no link, so nothing is rendered rather than an empty href.
  ok("🔴 no link line at all when none are configured",
    !/See <a/.test(managed) && !managed.includes('href=""'),
    "an empty href on a client's live page is the worse of the two failures");

  // Partial configuration is the realistic middle case and must not produce "See  and ."
  const partial = renderLandingPage({
    ...cl,
    campaignSetup: { ...cl.campaignSetup, privacyUrl: "https://stencilandthread.com/privacy.html" },
  });
  ok("one link reads as a sentence, with no stray joining words",
    /See <a[^>]*>Privacy Policy<\/a>\./.test(partial) && !/ and <\/label>/.test(partial));

  // 🔴 The managed form posts JSON, so the boxes existing in the markup proves nothing on
  // its own. The submit handler has to read them and send them.
  ok("🔴 the managed submit sends both consents", /payload\.smsConsentTransactional=/.test(managed)
    && /payload\.smsConsentMarketing=/.test(managed),
    "checkboxes the JSON post ignores would collect consent into thin air");
  ok("🔴 and sends them even when unticked", /!!\(sc&&sc\.checked\)/.test(managed)
      && /!!\(mc&&mc\.checked\)/.test(managed),
    "sending only when true would make a decline indistinguishable from never being asked, "
    + "which is exactly the case the auto-reply gate turns on");
  // 🔴 THE EXACT LABEL THEY WERE SHOWN, stored with the lead. The failure this whole round
  // trip came from was the live page drifting away from what the client filed with the
  // carriers, and a per-lead copy of the wording is the only record that survives an edit.
  ok("🔴 and carries the exact wording that was on screen",
    /payload\.consentDisclosure="Text me updates about my quote and order from Stencil/.test(managed),
    "without it the record says consent was given but not to what, and the page copy can change");
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

  // 🔴 AND AN IMPLIED CONSENT GOES OUT AS "yes". His endpoint only takes yes or no and gates
  // his own text-back on it, so sending "no" for a disclosure-based consent would stop him
  // texting every lead we send him. The disclosure under the button is exactly the basis his
  // A2P registration runs on.
  const impliedOut = crmFormPayload(client, {
    name: "Sam", receivedAt: "2026-09-01T00:00:00.000Z", smsConsentTransactional: "implied",
  });
  eq("🔴 an implied consent reaches his system as yes", impliedOut.sms_consent_transactional, "yes");
  eq("🔴 and marketing is still strictly the ticked box",
    crmFormPayload(client, { name: "Sam", receivedAt: "2026-09-01T00:00:00.000Z", smsConsentMarketing: "implied" })
      .sms_consent_marketing, "no");

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
  // 🔴 SHAUN'S SCHEME DELIBERATELY DOES NOT SIGN THE BYTES. The body goes as form-urlencoded;
  // the signature is over a JSON canonicalisation of the same fields, keys sorted A-Z, every
  // value a string, prefixed by a unix timestamp. Both ends can then agree on the canonical
  // form without agreeing on the wire encoding. Signing the urlencoded bytes is the obvious
  // mistake and fails with no useful error.
  {
    const h = sent[0].init.headers;
    ok("🔴 the request carries his timestamp header", /^\d{10}$/.test(h["X-BoldLine-Timestamp"] || ""));
    ok("🔴 and his prefixed signature header", /^sha256=[0-9a-f]{64}$/.test(h["X-BoldLine-Signature"] || ""));
    const params = new URLSearchParams(sent[0].init.body);
    const fields = {};
    for (const [k, v] of params) fields[k] = v;
    const expected = await hmacCheck(`${h["X-BoldLine-Timestamp"]}.${canonicalFields(fields)}`, "shh");
    ok("🔴 the signature is over the canonical FIELDS, not the body bytes",
      h["X-BoldLine-Signature"] === `sha256=${expected}`,
      "recomputed from the fields actually transmitted, so this fails if either side drifts");
    ok("and it is NOT the old body signature",
      h["X-BoldLine-Signature"] !== `sha256=${await signBody(sent[0].init.body, "shh")}`,
      "if these ever agreed, the canonicalisation would be doing nothing");
    ok("the old header name is gone for this client", !("x-boldline-signature" in h),
      "sending both would let a wrong one be ignored and hide a mismatch");
  }

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
  ok("🔴 the auto-reply text is gated on consent", /mayTextLead\(lead\)/.test(body)
      && /if \(lead\.phone && mayTextLead\(lead\)/.test(body),
    "collecting consent and then texting regardless is worse than never asking");
  // 🔴 AND ON WHETHER THE TEXT IS OURS TO SEND. Consent and ownership are separate questions,
  // so both gate the same send. A client whose own CRM texts the lead would otherwise have us
  // sending a second, near-identical text from a second number seconds later.
  ok("🔴 and on who owns the first text", /&& weSendTheText\(client\)/.test(body),
    "two systems both texting a new lead is the failure that reports itself as success");
  ok("the intake records both consents onto the lead", /pickConsent\(body\)/.test(body));
  ok("and the page the form was filled in on", /page: String\(body\.page/.test(body));
  ok("🔴 the email auto-reply is NOT gated on SMS consent",
    body.indexOf("mayTextLead") < body.indexOf("if (lead.email)"),
    "an SMS checkbox says nothing about email, and someone who declined a text still asked "
    + "to be contacted");
}

// ── 9. 🔴 SHAUN'S SIGNING SCHEME, WHICH IS NOT THE ONE WE HAD ───────────────
// Autopilot Systems deployed the endpoint 2026-09-01 with its own scheme. Ours signed the raw
// body under `x-boldline-signature` with no timestamp and no prefix, which produces a 401 on
// every forward. He assumed the 401 was only the missing secret; it was both. A backstop that
// always fails is worse than none, because it looks configured.
{
  eq("🔴 keys are sorted A-Z", canonicalFields({ b: 1, a: 2, c: 3 }), '{"a":"2","b":"1","c":"3"}');
  eq("🔴 and every value becomes a string", canonicalFields({ n: 5, t: true, z: null }), '{"n":"5","t":"true","z":""}');
  eq("🔴 so the same data in any order canonicalises identically",
    canonicalFields({ phone: "1", name: "D", gclid: "" }), canonicalFields({ gclid: "", name: "D", phone: "1" }),
    "JSON.stringify preserves insertion order, so unsorted keys give a different canonical for "
    + "identical data and his endpoint rejects it");
  eq("an empty object is still valid", canonicalFields({}), "{}");
  eq("and so is nothing at all", canonicalFields(null), "{}");

  const at = 1788292189000;
  const h = await signFields({ name: "Dana", lead_id: "L1" }, "shh", at);
  eq("the timestamp is unix SECONDS, not milliseconds", h["X-BoldLine-Timestamp"], "1788292189");
  ok("🔴 the signature carries his sha256= prefix", /^sha256=[0-9a-f]{64}$/.test(h["X-BoldLine-Signature"]));
  eq("🔴 and is HMAC over timestamp.canonical",
    h["X-BoldLine-Signature"],
    `sha256=${await hmacCheck(`1788292189.${canonicalFields({ name: "Dana", lead_id: "L1" })}`, "shh")}`);
  ok("🔴 a different timestamp gives a different signature",
    (await signFields({ name: "Dana" }, "shh", at)) ["X-BoldLine-Signature"]
      !== (await signFields({ name: "Dana" }, "shh", at + 60000))["X-BoldLine-Signature"],
    "the timestamp is what stops a captured request being replayed, so it has to be signed too");

  // 🔴 No secret means NO HEADERS, not headers made from an empty key. The second would look
  // valid-shaped and be indistinguishable from a wrong secret.
  eq("no secret sends no signing headers at all", Object.keys(await signFields({ a: 1 }, "")).length, 0);
  eq("and neither does an undefined one", Object.keys(await signFields({ a: 1 })).length, 0);
}

// ── 10. The dry run, so the form can be tested without junk in a real pipeline ──
{
  const client = { name: "S&T", campaignSetup: { crmFormat: "form", crmWebhook: "https://stencilandthread.com/api/ad-lead", crmWebhookSecret: "shh" } };
  const lead = { leadId: "L1", receivedAt: "2026-09-01T00:00:00.000Z", name: "Dana", phone: "+1555" };

  const sent = [];
  const fake = async (u, i) => { sent.push(i); return { ok: true, status: 200 }; };

  await forwardLead(client, lead, { fetchImpl: fake, dryRun: true });
  ok("🔴 a dry run is flagged so his endpoint records nothing", /(^|&)test=true(&|$)/.test(sent[0].body),
    "without the flag a smoke test puts a fake lead in the client's real pipeline");

  sent.length = 0;
  await forwardLead(client, lead, { fetchImpl: fake });
  ok("🔴 and a REAL lead is never flagged as a test", !/test=true/.test(sent[0].body),
    "a real lead marked as a test would be validated, answered ok, and silently dropped, which "
    + "is the most expensive possible failure here");

  // The flag is inside the signature, or his side would reject the test.
  const params = new URLSearchParams((await (async () => { sent.length = 0; await forwardLead(client, lead, { fetchImpl: fake, dryRun: true }); return sent[0].body; })()));
  const f = {}; for (const [k, v] of params) f[k] = v;
  const ts = sent[0].headers["X-BoldLine-Timestamp"];
  eq("🔴 the test flag is covered by the signature",
    sent[0].headers["X-BoldLine-Signature"], `sha256=${await hmacCheck(`${ts}.${canonicalFields(f)}`, "shh")}`,
    "signing the fields WITHOUT the flag we then send would fail on his side for a reason "
    + "nothing reports");

  // Other clients are untouched by any of this.
  const other = { name: "Other", campaignSetup: { crmWebhook: "https://other.example.com/h", crmWebhookSecret: "shh" } };
  sent.length = 0;
  await forwardLead(other, lead, { fetchImpl: fake });
  ok("🔴 every other client keeps the original scheme",
    !!sent[0].headers["x-boldline-signature"] && !sent[0].headers["X-BoldLine-Signature"],
    "his contract is his, and changing everyone's signing to suit one endpoint is how a working "
    + "integration breaks for a client nobody was thinking about");
  ok("and never gets a test flag", !/test=true/.test(sent[0].body));
}

console.log(`verify-sms-consent: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
