---
name: client-autobuild
topic: Ads
task: make the bots build a new client's landing page and campaign without being asked
keywords: [autobuild, client-autobuild, autoBuild, nextStep, readiness, automatic campaign build, approval, intakeComplete, CLIENT_AUTOBUILD, hands off, bots]
status: built
summary: Hourly job that drafts a new client's landing page, then builds a PAUSED Google campaign, one step per client per run, and raises an approval for Bryson. It PREPARES anything and PUBLISHES nothing. Built 2026-08-31 after Bryson asked whether the bots start on their own and the honest answer was no.
verified: 2026-08-31
---

## The gap it closes

Bryson, 2026-08-31: *"how do the ads build. Do the bots automatically start when the my info
section is filled out? ... the whole point of the bots is for them to build the campaign
landing page etc. without me having to do anything and then they send it to me for
approval."*

**The honest answer at the time was no.** Every builder existed and worked, and every one of
them waited for a button press. `intakeComplete` was read by `pipeline-shared` for the status
display and by `report-shared` for the health score, and **by nothing that acts**.
`ads-autopilot` runs on a schedule but its own contract forbids exactly this: *"WHAT IT NEVER
DOES: create a campaign, enable a paused one, raise an account's total budget."*

So the OS had one-button automation, not hands-off automation. The AI genuinely wrote the
page, the ads, the keywords and the tracking. Nothing chained them or started them.

## What it does

`netlify/functions/client-autobuild.mjs`, hourly (`17 * * * *`).

1. **Landing page** if there is none, saved as a **draft**.
2. **Campaign** once a page exists and an ad account is linked, created **paused**.

**One step per client per run.** Each is a model call or an ad-account write, so a failure in
the second never leaves the first half-saved, and one broken client cannot burn the run.

## 🔴 The safety model, copied from ads-autopilot

**It may PREPARE anything and PUBLISH nothing.** The page is `published:false`, the campaign
is paused by `createCampaign`, and both raise an owner alert. The worst case of a bug is work
Bryson throws away, never an unapproved ad spending a client's money.

`CLIENT_AUTOBUILD=off` is the kill switch, checked before anything loads. `autoBuild.off`
switches a single client off.

## The gates, and why each is separate

Not signed · house account · switched off · no main offer · no target location · three failed
attempts. Tested **one at a time**, because a gate that only works alongside another gate is
not a gate. **Every skip carries a readable reason** written onto the client, which is the
pipeline-honesty rule: a client sitting untouched with no explanation is the original complaint.

## 🔴 Idempotency is a timestamp, not content

`autoBuild.landingAt` / `campaignAt`. Once stamped the job never rebuilds that artifact **even
if Bryson clears the copy**, because a bot quietly overwriting his edits is worse than doing
nothing. Three failures stop a client rather than retrying hourly forever, since each attempt
costs a model call.

**A builder returning nothing counts as a FAILURE.** Stamping the step on an empty result
would set the idempotency key and guarantee that client is never built, which is the quietest
possible way to fail.

## Still Bryson's job

Conversion tracking, the keyword and negative review (his own notes call it the highest-value
hour on a new account), publishing the page, and approving the campaign. Meta is not wired
here yet; the campaign step is Google only.
