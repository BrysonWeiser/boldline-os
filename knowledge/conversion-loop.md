---
name: conversion-loop
topic: Ads
task: set up or debug what Google Ads is told to optimize toward for a client, or send qualified/won leads back to Google
keywords: [conversion loop, conversion actions, offline conversion import, uploadClickConversions, gclid, wbraid, gbraid, click id, qualified lead, closed customer, primaryForGoal, secondary conversion, enhanced conversions for leads, ConversionLoopCard, ScorecardCard, gads-conversions, scorecard, 30 day scorecard, grossMarginPct, mark qualified, order value]
status: built
summary: Google is now told which leads were actually worth having. Three conversion actions per client, deliberately unequal - a form fill is measured but NEVER bid on, while qualified lead and closed customer are what Smart Bidding chases. The click id is captured on the landing page at the visit, stored with the lead, and used weeks later to credit the outcome back to the ad that caused it. Plus the client-requested 30-day scorecard.
verified: 2026-08-24
---

## Why it exists

Bryson's first real prospect (a screen printer in Eugene, Oregon, ~$1,000 average order,
closes 7 to 8 of every 10) sent his own AI analysis, and it got the important part right:

> *"Don't have Google optimize around someone simply submitting Contact Us."*

🔴 **A conversion action is not a report, it is an INSTRUCTION.** Whatever is marked
primary is what Smart Bidding spends the client's money chasing. A business selling
25-piece orders and a teenager wanting one shirt fill in the same form. Report every form
fill as a conversion and Google will faithfully go and buy more teenagers, spend the whole
budget doing it, and show a healthy conversion count the entire time. **The account looks
like it is working right up until someone counts the customers.**

## The three actions, deliberately unequal

| Action | Google category | Type | Bid on? |
|---|---|---|---|
| BoldLine Form Submission | `SUBMIT_LEAD_FORM` | `WEBPAGE` | **No.** Measured only. |
| BoldLine Qualified Lead | `QUALIFIED_LEAD` | `UPLOAD_CLICKS` | **Yes** |
| BoldLine Closed Customer | `CONVERTED_LEAD` | `UPLOAD_CLICKS` | **Yes**, with the real order value |

`primaryForGoal: false` is what keeps the form fill out of the Conversions column that
bidding optimizes toward. All three are `ONE_PER_CLICK`, so a repeat submission is one lead.

**Value is a DEFAULT, never a replacement.** `alwaysUseDefaultValue: false`, so a real
$4,000 order is reported as $4,000 rather than as the average. A zero is never sent: zero
is a claim that the lead was worthless, and sending nothing is the honest answer.

## 🔴 The piece everyone forgets: the click id

Google can only credit a sale to the ad that caused it if the lead carries the `gclid` from
that click. That has to be grabbed **on the landing page, at the visit**, weeks before
anyone knows whether the lead was any good. Miss it then and the outcome can never be
attributed, no matter what is uploaded later. **This is why tracking ships with the
campaign, not after the first leads arrive.**

- Captured from the URL, kept in `localStorage` for 90 days (Google's own matching window)
  so a visitor who returns later is still attributed, and posted with the form.
- **`wbraid` and `gbraid` are supported too.** Google sends those instead when the browser
  blocks the usual one, mostly on iPhones. Ignoring them loses roughly half the leads.
- `lead-intake` accepts only those three keys plus `clickAt`, and refuses a `clickAt` in
  the future, because a bad clock on a visitor's phone must not make an expired click look
  fresh.

## Where everything lives

- **`netlify/lib/gads-conversions.mjs`** — every rule, pure and imported by the tests.
- **`google-ads.mjs`** actions **`conversionSetup`** (idempotent: reads what exists, creates
  only what is missing, then RE-READS because the create response carries no tag snippet and
  the snippet is the only place the conversion label exists) and **`uploadConversions`**.
- **`landing.mjs`** — the tag, the click capture, and the form conversion on success.
- **`index.html`** — `ConversionLoopCard` (setup + send), the qualified/order-value controls
  on each lead row, and `ScorecardCard`.

## Rules worth not rediscovering

- **Idempotent by name.** Creating the actions twice splits the conversion history across
  duplicates, which is worse than having none: bidding then sees half the evidence.
- **A conversion action we did not create is never adopted.** A client may have their own,
  and taking it over would change what their account bids on without anyone deciding to.
- **Only rows Google actually accepted are marked as sent.** Marking a rejected row would
  hide it forever. `partialFailure: true` and the rejects are read back per row.
- **A won lead is a qualified lead.** Without that rule a lead that jumps straight to won
  never reports as qualified, and that is the conversion the account bids on.
- **Timestamps are stamped at the moment of marking**, because Google refuses a conversion
  dated before its click and a guess that lands early is silently rejected.
- **90 day limit.** Older clicks are filtered out with the reason recorded on the lead, not
  sent and silently rejected.
- Every skip carries a WHY. A silent skip looks exactly like a working upload Google
  ignored, which is a bug nobody finds for months.

## The 30-day scorecard

The eleven numbers the client asked for, in his order, from live data. Anything not yet
measurable reads **"Not measured"**, never 0 (same rule as KB `live-stats`: a zero is a
claim, an empty field is the truth). Needs `campaignSetup.grossMarginPct`, which was added
to Edit → Campaign → Campaign Details in the same change, because a card that asks for a
field nobody can fill in is exactly the complaint that produced that section.

## Not built, deliberately

**A way for the CLIENT to grade their own leads.** Bryson's call (2026-08-24): for the
first month he reviews leads with the client on a weekly call instead, so he learns their
definition of qualified first-hand. Revisit when there are enough clients that a weekly
call per client stops scaling.

**94 checks in `tests/verify-conversion-loop.mjs`, ten deliberate breaks confirmed to
fail** — including making a form fill primary, throwing away real order values, allowing a
lead to be counted twice, dropping iPhone click ids, and marking rejected rows as sent.
🔴 One assertion crashed instead of reporting when broken (`clickIdOf(...).kind` on a null),
which killed every check after it. A guard that crashes is not a guard that reports; it is
null-safe now.
