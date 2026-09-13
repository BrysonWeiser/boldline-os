---
name: scheduled-job-wiring
topic: OS app
task: add or debug a scheduled Netlify job, or work out why a job that looks fine never runs
keywords: [scheduled function never runs, job did not run, backup never ran, daily check never ran, no backup email, withFailureAlert, wrappedJob, export default, extra arrow, job silently does nothing, netlify scheduled function, cron not firing, verify-scheduled-wiring, wiring, job looks fine but nothing happens, no email from job]
status: built
summary: `withFailureAlert` RETURNS a function, so `export default withFailureAlert(name, fn)` works and `export default async () => withFailureAlert(name, fn)` hands Netlify the wrapper instead of running it. The body never executes, nothing throws, and no alert can fire because the alerting lives inside the wrapper that was never invoked. `backup-run` and `daily-check` both shipped that way and NEITHER HAD EVER RUN, discovered 2026-09-13 when Bryson asked which address the backup email went to and the answer was that no email was ever sent. The wrapper now tags itself (`wrapped.wrappedJob = jobName`) and `tests/verify-scheduled-wiring.mjs` reads every scheduled job out of netlify.toml, imports it, and fails if a job that mentions the wrapper does not carry the tag. 14 checks, 7 mutations caught.
verified: 2026-09-13
---

**Bryson, 2026-09-13:** *"Which email did the backup email go to because I didn't get it"*.

He didn't get it because it was never sent. The backup had never run. Not once. Neither had
the daily health check. Both had been built, tested, merged, deployed and written up.

## 🔴 The defect is one pair of arrow brackets

```js
export default withFailureAlert("job", async () => { ... });             // works
export default async () => withFailureAlert("job", async () => { ... }); // never runs
```

`withFailureAlert` **returns a function**. In the second form the export hands that function
back to Netlify instead of invoking it. Netlify gets a function where a `Response` should be.

## Why nothing caught it

- **The body never executes, so nothing can throw.** Netlify records a successful invocation.
- **No alert can fire**, because the alerting lives inside the wrapper that was never run.
  The safety net was on the wrong side of the failure.
- **Every heartbeat in this codebase watches for a job that stopped.** None of them watch for
  a job that never started. There was no previous timestamp to go stale.
- 🔴 **The test asserted the wrong thing.** `verify-backup` grepped for the text
  `withFailureAlert("backup-run"` and passed. That text is present in the broken version too.
  **A grep proves a line exists, never that it is reachable.** That is the third time in one
  week that reading source passed while the running thing was dead (KB `portal-script-parse`,
  where a suite read raw source and passed through a full-day portal outage).

A job in this state is indistinguishable from a job with nothing to report, which is the exact
failure mode this project keeps building heartbeats to prevent, arriving through the one door
nobody was watching: the wiring itself.

## The guard

`withFailureAlert` now tags what it returns:

```js
const wrapped = async (...args) => { ... };
wrapped.wrappedJob = jobName;
return wrapped;
```

An extra arrow hides that tag, and nothing else can fake it. `tests/verify-scheduled-wiring.mjs`
**reads the schedule list straight out of `netlify.toml`**, imports each job, and fails if a job
that mentions the wrapper does not carry the tag. It executes no job bodies and greps for
nothing. A job added next month is covered the moment it is scheduled, with nobody needing to
remember the test file exists.

## Rule for any new scheduled job

Write `export default withFailureAlert("name", async () => { ... });` with **no arrow in
front**. If you need the request object, take it on the inner handler: `async (req) => {...}`.
The wrapper passes arguments through.

## What was actually lost

- **The backup produced nothing between 2026-09-11 and 2026-09-13.** There were no snapshots,
  no emails, and no prune. First real run: 1:00am Phoenix after the 2026-09-13 deploy.
- **The daily live-site check never ran either**, so from the day it was built the OS, the
  client portal script, the landing page and the deploy-is-current comparison went unchecked.
  The `tests/run-all.mjs` half was unaffected: it runs in GitHub Actions, not through Netlify.
