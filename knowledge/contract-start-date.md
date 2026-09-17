---
name: contract-start-date
topic: Contracts
task: set, move or slip a client's contract start date; send an agreement before the work can actually begin
keywords: [start date, effective date, contract start, contract end, term, committed term, slip, delay, reslotTerm, edit sheet, three months, countdown, renewal]
status: verified
summary: The Start Date is the Effective Date and EVERYTHING counts from it — the three month commitment, the billing, the 14-day intake clock and every countdown in the OS. Signing early is fine; set the date to the day the ADS GO LIVE, not the day he signs, or the client pays for time when nothing ran. 🔴 Until 2026-09-16 the EDIT sheet had start and end as two independent boxes, so moving a start date quietly shortened the term. It now SHIFTS the end by the same number of days (preserving a custom term rather than recomputing it), refuses to act on a half-typed date, and shows how long the term comes to with a warning under three months. SIGNED COPY IS A SNAPSHOT: docusign-send base64s the rendered HTML into the envelope at send time, so the DocuSign document NEVER re-renders and changing the date later does NOT alter what was signed. The OS copy re-renders and will silently drift from it. Not sent yet: change freely. Sent, not signed: VOID the envelope and resend, never just edit. Already signed: the PDF is fixed, so move the date by a written email amendment and update the OS to match. Move it forward, never backward.
verified: 2026-09-16
---

## What the Start Date actually drives

It is printed as the **Effective Date** on page one of the agreement, and:

- **Section 2.1** — the committed term (three months minimum on a managed plan) runs from it.
- **Billing** — the monthly minimum is payable for each month or part month from it.
- **The delay and abandonment clause** — the client has fourteen days from it to hand over
  intake, account access and approvals. That clock starts whether or not anything is running.
- **Everywhere in the OS** — days live, the contract countdown on the client screen, the
  30-day renewal warning, the "contract runway" line on the scorecard, and the renewal list.

Leave it blank and the agreement reads "the date of last signature", and the OS flags the
client as having nothing to count from.

## The rule

**Set it to the day the ads go live, not the day he signs.** Signing early is normal and the
agreement is valid from signature either way. Setting it early means the client is on the clock,
and paying, for time when nothing ran — on a brand new relationship that is the fastest way to
sour one. Air Suds is exactly this case: Constantine signed while his Shopify store was still a
week from existing.

## Moving it afterwards

RED FLAG: THE OS COPY AND THE SIGNED COPY ARE TWO DIFFERENT DOCUMENTS, AND ONLY ONE OF THEM IS
THE CONTRACT. This was stated the wrong way round to Bryson on 2026-09-16 and corrected the same
evening, because it changes what he does.

- The OS copy re-renders every time it is opened (KB `contract-terms-versioning`). Change the
  start date and the OS copy changes with it. This is the view, and it is what every countdown,
  renewal warning and scorecard figure in the OS counts from.
- The DocuSign copy is a SNAPSHOT. `docusign-send.mjs` renders the agreement once, base64s that
  HTML into the envelope (`documents[0].documentBase64`, `fileExtension: "html"`) and uploads it.
  DocuSign flattens it to a PDF. It never re-renders, never calls back to the OS, and nothing
  changed afterwards reaches it. That frozen PDF is the legally operative document.

So editing the start date after signature does NOT rewrite the signed agreement. It makes the two
copies disagree, silently, with the OS showing the newer one.

What to actually do:

| Where you are | What to do |
|---|---|
| Not sent yet | Change the date freely, then send. |
| Sent, not signed | VOID the envelope in DocuSign and send a fresh one. Editing the OS alone leaves the client signing a stale document. |
| Already signed | The PDF is fixed and cannot be changed. Email the client one line moving the start date, with everything else unchanged, and get a written yes. That email plus the signed contract IS the amendment. Then update the OS so the countdown matches. |

Either way: move it forward, never backward. Backward bills them for time that had not happened
yet.

## CLOSED 2026-09-16: the signed copy is now stored and shown

The gap this section used to describe is fixed. The completed PDF is fetched out of DocuSign into
a private bucket, and the OS and the portal both show THAT document rather than a re-render once
one exists. A contract signed but not yet fetched says so plainly instead of quietly falling back.
Full detail in KB `signed-contract-copy`.

What it does NOT change: the signed PDF is still frozen, so everything above about moving a start
date still applies exactly as written. It just means you can now see, side by side, that today's
terms and the signed ones have diverged.

## 🔴 The bug this fixed (2026-09-16)

Bryson: *"can I set it for a week from now as the start date and then go into edit in his client
tab and change the start date and have it automatically update the end date?"*

The answer was **no**, and it failed silently. The **Add Client** screen moved the two dates
together. The **Edit** sheet had two independent text boxes, so pushing a start date back a week
and saving handed the client a term a week SHORT of what they signed for, and the agreement, the
countdown, the renewal warning and the scorecard runway all took the wrong number without a word.

`reslotTerm` in `index.html` now does it, wired to the start box in `EditClientSheet`:

- **Shifts the end by the same number of days the start moved**, rather than recomputing it from
  the committed term. A six month term someone set by hand survives; recomputing would silently
  make it three.
- Falls back to start + `contractTermMonths` (or three) only when there is no readable end date
  to shift.
- 🔴 **Refuses to act on a half-typed date.** The box is free text so every keystroke calls it,
  and `new Date("Sep 2")` parses to the year **2001** in V8, which would have parked the end date
  in 2001 while he was still typing the word. It requires a four-digit year and a date that
  actually parses.
- Uses the shared `addMonths`, so Jan 31 plus a month is Feb 28, not Mar 3.
- The sheet now prints how long the term comes to in days and months, and warns in amber when it
  is under the three month commitment in the agreement.

Pinned by `tests/verify-contract-dates.mjs` (31 checks). The real function is extracted from the
page and run, never re-implemented. Five mutations verified, including the original bug (the
start box back on the plain setter) and the 2001 one.
