---
name: portal-chart
topic: Client portal
task: build or change any chart or graph a client (or Bryson) reads, especially the portal's results chart; make a graph readable at a glance
keywords: [chart, graph, bar graph, bar chart, leads per week, leads per day, at a glance, trend, up down level, weekly average, gridlines, scale, dataviz, portal chart, weeklyChartHTML, portal-chart.mjs, see the numbers, glance]
status: built on the dev branch with the portal v4 look (KB portal-os-look); goes live with it
summary: Built 2026-10-19 (Bryson, "make sure the the bar graph and any graphs we use can clearly display data that way a client can see how things are going based on a quick glance"). The portal's 30 daily bars (a comb of 0s, 1s and 2s, no scale) became "Leads per week": up to 8 rolling 7-day weeks (no empty weeks before their first lead, minimum 4), the answer written above it ("Up: 9 leads in the last 7 days, up from 4 the week before", arrow + word + colour), this week gold and earlier weeks grey, gridlines at 0 / middle / a round top, a dashed weekly-average line named in the key, numbers only on this week and the best week, a tap tip on every bar, and "See the numbers" opening the table. Now a standing rule in CLAUDE.md for every graph.
verified: 2026-10-19
---

## The rules (apply to every graph we build, client-facing or not)
1. **Write the answer in words above the chart.** Up / Down / Level with an arrow, the word and the two numbers.
   Colour supports it, never carries it alone. Down is said plainly.
2. **Give sparse data a shape.** Group by week (or month) when daily counts are small; 4 to 8 bars reads instantly.
3. **Emphasis, not rainbow.** The period that matters in the accent (gold), the rest in grey (#5F6474). Validated
   with the dataviz skill's `validate_palette.js` on the dark panel #0E1018: delta E 36.9 normal, 35.0 worst CVD,
   both above 3:1 contrast. (Its lightness-band and chroma checks flag the pair because they are written for
   categorical palettes; an accent + grey emphasis pair is meant to have a grey.)
4. **A real scale and a reference.** Gridlines with whole round numbers (`niceMax`), plus their own average as a
   dashed line, named in the key (on-chart label collided with tall bars, so it moved to the key).
5. **Selective labels.** Only the latest and the best values carry a number; every bar is focusable with a tip, and
   a table holds every number.
6. **No empty history.** Do not show flat weeks before the client started; it reads as failure.

## Where
`netlify/lib/portal-chart.mjs`: `weeklySeries`, `weeklyVerdict`, `niceMax`, `weeklyChartHTML`, `WEEKLY_CHART_CSS`.
portal.mjs calls `weeklyChartHTML({ dated, nowMs, noun, nouns, Nouns, esc })` in place of the old daily chart and
appends the CSS. Bars reuse the `.bar` class, so the v4 "bars rise once" motion and the hover tips still apply.

## Tests
`tests/verify-portal-chart.mjs` (21) + `verify-portal-results` updated (bars per week, answer present). Rendered
up and down cases at 390/768/1280/1600: no sideways scroll, labels clear, phone hides every other week label.
