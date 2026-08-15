---
name: house-account-reporting
topic: OS app
task: weekly reports and the visual pipeline for BoldLine's own ads
keywords: [house account report, weekly briefing, isOwnerBriefable, isReportable, my ads report, findPkg bl-house, visual pipeline, pipeline progress bar, adPerf in report]
status: verified
summary: The house account was excluded from every scheduled report by TWO independent things — `isReportable` requires `!client.internal`, AND the server's `findPkg` had no `bl-house` entry so it resolved no package and skipped silently even before the gate. Both fixed: a new `isOwnerBriefable` gate sends Bryson a WEEKLY briefing on his own ads (never a client-facing report, there is no client), the briefing prompt now reads as his own money rather than a client account, and live ads-sync numbers were added to the data block. The Pipeline tab also gained the visual progress read clients get in their portal. 32 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"I want to make sure I can generate my own report manually and i get automated weekly reports. I also want a visual bot pipeline of where my ads are at just like how the clients get."*

## Reports — two separate reasons it was excluded

**One:** `isReportable(client, pkg)` requires `!client.internal`, with a comment saying ARIA's monthly OS report covers the house account. It doesn't — that report is about the OS itself, not about whether his ads are working.

**Two, and this one would have bitten even after fixing the gate:** the server's `findPkg` reads a package table that does not contain `bl-house` (the house package is deliberately kept out of `PACKAGES_DB` so it can never appear in a client-facing picker — see KB `house-account-full-services`). So `findPkg` returned `undefined`, `!!pkg` failed, and every job skipped the account **silently**. Fixing only the gate would have produced a change that looked right and did nothing.

**THE FIX — two gates, not one:**
| Gate | Question | House account |
|---|---|---|
| `isReportable` | may a CLIENT-facing report be sent? | **no** (no client exists) |
| `isOwnerBriefable` | may Bryson get a briefing? | **yes**, once an ad account is linked |

The owner gate needs no client email and no contract, because the briefing goes to Bryson. It requires a **linked ad account** — before that there is genuinely nothing to report. `processWeekly` now evaluates both independently and only skips when both are false.

**The briefing had to be rewritten too.** The owner prompt said "about one of his clients". Pointed at the house account that produces a briefing discussing the contract and keeping the client happy, about his own money. It now branches: for `internal`, it says plainly this is BoldLine's own advertising, there is no contract and no client, and judges it the way an owner would.

**Live ad numbers were missing from every briefing.** The data block described the CRM record (leads, CPL, stage) but never the ads. It now includes the `ads-sync` snapshot: live campaign count, impressions, clicks, 30-day spend, conversions, and budget pacing against the monthly figure — with an honest "none yet" line when nothing has synced, rather than implying zero performance.

**Manual generation already worked** — `ReportsTabContent` in the OS is not gated on `internal`, and the Reports tab was never filtered out. Verified rather than assumed.

## Visual pipeline

The OS Pipeline tab was a **list of 20 bot rows**, which answers "what exists". The visual clients see in their portal answers "where are we". Added above the list: **one segment per step in order**, coloured by state (green done, gold running with a glow, red needs-you, grey waiting), a **percent complete**, and a line naming what is **running now**, what **needs him**, or what is **next up** when nothing is running. House wording differs from client wording, since his steps advance from observed facts rather than from a bot he can chat to.

**Verified by 32 cases:** the house package resolves server-side with a weekly cadence while real and unknown ids behave unchanged; the house account passes the owner gate and fails the client gate; an **unlinked** house account is skipped; a Meta-only link qualifies; real clients still pass both and an inactive one passes neither; the weekly runner evaluates both gates independently; the prompt branches on `internal` and keeps the client wording for clients; live ad data and pacing reach the block with an honest empty state; and every element of the visual header renders including the all-complete case.
