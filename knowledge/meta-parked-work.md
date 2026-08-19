---
name: meta-parked-work
topic: Ads
task: find out what work is waiting on Meta approval, or decide what to build the moment Meta grants standard access
keywords: [meta parked, blocked on meta, once meta is approved, meta split testing, meta creative testing, conditions trigger meta, meta standard access, development tier, MetaLaunchCard, meta-ads.mjs, waitlist]
status: verified
summary: The running list of work deliberately NOT built because Meta has not granted Marketing API standard access. ~~Meta creative split testing~~ **BUILT 2026-08-19 for BoldLine-owned accounts** (Development tier allows writes to own accounts) — see KB `meta-creative-testing`; one named condition (`META-TIER-GATE`) opens it to clients at approval. The conditions-triggered ad refresh rides the same path and now works on Meta too, for owned accounts. Also parked: 9 of 12 packages stay on "Join the waitlist", and the marketing site's coming-soon state. Nothing here is broken or half-done, it is scoped out on purpose. Bryson asked for it to be marked so it resurfaces at approval rather than being rediscovered.
verified: 2026-08-17
---

**Bryson, 2026-08-17:** *"ok mark the meta thing for later once meta is approved"*

This is the single list of everything waiting on Meta. The **CLAUDE.md standing trigger** points
here, so it surfaces the moment approval lands rather than being rediscovered months later.

## Why everything below is blocked

App Review came back **partially approved on 2026-08-12**. The permissions the code calls were all
granted, but the **Marketing API Access Tier was refused** for *"not a sufficient number of Ads API
calls in the last 15 days"*. That leaves the app on **Development tier: BoldLine's own ad accounts
only, no client accounts**. Full history and the resubmission plan in KB `meta-marketing-api`.

**The unlock is not paperwork, it is traffic.** Real Meta ads have to run on the house account for
15+ days to generate genuine API calls, then the tier gets re-requested. As of 2026-08-17 that clock
**has not started** — Bryson is waiting on money to transfer into the ad account.

## Parked work, in the order I would build it

### 1. Meta creative split testing — the big one
**Google has it, Meta does not.** `ads-autopilot` writes a challenger ad into a live Google ad group,
judges it on conversion rate (or CTR when there are no conversions), and pauses the loser. There is
no Meta equivalent, so Meta creatives never improve on their own. Details of the Google version in
KB `campaign-detail-and-split-testing`.

Needs: a Meta read of live ads per ad set, a way to add a creative to an existing ad set, and the
same winner/loser judging. The judging logic and thresholds are already written and can be reused
almost as-is; the missing half is the Meta API surface in `meta-ads.mjs`.

**Why it is worth doing first:** it is the difference between Meta ads that decay and Meta ads that
compound, and it is the only piece that makes Meta genuinely hands-off the way Google now is.

### 2. Conditions-triggered refresh on Meta
The weather/season trigger (KB `local-conditions`) rewrites **Google** ads when local conditions
settle into a real change. It is Google-only **because it rides on the split-testing path above** —
there is nowhere on Meta to put a challenger creative. This becomes a small change once (1) exists.

### 3. Everything gated on the site
Handled automatically by the CLAUDE.md standing trigger, listed here for completeness: **9 of 12
packages** (every Meta, Full System and E-Commerce tier) show **"Join the waitlist"** instead of
"Book a Call", and the coming-soon notices sit behind `CS:META-SOON` sentinels. Only the 3 Google
packages are sellable today. See KB `site-coming-soon`.

**Note the newest card is NOT covered by the revert commit.** `Full System: Acquisition` was added
after `a4b83f0`, so `git revert a4b83f0` will not restore its CTA. Grep `CS:META-SOON` and flip that
one by hand. Recorded in KB `package-multi-campaign` too.

### 4. Resubmit for the tier, and drop `ads_read`
Once 15+ days of real Meta traffic exist: re-request the Marketing API tier, and leave `ads_read`
out of the resubmission entirely — `ads_management` is a superset and was already approved. The
earlier `ads_read` rejection was about a screencast showing placeholder numbers, which real traffic
fixes on its own.

## What is NOT blocked

**Google clients are sellable today**, and everything built this month (live local conditions,
landing-page seasonality, the additive upgrade ladder, the new top package, split testing, campaign
detail editing) works for them right now. Meta gates Meta, nothing else.

## How this should surface

Not by memory. Three things point at it:
1. **CLAUDE.md standing trigger** — the Meta approval section says to raise this list.
2. **The weekly Routine** `trig_012hH9VLXchaMj7LUc461Wrb` (Mondays 09:00 Phoenix) that already
   checks in about the coming-soon state.
3. **The recall hook** on this entry's keywords.

**Raise it, do not silently build it.** The site revert is automatic because it is a revert of a
known commit. These are features with real cost, so the right move at approval is to say what is
parked, recommend the order above, and let Bryson choose.
