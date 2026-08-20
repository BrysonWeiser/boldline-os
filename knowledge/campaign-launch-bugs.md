---
name: campaign-launch-bugs
topic: Ads
task: debug a campaign that was approved but is not delivering, or one spending on the wrong people; understand why starting a campaign touches ad groups and ads
keywords: [activateCampaign, campaign not delivering, no impressions, zero spend, approved but nothing happened, ad set paused, ad group paused, effective_status, geo_locations, countries US, nationwide targeting, resolveGeoTargets, adgeolocation, geo key, toLocationLines, verify-campaign-launch]
status: verified
summary: Two silent bugs found 2026-08-20 in a pre-launch sweep Bryson asked for before approving his first campaign. (1) Approving a campaign NEVER MADE IT DELIVER on either platform — the build correctly creates campaign, ad group/ad set and ad all paused, but approval only set the CAMPAIGN live, and both platforms need every level active to serve an impression. Every surface reported success. (2) Every Meta campaign targeted the ENTIRE UNITED STATES, because the launch card sent only a two-letter country. Both fixed at the handler level so no caller can reintroduce them. 53 checks, five deliberate breaks.
verified: 2026-08-20
---

**Bryson, 2026-08-20:** *"i have a campaign made but before i approve it go through and make sure
there arent any more bugs we missed."*

Both bugs were **silent**. Nothing errored, every surface reported success, and the only symptom
of either was a number that looks like ordinary bad performance.

---

## 🔴 BUG 1 — approving a campaign never made it deliver

`createCampaign` builds three levels and pauses all of them, which is correct and deliberate:

| | Meta | Google |
|---|---|---|
| Campaign | PAUSED | PAUSED |
| Ad set / ad group | PAUSED | PAUSED |
| Ad | PAUSED | PAUSED |

Approval called `setStatus(campaignId, "ACTIVE")`. **Both platforms require every level to be
active before one impression is served**, so the campaign flipped on and nothing ran.

**Why it would have cost days rather than minutes.** A campaign's own status does not reflect a
paused child, so *everything agreed it was live*: the OS said "activated", the campaign list showed
it running, and `metaLive()` in autopilot (which correctly prefers `effective_status`) also saw a
live campaign. The single symptom was **$0 spend and no impressions**, which reads as *"my ads
aren't working"*, not *"my ads never started"*.

**It affected both platforms and all three ways of going live** — the approval queue, the Live
Campaigns toggle, and the Campaign Manager toggle.

**The fix is in `setStatus` itself, not in the callers.** Three call sites ask for "live"; patching
them one at a time would leave the next one free to reintroduce it. *"Make this campaign live"* can
only ever mean *"make it deliver"*, so that meaning lives in one place:

- **Meta `activateCampaign(campaignId)`** — campaign, then every ad set, then every ad under each.
  Returns how many of each it started, so a campaign with no ads in it is visible rather than a
  bare success.
- **Google `activateCampaign(...)`** — campaign, then ad groups and ads in **one mixed
  `googleAds:mutate`**, so a campaign is never left half-started. Skips anything already enabled.

**PAUSING stays campaign-level on purpose.** Pausing the parent stops all delivery immediately,
which is the safe direction. Only starting needs the full walk.

**Autopilot still may not start anything** — asserted directly (`may always spend LESS, may NEVER
spend more without asking`).

---

## 🔴 BUG 2 — every Meta campaign targeted the whole United States

The Meta launch card had **no locations field at all**, just a two-letter Country box defaulting to
`US`, so the payload was:

```js
geo:{countries:[f.country||"US"]}      // ~340 million people
```

On a $500/month budget aimed at one metro this is not an inefficiency, it is **the entire budget
spent on the wrong people**, and it would have looked exactly like the ads failing.

The Google card has resolved city targets since it was built and refuses to build without them.
Meta never got the equivalent, because **Meta does not accept place names** — it targets by numeric
geo KEY, so a locations box could not simply be passed through.

**`resolveGeoTargets(names, country)`** looks each one up through Meta's `adgeolocation` search and
**prefers a hit whose region matches the state that was typed**. Without that, "Gilbert" could
resolve to a Gilbert in another state and quietly advertise the wrong place — the same class of
error as the Gila Bend problem in `local-conditions`.

**🔴 An unresolvable location is now FATAL, not nationwide.** The old default meant a typo, an
unrecognised town, or a missing field silently bought the whole country. Falling back to "everyone"
is the most expensive possible failure mode, so the build stops and names which entry failed.
Country-only targeting is still possible, but only when explicitly asked for with no service area
given.

**The seeder must never invent a town.** `toLocationLines()` fills the new field from the client's
service area. The first version paired every other comma-separated chunk, which works for
`"Gilbert, Arizona, Mesa, Arizona"` and turns `"Phoenix, Mesa, Tempe"` into **"Phoenix, Mesa"** — a
place that is not where anyone meant. It now only pairs when the second half actually looks like a
US state.

---

## Checked and found HEALTHY (worth not re-checking)

- **Lead capture on `/get-started`** — the served HTML has no `data-netlify` attribute, which looks
  alarming and is not: Netlify strips it after registering the form, and the homepage's known-good
  `contact` and `recommendation` forms are stripped identically. All inputs carry `name`.
- **Meta pixel** — set and firing `PageView` plus a lead event on form submit.
- **Budget units** — dollars to cents conversion is correct on both write paths.
- **Autopilot rebalance** — default off, guarded so the account total cannot rise, and it lowers
  the loser BEFORE raising the winner, so a mid-way failure leaves spend lower rather than higher.

## 🟡 Deliberate, not a bug — worth revisiting later

`createCampaign` uses `OUTCOME_TRAFFIC` + `LINK_CLICKS` with no `promoted_object`, so **Meta
optimises for clicks, not leads**, even though the pixel exists and fires. That is the right call
for a cold start (conversion optimisation needs roughly 50 conversions a week to learn) but it
should be switched to conversion optimisation once real lead volume exists, or the budget buys
cheap clicks that never convert.

## Verified by `tests/verify-campaign-launch.mjs` — 53 checks

Five deliberate breaks confirmed to fail: Meta's setStatus reverting to campaign-only, Google's
activation skipping ad groups, the nationwide fallback restored, an unresolved location silently
ignored, and the seeder pairing bare cities again. It also pins that the BUILD still creates
everything paused, since a campaign that is live the moment it is built cannot be reviewed first.

One assertion failed on the first run and was **my own mistake, not the code**: it searched for the
old nationwide default and matched the comment explaining the bug. Comments are now stripped before
that check, so it tests behaviour rather than prose.
