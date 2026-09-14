---
name: sales-call-playbook
topic: Sales
task: run a sales call or a client intake call, or decide what to ask a prospect
keywords: [sales call, discovery call, questions to ask a client, intake questions, client onboarding questions, meeting flow, call script, qualify a prospect, walk away signals, disqualify, per lead pricing, what is a lead worth, close rate, average job value, qualified lead definition, capacity, speed to lead, brendon, springbok, close sheet]
status: built
summary: Bryson asked for one standard question list and a repeatable meeting flow for every prospect. Built as "The Close Sheet" (artifact https://claude.ai/code/artifact/11a36113-b5f6-4a25-a426-343925b71b53) and derived BACKWARDS from `launch-checklist.mjs` and the portal's own `data-key` fields, so the questions map to fields the OS actually uses rather than to a generic template. 🔴 THE KEY DECISION IS TWO LISTS, NOT ONE: a first call only asks what sets the price and decides fit, because everything else is friction that costs the deal; the other twenty fields are an intake job after signing, and most of them the client types into their own portal. Includes the five numbers that set the price, the arithmetic that justifies a per-lead fee, six walk-away signals, and Brendon's specific call.
verified: 2026-09-14
---

**Bryson, 2026-09-14:** *"why don't we create a general list of questions for all the information
we will need in our system that I can use for every client and create a standardized meeting flow
for each of my meetings I have to potentially land a client"*.

## 🔴 The decision that shaped it: two lists, not one

He asked for one list. One list is wrong. A first call has a single job, which is to find out
whether this is a fit and what to charge. Every extra question is friction that costs the deal.
The other twenty things the OS needs are an **intake** job, after signing, and most of them the
client can type into their own portal without a call at all.

So the sheet is split: **the call that decides whether there is a deal**, then **intake, and
nothing before this point**.

## Derived from the system, not invented

The question list was built backwards from two real sources rather than from a generic template:
- `netlify/lib/launch-checklist.mjs` — the eleven steps between "they said yes" and "the ads are
  running", already split by who has to move (you / the client / their web person / automatic).
- The `data-key` fields in `netlify/functions/portal.mjs` — exactly what the client can fill in
  themselves: contact details, ad account ids, service area, target locations, average ticket,
  main offer, competitors, differentiator, tone, excluded keywords, lead destination, privacy and
  terms URLs, SMS opt-in URL, reviews.

Every question on the sheet carries a small tag saying what it feeds, so nothing is asked that is
not used and nothing used goes unasked. **If a new required field is added to the client record,
the sheet needs a matching question.**

## The five numbers that set the price

Average job value · close rate (in ten) · current monthly enquiries · current marketing spend ·
**how many more jobs a month they could take before it hurts**.

That last one is the one nobody asks and it is in there deliberately: selling a two-man crew forty
leads a month produces a client who cannot service the work, blames the leads, and churns.

## The arithmetic that closes people

Job value × close rate = revenue per enquiry. Halve it for margin. The fee is then expressed as a
**share of their profit per lead**, not as a dollar figure: *"fourteen percent of what you make on
it, and only when it happens"* rather than *"fifty dollars a lead"*. If the fee lands above about a
third of profit per lead, the deal does not work and should be said so plainly.

## Walk-away signals (the honest part)

They want BoldLine to fund the ad spend (**hard no, the one rule with no exceptions** — see the
hard business constraint in CLAUDE.md) · nobody reliably answers the phone (speed to lead IS the
product) · they want to pay per sale not per lead (never take the risk on someone else's closing
ability) · they expect week-one results · they cannot describe a good customer · the job value is
too small for any fee to work.

## 🔴 The single most valuable question on the sheet

*"Describe a bad lead. What makes you roll your eyes?"* — asked on the FIRST call, before money is
involved. The answer is the definition of a qualified lead in the client's own words, and it is
what both parties will be looking at the first month an invoice is queried. Write it down verbatim
and email it back after the call.

This came directly out of Brendon's stated worry and out of the standing risk that a per-lead deal
where the client decides what counted after seeing the bill only ever drifts one way.

## Brendon's call this week

He agreed verbally on Thursday 2026-09-10, so his is **call two, not call one**. The contract
should go out before they speak again: a signed agreement changes the conversation from whether to
how. His section covers the qualified-lead definition (including whether a no-show counts), sales
reps as a day-one negative keyword rather than something the bidding learns, lifetime patient value
rather than first-visit value, practice capacity, and why the campaign opens as "chiropractor"
rather than on TMJ.
