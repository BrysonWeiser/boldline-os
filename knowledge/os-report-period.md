---
name: os-report-period
topic: Reports
task: fix or change what the monthly OS health report counts, or why its numbers look wrong
keywords: [os health report, monthly report, two clients, client count wrong, internal account counted, buildOSDataBlock, leadsInMonth, MONTH_KEY, whole month, snapshot, trailing 30 days, spend30d, reporting period, ARIA report, liveStats leads lifetime]
status: built
summary: The monthly OS health report counted BoldLine's own ad account as a client (one client read as two) and reported LIFETIME lead totals under a monthly heading. It now excludes the internal account and reports it separately, counts leads for the calendar month just ended from the dates on the records, and labels the ad spend honestly as a trailing 30-day reading because that is the only spend figure stored. 18 checks, seven mutations caught.
verified: 2026-09-04
---

## The two things Bryson reported

> *"make sure it takes information from the whole month and uses it not just what it sees when
> it writes the report."*
> *"it is also saying i have two clients but i only have 1 and then my own ads running"*

### 🔴 The client count

BoldLine's own advertising account is a row in `clients` with **`internal: true`**, because
that is how the OS gives its own ads the same machinery every client gets. `buildOSDataBlock`
counted it. A one-client agency read as a two-client agency, and **every average was computed
over a "client" that pays nothing, signs nothing and renews nothing.**

It is now excluded from `clients` and reported separately as *"BoldLine's Own Ads, Leads in
&lt;month&gt;"*, so its results are not lost. The block also **says in words** that the count
excludes it, because the model writes the prose and will otherwise reintroduce the same error.

### 🔴 The period

It read `liveStats().leads`, which is the **lifetime length of the lead log**. On the first
monthly report that is indistinguishable from the month; by month three it is a number that
only ever goes up and says nothing about the month on the subject line.

Now: the report runs on the 1st, so it covers **the month just ended**, and leads are counted
from `receivedAt` for that calendar month, with the previous month beside it for comparison.

### 🔴 The half that arithmetic cannot fix, which is the part worth remembering

Leads carry a timestamp, so a calendar month is exact. **Spend does not.** The only stored
figure is `adPerf.totals.spend30d`, a **trailing 30-day reading** from whenever the hourly sync
last ran. No amount of dividing turns that into the month.

So it is reported as what it is, **with the time it was read**, and the prompt is told not to
call it monthly or derive a cost per lead from it. **A number presented as something it is not
is worse than no number.** True calendar-month spend needs a dated query to Google and Meta,
which is a separate build.

## Testing note

`tests/verify-os-report-period.mjs`, 18 checks, seven mutations all caught. Includes the
off-by-one-year case every month-boundary calculation gets wrong exactly once: **running on
1 January, the report covers December of the previous year and compares against November.**
