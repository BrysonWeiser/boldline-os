---
name: lead-handoff
topic: Ads
task: send a client's leads on to their own CRM, or serve their landing page on their own domain
keywords: [crm webhook, crm forward, lead handoff, forward lead, crmWebhook, crmWebhookSecret, landingDomain, custom domain landing page, subdomain, edge function, client-domain, Shaun Smith, speed to lead, display URL, x-boldline-signature, store before forward, forward once]
status: built
summary: Two things needed before a client's campaign can go live. Their leads now land in the OS first (so the ad click is captured) and are forwarded on to their own CRM second, so their existing follow-up automation still fires. And their landing page can be served on their own subdomain, because Google shows the address the ad points to and a client's ad must not display BoldLine's domain.
verified: 2026-08-25
---

## Where both came from

One email from **Shaun Smith**, who runs Stencil & Thread's website, 2026-08-25. He offered
an endpoint to post the landing-page form to, so leads land in Sebastian's CRM where the
follow-up automation lives, noting that *"ad leads that get a response within a minute or
two convert at a much higher rate."* He is right, and that automation is worth more than
anything BoldLine would bolt on.

## 🔴 But it could not simply REPLACE our intake

The Google click id is captured at our endpoint at the moment of arrival. It is the only
way an order weeks later is credited back to the search that produced it (KB
`conversion-loop`), the only basis for per-qualified-lead billing, and the entire content
of the 30-day scorecard. Post the form straight to the client's CRM and **the ads keep
spending and stop learning**, silently.

So it is BOTH, in a fixed order.

| Rule | Why |
|---|---|
| **Store before forward** | A CRM that is down must never cost a lead. `appendLead` runs first, always. There is a test asserting the source order. |
| **Forward exactly once** | A duplicate lead in someone's sales pipeline is worse than one that never arrived, because a human works it twice and the customer notices. The lead itself carries `crm.ok`, so the check survives restarts. |
| **Retry only what a retry can fix** | Network failures, 5xx, 408 and 429 are retried once. **A 4xx is never retried**: the request was wrong, a repeat gets the same rejection, and on a half-accepting endpoint it creates the duplicate above. |
| **A failure is visible** | Silence looks exactly like a quiet week. The result is written onto the lead and shown on its row in the OS. |
| **https only** | An http endpoint would put a customer's name, email and phone across the open internet on someone else's behalf. Refused outright. |

Signed with HMAC-SHA256 over the exact bytes sent, in `x-boldline-signature`, so the far
end can prove it was us. Capped at **6 seconds**: the visitor is watching a "Sending..."
button, so a slow CRM must never become a slow form.

Fields live in Edit → Campaign → Campaign Details: **Send leads on to** and **Password for
that link**.

## The client's own domain

Google makes the address shown on an ad match the address it points to. A page on
boldlinemedia.com therefore puts a marketing agency's name on a screen printer's ad, in the
one place a searcher looks to decide if it is the right business.

A client points a subdomain at the OS site (one DNS record) and sets **Page address on
their domain** in Edit. `landing.mjs` now resolves by hostname as well as by slug.

**🔴 The edge function is the risky part.** `netlify/edge-functions/client-domain.js` runs
on EVERY request to the whole OS, so a throw there is a blank app for everyone, not a
broken feature. It is defensive by construction: no database, no state, the rule lives in
the pure `netlify/lib/client-domain.mjs`, and **every failure path passes the request
through untouched**.

The safety direction is deliberate: our own hosts are allowlisted (`*.netlify.app`,
`*.netlify.live`, boldlinemedia.com, localhost, plus an `OS_HOSTS` env var), and anything
else gets a landing-page lookup that 404s if no client claims it. A missing entry serves a
404 instead of the OS, which is loud and a one-line fix. The alternative (allowlisting
client domains) would need a database read on every OS page load.

Two traps closed:
- **`/.netlify/*` is never rewritten.** The landing page posts its form to a relative
  function path, so rewriting those would break the very lead capture this preserves.
  `/.well-known/*` too, or certificates stop renewing.
- **A crafted Host header cannot reach the database as a wildcard.** The domain lookup is
  case-insensitive (`ilike`), where `%` and `_` are wildcards, so `normalizeHost` discards
  anything that is not a plain hostname.

## Setup, per client

1. Their web person adds one DNS record pointing e.g. `quote.theirdomain.com` at the OS site.
2. Add that hostname in Netlify as a domain alias so the certificate is issued.
3. Put it in Edit → Campaign → **Page address on their domain**.
4. Put their CRM endpoint in **Send leads on to**.

**95 checks in `tests/verify-lead-handoff.mjs`, nine deliberate breaks confirmed to fail**,
including forwarding before storing, retrying a rejected request, forwarding twice,
allowing an unencrypted endpoint, rewriting the function routes, and letting a wildcard
host through.

## Related

`conversion-loop`, `stencil-and-thread-deal`, `ad-landing-page`, `hand-off-product`.

## 2026-08-26 — Shaun's reply, and what it changed

He agreed to the loop and picked the **dual-post** shape: *"the page posts to both endpoints
independently. Your endpoint captures the marker and handles the Google side, mine takes the
lead straight into the CRM. Neither of us becomes a dependency for the other."* And he asked
for one thing on the payload: *"include the gclid and UTM fields alongside the contact info.
I'll store them on the contact record in the CRM."*

**Built the payload half straight away** (the dual-post half waits on his endpoint URL and
field names, which he is sending before the call):

- **`netlify/lib/attribution.mjs` is now the single source of the key lists.** `CLICK_KEYS`
  (gclid, wbraid, gbraid), `UTM_KEYS` (the five standard tags), `pickAttribution` (the public
  endpoint's allow list), `utmFields`, `hasClickId`. The landing page interpolates it, the
  intake endpoint picks through it, the CRM payload sends it. They had already drifted once.
- **UTM tags are captured on the landing page** with the same 90-day localStorage recall as
  the click ids, and forwarded to the CRM.
- **Every lead is minted a `leadId` (`crypto.randomUUID()`)** at intake and it goes in the CRM
  payload as the dedupe key, with `receivedAt` as the fallback for leads that predate it.

### 🔴 The invariant this added, and it is the one to remember
**A UTM TAG IS NOT A CLICK ID.** A click id is Google's own receipt for a paid click and the
only thing an offline conversion upload can match on. A UTM is a label *we* put on our own
link and Google never reads one back. So: only a click id sets `clickAt` (the 90-day matching
clock), and `fromAd` is computed from `hasClickId` alone. If a UTM ever stands in for a click
id, the scorecard reports revenue Google cannot see and per-qualified-lead billing counts
leads that were never attributable, and nobody finds out for months.

### The pushback sent back to Shaun (open, as of 2026-08-26)
1. **His endpoint must return CORS headers for the landing page origin plus a real status
   code.** A browser posting cross-origin gets an opaque response otherwise, and a silent
   failure looks identical to a success.
2. **Our server-side forward stays as a backstop**, firing only when the page's direct post
   did not confirm. Normal path never runs it, so no duplicates in Sebastian's pipeline.
3. **He must store wbraid and gbraid, not just gclid** — they are what Google sends instead
   when the browser blocks gclid, which is most iPhone traffic. Storing gclid alone loses
   roughly half the attribution.

**76 checks in `tests/verify-attribution.mjs`, five deliberate breaks confirmed to fail**
(a UTM stamping the click clock, the 90-day window widened, the UTMs dropped from the CRM
payload, `hasClickId` counting UTMs, and `pickAttribution` copying every key it is handed).
The landing page's capture code is **sliced out of the shipping file and executed against a
fake browser** rather than pattern-matched, per KB `repo-tests`.

**Call with Shaun: Saturday 2026-08-29, 10am MST.**

## 2026-08-29 — Shaun's full endpoint spec, and the one thing we do not have

The 10am Saturday call never happened: Shaun set up the calendar event and left Bryson off
it, so Bryson sat waiting for a link that was never coming. Shaun apologised and sent the
whole spec by email instead, *"so you're not blocked while we sort a time."* Rescheduling for
Wed 2 Sep or Thu 3 Sep.

**All three asks were granted, unprompted:**
- CORS headers for the landing page origin, the OPTIONS preflight handled, and real status
  codes so the page can tell a success from a failure.
- The signed server-side backstop, deduped on `lead_id`.
- All three Google click ids. Shaun: *"I'd only asked for gclid and you're right that would
  have thrown away most of the iPhone traffic. All three get their own home on the contact
  record."* That catch is what bought the technical credibility in this relationship, and it
  is worth remembering that it came from reading the spec properly rather than from a track
  record nobody has yet.

### THE ENDPOINT (not deployed yet — spec first, on purpose, so we do not build twice)

```
POST https://stencilandthread.com/api/ad-lead
Content-Type: application/x-www-form-urlencoded
200 {"ok":true} · 400 validation failure · 500 delivery failure
```

| Group | Fields |
|---|---|
| Required | `name`, and at least one of `email` / `phone` |
| Contact | `first_name` (optional, derived from `name` if omitted), `details` (the free-text enquiry, our `message`), `page` (landing page URL) |
| Attribution | `gclid`, `wbraid`, `gbraid`, `click_timestamp` (ISO 8601 UTC), `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` |
| Idempotency | `lead_id` (our unique id per lead) |
| SMS consent | `sms_consent_transactional` ("yes"/"no"), `sms_consent_marketing` ("yes"/"no") |

**Do NOT send `source` or `business`.** Shaun sets both server-side so everything feeding
the CRM keeps one shape. Ours currently sends both, so they have to be dropped for him.

### 🔴 THE GAP, and it is bigger than a rename

`crmPayload` sends **nested JSON**. Shaun wants **flat form-urlencoded** with different
names. So this is not "map a few fields", it is a second wire format:

| Ours | His |
|---|---|
| `application/json` | `application/x-www-form-urlencoded` |
| nested `lead:{}` / `attribution:{}` | flat, one level |
| `leadId` | `lead_id` |
| `lead.message` | `details` |
| `business`, `source` | must be absent |
| (not sent) | `page`, `first_name`, `click_timestamp` |

The HMAC signature is over the exact bytes sent, so it keeps working unchanged as long as
the signing happens after serialisation, whatever the serialisation is.

### 🔴 SMS CONSENT — WE DO NOT COLLECT IT AT ALL, ANYWHERE

A grep for `sms_consent` / `smsConsent` across the whole repo returns **nothing**. This is a
genuine product gap, not a Sebastian-specific mapping detail, and it is the one Shaun flagged
himself as deciding whether the campaign is worth running:

> *"If the form doesn't carry a consent checkbox, the lead still lands in the CRM and Sebastian
> still sees it, but it gets no text. The one-minute response that makes ad leads convert never
> happens, and the campaign quietly loses the thing we both want from it."*

Stencil & Thread is A2P registered and the instant follow-up text is gated on **transactional**
consent. So a landing page with no checkbox produces leads that can never be texted, and
nothing anywhere would report that as a failure. It is exactly the silent-degradation shape
this file already exists to prevent.

**What a landing page needs:** a checkbox, **unchecked by default**, consent language naming
the client, and links to three pages. For Stencil & Thread they are already live:

```
https://stencilandthread.com/privacy.html
https://stencilandthread.com/terms.html
https://stencilandthread.com/sms-opt-in.html
```

🔴 **Keep the `.html`.** Shaun: *"The extensionless versions won't resolve, so link them
exactly as written."* They also satisfy Google's landing page policy, so the one checkbox does
two jobs.

Since every client doing speed-to-lead texting needs this, it should be built as a **landing
page feature with per-client consent text and links**, not hardcoded for one client.

### Not on the critical path
The DNS record for the display URL: send it whenever, Shaun has delegate access on the GoDaddy
account and will have it live the same day.

### Status
**Not built, deliberately.** Sebastian had still not signed or even opened the agreement as of
2026-08-29, and Shaun's endpoint is not deployed either. Building a client-specific integration
for an unsigned client is how work gets thrown away. The spec is captured here so the build is
a day's work whenever the signature lands.
