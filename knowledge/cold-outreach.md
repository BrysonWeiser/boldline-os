---
name: cold-outreach
topic: OS app
task: work the cold list — calls, DMs and emails — log attempts, schedule follow-ups, or read the outreach numbers
keywords: [cold outreach, outreach screen, cold calling, dialer, call workflow, outcome buttons, cadence, follow up, do not contact, blocked, appointment setter, outreach_touches, outreach_settings, dues queue, meetings showed, cold email deliverability, automated DMs, outreach draft]
status: verified
summary: A new Outreach screen that WORKS the list Lead Scout builds. One prospect at a time with the script beside it, big outcome buttons that log and advance on their own, an automatic follow-up cadence, and counters that separate meetings BOOKED from meetings that SHOWED UP. 🔴 Nothing sends. Cold email and DMs are WRITTEN here and sent by hand, because bulk cold email poisons the domain that sends client invoices and automated DMs get Instagram accounts banned; a test fails if a sender is ever wired in. 🔴 "Do not contact" is enforced in three places, not remembered. Built 2026-09-21. Needs a one-time Supabase migration. 145 checks, 13 mutations caught.
verified: 2026-09-21
---

## Why it exists

Bryson, 2026-09-21: *"what if we build a cold outreach section in the os and it is completely
tailored to doing cold outreach (cold calls, cold dms, cold emails, etc.)"*, then *"build everything
but what you flagged we shouldnt do"*.

Lead Scout already FINDS prospects and ranks them. **A card list with a status dropdown is not a
workflow.** Nobody makes sixty dials a day off one, because every call begins with a decision about
who to call next, and deciding is what kills momentum. So this screen is one prospect, one tap,
next prospect.

## 🔴 THE TWO THINGS DELIBERATELY NOT BUILT

Their absence is the feature, and `tests/verify-outreach.mjs` fails if either is ever wired in.

| Not built | Why |
|---|---|
| **A cold email sender** | Cold email at volume earns spam complaints, and complaints poison the sending domain. That is the **same domain client reports and INVOICES go out on**, so a stranger pressing "spam" could land a client's invoice in their junk folder. Proper cold email needs a separate warmed domain and a dedicated tool: a deliberate decision with a real cost, not a feature to bolt on |
| **Automated Instagram / LinkedIn DMs** | Both platforms ban accounts for it, and that account carries his name and his audience |

The **Messages** tab writes three openers from what Lead Scout already knows, he copies one, sends it
himself, then logs it so the follow-up is scheduled and it counts. 🔴 **The screen says this out
loud**, because a missing Send button reads as unfinished and gets "fixed" otherwise.

The detectors look for the MACHINERY, not the words: a first version banned the strings "instagram"
and "linkedin" anywhere in the file and failed on this feature's own explanation of why it does not
send to them. A guard that fires on its own documentation gets deleted.

## 🔴 "Take me off your list" is enforced, not remembered

The one rule with legal weight, and the one that gets handed to a setter. `blocked_at` is **its own
column**, not a status, because status is a sales stage a dropdown can move back. Three independent
guards, because this failing is a legal problem rather than a bug:

1. The queue query filters `blocked_at is null` in SQL.
2. `dueQueue` filters again in code.
3. The endpoint **refuses** a touch on a blocked prospect, so a stale tab or a replayed request
   cannot contact somebody who asked not to be.

The button asks first and says the word *permanent*, and undoing a later attempt rebuilds the block
from the remaining history rather than clearing it.

## The rules

All in `netlify/lib/outreach.mjs`, mirrored in `index.html` with a parity test, because the queue,
the counters and the screen must agree about what a conversation is.

- **Outcomes** carry `reached`, `ends`, `blocks`, `books`, `needsWhen`. 🔴 **A gatekeeper IS a
  conversation and a voicemail is not**: dials-to-conversations is how you tell a bad LIST from a
  bad SCRIPT, and that only works if "a human answered" is the line.
- **Cadence** `[2, 3, 5, 7, 14]` days, widening on purpose, then it stops. Chasing daily reads as
  pestering; a gap over a fortnight means they have forgotten the first call. **A time the prospect
  named always wins over the schedule.**
- **Counters** separate booked from showed. 🔴 A booking is a promise, a show is the result, and it
  is the number a setter gets paid on, so it is answered by a person and never inferred. Meetings
  that have passed with no verdict are named as pending rather than counted either way. Rates are
  `null`, never `0`, so "we have not called anybody" cannot read as "nobody ever answers".

## Setup

🔴 **One-time Supabase migration: `docs/sql/outreach-schema.sql`.** Until it is run the screen shows
an exact instruction rather than a Postgres error. The new tables are in the nightly backup, caught
by `verify-backup` during the build: prospects can be found again by re-running a search, but **every
attempt ever made and every do-not-contact request exists nowhere else.**

## 🔴 Two bugs the green tests did not catch

Found by driving the screen in a browser, which is now the habit:

1. **`authToken` is not module scope.** Every screen in `index.html` defines its own. Without it
   every call failed with "authToken is not defined" in the error strip while all tests passed,
   because the tests never ran the component.
2. **Arriving at Messages from Call mode** left the channel on "call", which that tab hides. The
   button read "Write 3 texts" with no chip selected, and the draft it asked for was an email.
