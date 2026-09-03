---
name: sms-consent
topic: Forms/Leads
task: collect or debug SMS consent on a landing page, or change what a CRM receives
keywords: [sms consent, smsConsentTransactional, smsConsentMarketing, consent checkbox, TCPA, A2P, opt in, opt out, STOP, auto reply text, speed to lead, may we text, crmFormat, form urlencoded, flat payload, crmFormPayload, crmBody, Shaun Smith endpoint, lead_id, sms_consent_transactional, details field, first_name, page field]
status: built
summary: The landing page now asks two separate consent questions (text me about my quote / send me offers), neither pre-ticked and neither blocking the form, and the answer follows the lead into the OS and on to the client's CRM. The auto-reply text is gated three ways - ticked sends, declined does not, never asked still sends so existing clients do not silently lose speed-to-lead. Ships with a second per-client CRM wire format (flat form-urlencoded with Shaun's field names) because his endpoint does not take the nested JSON. 76 checks plus 7 in verify-lead-handoff, 20 mutations caught.
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

## 2026-09-01 — two fixes Bryson found by actually looking at the page

**Spacing.** Shipped with only a top margin on each consent row, which left the second
checkbox flush against the submit button. Not just clutter: *"the check boxes are to close to
the get my free quote button"*, and a tick box a few pixels above the thing someone is about to
tap is a mis-tap waiting to happen. Ticking a consent box by accident is not a cosmetic bug.
Spacing now lives on a `.consbox` wrapper so the gap before the button is one number rather
than a guess about which element follows, since the two form variants differ (the managed one
has an error row next). Measured in a browser at all four breakpoints: 25px above, 10px
between, 19px before the button, identical at every width.

## 🔴 2026-09-01 — the preview navigated to the OS, and the deeper thing underneath

Bryson: *"the get my free quote button goes to my os which it shouldnt."* **Reproduced in a
headless browser before touching anything**, which is what identified it:

The OS previews the page in `<iframe srcdoc>` (`LandingPreview` in `index.html`). A srcdoc
document's own URL is `about:srcdoc`, so **a bare `href="#lead-form"` resolves against the
PARENT document** and the frame navigates to the OS app. The harness watched the frame URL go
from `about:srcdoc` to the OS URL with `#lead-form` appended, and the frame then rendered the
OS.

**The live page was never broken by this.** But a preview that jumps to the OS the moment you
press the main button is a preview nobody can trust, and trusting it is the entire point of
having one. Fixed by handling fragment clicks in JS (`navJS`, applied to both page variants),
which behaves identically live and in a preview; the plain href stays as the no-JS fallback,
which only matters on the live page where the fragment is correct anyway. Links whose target
does not exist are left alone rather than hijacked.

### 🔴 The second bug, found while fixing the first, that nobody had reported

The preview carries the **real `leadToken`** and is same-origin with the OS, so a submit from
it would post to the **live intake**: a phantom lead in the client's pipeline, a text and an
email to whatever was typed in those boxes, and a forward to their CRM.

Measured: **nothing leaks today**, because the OS sandbox is `allow-scripts allow-same-origin`
with **no `allow-forms`**, so Chromium blocks the submission and the submit event never fires.
But that safety is a sandbox attribute in a different file held up by nothing but habit, and
**adding `allow-forms` to make the preview button feel alive is an obvious future edit** that
would silently arm a live intake. So the submit handler now returns early on an `about:` scheme,
before the fetch, and shows the thank-you state so the preview stays useful. Second lock, not
the only one, and the comment in the code says so.

**Deliberately NOT done:** adding `allow-forms` to the preview sandbox. It would make the
button feel alive but the hand-off variant uses a native Netlify form with `action="?sent=1"`,
which would then really submit and navigate the frame. Two locks and an inert button beats one
lock and a live one.

**Verified end to end in both contexts.** Preview: the CTA stays in the frame, the form scrolls
into view, zero leads created. Live: the CTA stays on the page, exactly one lead posted, consent
`true` on the wire, page URL captured, thank-you shown. Three more mutations, all caught.

🔴 **A note on the harness, because it wasted a cycle.** The first live run reported "no lead
posted" and it was **my test, not the code**: Playwright matches the **most recently added**
route first, so a catch-all registered after the specific `lead-intake` route shadowed it. Same
trap as recorded in KB `repo-tests`. Register the catch-all FIRST.

🔴 **And one that took the renderer down mid-edit:** a **backtick inside a comment** in the
submit-handler string. That comment lives inside a template literal, so it terminated the
string and `node --check` failed on the whole file. Same class as the CSS one in KB
`sheet-layering`. No backticks inside these strings, comments included.

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

---

## The transactional tick box became a line of small print (2026-09-03)

Bryson, out of the Stencil & Thread call: *"the form is good we just want to put smaller
wording under the get a free quote button saying they will get texts, etc. when they fill out
the form. We want to keep the optional button to sign up for the occasional offer and
updates"*.

**This looks like weakening the consent record and is the opposite.** The two consents were
never the same thing:

- **Transactional** is a reply to the enquiry the visitor just sent, from the business they
  just sent it to. **Nobody needs to tick a box to be answered.** What the carriers require is
  a **conspicuous disclosure at the point of submission**, which is what now sits directly
  under the button. Pressing the button after reading it IS the agreement.
- **Marketing** is offers later, unrelated to this enquiry. That genuinely does need express
  written consent, so **that box stays** — unticked, optional, never blocking the form.

Every extra tick costs real leads, and asking permission to answer somebody who just asked to
be answered was the tick least worth its cost.

### What changed

| Before | Now |
|---|---|
| `<input type="checkbox" id="lf-sms">` "Yes, text me back about my quote" | Hidden `id="lf-tx"` valued `implied`, inside the disclosure sentence |
| Consent value `true` / `false` | `"implied"` / `true` / `false` |
| Links inside `<label for="lf-sms">` | Links inside `<div class="fine discl">` |
| Two checkboxes | One (marketing only) |

The three policy links are unchanged and still required: A2P registration is checked against
them.

### 🔴 The value is "implied", not `true`

A record saying `true` cannot tell six months later whether somebody **ticked a box** or
**submitted under a disclosure**, and those are different evidence. The lead also carries
**`consentDisclosure`**, the exact sentence that was on screen, so the record proves what was
actually shown rather than what the page says today.

### 🔴 `consentGranted` is a SEPARATE function from `consentYes`

- `consentYes` — "did this person affirmatively tick something". **Marketing** turns on this,
  and it stays strict. Widening it to accept `implied` would have quietly made every lead a
  marketing opt-in, and marketing is the direction where a wrong yes is unrecoverable.
- `consentGranted` — "do we hold a basis to send this text". `mayTextLead` and the
  transactional wire field use this.

`consentField` therefore branches on the key: transactional uses `consentGranted` so an
implied consent **goes out to the client's CRM as `"yes"`**. Sending `"no"` would stop their
side texting every lead we forward, and the disclosure is precisely the basis their A2P
registration runs on.

### 🔴 The hidden field and the sentence are built as one block

The field is the claim "this person was told". If it could post while the sentence was gone,
the record would assert a disclosure that never appeared on screen. They render from the same
expression and a test checks the field sits **inside** the sentence, and that the whole block
sits **after** the button.

### The three-way rule is now four-way

| Lead | Text them? |
|---|---|
| Ticked (legacy leads) | Yes |
| **Submitted under the disclosure (`implied`)** | **Yes** |
| Asked and declined | No |
| Never asked | Yes |
