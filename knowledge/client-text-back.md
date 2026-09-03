---
name: client-text-back
topic: Forms/Leads
task: decide who texts a new lead first, or wire a client's own text-back into the OS
keywords: [text back, auto reply text, speed to lead, smsSender, weSendTheText, double text, two texts, who texts the lead, Twilio, A2P, 10DLC, Shaun Smith, Sebastian, Stencil and Thread, CRM texts, webhook, lead-intake, notifyLead]
status: built
summary: The OS texts a new lead within seconds. So does a client's own CRM once their developer wires it up, and neither system can see the other, so the lead gets two near-identical texts from two numbers and nothing errors. A per-client setting ("Who texts the lead first") decides, defaulting to us, and ignoring "their" when there is no address to forward to so a typo cannot switch off speed-to-lead entirely.
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
