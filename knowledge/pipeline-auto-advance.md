---
name: pipeline-auto-advance
topic: OS app
task: how the 20-bot delivery pipeline advances, and which steps are still manual
keywords: [bot pipeline, botStatuses, auto advance, deriveBotStatuses, effectiveBotStatus, botStatusManual, MANUAL_BOTS, pipeline progress, stage, waiting active done]
status: verified
summary: The bot pipeline never advanced by itself for ANYONE — every writer of `botStatuses` was a creation default, a seed row, or a button Bryson clicks, and the demo clients only looked staged because their statuses are hand-written in INIT_CLIENTS. Now 15 of the 20 steps derive from facts the OS can observe (intake fields, landing page, built/live campaign, linked account, conversions, spend, leads) and each row shows the REASON for its state. 5 steps with no observable artifact stay manual and say so rather than being guessed at. A hand-set status always wins and is remembered per-bot. 71 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"yes I want them to advance on their own like how they do for real clients."*

**FIRST, THE CORRECTION — they never did, for anyone.** I had told him in the previous message that statuses don't advance "for your own account *yet*", which implied clients were different. They were not. Every writer of `botStatuses` in the app was one of: a creation default (all `waiting`, or `intake: active`), a hard-coded seed row, or a button in Edit → Pipeline (cycle / Reset All / Mark All Done). **Apex Roofing and Luxe Med Spa look like a live pipeline purely because their status maps are typed out by hand in `INIT_CLIENTS`.** Worth remembering before trusting any other "it works for clients" assumption in the demo data.

**DESIGN CHOICE: derive from observable facts, never from a timer.** A clock that walks stages forward would make the bar move while nothing happened, which is worse than an honest `waiting` — the whole point of the screen is to answer "where is this actually up to". So every automatic status is a function of the client record.

**The 15 derived steps and their signals:**

| Step | active when | done when |
|---|---|---|
| intake | some campaign detail filled | `intakeComplete` |
| ceo | — | intake complete (the brief IS the plan) |
| offer | — | `campaignSetup.mainOffer` set |
| architect | — | `landingPage.headline` exists |
| copy | headline only | subheadline + bullets |
| builder | page drafted | `landingPage.published` |
| keywords | — | a campaign exists |
| ads | built, awaiting launch | a campaign is live |
| tracking | ad account linked | a conversion recorded |
| automation | — | `leadToken` exists (capture + auto-reply live) |
| qc | built and paused | live |
| budget | live with a budget set | never (ongoing) |
| terms | spend > 0 | never (ongoing) |
| leads | leads > 0 | never (ongoing) |
| perf | spend > 0 | never (ongoing) |

**Ongoing steps cap at `active` deliberately.** Budget management, search-term review, lead scoring and performance reporting are never "finished" while ads run; marking them done would misrepresent the work and inflate the pipeline-progress health metric.

**The 5 manual steps are named, not guessed:** `research`, `avatar`, `funnel`, `scaling`, `success` (`MANUAL_BOTS`). These describe work that produces **nothing the OS stores**, so any derivation would be inventing progress. Their rows say "Tracked by hand (no automatic signal for this step)". If those ever gain real artifacts (a stored research doc, an avatar record), add a rule and they start advancing too.

**Live status detection covers both platforms** — `c.live`, Google's `status === "ENABLED"`, and Meta's `effectiveStatus === "ACTIVE"`, since the two APIs disagree on field names and a Meta-only client would otherwise never leave "built".

**MANUAL ALWAYS WINS.** Cycling a badge writes `botStatusManual[id] = true` alongside the value. Without that flag the derivation would overwrite the click on the very next render, which is the obvious bug in this design. Overrides are per-bot, so pinning `ads` leaves `qc` automatic. An **`auto`** button on any overridden row hands it back. **Reset All clears every override** (or the reset would silently pin all 20 to manual forever); **Mark All Done sets them** (or the derivation would immediately undo it).

**Every row shows WHY** — "Campaign built, awaiting launch", "Ad account linked, no conversion recorded yet", "Scoring 4 leads". An automatic status without a reason is just a colour, and an unexplained colour is not trustworthy.

**All three consumers read the same effective statuses**: the Pipeline tab, the health-score "Pipeline progress" factor, and the generated client report. Previously the report and health score read raw stored `botStatuses`, so after this change they would have quoted different numbers from the screen. The test asserts no consumer still counts the raw map.

**Verified by 71 cases** running the shipped `deriveBotStatuses` / `effectiveBotStatus` extracted from `index.html`: a blank record leaves all 14 derivable steps waiting; each signal moves exactly the step it should; the landing-page and campaign chains progress in order; Meta's `effectiveStatus` counts as live; ongoing steps never reach done even on a fully-live record; manual bots are never derived and explain themselves; an override wins, says "Set by hand", does not leak to other bots, and reverts when cleared; and all the wiring is in place. Plus a Babel parse-check, and the geo/budget/copy/house suites re-run clean (24/36/26/32).

**NOT done: the server side.** `deriveBotStatuses` lives in `index.html`, so scheduled jobs (weekly-report, monthly-report, os-report) still read raw stored `botStatuses`. Their pipeline numbers can therefore lag what the OS shows until the record is next saved. Moving the function into `netlify/lib/` shared code is the fix and is unbuilt.
