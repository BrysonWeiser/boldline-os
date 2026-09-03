---
name: client-text-back
topic: Forms/Leads
task: decide who texts a new lead first, or wire a client's own text-back into the OS
keywords: [text back, auto reply text, speed to lead, smsSender, weSendTheText, double text, two texts, who texts the lead, Twilio, A2P, 10DLC, Shaun Smith, Sebastian, Stencil and Thread, CRM texts, webhook, lead-intake, notifyLead]
status: built
summary: CONFIRMED 2026-09-03: Autopilot Systems (Shaun) sends the text itself, so Stencil & Thread is set to "their". A2P registration is per business, not per platform, so one BoldLine registration would NOT cover clients. The OS texts a new lead within seconds. So does a client's own CRM once their developer wires it up, and neither system can see the other, so the lead gets two near-identical texts from two numbers and nothing errors. A per-client setting ("Who texts the lead first") decides, defaulting to us, and ignoring "their" when there is no address to forward to so a typo cannot switch off speed-to-lead entirely.
verified: 2026-09-03
---

## Why this exists

Bryson, after the Stencil & Thread call: *"we will use whatever shaun and sebastian already
have set up I just need to know what i need to ask for so you can hook it up"*.

Using their existing text-back is the right call commercially. It creates **the one failure
that looks exactly like success**: we text the lead within seconds, their CRM texts the same
person seconds later, neither system can see the other, nothing errors, nothing reports it.
The only way anybody finds out is a customer mentioning it, and by then it has happened to
every lead.

## The setting

**Client → Edit → Campaign → "Who texts the lead first"** (`campaignSetup.smsSender`).

- Blank (the default) — **we** text them, exactly as every existing client already works.
- `their` / `theirs` / `them` / `client` — **their** system does it and we stay quiet.
- Anything unrecognised falls back to **us**. Guessing that an unknown word means them is
  guessing in the direction of silence.

🔴 **"their" only counts when there is a CRM address to forward to.** Handing the text to a
system we do not forward to means nobody texts at all, which is the same silence as a broken
integration and no more visible. `weSendTheText()` in `netlify/lib/sms-consent.mjs` enforces
this; `lead-intake.mjs` gates the send on **both** `mayTextLead(lead)` (consent) and
`weSendTheText(client)` (ownership), because they are separate questions.

**The email auto-reply is not affected.** Only the SMS can double up.

## 🔴 What to ask the client's developer for

This is the list Bryson needs answered before flipping the setting. Nothing here is a
credential we hold; their text-back runs entirely on their side.

1. **Does your system text the lead itself when our webhook fires, or should we keep doing
   it?** The one that decides everything else. If both, we get two texts.
2. **Which number does it text from?** It has to be a number the client owns and that is A2P
   / 10DLC registered, or carriers filter it silently.
3. **How fast?** The whole value is the first minute. If theirs is on a five minute cron and
   ours is instant, ours is better and the setting should stay on us.
4. **Does it honour `sms_consent_transactional`?** We send `yes` or `no` on every lead. If
   their side texts regardless, the consent record is decorative.
5. **What does the message say, and does it name the business?** So the client is not sending
   something generic on the back of our ad.
6. **Does it handle STOP replies and where do those land?** Opt-outs have to reach whoever is
   sending, and if that is them, we must not still be texting.
7. **Where does a reply go?** If the lead texts back, somebody has to be reading it.

Answers 1 and 3 set the switch. If any of 2, 4 or 6 is a no, leave it on us until it is fixed.

## 🔴 A2P registration does NOT carry over between clients

Bryson, 2026-09-03: *"after we register for the texting thing would we be able to use it for
any client or do we have to register each time because I want it to be a base thing we use as
part of the crm"*.

**It is per business, not per platform.** Registration has two layers:

- **The brand** is a legal business: name, tax ID, address, website. It is what the phone
  companies check the texts against, so it cannot be shared between businesses.
- **The campaign** is the use case under that brand: sample messages, and how people opted in.

So one BoldLine registration covers **texts sent as BoldLine, from BoldLine's number**. It
does **not** let us text as a client. To do that as a platform, each client is registered as
their own brand under our account, using **their** legal name and tax ID, with a campaign per
client. That is the standard agency setup and most of it can be driven by API, but it needs a
tax ID from every client and carries a small per-brand and per-month cost.

Roughly: a few dollars one-time per brand, around fifteen dollars one-time to vet a campaign,
and low single-digit dollars a month per campaign, plus per-message fees. **Confirm current
pricing before quoting it, it moves.**

### What this means for the product

🔴 **Stencil & Thread is the easy case and the next client probably will not be.** Sebastian
already has his own registration and his own system, so we set `smsSender` to `their` and
never touch it. A client with no system of their own has neither, and the whole "full
automation before the first client" goal means texting on their behalf, which means
registering them. **It is deferrable, not avoidable.**

Order that makes sense:
1. Register **BoldLine** once, so our own alerts and our own ads' leads can text. Small, cheap,
   one time. This is also what currently blocks owner alert texts (`SMS_ENABLED`, Twilio still
   on trial as of the last note in `major-issue-alerts` and `call-tracking`).
2. Use the client's own registration whenever they have one.
3. Build per-client brand registration into onboarding only when enough clients lack one that
   it pays for itself.

🔴 **Do not claim BoldLine's texting is on or off from reading the repo.** The code has an
`SMS_ENABLED` switch and the KB records it as off since 2026-07-25 with Twilio on trial, but
whether it has been upgraded since is live state, and live state is not readable from here.

## ✅ 2026-09-03 — CONFIRMED: Autopilot Systems sends the text itself

Bryson, reporting what Shaun said in the meeting: their endpoint **sends the text to the lead
automatically** when our lead arrives. It is not a filing cabinet Sebastian works by hand.

Shaun also confirmed in the same meeting that **he already went through A2P registration** to
send automated texts on behalf of clients, and that **the disclosure wording is approved** as
it now appears under the button.

**So Stencil & Thread's setting is `their`.** Nothing to build, nothing to hand over, nothing
to collect. The forward already fires; his side does the rest.

🔴 **Set the box even though our texting is off today.** It changes nothing now, because we
cannot text either way. It matters the day BoldLine registers and switches ours on: a blank
box means "we send it", so the moment ours works, his leads start getting two texts from two
numbers. Ten seconds now against a fault only a customer would ever report.

🔴 **Note on sourcing.** This is live state learned from Bryson, not read from code, and it is
the answer to the one question that could otherwise have left a client with NO first text and
nothing anywhere reporting it. Do not re-derive it from the repo; the repo cannot know.
