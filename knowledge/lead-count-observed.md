---
name: lead-count-observed
topic: OS
task: fix a client showing leads that were deleted, and keep every screen counting the same list
keywords: [lead count wrong, deleted leads still showing, cl.leads, leadCount, stale count, leads tab disagrees, two leads, stored count, observed never stored]
status: verified
summary: Sebastian's record showed "2 leads" on the client card and Overview tile while his Leads tab correctly showed none, because seven places read a STORED `cl.leads` number that only demo seed clients ever set, and deleting a lead removes it from `leadsLog` without touching that tally. One shared `leadCount(cl)` helper now counts the real list everywhere, falling back to the stored number only for demo clients (which have no `leadsLog` at all). Fixed 2026-09-08.
verified: 2026-09-08
---

**Why (Bryson, 2026-09-08):** *"On the os it is showing he has 2 leads (the ones that were
deleted so it doesn't show them in the actual leads tab)"*.

Two screens disagreed about one client, and the one that was right was the one nobody
doubted. The Leads tab reads `leadsLog`, the real list. Seven other places read `cl.leads`,
a number **only the demo seed clients ever set** — and nothing keeps a separate tally in step
with a list you can delete from.

```js
const leadCount = (cl) => Array.isArray(cl && cl.leadsLog) ? cl.leadsLog.length : Number((cl && cl.leads) || 0);
```

Now used by: the bot status line, the health score (three thresholds), the client-list sort,
the client card, the Overview tile, and `deriveBotStatuses`.

🔴 **THE SEVENTH SITE IS THE INTERESTING ONE, because it survived the first sweep by being
written differently:**

```js
const leads = (cl.leadsLog || []).length || Number(cl.leads || 0);   // BUG
```

It **reads** as "count the list, fall back if there is none" and **behaves** as "count the
list unless the answer is none" — an empty log is `0`, which is falsy, so `||` reaches
straight past the real list to the stale number. Deleting every lead is exactly the case that
triggers it. A grep for `cl.leads` with a comparison found the six obvious ones and this one
only turned up because the test asserted that *nothing* reads the stored count any more.

🔴 **The stored number survives ONLY for demo clients**, which carry `leads: 24` and no
`leadsLog` at all. Counting their (absent) list would render the product tour empty.

## Two guards had to be updated rather than deleted

- `verify-house-leads` pinned the exact buggy expression, so the fix read as a regression.
  It now pins the helper, which keeps the intent and cannot be satisfied by the old code.
- `verify-house-pipeline` extracts `deriveBotStatuses` and runs it in isolation, so the
  helper had to be added to the extraction list or it threw — the same trap `landingUrlFor`
  set on 2026-09-03, recorded there and hit again here.

`tests/verify-lead-delete.mjs`, 16 checks, extracts and RUNS the helper. Five mutations, all
caught, including the falsy-empty-list one specifically.
