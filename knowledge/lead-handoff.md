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
