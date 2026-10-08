---
name: cool-but-clear
topic: Working preferences
task: design or build any OS screen or new page and decide how to make it look cool, modern or exciting without making it confusing; add charts, animated numbers or a "needs you" line to a screen header
keywords: [cool but clear, cooler screens, screen header, ScreenHeader, CountUp, Spark, ShViz, sparkline, count up, needs you, focus line, viz, reduce motion, prefersStill, micro interactions, mission control, os screens]
status: standing rule
summary: Bryson, 2026-10-08 - "make them cooler but still very useful and not confusing, same thing for the other pages we are going to build". Rule - every bit of motion says something true (numbers count up because they arrived, charts are real data you can point at, a dot pulses only while something waits on him, an all-clear sits still). Each screen's header answers "what needs me now" and carries one live chart of its own numbers. Built as shared pieces on ScreenHeader (focus + viz props, CountUp, Spark, ShViz) and pinned by verify-os-screens section 5.
verified: 2026-10-08
---

**LIVE** since 2026-10-07 19:41 Phoenix (merge `cb9dbe1`; restore point `rollback/20261008-024128`).

## What he asked

After seeing OS Stage 5 (the shared Mission Control header on every screen), Bryson asked, 2026-10-08:
*"Is there a way we could still make them very useful and not confusing but make them cooler same thing
for the other pages we are going to build?"* So this is a standing rule for every OS screen AND any page
we build later, not a one-off.

## The rule (apply to every new screen or page)

1. **Motion has to mean something.** Allowed: a number counting up because it just loaded, bars growing
   because they are real data, a pulse because something is waiting on him, a press/hover response on
   something he can click. Not allowed: motion that only decorates, or anything that delays reading.
2. **The top of every screen answers "what needs me now".** One line, plain words, with a count. If it
   can take him there, it is a button that does (Leads: filters to the new ones). Tones:
   - gold, pulsing = needs him
   - red, pulsing = something is wrong
   - green, still = all clear
   - grey, still (`info`) = just information
   Never show an all-clear while the data is still loading (Calendar waits for `loading` to finish).
3. **One live chart per screen, of that screen's own numbers**, replacing the decorative turning ring.
   The label always says what the big number is, and pointing at (or tapping) a bar swaps the label and
   number for that bar's own. A screen reader gets every bar's value. Without real data the ring stays.
4. **Phones get the same information, not less.** The chart drops under the counts on narrow screens
   instead of disappearing; labels wrap instead of being cut off.
5. **Reduce motion = everything still**: numbers show their final value immediately, no pulse, no growing
   bars. Effects stay cheap (CSS + small SVG, no libraries) so screens still open instantly on a phone.
6. **Reuse the shared pieces, never hand-build effects per screen** (that is how the old titles drifted).

## The shared pieces (index.html, just above `TodayHero`)

- `ScreenHeader({ ..., focus, viz })`
  - `focus = { text, tone: "gold"|"red"|"green"|"info", onClick? }`
  - `viz = { label, data: number[], labels: string[], value?, format?, mark? }`
    - `value` defaults to the sum of `data`.
    - `mark` is the highlighted bar. It defaults to the last bar; Calendar uses 0 = today.
- `CountUp({ value, format })` counts up any plain number and passes anything else through as it is.
  Every header stat already uses it.
- `Spark` draws the bars; `ShViz` is the panel (label, number, bars, the point-at-a-bar readout).
  `ShViz` keeps `CountUp` mounted while you point at a bar, so moving off the chart does not re-count.
- Helpers: `prefersStill()` (the reduce motion check), `phxLastDays(n)` (Arizona day keys),
  `shortDay(ymd)`.
- CSS: `.sh-focus*`, `.sh-viz*`, `.spark-bar`, `@keyframes shPing/shPingR/sparkGrow`.

## Where it is applied (2026-10-08)

| Screen | "Needs you" line | Chart |
|---|---|---|
| Leads | N new leads you haven't contacted yet (filters to them), or all caught up | Leads per day, last 14 days (Arizona clock) |
| Calendar | N things on today incl. meetings (jumps to today), or nothing on today | Items per day, next 7 days, today marked |
| Revenue | $X still unpaid this month, or every invoice this month is paid | Invoiced per month, last 6 months; this month marked |
| Campaigns | Ad accounts that didn't answer (red), or N campaigns running right now | none yet: no per-day series. Ring stays. |

Deal Prep, Lead Scout, Content Studio, Website and the client lists keep the ring for now. They don't
have a time series in hand at the header. Good next candidates:
- Lead Scout: calls per day from outreach touches.
- Website: visitors per day from GA4, once that card's data is lifted to the screen.

## Verification

- `tests/verify-os-screens.mjs` section 5 pins the rule: count-up and reduce motion, the readable
  chart, only gold/red pulsing, the phone placement, which screens carry a chart and a line, and
  Calendar not claiming "nothing on today" mid-load.
- Checked headlessly at 1440 / 768 / 390:
  - no sideways scroll;
  - pointing at a bar showed "AUGUST 2026 | $2,400" and moving off restored "LAST 6 MONTHS | $9,150";
  - a reduce-motion run rendered cleanly.
- Related: `os-redesign` (Stage 5 header), `website-design-bar` (the same idea for client websites),
  `responsive-standards`.
