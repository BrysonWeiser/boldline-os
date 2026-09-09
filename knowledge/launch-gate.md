---
name: launch-gate
topic: Ads
task: understand or change who has to approve before a campaign goes live and starts spending
keywords: [who approves, approve campaign, goes live, does it go live, launch gate, launchGate, clientApprovalFor, start without them, override client, owner approve button, pendingActions approve, client approval, portal approve, both approvals, double approval, spends client money, enable_campaign]
status: built
summary: Either side's Approve set a campaign live, with neither checking the other, so the owner pressing his own button would start spending the CLIENT's money on ads the client had never seen while their portal still said "nothing goes live without your OK". The client's approval still launches instantly (unchanged, and now the only on-time path). The owner's button now waits on the client, is relabelled "Start without them" when it would override, warns on the card before it is pressed, asks once, and closes the client's request afterwards so the portal stops asking about a campaign already running. Never blocked: an unresponsive client is real, and so is a go-live that failed after they said yes. 50 checks, 15 mutations caught.
verified: 2026-09-09
---

**Bryson, 2026-09-09**, having built Stencil & Thread's first campaign and seen it queued on both sides: *"I know once I press approve it goes live but does it go live right away when Sebastian approves it or do I still need to approve it afterwards?"*

## The answer to the question

**The client's approval alone starts it.** Pressing Approve in the portal calls Google there and then, sets the campaign live, and **clears the owner's queued "Launch..." item** so it disappears from his notifications by itself. That was built 2026-09-02 (*"Once something is approved by whichever party needs to approve it the thing should instantly go live"*) and is unchanged. If Google refuses, the alert is **red** and says it did not go live, so a green tick always means green.

## 🔴 The problem the question exposed, which was the other direction

Nobody had looked at the owner's own button. `decideAction` ran the identical activation **with no reference to the client at all**. Whoever pressed first launched it.

So Bryson pressing his own button would have:

1. started spending **Sebastian's** money on ads Sebastian had never seen, and
2. left Sebastian's portal still showing a card asking him to approve a campaign that was **already live and already charging his card**, under a line that reads *"Nothing goes live without your OK."*

That is not a missing feature, it is **the product saying something untrue** — the same shape as the bug fixed in `portal.mjs` on 2026-09-02, and it cuts straight across the standing rule that **the client pays for every penny of ad spend and therefore decides.**

## What it does now

`launchGate(cl, action)` returns null when there is nothing to wait for, or `{approval, state}` when there is. It waits only on **`enable_campaign`**, and only for a **real client**:

| Situation | Result |
|---|---|
| Client approved | **no wait** — this is the retry case, they said yes and Google refused |
| Client has not answered | wait, `not-answered` |
| Client asked for **changes** | wait, `wants-changes` (a clearer no than silence, and it used to launch anyway) |
| 🔴 **No approval at all** | wait, `never-asked` — **the strongest reason to wait, not a reason to skip the check** |
| House account (`internal`) | no wait, there is no client to ask |
| Pause, or a budget change | no wait — waiting for permission to **stop** spending their money is backwards |

**It is a WAIT, not a BLOCK.** An unresponsive client is a real situation. The button is **relabelled "Start without them"** and the card turns amber and says, before he presses anything, that it goes live by itself the moment they approve and that starting it himself spends their money on ads they have not agreed to. Pressing it asks once more, naming the consequence.

🔴 **An override closes the client's request too** — marked approved, `decidedBy:"owner"`, with a note in their portal reading *"Started by BoldLine before you replied. Tell us if you want it paused."* Without that, the portal keeps asking them to approve something already live and spending, which is the same untruth one step later. The activity log records **`⚠ OVERRODE`** and which state was overridden, never a plain "Approved".

## Verified

`tests/verify-launch-gate.mjs` — **50 checks, 15 mutations, all caught.** The real gate is extracted from `index.html` and RUN: every waiting state, every non-waiting state, an approval for a **different campaign** not unlocking this one, numeric-vs-string ids matching, junk and missing approval lists not throwing. Plus the button's own wording, the ordering (the gate runs **before** anything reaches the platform), and the override's bookkeeping. It also pins the client's path in `portal.mjs`, because with the owner's button now waiting, **that is the only path that launches on time** and a regression there turns the gate into a deadlock.

🔴 **One mutation initially survived: `indexOf` returns -1, and -1 is less than everything.** The "gate runs before the API call" assertion was written as a bare `<`, so deleting the gate call outright made it pass. Both positions are now proved real before being compared. Any ordering assertion written on raw `indexOf` has this hole.
