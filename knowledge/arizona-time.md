---
name: arizona-time
topic: Working preferences
task: write any date, time, day name, deadline or scheduled reminder for Bryson
keywords: [arizona, phoenix, MST, timezone, time zone, UTC, what time is it, today, tomorrow, yesterday, daylight saving, DST, cron, schedule, reminder, routine, trigger, meeting time, availability, day of week, date wrong, off by one day, what day is it, what day is it today, current time, whats the date, clock]
status: standing rule
summary: Bryson is in Phoenix, MST, UTC-7, and Arizona never observes daylight saving, so the offset is 7 hours all year. The session clock is UTC and is already a day ahead of him every evening after 5pm his time, which has caused two real errors. Run `TZ=America/Phoenix date` before writing any time, day name, date or relative day, especially in anything a client or partner reads.
verified: 2026-08-31
---

## The rule

Bryson, 2026-08-31: *"do you know what time I am, always look at what time and day it is in
Arizona unless I say otherwise."*

**Arizona is the only clock.** Every time, date, day name and deadline is in Phoenix time
unless he explicitly says otherwise. He should never have to convert anything.

| | |
|---|---|
| Zone | America/Phoenix |
| Offset | **UTC-7, all year** |
| Daylight saving | **Arizona never observes it.** No spring-forward, no fall-back, no seasonal exception to remember |
| Command | `TZ=America/Phoenix date +"%A %Y-%m-%d %I:%M %p %Z"` |

The no-daylight-saving part is the one genuinely easy thing here. Most zones need to know the
date before you know the offset. Phoenix does not. It is 7 hours behind UTC in January and 7
hours behind UTC in July.

## 🔴 Why this is a rule and not a nicety

**The session clock runs on UTC, which is 7 hours AHEAD of him.** So from about **5:00 PM
Phoenix onward, the date handed to the assistant is already the NEXT calendar day** while
Bryson is still living the current one. An evening session that trusts its own clock will be
wrong about the day roughly a third of every 24 hours.

That has now produced two real errors, both caught by Bryson rather than by anything here:

1. **A reminder set for 10pm fired at 5pm.** Scheduled with a raw `delay_minutes` computed
   against the wrong current time. His words: *"it isn't 10pm it's 5:04 pm right now."*
2. **An email drafted for Shaun Smith said the contract was signed FRIDAY when it was
   SUNDAY**, and called Wednesday the 2nd "tomorrow" when it was two days out. UTC had
   rolled to 2026-09-01 while his Monday 2026-08-31 was still going. His words: *"he signed
   the agreement yesterday which was Sunday."*

The second one is the reason this is written down. A wrong day in an internal note is
harmless. A wrong day in an email to the first client's developer, during the first launch,
reads as not paying attention.

## What to actually do

**Before writing ANY of these, run the command:** a clock time, a date, a day name, or a
relative day (`today`, `tomorrow`, `yesterday`, `this week`, `last night`, `in two days`).

Applies to all three of these, in increasing order of how much it costs to get wrong:

- Replies to Bryson.
- Scheduled reminders, Routines and cron triggers.
- 🔴 **Anything a client or partner reads.** Emails, proposals, meeting times, contract dates.

**For crons and Routines, convert Phoenix to UTC and then convert the result BACK to confirm
it lands where intended.** `cron` is UTC here. Note the trap that `date -d "..." -u` applies
UTC to the *parsing* as well as the output, which silently gives the wrong answer. Use an
explicit `%z` or set `TZ=` on the command instead. 8:00 AM Phoenix is `0 15 * * *`, which is
how the morning-brief Routine is already written (KB `morning-brief-routine`).

If a day boundary is genuinely load-bearing and the command is unavailable, say which day you
mean by its date rather than by "tomorrow" and let him correct it.

## Related

`morning-brief-routine` (the 8am Arizona Routine and its UTC cron), `stencil-and-thread-deal`
(where the Friday/Sunday error happened), `site-coming-soon` (the Monday 09:00 Phoenix weekly
Routine).
