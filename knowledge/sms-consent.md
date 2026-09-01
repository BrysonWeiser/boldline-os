---
name: sms-consent
topic: Forms/Leads
task: collect or debug SMS consent on a landing page, or change what a CRM receives
keywords: [sms consent, smsConsentTransactional, smsConsentMarketing, consent checkbox, TCPA, A2P, opt in, opt out, STOP, auto reply text, speed to lead, may we text, crmFormat, form urlencoded, flat payload, crmFormPayload, crmBody, Shaun Smith endpoint, lead_id, sms_consent_transactional, details field, first_name, page field]
status: built
summary: The landing page now asks two separate consent questions (text me about my quote / send me offers), neither pre-ticked and neither blocking the form, and the answer follows the lead into the OS and on to the client's CRM. The auto-reply text is gated three ways - ticked sends, declined does not, never asked still sends so existing clients do not silently lose speed-to-lead. Ships with a second per-client CRM wire format (flat form-urlencoded with Shaun's field names) because his endpoint does not take the nested JSON. 76 checks, 17 mutations caught.
verified: 2026-08-31
---

## Why this existed as a gap at all

Shaun Smith (Stencil & Thread's developer), 2026-08-29, flagged it himself as the thing that
decides whether the campaign is worth running:

> *"If the form doesn't carry a consent checkbox, the lead still lands in the CRM and
> Sebastian still sees it, but it gets no text. The one-minute response that makes ad leads
> convert never happens, and the campaign quietly loses the thing we both want from it."*

A grep for `sms_consent` / `smsConsent` across the whole repo returned **nothing**. The form
collected none, the intake stored none, the CRM payload sent none, and `notifyLead` in
`lead-intake.mjs` texted **every lead with a phone number** regardless. Stencil & Thread is
A2P registered and their instant follow-up is gated on transactional consent, so their leads
would have arrived permanently un-textable with nothing reporting it as a failure.

## What the visitor sees

Two checkboxes on the lead form, in **both** page variants (managed and hand-off), rendered
from one `consentHTML` block in `netlify/functions/landing.mjs`:

1. **Transactional** — "Text me about my quote. *&lt;Business&gt;* may send you text messages
   about this enquiry. Message and data rates may apply. Reply STOP at any time to opt out."
2. **Marketing** — "Send me occasional offers and updates too. Optional, and you can stop any
   time."

🔴 **AND THE CONSENT LINE LINKS THREE PAGES: privacy policy, terms, and a text-consent page.**
Shaun, same spec: A2P registration is checked against these, so a checkbox without them
collects consent the carrier will not honour, and *"the extensionless versions won't resolve,
so link them exactly as written"* including the `.html`. They satisfy Google's landing page
policy too, so the one row does two jobs. Fed from `campaignSetup.privacyUrl` / `termsUrl` /
`smsOptInUrl`, which the client fills in themselves in the portal under Your Website. Only the
ones actually set are rendered: a client who does not text their leads leaves all three blank
and gets no link line, because a dead link on a live page is worse than no link. Links open in
a new tab so a visitor who taps Privacy mid-form does not lose what they typed.

🔴 **NEITHER IS PRE-TICKED AND NEITHER IS `required`.** A box the visitor never touched is not
consent, it is the *appearance* of consent, which is worse than collecting none. And marketing
consent must never gate the form: an untouched form still produces a lead, it just produces one
nobody may text. The disclosure names the **client's** business, not BoldLine, because the
reader is on the client's own domain and has never heard of us.

## 🔴 THE THREE-WAY RULE, which is the whole feature

`mayTextLead()` in `netlify/lib/sms-consent.mjs`. Two-way readings of this pass a careless test
while breaking one direction or the other:

| Lead | Text them? | Why |
|---|---|---|
| Ticked the box | **Yes** | They agreed |
| Asked and declined | **No** | The entire point of asking. Legally the unrecoverable direction |
| **Never asked** (no such field) | **Yes, exactly as before** | Leads predating this, plus every lead from Calendly or the marketing site. Gating on absence would switch off every client's speed-to-lead reply as a side effect of shipping, and would look identical to "no leads today" |

The third row only works because `pickConsent` **always writes both keys, even when false**. If
the intake dropped falsey values, "declined" would decay into "never asked" and start texting
people who said no. There is a round-trip test for exactly that.

`consentYes()` is an **allow list** (`true`, `on`, `yes`, `true`, `1`, `checked`), not a deny
list, because guessing yes is the mistake that texts a stranger. `"maybe"` is not consent.

**The email auto-reply is deliberately NOT gated on this.** An SMS checkbox says nothing about
email, and someone who declined a text still asked to be contacted. Asserted, so a future edit
cannot quietly extend the gate.

## The second CRM wire format

Shaun's endpoint takes **flat form-urlencoded with his own field names**, not the nested JSON
`crmPayload` sends. That is a different content type, shape and vocabulary, so it is a named
per-client format rather than edits to the default.

- Set it in the OS: **Edit → Campaign → "Format their system wants"**. Blank (or anything
  unrecognised) = the standard format. Type `form` for his.
- `crmFormat` / `crmFormPayload` / `crmBody` in `netlify/lib/crm-forward.mjs`.
- Field mapping: `details` (our message), `lead_id`, `click_timestamp`, `first_name` (derived
  from `name` when absent), `page`, the three click ids, the five UTMs, and the two
  `sms_consent_*` fields as the literal strings `yes` / `no`.
- 🔴 **`source` and `business` are absent on purpose.** Shaun sets both server-side. Tested as
  absences so the omission survives a future edit.
- 🔴 **A never-asked lead sends `no`, not blank.** His side gates the text on this field.
- The HMAC signs the **exact bytes sent**, so `crmBody` returns the body and its content type
  together. Splitting them is how a signature ends up covering something other than what was
  transmitted.

🔴 **THIS STAYS A PER-CLIENT OPTION AND NEVER BECOMES THE DEFAULT.** Sebastian happens to have
a competent developer with opinions. Most clients will have neither a developer nor a CRM.
Every existing client keeps the JSON they were set up with, byte for byte, and there is a test
asserting that.

## Also captured now

`page` (the URL the form was filled in on) is stored on the lead. Asked for by his spec, and it
stops being obvious the moment a client runs more than one page.

## How it was verified

**76 checks in `tests/verify-sms-consent.mjs`**, executing the real page builder and the real
`forwardLead` with a fake fetch rather than pattern-matching source. **17 mutations applied and
every one caught**, including: absent read as decline, explicit decline ignored, falsey consent
dropped at storage, any non-empty string read as consent, the intake gate removed, the sender
ignoring the chosen format, `source` re-added to Shaun's payload, never-asked sent as blank, a
pre-ticked box, a `required` box, the checkbox missing from either form variant, and the submit
handler sending consent only when ticked, the three policy links dropped, blank urls rendered as dead links, the links stealing the visitor away mid-form, and the `.html` stripped off them. A deliberate no-op control was correctly **not**
caught, so the suite is not failing on noise.

**Checked in a real browser** at 390 / 768 / 1280 / 1600: no sideways scroll, boxes visible and
unticked, disclosure text inside the viewport at every width. And end to end with the form
actually submitted: unticked posts `false` (not absent), ticked posts `true`, the form still
succeeds and still carries the click id and the page URL either way.

## Open, and worth saying out loud

The disclosure wording has **not** been reviewed by a lawyer, same as the service agreement.
The three-way rule is defensible (the absent case is a direct reply to someone who just handed
over their number asking to be contacted) but it is a judgement call, not advice. Raise it in
the same conversation as the contract review.

## Related

`lead-handoff` (the CRM forward and the client's own domain), `conversion-loop`,
`stencil-and-thread-deal`, `attribution` keys in `netlify/lib/attribution.mjs`.
