// Whether a lead has actually agreed to be texted, captured on the form and carried with them.
//
// Shaun Smith (Stencil & Thread's developer), 2026-08-29: *"If the form doesn't carry a
// consent checkbox, the lead still lands in the CRM and Sebastian still sees it, but it gets
// no text. The one-minute response that makes ad leads convert never happens, and the
// campaign quietly loses the thing we both want from it."*
//
// He was right, and a grep for consent across this repo returned nothing at all. So the
// landing page collected none, the intake stored none, the CRM payload sent none, and the
// auto-reply texted everybody regardless. That is a product gap, not a mapping detail.
//
// 🔴 TWO CONSENTS, AND THEY ARE NOT THE SAME THING.
//   TRANSACTIONAL — "text me about my quote". A direct reply to the enquiry they just sent.
//   MARKETING     — "send me offers later". A different, ongoing thing.
// They are collected separately, stored separately and sent separately, because agreeing to
// one is not agreeing to the other and a system that conflates them cannot prove otherwise.
//
// 🔴 NEITHER BOX IS EVER PRE-TICKED AND NEITHER BLOCKS THE FORM. Express written consent
// cannot be given by a box the visitor never touched, so a pre-ticked default would be worth
// less than nothing: it would look like consent while proving the opposite. And marketing
// consent must never be a condition of submitting, so an untouched form still produces a
// lead. All this changes is whether a text is allowed to follow.

// The field names, in one place. The landing page posts these, the intake accepts exactly
// these, and the CRM payload maps from them. `attribution.mjs` exists for the same reason:
// the click-id names drifted across three files once already.
export const CONSENT_KEYS = ["smsConsentTransactional", "smsConsentMarketing"];

// 🔴 THE TRANSACTIONAL CHECKBOX IS GONE AS OF 2026-09-03, AND THE CONSENT IS NOT.
//
// Bryson, straight out of the Stencil & Thread call: *"the form is good we just want to put
// smaller wording under the get a free quote button saying they will get texts, etc. when
// they fill out the form. We want to keep the optional button to sign up for the occasional
// offer and updates"*.
//
// This is the right call and it is worth writing down WHY, because it looks like weakening a
// consent record and is the opposite. The two consents were never the same thing:
//
//   TRANSACTIONAL — a reply to the enquiry the visitor just sent, from the business they just
//     sent it to. Nobody needs to tick a box to be answered. What is required is a
//     CONSPICUOUS DISCLOSURE at the point of submission, which is exactly what now sits under
//     the button. Pressing the button after reading it IS the agreement.
//   MARKETING — offers later, unrelated to this enquiry. That genuinely does need express
//     written consent, so THAT box stays, unticked, optional, never blocking the form.
//
// Every extra tick costs real leads, and asking permission to answer somebody who just asked
// to be answered was the tick least worth its cost.
//
// 🔴 SO THE VALUE IS "implied", NOT true. A record that says `true` cannot tell six months
// later whether somebody ticked a box or submitted under a disclosure, and those are
// different evidence. The lead also carries `consentDisclosure`, the exact sentence that was
// on screen, so the record proves what was actually shown rather than what the page says
// today.
export const CONSENT_IMPLIED = "implied";

// A checkbox arrives as "on" from a plain HTML form, `true` from our JSON post, and "yes"
// or "true" from anyone hand-rolling a request. Anything else, including absent, is NO.
// Deliberately strict in that direction: guessing yes is the one mistake that texts someone
// who never agreed to it.
export const consentYes = (v) =>
  v === true || ["on", "yes", "true", "1", "checked"].includes(String(v == null ? "" : v).trim().toLowerCase());

// What the intake stores on the lead. Both keys are always written so a lead record shows
// what was asked and answered, rather than leaving "not consented" and "never asked"
// looking identical on the row.
// 🔴 MAY WE TEXT THEM? Broader than `consentYes`, and deliberately a SEPARATE function.
//
// `consentYes` answers "did this person affirmatively tick something", which is what
// MARKETING requires and must stay strict about. This answers "do we hold a basis to send
// this text", which a disclosure plus a submission also satisfies. Folding "implied" into
// `consentYes` would have quietly widened the marketing test too, and marketing is the one
// direction where a wrong yes is unrecoverable.
export const consentGranted = (v) =>
  consentYes(v) || String(v == null ? "" : v).trim().toLowerCase() === CONSENT_IMPLIED;

export function pickConsent(body) {
  const b = body || {};
  const out = {};
  for (const k of CONSENT_KEYS) out[k] = consentYes(b[k]);
  // 🔴 Transactional keeps HOW it was given, rather than flattening to a boolean the moment
  // it is stored. Marketing stays strictly boolean: there is no implied marketing consent and
  // there must never be a value that could become one.
  if (String(b.smsConsentTransactional == null ? "" : b.smsConsentTransactional).trim().toLowerCase() === CONSENT_IMPLIED) {
    out.smsConsentTransactional = CONSENT_IMPLIED;
  }
  // The exact wording that was on screen when they submitted. Without it the record says a
  // disclosure happened but cannot say what it said, which is the half that matters if the
  // page copy is ever edited.
  const disc = String(b.consentDisclosure == null ? "" : b.consentDisclosure).trim();
  if (disc) out.consentDisclosure = disc.slice(0, 600);
  return out;
}

// What a CRM receives. Shaun's endpoint spec asks for the literal strings "yes" and "no",
// and an absent lead field becomes "no": we do not hold documented consent for that person,
// so his side must not text them.
//
// 🔴 TRANSACTIONAL USES `consentGranted`, SO AN IMPLIED CONSENT GOES OUT AS "yes". If it went
// out as "no" his side would stop texting every lead we send, and the disclosure under the
// button is precisely the basis his A2P registration runs on. Marketing stays on the strict
// test: only a ticked box is a yes there, ever.
export const consentField = (lead, key) =>
  ((key === "smsConsentTransactional" ? consentGranted : consentYes)((lead || {})[key]) ? "yes" : "no");

// 🔴 MAY WE SEND THE AUTO-REPLY TEXT AT ALL?
//
// The rule is deliberately three-way, not two, and the third case is the important one:
//
//   explicit yes  -> text them. They ticked the box.
//   explicit no   -> do not. They were asked and declined, and that is the whole point of
//                    asking. This is the new behaviour.
//   never asked   -> text them, exactly as before. Leads predating the checkbox, and leads
//                    from Calendly or the marketing site where no such field exists, must
//                    not silently stop getting a reply the moment this shipped. Turning off
//                    every client's speed-to-lead reply as a side effect of adding a field
//                    is precisely the silent degradation this codebase keeps getting bitten
//                    by, and it would look identical to "no leads today".
//
// The absent case is defensible on its own terms as well: it is a direct response to
// someone who just handed over their phone number asking to be contacted. The checkbox
// makes that explicit and documented rather than assumed.
// 🔴 DO *WE* SEND THE FIRST TEXT, OR DOES THE CLIENT'S OWN SYSTEM?
//
// Bryson, after the Stencil & Thread call, on their text-back: *"we will use whatever shaun
// and sebastian already have set up"*. That is the right answer commercially, and it creates
// the one failure that looks exactly like success: we text a new lead within seconds, their
// CRM texts the same person seconds later, neither system can see the other, and the lead
// gets two near-identical texts from two different numbers. Nothing errors. Nothing reports
// it. The only way anybody finds out is a customer mentioning it.
//
// So it is an explicit per-client choice, defaulting to us, because "we text them" is the
// behaviour every existing client already has and a default that silently switched it off
// would be a worse bug than the one this prevents.
//
// 🔴 AND "their" ONLY COUNTS IF THERE IS SOMEWHERE FOR THE LEAD TO GO. Handing the text to a
// system we do not forward to means nobody texts at all, which is the same silence as a
// broken integration. A typo in this box must not be able to switch off speed-to-lead.
export function weSendTheText(client) {
  const c = client || {};
  const cs = c.campaignSetup || {};
  const choice = String(cs.smsSender == null ? "" : cs.smsSender).trim().toLowerCase();
  if (choice !== "their" && choice !== "theirs" && choice !== "them" && choice !== "client") return true;
  const target = String(cs.crmWebhook || c.crmWebhook || "").trim();
  return !target;
}

export function mayTextLead(lead) {
  const l = lead || {};
  const asked = Object.prototype.hasOwnProperty.call(l, "smsConsentTransactional");
  if (!asked) return true;
  return consentGranted(l.smsConsentTransactional);
}
