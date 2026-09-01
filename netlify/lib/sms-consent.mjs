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

// A checkbox arrives as "on" from a plain HTML form, `true` from our JSON post, and "yes"
// or "true" from anyone hand-rolling a request. Anything else, including absent, is NO.
// Deliberately strict in that direction: guessing yes is the one mistake that texts someone
// who never agreed to it.
export const consentYes = (v) =>
  v === true || ["on", "yes", "true", "1", "checked"].includes(String(v == null ? "" : v).trim().toLowerCase());

// What the intake stores on the lead. Both keys are always written so a lead record shows
// what was asked and answered, rather than leaving "not consented" and "never asked"
// looking identical on the row.
export function pickConsent(body) {
  const b = body || {};
  const out = {};
  for (const k of CONSENT_KEYS) out[k] = consentYes(b[k]);
  return out;
}

// What a CRM receives. Shaun's endpoint spec asks for the literal strings "yes" and "no",
// and an absent lead field becomes "no": we do not hold documented consent for that person,
// so his side must not text them.
export const consentField = (lead, key) => (consentYes((lead || {})[key]) ? "yes" : "no");

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
export function mayTextLead(lead) {
  const l = lead || {};
  const asked = Object.prototype.hasOwnProperty.call(l, "smsConsentTransactional");
  if (!asked) return true;
  return consentYes(l.smsConsentTransactional);
}
