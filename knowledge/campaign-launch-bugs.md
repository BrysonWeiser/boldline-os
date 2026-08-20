---
name: campaign-launch-bugs
topic: Ads
task: debug a campaign that was approved but is not delivering, or one spending on the wrong people; understand why starting a campaign touches ad groups and ads
keywords: [activateCampaign, worldwide targeting, target another country, international ads, geo-parse, parseLocation, resolveLanguages, language targeting, per-service campaign, client parity, house account parity, campaign not delivering, no impressions, zero spend, approved but nothing happened, ad set paused, ad group paused, effective_status, geo_locations, countries US, nationwide targeting, resolveGeoTargets, adgeolocation, geo key, toLocationLines, verify-campaign-launch]
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

---

## ✅ 2026-08-20 (later) — TARGET ANYWHERE IN THE WORLD, and client/house parity

**Bryson:** *"for the target location for my own ads and even clients that we can be located in one
state or area and be able to target anywhere in the world we want. Also make sure everything we are
doing for my own ads is updated and added for clients ads for the stuff that is applicable."*

### The world was hardcoded to the United States, twice

Both platforms look a place up **within one country**, and both had that country pinned:

| | Before | Effect |
|---|---|---|
| Google | `countryCode: "US"` in `geoTargetConstants:suggest` | a location outside the US could never resolve |
| Meta | `country_code: countryCode` defaulting to `"US"` | same |
| Google language | `languageConstants/1000` (English) always | a campaign aimed at Mexico or Quebec shows to almost nobody, silently |

**`netlify/lib/geo-parse.mjs` is shared on purpose.** Two separate country parsers would drift, and
a drift here means advertising in the wrong country, which nobody notices until the money is gone.
It reads the country off the END of each entry, so one box handles everything:

```
"Gilbert, Arizona"        -> query "Gilbert, Arizona"  in US   (state recognised)
"London, United Kingdom"  -> query "London"            in GB   (country stripped from the query)
"Toronto, Ontario"        -> query "Toronto, Ontario"  in CA   (province recognised)
"Canada"                  -> the whole country, no lookup needed
"Paris"                   -> falls back to the default, AND IS REPORTED AS ASSUMED
```

The trailing country is stripped from the query because both platforms already search inside a
country and repeating it only hurts the match. A trailing **state is kept**, because it is what
tells Phoenix, Arizona from Phoenix, Oregon.

**🔴 It never guesses silently.** An entry whose country cannot be determined falls back to the
default *and is returned in `assumed`*, so the caller can surface it. Combined with the existing
rule that an **unresolvable location is fatal**, a mistyped place can neither be dropped nor
quietly advertised in the wrong country.

**Language is resolved, not hardcoded.** `resolveLanguages()` looks names or codes up against
Google's own `language_constant` table, defaults to English (what every existing campaign already
targeted), and accepts `"all"` to remove language targeting entirely. **The ids are deliberately
not hardcoded**: guessing a language constant id and getting it wrong targets the wrong audience
exactly as quietly as a wrong geo id, so it follows the same resolve-don't-guess rule as geo.

The Meta card's two-letter Country box is now labelled **"If unclear"** and is only the fallback
for a line that names no country of its own.

### Parity: what the house account could do, a client now can

The audit found the server-side `internal` branches are all **correct by design** — BoldLine does
not email, nurture, invoice or report to itself. One real gap and one deliberate exception:

**🟢 FIXED — per-service campaigns.** The house account could always type a NICHE and rebuild, so
BoldLine runs one campaign per kind of business it chases. A client had no equivalent, and needs
the same thing for the same structural reason: **one ad group holding "roof repair" and "roof
replacement" can never match either search well.** Both launch cards now ask *"Which service is
this campaign for?"* on a client, seed the name, copy and keywords from it, and — importantly —
**pass it into the AI brief as the niche and the offer**, or the model writes for the whole trade
while the campaign name and seeds say one service, and the two disagree.

**🔴 DELIBERATE — Meta split testing stays house-only.** That is the `META-TIER-GATE`: Meta's
Development tier only permits writes to owned accounts, so removing it would have Meta rejecting
writes every two hours forever. **Google creative testing has no such restriction and already runs
for clients.** The gate goes at Meta approval, along with the site flip.

Everything else built this week reaches clients already: local conditions (both windows), the
conditions card on both launch cards, the creative strategy switch, the delivery-chain activation,
and the geo guards.

### Verified — `verify-campaign-launch.mjs` now 104 checks

Five more deliberate breaks confirmed to fail: Google reverting to a hardcoded country, language
pinned back to English, the parser marking an unplaceable entry as confidently placed, the
per-service box hidden from clients again, and the client's chosen service not reaching the AI.

**One test failed for the second time on a character-window proxy.** `verify-local-conditions`
asserted the Meta generator sends its service area *"within 900 characters of `action:"meta"`"*;
a comment added to that call pushed it out of range while the wiring stayed correct. This is the
**same trap as the 400-character proxy** already recorded in `repo-tests`. It now slices the call
and asserts the field is inside it, and was re-confirmed to catch the real regression.

---

## ✅ 2026-08-20 — deleting a campaign now clears its approval request

**Bryson:** *"if a campaign needs approve itll give me the notification but then if i delete the
campaign the notification is still there."*

**Worse than untidy.** The leftover notification still carries an Approve button. Pressing it
re-reads the ad account, cannot find the campaign, and fails — so the queue holds an item that
**can never be cleared by doing what it asks**, and the bell count stays permanently wrong, which
is how a real approval ends up ignored.

**Two things are attached to a campaign and both had to go:** the owner's `pendingAction`
("Launch Meta campaign X"), matched on `exec.campaignId`, and the CLIENT's pending approval
("Your campaign is ready to launch"). The client approval carried no campaign id at all, so
`makeApproval` now stamps one at creation and both launch cards pass it. Matching on the title
would have been guesswork.

**An already-ANSWERED client approval is kept.** It is a record of what they decided, not an
outstanding request, and deleting it would erase that.

**`withoutCampaign()` returns the SAME object when nothing matched.** The caller only saves when
the object changed, so returning a fresh copy every time would write to the database on every
screen load.

### The self-heal, and the guard that matters more than the feature

The delete button clears its own paperwork, but a campaign removed straight from Google Ads or
Meta Ads Manager leaves the identical dead notification — as do any orphaned before this fix
existed (Bryson already had one). So the Campaigns screen also sweeps on load.

**🔴 It only prunes for an ad account that actually ANSWERED.** Treating a failed API call as
"this account has no campaigns" would wipe every pending approval the moment the ads API had a bad
minute, and those are the items that authorise real spend. Success is recorded only after the call
returns, never in the catch. The sweep also matches on **platform as well as id**, since two
platforms can hand out the same campaign id.

**29 checks, four deliberate breaks confirmed to fail** — the delete no longer clearing, answered
approvals being wiped, the self-heal ignoring whether the account answered, and the helper
returning a new object when nothing changed. The pruning helper is **extracted from `index.html`
and executed** rather than re-implemented, so the test cannot pass while the shipped version is
broken.

One assertion failed on the first run and was **my regex, not the code**: `[^>]*` inside a JSX
prop matcher ends early on the `=>` of an arrow function.
