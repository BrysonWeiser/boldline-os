---
name: call-tracking
topic: Forms/Leads
task: set up, debug, or change phone-call lead tracking (tracking numbers, call forwarding, call leads)
keywords: [call-tracking.mjs, voice.mjs, callTrackingNumber, callTrackingNumberSid, Twilio, IncomingPhoneNumbers, VoiceUrl, Dial, forward, businessPhone, notifyOwnerOfLead, source call_tracking, dynamic number insertion, Google call reporting]
status: verified
summary: Phone-call lead tracking = a dedicated Twilio number that forwards to the real phone AND logs each inbound call as a lead. Provision/release from the OS (Client detail → Client View tab → Assets → Call Tracking card; same card works for a client OR the internal My Ads account — forwards to that record's businessPhone). call-tracking.mjs buys a Twilio local number (optional area code) and points its VoiceUrl at voice.mjs?token=<leadToken>; on an inbound call voice.mjs logs a lead (source "call_tracking", caller ID as phone) then TwiML <Dial>s the client's businessPhone. Needs TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN and businessPhone set. BLOCKED for real use until Twilio is upgraded off the free trial (trial only holds 1 number, forwards to verified numbers only, plays a trial greeting). 2026-08-03: call leads now also fire the branded "New Lead" owner email (shared notifyOwnerOfLead). Attribution truth: a BARE real number can't attribute ad calls — you need a distinct tracking number (or Google's own call reporting).
verified: 2026-08-03
---

**How it works (two files):**
- `netlify/functions/call-tracking.mjs` (owner-triggered, keyed by `portalToken`): `?action=provision`
  searches Twilio `AvailablePhoneNumbers/US/Local` (optional `areaCode` in the POST body), buys the
  number via `IncomingPhoneNumbers`, sets its **VoiceUrl** to
  `${URL}/.netlify/functions/voice?token=<client.leadToken>`, and stores `callTrackingNumber` +
  `callTrackingNumberSid` on the client. `?action=release` DELETEs the Twilio number and clears both
  fields (stops the ~$1/mo charge; irreversible).
- `netlify/functions/voice.mjs` (Twilio hits this on every inbound call): looks the client up by
  `leadToken`, logs a lead `{phone: caller From, source:"call_tracking", message:"Inbound call to
  tracking number"}` via `appendLead` (→ leadsLog, `leads`+1) **and** `notifyOwnerOfLead` (parallel),
  then returns TwiML `<Dial>${businessPhone}</Dial>` so the real phone rings. If `businessPhone` is
  missing it plays a "not set up" message instead of forwarding.

**UI:** OS → open the client → **Client View** tab → **Assets** → **Call Tracking** card → optional
area code → **Buy tracking number** (or **Release**). The card is also present on the **My Ads**
internal account (copy switches to "…for your ads") — so BoldLine's own ads use the exact same
mechanism, forwarding to the My-Ads record's `businessPhone`.

**Call leads feed per-lead billing** like any lead (they land in `leadsLog`, count toward `leads`,
and are reviewable/billable on the Billing card). A missed call still becomes a "new" lead, so the
day-1/3/7/14 lead-followup nurture ("you called … recently") covers no-answers automatically.

**2026-08-03 fix:** call leads used to log silently (voice.mjs only called `appendLead`). Extracted
lead-intake's owner notifier into shared **`report-shared.notifyOwnerOfLead(client, lead)`** and call
it from BOTH lead-intake (form/website leads) and voice (call leads), so every new lead — form or
phone — sends Bryson the same branded "New Lead" email. Runs in `Promise.all` with the DB write to
keep call-forward latency to one round-trip; `leads+1` passed so the email's "Lead #N" is correct.

**⚠️ Twilio dependency (still on the free trial as of 2026-08-03):** provisioning + clean forwarding
need Twilio **upgraded to paid (~$20/mo)** — the same upgrade that unlocks SMS (`SMS_ENABLED=1`).
Trial limits: one number only, forwards to *verified* numbers only, and a trial greeting plays before
connecting. Code is fully built and waiting on the paid account. Env var NAMES: `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN` (+ `TWILIO_FROM_NUMBER` for SMS).
**DECISION (Bryson, 2026-08-03): do NOT upgrade Twilio until the first client lands** — hold the
~$20/mo (+SMS) until there's revenue, same as the pre-client-readiness plan. Approach chosen =
Twilio tracking numbers (not Google call reporting / DNI), because per-lead billing needs the
individual call records.

**"Can we track calls with just the client's real number, no tracking number?" (Bryson, 2026-08-03) —
answer: not with real attribution.** A bare real number on an ad can't tell an ad call from a search /
referral / business-card call. To attribute ad calls you need ONE of: (1) a **dedicated tracking
number** forwarding to the real phone (what we built — best for Google+Meta and gives per-call lead
records with caller ID → feeds per-lead billing); (2) **Google Ads' own call reporting** — Google
provisions a FREE Google forwarding number for call assets + website-call conversions and reports
calls in the Ads account (no Twilio; but Google-only, data lives in Google Ads → pull via the existing
google-ads.mjs API, and it's call *counts/conversions*, not individual billable lead records); or
(3) **dynamic number insertion (DNI)** — a JS snippet swaps the displayed number to a tracking number
only for ad visitors, so the client's real number stays public (still a tracking number underneath).
Recommendation for BoldLine's per-lead model: the tracking-number approach, because per-lead billing
wants the individual call records that Google's count-based reporting doesn't give.

**PENDING:** put a tracking number on the **get-started** ad landing page
(`marketing-site/get-started/index.html`) so BoldLine's own ads get real call tracking — it currently
has NO phone number (only Calendly + the get-started form). Blocked on an actual My-Ads number
existing (Twilio paid + provision), and on the tracking-approach decision above.
