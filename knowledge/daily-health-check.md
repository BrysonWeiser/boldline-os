---
name: daily-health-check
topic: OS app
task: understand or change the automatic checks that watch the OS, the client portal and the live site
keywords: [deploy is current, stale deploy, deployBehind, COMMIT_REF, GITHUB_READ_TOKEN, build failed silently, merged but not live, git says merged, daily check, health check, daily-check.mjs, is everything working, automatic testing, CI, github actions, run-all, run all tests, tests do not run, live site check, deployed site, green repo broken site, monitoring, all clear, monday all-clear, health_checks]
status: built
summary: There was no CI and no live-site check, so 86 test suites only ran when somebody typed the command, and nothing ever looked at what Netlify actually served. Two layers now. `tests/run-all.mjs` plus a GitHub Action runs every suite on every push and again at 6:10am Phoenix. `netlify/functions/daily-check.mjs` runs at 6:40am against the LIVE site: it fetches the OS, a real client's portal and their landing page, and PARSES the scripts, which is the only check that could have seen the 2026-09-10 outage. Read only, alerts red on failure, and sends a Monday all-clear so silence means the check is alive. 65 checks, 24 mutations caught.
verified: 2026-09-10
---

**Bryson, 2026-09-10**, after every button in the client portal was dead for a day: *"is there a way we can set up a daily check on everything, client portal, client portal preview, os operations ... through tests and through the actual code as well ... that way something like this doesn't happen again"*.

## What was actually missing

**Nothing ran anything.** There was no CI at all. 86 suites existed and only ran when somebody typed the command. And nothing anywhere looked at the deployed site.

So the outage had two chances to be caught and neither existed.

## 🔴 Why the test suite alone was never going to be enough

**Every suite in `tests/` reads THIS REPO.** The portal outage lived in the text Netlify actually served. Worse, `verify-field-formats` was reading the raw source and running it, so it **passed the entire time the portal was dead** (KB `portal-script-parse`).

**A green repo and a working site are different claims.** This project has now shipped that gap twice:

| | |
|---|---|
| 2026-08 | Seven builds failed the secret scanner while git said merged. The OS silently served day-old code. |
| 2026-09-10 | The portal's script had a syntax error. Every button dead, live, for a day. |

Both are invisible to anything that only reads the repo.

## The two layers

**1. The repo, on every push and every morning.** `tests/run-all.mjs` runs all 87 suites, exits non-zero on any failure, and treats a suite that hangs past 180s as a failure rather than letting CI sit for an hour. `.github/workflows/tests.yml` runs it on every push, on pull requests, and at **13:10 UTC (6:10am Phoenix)**. The daily run matters separately from the push run, because several suites read live files and external shapes and can start failing with no push at all.

**2. The deployed site, every morning.** `netlify/functions/daily-check.mjs` at **13:40 UTC (6:40am Phoenix)**, half an hour after CI so both complaints arrive together. It fetches what a browser fetches:

- The OS page, and the portal **preview** literal inside it, evaluated and parsed.
- 🔴 **A real client's portal, and whether its script PARSES.** This is the check that would have caught the outage. The page loaded fine that whole day; the script was the thing that was dead.
- Their landing page: loads, still has its lead form, script parses.
- Whether the background jobs are still running, read off how stale the stored figures are. A stopped job looks exactly like a quiet week (KB `ads-sync-stall`).
- That `portal`, `landing` and `lead-intake` answer at all rather than 500, which is what a function that fails to start looks like.

## Three decisions worth keeping

🔴 **READ ONLY.** It runs against production holding a real client's token. Every request is a GET; it never writes to a client, sends to a person, or spends money. The only write is its own result row, and that failing never fails the check. Pinned by the suite.

🔴 **A skipped check is neither a pass nor a failure.** Before the first client had a portal there was nothing to fetch. Calling that green would be a lie; calling it red would cry wolf every morning. Skips are counted separately and named in the summary.

🔴 **It reports in when nothing is wrong.** A checker that only speaks when things break is indistinguishable from a checker that has itself died. Failures alert in red immediately; **Monday morning gets an all-clear either way**, and the all-clear says why it exists.

## Verified

`tests/verify-daily-check.mjs` — **65 checks, 24 mutations, all caught.** The first assertion is the one that matters: it feeds the checker the **exact broken page from 2026-09-10** and requires it to go red, then feeds it the healthy one and requires it to go green. It also re-breaks the real `index.html` preview in memory and confirms the check catches that too, so the guard cannot rot into a check that only passes.

## 🔴 And the one it could not see on its own: a deploy that never happened

In August, seven builds in a row were rejected by Netlify's secret scanner **while git reported every merge as fine**, and the OS quietly served day-old code for days (KB `netlify-secret-scan-deploys`). This job runs FROM the deploy, so it can never notice its own staleness by looking inward.

`deployBehind()` compares Netlify's `COMMIT_REF` (the commit this deploy was built from) against the head of `main` read from GitHub.

**A difference alone is not a fault.** A build takes minutes, so a commit pushed moments ago is *expected* to be ahead. Only a head that has sat there past a **25 minute grace period** means a build failed or never started. Without that grace this would page him on every single push, and an alarm that fires on normal work is an alarm he turns off.

**Unknown is not OK.** No `COMMIT_REF`, or no readable head from GitHub, reports as **skipped**, never as fine.

**It needs `GITHUB_READ_TOKEN` in Netlify** (read-only; the repo is private). 🔴 **Until that is set the check SKIPS rather than failing**, so the rest of the morning check still runs and he does not get a red alert every day for a setting that is simply absent. `null` is the skip and `false` is the alarm; a mutation swapping them initially survived and the assertion now pins the literal.

**Setting it:** Netlify → the site → Site configuration → Environment variables → Add a variable → key `GITHUB_READ_TOKEN`, value a GitHub fine-grained token with **Contents: Read-only** on this repo. Then redeploy. The value never goes in the repo.
