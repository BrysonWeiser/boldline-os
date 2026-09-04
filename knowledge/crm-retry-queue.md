---
name: crm-retry-queue
topic: Forms/Leads
task: understand or debug why a lead did or did not reach a client's own system, or change the retry behaviour
keywords: [crm retry, retry queue, lead not delivered, forward failed, crm-retry.mjs, sweepClientLeads, dueForRetry, nextCrmState, retryDelayMs, needsAHuman, CRM_RETRY_MAX_TRIES, gaveUp, backoff, scheduled function, lead stuck, 401 password, Shaun Smith, browser post, direct post, unsigned endpoint, attribution, duplicate lead]
status: built
summary: A scheduled sweep re-sends leads whose forward to the client's own system failed, backing off over about 28 hours and then giving up loudly. Built as the honest answer to Shaun Smith's request for an unsigned browser post straight to the client's site, which was spoofable, let a lead reach the client without reaching the OS (breaking billing attribution), and whose fallback could not run in the cases it was meant to cover. 54 checks, fourteen mutations caught.
verified: 2026-09-03
---

## Why it exists

Bryson told Shaun Smith on 2026-09-03, declining his request:

> *"What I'd suggest instead is I make my relay retry harder and queue anything that doesn't
> get through, so a blip on my side delays a lead rather than losing it."*

**A promise made to a partner, so it exists.** Until then the intake tried twice, in the same
breath, while the visitor watched a Sending button. If both failed, the lead sat in the OS with
a failure stamped on it and **nothing ever tried again**. Shaun's worry was real.

### Why his fix was refused

He wanted the visitor's browser to POST straight to `stencilandthread.com/api/ad-lead` as
well, unsigned, with our origin allowlisted.

1. **Spoofable.** An origin header is trivially forged from anything that is not a browser.
   Anyone who found it could push fake leads into GHL that **text real strangers from
   Sebastian's registered number** — his A2P registration at risk, not ours.
2. **It breaks billing.** Per-lead invoicing needs the OS to be the record. A lead reaching him
   without reaching us is one we cannot see, attribute or charge for.
3. 🔴 **The fallback cannot run in the cases it exists for.** He described our relay as firing
   only when the browser post did not confirm. Browser closed, tab killed, connection dropped:
   in every one of those the browser cannot execute a browser-side fallback either. **It does
   not cover what it looks like it covers.**

## 🔴 The four rules, and the first would do real damage

1. **ONLY LEADS THAT WERE ATTEMPTED AND FAILED.** A lead with no `crm` record was never
   attempted, because no CRM was configured when it arrived. Sweeping those means **the day a
   client connects their CRM, every lead they have ever received floods their pipeline at
   once** — months of it, looking to them like our software went haywire. `crm.ok === false` is
   the whole gate.
2. **NEVER TWICE.** `alreadyForwarded` plus the stable per-lead dedupe key their endpoint
   sees. A duplicate in someone's sales pipeline is worse than a late lead.
3. **GIVE UP, BUT NEVER SILENTLY.** Eight tries, then `gaveUp` and an alert naming the client
   and the reason. Retrying forever is noise; dropping a paying customer's lead is worse.
4. **SPACED OUT.** 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h — about 28 hours total, which covers an
   overnight outage in eight attempts instead of nine hundred.

## Details worth knowing

- 🔴 **A 401/403 is reported on the FIRST failed sweep, not at the cap.** A wrong shared secret
  is a job for a person, and no amount of waiting fixes it. A day of silent retries is a day of
  lost customers. It is still retried, so the queue drains the moment the password is fixed.
- **A successful retry keeps `tries` and `retried: true`.** "Delivered after four goes" is a
  different fact from "delivered", and it is the one that says an endpoint is flaky while
  still working.
- 🔴 **`null` from `forwardLead` is a skip, not a failure.** Counting it as a failure would
  walk a healthy lead to the give-up cap for no reason.
- **The job forwards only.** It never re-runs `notifyLead` or `notifyOwnerOfLead`: re-texting
  a customer three hours later because their details were slow reaching a CRM is how a number
  gets blocked. A test asserts those names appear nowhere in the function.
- 🔴 **It re-reads the client row before writing and writes back only `leadsLog`.** The sweep
  holds a record across several HTTP calls; writing the whole thing back would clobber an
  approval, a campaign or a billing change made meanwhile.
- **25 leads per client per sweep**, so one client's large stuck backlog cannot starve every
  other client's single stuck lead.
- **Every 15 minutes, a no-op on almost all of them.** The delays live on each lead. The
  cadence exists so the first retry lands five minutes after a blip rather than an hour later.
- 🔴 **The scheduler is best effort.** Netlify has skipped a run by two and a half hours with
  no error (KB `house-leads`). Every decision is made from timestamps **on the lead**, never
  from "this run is N minutes after the last", so a skipped sweep delays a retry and breaks
  nothing.

## Testing note

`tests/verify-crm-retry.mjs`, 54 checks, fourteen mutations all caught.

🔴 **One mutation escaped at first and the fix was to DELETE code, not add a test.** The cap
was enforced twice in `dueForRetry` — an explicit `tries >= CRM_RETRY_MAX_TRIES` and the
`retryDelayMs(tries) == null` path — so removing either changed nothing and no test could tell.
They could never disagree, because the cap **is** the length of the delay list. Collapsed to
one gate, with a check pinning `CRM_RETRY_MAX_TRIES === CRM_RETRY_DELAYS_MS.length` at the
source. **Belt and braces that cannot come apart is not belt and braces, it is a place a bug
can hide.**

🔴 **And one test failure was the fixture, not the code:** a lead seven tries in was aged only
an hour, so the cap check read as broken while the back-off was working perfectly. Aged past
the last delay instead.
