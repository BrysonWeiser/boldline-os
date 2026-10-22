---
name: ad-account-link
topic: Client portal
task: what happens when a client enters their Google Ads Customer ID or Meta ad account ids in their portal, and how they are told to accept our access
keywords: [googleAdsCustomerIdConfirm, googleLinkRequest, metaAccess, planGoogleLink, observeAccess, liveAccessApi, ad-access-watch, accessBanner, acc-pulse, manager request, partner access, One step left, accept our request, metaNoAccess]
status: verified
summary: Since 2026-10-21 the portal SENDS the Google manager request itself when a client saves a new Customer ID, but only after they type it twice and the two match (one wrong digit would ask a stranger). Meta has nothing to send, so we look whether we can read the ad account. The "accept it" step is its own highlighted box under each Save, pulsing "Waiting for you" once saved, with a "One step left before your ads can run" banner at the top of the Status tab, and it all turns "Connected" by itself. Opening the portal only LOOKS (the OS preview loads it); the ad-access-watch job (every 15 min) saves changes and alerts Bryson.
verified: 2026-10-21
---

**Why (Bryson, 2026-10-21):** *"double check that if a client puts their Google ad account number or meta into their
client dashboard that it saves and automatically sends the request"*, then *"make sure that it's very clear that the
client has to accept the request after they put their number in. Right now it's there but it's not super obvious"*.

## What was wrong
- Saving worked (the whitelist in `sanitizeFields` has all four ids).
- 🔴 **Nothing was sent and nobody was told**, while the portal promised "We'll send a manager link request". The
  request only ever went out if Bryson pressed Send in the OS.
- The accept step was line 5 of a numbered list.

## Google: sent automatically, typed twice
- `planGoogleLink(prev, next, confirm, rec)` in `netlify/lib/ad-link.mjs`:
  - A **changed** number must be 10 digits and match the confirm box (`googleAdsCustomerIdConfirm`). If not, the save
    is refused with a plain reason, and nothing is saved or sent.
  - The **same** number sends only when no request is live for it (`active/sent/pending`) AND the client retyped it.
    That covers a resend after a decline, and a number Bryson typed on a call.
- 🔴 **The confirm box is never prefilled.** If it were, re-saving the tab for testimonials would "confirm" a number
  nobody retyped.
- The confirm box is never stored. `sanitizeFields` drops it.
- The send: Google is asked first (`getClientLinkStatus`).
  - ACTIVE gives "already".
  - PENDING gives "pending".
  - Otherwise it calls `linkClientAccount` and gives "sent".
  - Any error gives "failed": the number is still saved, the client is told their account manager will send it, and
    Bryson gets an amber "Send X's Google manager request".
- What gets saved: `googleLinkRequest {id, status, at, checkedAt, activeAt?, error?}`.
- Every save that sends adds an alert and a commLog line.
- Why this doesn't break the 2026-09-08 "never automatic" rule (KB `manager-link-status`): that rule guards against a
  typo. Here the OWNER types their own number twice. Bryson's OS edit sheet stays manual. There's a note in
  `google-ads.mjs` above `linkClientAccount`.

## Meta: nothing to send, so we look
- The client adds BoldLine as a partner in their own Business settings.
- On save, `getAccountHealth` decides between connected and waiting. What gets saved:
  `metaAccess {status, adAccountId, at, checkedAt, connectedAt?}`.
- 🔴 **Only a permission answer means "not shared"** (`metaNoAccess`: code 200, code 10, code 803, or code 100 with
  subcode 33). A timeout, an outage or a rate limit changes nothing. Otherwise a Meta hiccup would tell a connected
  client they still have a step to do.

## Making "you must accept" unmissable (portal)
- Under each Save there is a box of its own:
  - Before saving: "After you save: accept our request".
  - After saving: "Waiting for you: accept our request", with an amber border and a pulsing dot.
  - Once accepted: a green "Connected".
  - Meta's version reads "Then / Waiting for you: add BoldLine as a partner".
- Other Google states:
  - Failed send: "Next: accept our request" ("we're sending it shortly").
  - A number saved but no live request: "Next: confirm your number, then accept our request".
- The Status tab opens with **"One step left before your ads can run"** while anything is waiting. It has the exact
  clicks and a "Show me how" button (`goConnect()`), which jumps to the Account tab's connect card.
- After Save, a note appears under the card with what happened. It's the server's `googleNote` / `metaNote`.
- A refused save shows the reason (`d.error`).
- The `.acc-pulse` animation stops under "reduce motion".
- 🔴 A Meta number Bryson typed in the OS that nobody has looked at yet shows **no** banner. The banner shows only once
  a look has actually been refused, so a connected client is never told they have a step left.

## Keeping it true: look on open, save in the job
- 🔴 **The portal's page load must never write or alert.** The OS preview loads the real portal every time Bryson
  opens a client (KB `preview-safety`). So `observeAccess(cl, liveAccessApi())` only LOOKS on page load. It checks
  both platforms side by side with a 3.5s cap and swaps the observed records into the page.
  `verify-preview-safety` pins that it contains no update or alert.
- `netlify/functions/ad-access-watch.mjs` runs every 15 min (`8,23,38,53 * * * *`). It is the one place the answer is
  saved, and Bryson is told:
  - green "X accepted Google access" / "X shared their Meta ad account" (he can launch);
  - amber "X removed ... access" / "X's Google request was declined" (the portal already asks the client to fix it).
- How often it looks:
  - Anything waiting: every run.
  - A connected account: once a day. 🔴 It's observed, not trusted forever, because a client can remove us without
    saying (same rule as KB `manager-link-status`).
- It skips BoldLine's own house record.
- Before writing, it re-reads the record and only touches the two access records.
- No new env vars and nothing for Bryson to do in Netlify. It uses the existing Google Ads and Meta credentials.

## Tests
`tests/verify-ad-account-link.mjs` (77 checks) runs the real portal handler with Supabase, Google, Meta and the alert
email stubbed at `fetch`, plus the watch job with a fake database.
