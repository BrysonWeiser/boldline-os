---
name: deal-prep-to-client
topic: OS app
task: change the meeting questions in Deal Prep, or the button that turns a meeting into a client
keywords: [meeting questions, deal prep questions, MEETING_QUESTIONS, clientFromMeeting, setPath, create client from meeting, convert prospect to client, meeting notes, deal brief notes, sales call in the os, no manual entry, qualifiedLeadDef, salesNotes, deal-research notes action]
status: built
summary: Deal Prep now carries the meeting questions, a box for each answer, and one button that turns them into a real client record so nothing is typed twice. 🔴 THE DESIGN IS THAT EVERY QUESTION DECLARES WHERE ITS ANSWER LANDS (`path`), so the question list and the conversion are one object and cannot drift; adding a question carries it into the client with nothing else to edit. Answers auto-save ~0.9s after typing stops, into `deal_briefs.input.meetingAnswers` (NOT a new column, because a migration nobody runs is how Lead Scout hung silently) and come back when a brief is reopened. The created client is deliberately identical in shape to one from the Add Client sheet and lands unsigned at onboarding, so nothing counts it as a client. 188 checks, 14 mutations caught.
verified: 2026-09-14
---

**Bryson, 2026-09-14:** *"a section in the os where I can do the deal prep and then in there there
is the list of meeting questions to go over and then a place to put the answers and then from
there a button in the deal prep section to take all the information I gathered into a client that
way I don't have to manually put everything in"*.

## 🔴 The design decision: a question and its destination are one object

```js
{ id:"avgTicket", ask:"first", sec:"The numbers", path:"campaignSetup.avgTicket",
  q:"What is an average job worth to you?", feeds:"Sets the price" }
```

A hand-written question list beside a hand-written mapper is **two lists that drift**, and the way
you find out is a client created weeks ago with a field silently empty. Here `path` IS the mapping.
`clientFromMeeting` walks the same array, so **adding a question carries it into the client with
nothing else to remember**.

`tests/verify-deal-to-client.mjs` executes the real block out of `index.html` (between the
`DEALPREP-QUESTIONS-START/END` sentinels) and fails if any question points at a top-level field
the client record does not have.

## Two lists, same reasoning as the Close Sheet

`ask: "first"` is the sales call, `ask: "intake"` is after signing. A first call only needs what
sets the price and decides fit; everything else is friction that costs the deal. The suite caps
the first-call list at 14 so it growing is a decision, not an accident.

## Where the answers live, and why not a new column

`deal_briefs.input.meetingAnswers`, merged read-modify-write, saved ~0.9 seconds after typing
stops. Reasoning, in order:
- Browser-only storage loses a call to a page reload, which is unacceptable mid-meeting.
- A new column means a Supabase migration Bryson has to remember to run, and **a feature that
  silently does nothing until somebody pastes SQL is exactly how Lead Scout hung**.
- `input` is written ONCE by the background job when the brief is created and never touched
  again; `result` is overwritten by the research run. So answers parked in `input` cannot be
  clobbered.

`action=get` returns them alongside the brief, so reopening a prospect restores the answers.

## What the button makes

`clientFromMeeting(answers, brief)` returns **the same shape `AddClientSheet` produces**, on
purpose: two ways of making a client is two shapes to keep in step, and the day they differ is the
day a campaign build reads a field only one of them writes. The suite pins ten fields against the
sheet's own literal.

🔴 It lands at `stage: "onboarding"`, `contractSigned: false`, `contractStatus: "pending"`, no
package. A good meeting is not a signature, and `isFoundingClient` must not count it (standing rule
in CLAUDE.md, 2026-09-14). Mutation-tested in both directions.

Two new fields on the client record, neither needing a migration (it is all one JSON blob):
- **`qualifiedLeadDef`** — the answer to *"describe a bad lead"*, asked on the FIRST call before
  money is involved. It is what both sides look at the first time an invoice is queried.
- **`salesNotes`** — everything said on the call with no field of its own (close rate, current lead
  volume, capacity, speed to lead, past ads, web person), plus `capturedAt`. Kept rather than
  dropped, because "what did he say his close rate was" is a month-two question.

## 🔴 A test in this repo was matching somebody else's code

`verify-app-boots` finds the tab-label map with `/\.map\(\(\[k,label\]\)=>/` and takes the FIRST
match in a 1.1MB file. The segmented control added here destructured the same two names 2,500 lines
earlier, so the guard silently started reading unrelated code and reported the tab rename as
broken. Fixed on both sides: this code uses `([key,label])`, and the pattern is now anchored on
`k==="portal"`. The test's own comment already said a pattern that can match somebody else's code
is not a test. It was one line too loose.
