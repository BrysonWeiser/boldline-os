---
name: approval-chase
topic: Clients
task: understand or change what happens when a client goes quiet on something sent for their approval
keywords: [client not responding, silent client, chase client, nudge client, stale approval, unanswered approval, approval reminder, APPROVAL_CHASE_DAYS, chaseDue, chaseable, chasesSent, handedOffAt, alerts-watch, follow up automation, client went quiet, no reply, reminder email, escalation]
status: built
summary: A client sitting on an approval used to produce ONE yellow alert to Bryson on day 3 and nothing ever again, and the client themselves was never contacted by the OS at all. Now the OS emails the client on days 3, 7 and 14, in reminder-flavoured copy that names how long it has been waiting and invites the real objection, then STOPS and raises one red hand-off telling Bryson to phone them. Never chases a client who asked for changes, the demo client, the house account, or anyone with no portal to open. The chase is recorded only after the send succeeds. 65 checks, 18 mutations caught.
verified: 2026-09-09
---

**Bryson, 2026-09-09**, with his first real client's campaign built, paused and awaiting approval: *"what do we do if it takes Sebastian a long time to respond again"*.

## What was actually there

`alerts-watch` had a stale-approval nudge. It fired at **day 3**, sent **one yellow alert to Bryson**, and de-duped itself forever with a `nudgedAt` boolean. **The client was never contacted by the OS at all.**

So a signed client could sit on a built, paused campaign indefinitely while the system meant to be automating follow-up said one thing, to one person, on one day. For a project whose stated goal is *full automation before the first client*, this was the first place that promise was tested and it did not hold.

## 🔴 Why this matters more than it looks, on these terms

Stencil & Thread is **setup waived, no monthly minimum, $50 per qualified lead**. No leads means no invoice. So a stalled approval costs **BoldLine everything and the client nothing**, and there is no clock running on them anywhere. That asymmetry is the argument for escalating and then stopping, rather than politely repeating.

## The ladder

`APPROVAL_CHASE_DAYS = [3, 7, 14]` — the client is emailed on each, then it ends.

- **`chaseDue(approval, ageDays)`** returns the next **unsent** rung once its day has passed. A watcher that misses a day **catches up rather than skipping a rung**: a client never emailed on day 3 gets reminder *one* on day 9, not reminder two.
- **`chasesSent`** counts the record of sends, never a counter kept beside it, so a failed send cannot leave the count ahead of reality.
- **The ladder ends.** Emailing someone forever is not persistence, it is noise they learn to ignore, and it hides the fact that the thing now needs a person. After the third, one **red** hand-off alert fires **once** (`handedOffAt`) saying the OS will not email them again and to phone them.

**Bryson is told every time** the OS emails his client, with which reminder it was and when the next one goes. An automatic message to his client that he cannot see is a message he can be blindsided by.

## Who is never chased

| | Why |
|---|---|
| Asked for **changes** | 🔴 That is an ANSWER. Chasing them to approve the thing they asked you to change is how you lose a client. |
| Already approved | Nothing to chase. |
| The **demo** client | A fake client sending real reminder emails eventually reaches a real inbox. |
| The house account | There is no client. |
| No email address | Nothing to send to. |
| 🔴 **No portal token** | An email whose only button opens a page they cannot use is worse than no email. |
| No `createdAt` | The age is unknowable, so it would chase on day zero forever. |

## The copy

One template, two tones. `approval_request` takes an optional **`reminderDays`**: with it, the subject becomes *"Still waiting on you"*, the body names how many days it has been waiting, says **nothing has started yet**, and asks *"If something is holding you up, or you want anything changed first, just reply"*.

That last line is the point. A client hesitating about starting the spend will not volunteer that unless asked, and no number of reminders fixes a hesitation. Sending the identical "something's ready" email three times reads as a broken robot, and a hesitating client reads a broken robot as a reason to keep not answering.

## 🔴 The ordering that decides whether a failed send costs a reminder

The chase is written to the record **only after `autoSendClientEmail` reports success**. Recording first burns a rung of the ladder on an email that never left, and the client silently gets two reminders instead of three with nothing anywhere saying why. A failed send logs and moves to the next client; a failed **write** is logged too, because losing the record means the same reminder goes out again tomorrow, every day.

## Verified

`tests/verify-approval-chase.mjs` — **65 checks, 18 mutations, all caught.** The real helpers are imported and run: every rung, the catch-up case, the end of the ladder, every excluded client, and both email tones rendered and checked against the standing no-emoji and no-em-dash rules for client-facing copy.

Two mutations initially survived, both worth recording:

1. **`severity: "red"` tested against the whole file** passed with the hand-off downgraded to yellow, because other alerts in the same watcher are red. Scoped to the hand-off's own alert block.
2. **The end of the ladder is guarded twice** (an explicit length check, and `APPROVAL_CHASE_DAYS[sent]` being `undefined` so the comparison is false). Each guard alone reads as an equivalent mutant; removing **both** is caught. That redundancy is deliberate, since relying on `age >= undefined` being false is not something to build on.
