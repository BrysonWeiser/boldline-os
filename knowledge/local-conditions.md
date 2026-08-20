---
name: local-conditions
topic: Ads
task: make ads reflect what is actually happening in the target area right now (weather, season, local demand), or check why an ad did or did not use a weather angle
keywords: [local-conditions, recent weather, storms recently, past 14 days, aftermath, storm damage, county zone, Maricopa, areaDesc, fetchRecent, summariseRecent, resolveCounties, countyZones, Nominatim, area-conditions, AreaConditionsCard, manual ad copy, landing page seasonal, conditions change trigger, CONDITIONS_DWELL_HOURS, CONDITIONS_COOLDOWN_HOURS, conditionsWatch, seasonal ads, weather angle, api.weather.gov, National Weather Service, NWS alerts, Extreme Heat Warning, monsoon, storm damage roofing, HVAC summer, conditionsFingerprint, isAdvertisable, parseAreas, verify-local-conditions]
status: verified
summary: Every ad writer AND the landing-page writer (Google campaign builder, Meta variants, creative angles, landing pages, and the always-on challenger writer) now receives the LIVE weather alerts for the client's own service area plus today's date and season, pulled from the free US National Weather Service API (no key, no account). Facts are fetched in code because the model has no live data and would otherwise guess, and a guessed weather claim in a live ad is a lie with money behind it. Emergencies (wildfire, tornado, evacuation, flash flood, civil) are HARD-EXCLUDED from ad angles on both policy and decency grounds. Area matching is exact-place so a Bend, Oregon client is never claimed to be covered by an alert for "Gila Bend". A weather outage never blocks ad generation. 119 checks.
verified: 2026-08-20
---

**Bryson, 2026-08-17:** *"for any ads my own or for clients I want to make sure that the bots also
look at whats going on in the targeted areas (ex. arizona having lots of storms right now so for
roofers the ads should be about storms and them being the company people call to fix their roof.
Another example would be hvac for ac repairs during the hot arizona days, etc. for any other
companies and local cercumstances, same for ecommerce)"*

## Why this needed code and not just a better prompt

The model writing the ads has a **training cutoff and no live data in that call**. Ask it whether
Arizona is stormy today and it can only guess. A guessed weather claim inside a running ad is a lie
with budget behind it. So the facts are gathered in code and handed over, and the prompt is told to
use them only where they genuinely apply.

## Where the facts come from

**`api.weather.gov`, the US National Weather Service.** Free, no API key, no account, no billing.
It requires a `User-Agent` header. Verified live during the build: Arizona had **6 active Extreme
Heat Warnings** including central Phoenix and East Mesa, which is exactly Bryson's HVAC example.

**`netlify/lib/local-conditions.mjs`** exports:

| Function | What it does |
|---|---|
| `parseAreas(text)` | Pulls state codes and city names out of free-text `targetLocations` ("Tempe, AZ; Mesa, AZ", "Phoenix Arizona") |
| `fetchAlerts(states)` | Live alerts per state, 6s timeout, best-effort |
| `summariseAlerts(alerts, cities)` | Collapses many zone-level alerts into one line per event, marks which name the client's own towns |
| `isAdvertisable(event)` | The policy gate, below |
| `conditionsBlock({...})` | The text block the model receives |
| `getLocalConditions({locations})` | One call: parse, fetch, summarise, build |
| `conditionsFingerprint(summary)` | Short signature so a later run can tell "nothing changed" from "the monsoon started" |

Non-US areas get **season-only** context (still useful). No state parsed means **no network call at
all**.

## 🔴 EMERGENCIES ARE NEVER AN ADVERTISING ANGLE

This is the part that matters more than the feature. The test is not "is this weather" but **"is
this a normal seasonal reason someone needs this trade, or an event where people are in danger right
now"**.

- **Usable as demand context:** heat, cold, freeze, wind, dust, air quality, ordinary thunderstorms,
  flood advisories, fog. These drive genuine demand for HVAC, roofing, plumbing, restoration,
  detailing.
- **Hard-excluded (`NEVER_ADVERTISE`):** tornado, hurricane, tropical storm, typhoon, tsunami,
  evacuation, fire/wildfire, red flag, volcano, ashfall, earthquake, civil emergency, hazardous
  materials, radiological, law enforcement, child abduction, shelter in place, local area emergency,
  911 outage, **flash flood warning/emergency**, extreme wind, blizzard.

Excluded events are still shown to the model, but under a heading that says **"NOT AVAILABLE AS AN
ANGLE … Do not reference them, hint at them, or build urgency from them."** Naming them explicitly
beats staying silent, because silence invites the model to rediscover them from the season.

Google and Meta both reject ads exploiting a tragedy, so this is policy compliance as well as
decency. The fingerprint also excludes emergencies, so an active wildfire can never be the thing
that triggers a fresh ad.

## 🔴 AREA MATCHING IS EXACT-PLACE, BECAUSE IT BECOMES A CLAIM

"This alert covers your area" ends up inside a live ad. Three attempts, and the first two were wrong:

1. **`includes()`** — claims a **Bend, Oregon** client is covered by an alert for **"Gila Bend"**.
2. **Word boundaries** — no better. "Bend" *is* a whole word inside "Gila Bend".
3. **What shipped:** the NWS writes zones as semicolon-separated names, sometimes slash-joined and
   sometimes carrying a direction (`"Central Phoenix"`, `"Fountain Hills/East Mesa"`,
   `"Buckeye/Avondale"`, `"Gila Bend"`). So split the zone into individual place names, strip a
   **leading direction word**, and require the remainder to **EQUAL** the client's city.
   - `"East Mesa"` → strip `East` → `"Mesa"` → matches a Mesa client ✓
   - `"Gila Bend"` → `Gila` is not a direction → never matches a Bend client ✓

An alert elsewhere in the same state is passed through as **context, explicitly flagged "NOT this
client's area"**, so it can inform seasonal wording without becoming a false claim. In-area alerts
**name the matched city** in the prompt (`covers Mesa, Phoenix, in this client's own service area`)
so the claim is checkable rather than asserted.

## Where it is wired in

All four places that write ad copy, so his own ads and client ads behave identically:

1. **`ad-generator-background.mjs`** — the Google campaign builder and the Meta variants.
2. **`ad-generator.mjs`** — the Ad Creative Studio angles.
3. **`ads-autopilot.mjs`** — the always-on challenger writer, which is the "ongoing" half of what
   Bryson asked for. Conditions are fetched **lazily and at most once per client per run**, so a run
   that writes no challengers makes no network calls, and `localCond` is scoped **inside the client
   loop** so a Phoenix heat warning can never leak into a Seattle client's ad. The challenger prompt
   says: if the conditions genuinely drive demand, that is a strong angle *and one the ad running now
   is probably missing*. Each logged action records the conditions fingerprint.

## A weather outage must never stop an ad shipping

Every failure path returns season-only context: network down, non-200, timeout, unexpected JSON
shape. An ad that ships without a weather angle is fine; an ad that never ships is not. Asserted
four ways in the test.

## Guarded by `tests/verify-local-conditions.mjs` — 91 checks, no network

Alerts are stubbed so it runs anywhere and cannot flake on real weather. It asserts all 18
never-advertise event types are refused and all 15 usable ones accepted, the exact-place matching in
both directions, that an out-of-area alert is never claimed as covering the client, that the block
carries the invent-nothing and don't-force-it rules, the date/season maths, all four graceful-failure
paths, the fingerprint behaviour, and that **each of the four writers actually imports it, calls it,
and puts it in the prompt** — plus that autopilot scopes it per client.

**Both critical guards were proved to fail**: removing wildfire from the exclusion list produced 5
failures, and dropping the conditions out of the autopilot prompt produced 1. Then restored.

## ✅ Landing pages get it too, with DURABLE framing (2026-08-17)

`generate-landing.mjs` now receives the same facts in **`mode: "landing"`**, which swaps the
guidance rather than the facts. The distinction is real and worth keeping:

| | Ads | Landing page |
|---|---|---|
| Lifespan | swapped in a day | same URL for months |
| May use | today's specific alert | the season and the recurring pattern |
| Example | "AC out in this heat?" | "Monsoon season roof repair" |

A page saying "storm damage today" is wrong by Thursday and makes the business look asleep. The
landing prompt also says **match the page to the ads pointing at it** — a heat-led ad landing on a
generic page wastes the click, which is the whole reason Bryson asked for this.

## ✅ Conditions-CHANGE rewrite trigger, with two brakes (2026-08-17)

Bryson: *"yes do all of that."* Autopilot may now write a challenger **because the weather turned**,
not only because an ad group hit the impressions floor. It deliberately **ignores the impressions
floor** in that case: relevance is not a question of sample size, and if it is 115F while the ad
talks about spring tune-ups then the ad is wrong whether or not anyone has seen it.

Two brakes stop it churning live ads:

| Brake | Value | Why |
|---|---|---|
| `CONDITIONS_DWELL_HOURS` | **48** | The new conditions must HOLD this long. An advisory that posts at noon and expires at dusk must never rewrite anything. |
| `CONDITIONS_COOLDOWN_HOURS` | **336** (14 days) | Seasons turn a handful of times a year, not weekly. |

`SPLIT_MAX_ADS_PER_GROUP = 2` still applies, so this never piles up ads, and emergencies are already
out of the fingerprint, so a wildfire can never be what triggers a rewrite. The logged action records
`trigger: "conditions"` vs `"traffic"` and says which in plain English, so the owner alert explains
itself.

**🔴 THE BUG THAT WOULD HAVE MADE THE WHOLE THING DEAD.** `conditionsWatch` was first written inside
`if (actions.length)`. Autopilot does nothing on most days, so on every quiet run the fingerprint's
`since` reset to now, dwell never accumulated past a single day, and the trigger could never fire.
The watch is now saved whenever it changes, action or not, while `lastRun` is still stamped only when
autopilot actually acted. **Caught by simulating the trigger day by day, not by reading it.**

**Verified by replaying the trigger across simulated days** using the real constants read out of the
file, so the brakes are exercised rather than described:

| Scenario | Result |
|---|---|
| Advisory flaps on/off daily for a week | never fires ✓ |
| Quiet weather for a month | never fires ✓ |
| Heat arrives and holds | fires **once**, on day 3 (after the 48h dwell) ✓ |
| Heat for 20 days, then wind season | fires **twice**, 20 days apart ✓ |
| Heat → wind → heat inside a fortnight | fires **once** (cooldown holds) ✓ |

Both brakes were proved to be load-bearing: setting the dwell to 0 made the flapping-advisory case
fire, and reverting the quiet-run persistence made its own assertion fail.

## 🟡 Not built (deliberate)

- **Forecast temperatures.** NWS forecasts need lat/lon, which means a geocoding step. Alerts plus
  the date already carry the signal. Worth adding if a client needs "next week's high" precision.
- **Local events beyond weather** (festivals, road closures, sports) would need a search API and
  carries a much higher rate of irrelevant angles.
- **Meta creative refresh on a conditions change.** The trigger is Google-only, because it rides on
  the split-testing path, which does not exist for Meta yet. **Parked until Meta approval — tracked
  in KB `meta-parked-work`** (Bryson asked for it to be marked, 2026-08-17).

---

## ✅ 2026-08-20 — THE PAST, THE COUNTY BUG, AND THE MANUAL PATH

**Bryson:** *"for the copy generation whether its the manual or the generated variants make sure
that also looks at whats going on in the area. Like right now for metro arizona there has been
lots of storms recently."*

Three separate problems came out of checking this, and two of them meant the feature was
quietly wrong rather than merely incomplete.

### 1. Active alerts alone MISSED HIS EXAMPLE ENTIRELY

Measured live on the day he asked, against the real API:

| Window | What Arizona actually had |
|---|---|
| **Active right now** | 11 alerts: 7 Extreme Heat Warnings, 3 Air Quality, 1 Flood Advisory. **Zero storms.** |
| **Previous 14 days** | 437 alerts including **146 Severe Thunderstorm Warnings**, 84 Flash Flood, 11 Dust Storm |

So a roofer's ad written that morning would have said nothing about storms, on exactly the day
the metro was full of damaged roofs. **That is not an edge case, it is the normal shape of
storm-driven trades: the demand arrives after the weather leaves.** Nobody calls a roofer during
the storm, they call when they notice the ceiling stain. Roofing, restoration, tree work, glass,
auto hail repair, fencing and landscaping all sell into the aftermath, and the aftermath was
invisible to an "active alerts" query.

**`fetchRecent(states, {days})`** now pulls a trailing 14-day window from the same NWS API
(`/alerts?area=X&start=&end=`), and **`summariseRecent`** collapses it.

**It counts DAYS, not rows, and that matters.** The NWS issues one alert per zone per event, so a
single storm night across the Valley is dozens of rows. *"146 warnings"* sounds like the
apocalypse and is useless; *"storms on 5 of the last 14 days, 2 of them covering Maricopa"* is the
fact a person recognises. `MIN_RECENT_ROWS = 3` drops the single stray advisory, because one
event eleven days ago is not a pattern and must not become an ad angle.

The prompt gets the framing, not just the data: **live weather sells prevention, recent weather
sells repair**, plus an explicit ban on manufacturing urgency out of the window. Landing pages get
the durable version, where a run of events is evidence of the **seasonal pattern** rather than a
reason to write "after last night's storm".

### 2. 🔴 THE COUNTY BUG — the feature was telling the writer his own storms belonged elsewhere

**The NWS uses two different zone schemes and the matcher only understood one:**

```
Extreme Heat Warning  ->  "Central Phoenix; Fountain Hills/East Mesa"   public zones, CITY names
Severe Thunderstorm   ->  "Maricopa, AZ; Pinal, AZ"                     COUNTY zones
```

The exact-place city matcher handled the first perfectly. Against the second it matched nothing,
so **every storm alert in Bryson's own metro was reported to the model as "elsewhere in the state,
NOT this client's area"** even though Gilbert, Chandler, Mesa, Tempe, Phoenix and Scottsdale are
all in Maricopa County. Watches, warnings and most severe weather are issued by county, so this
was not a rare miss: **it was most of the severe weather, and it suppressed the exact angle he
asked for.** It hit live alerts too, not only the new window: the active Air Quality Alert for
"Maricopa, AZ" was being disclaimed as somebody else's.

**Fix:** `countyZones()` recognises the `"Name, ST"` segment shape (a public zone never carries
the state), and `resolveCounties()` resolves the client's own towns to their county through
**OpenStreetMap Nominatim** — free, no key, cached per process, and only called at all when a
county-issued alert actually turned up.

**🔴 It fails soft in a SPECIFIC DIRECTION.** If the county cannot be resolved, the alert is
reported as **county-issued and UNCONFIRMED** — never as "elsewhere", because that was the false
statement being fixed. Three distinct states now exist where there were two: confirmed in-area,
confirmed elsewhere, and honestly unknown. Uncertain and honest beats confident and wrong, and the
unknown wording explicitly forbids claiming their customers are affected.

### 3. 🔴 META WAS NEVER SENDING ITS SERVICE AREA

The server reads the weather from `body.locations`. The Google launch card sent it. **The Meta
card never did**, so every Meta variant since this feature shipped on 2026-08-17 was written with
season-only context while the Google ones got live data. Nothing errored, which is why it went
unnoticed. The Meta card has no locations box of its own (it targets by country and age), so it
now derives one from the client's own `targetLocations`, falling back to the metro for the house
account. Found while wiring the UI, three days before Bryson's first Meta campaign.

### 4. The MANUAL path now sees what the bots see

The facts had only ever existed inside a server-side prompt. When Bryson wrote a headline himself,
or edited one the model gave him, **he was working from memory while the bot worked from data** —
backwards, since he makes the final call on what ships.

**`netlify/functions/area-conditions.mjs`** (read-only, owner-gated, writes nothing) hands the same
facts to the browser, and **`AreaConditionsCard`** renders them at the top of both launch cards.
Design rules that are asserted, not just intended:
- **Only in-area conditions are shown.** An out-of-area alert sitting beside a copy field reads as
  a suggestion.
- **Only advertisable ones cross the wire.** An excluded emergency must never be rendered next to
  an ad form at all.
- **Silence when there is nothing to say**, and **silence on failure** — a weather lookup failing
  must not look like the campaign is broken.

### Verified — 176 checks (was 121), five deliberate breaks confirmed to fail

Removing county matching, denying an unresolved county instead of flagging it, dropping the recent
window from the change fingerprint, un-wiring Meta's service area, and letting the card show
out-of-area alerts each produced failures. One assertion failed on the first run and was **my own
mistake, not the code**: it searched the whole block for "elsewhere in the state" and matched the
guidance paragraph that explains the phrase. Scoped to the alert list rather than loosened.

**The change fingerprint buckets the recent window (none/some/many) rather than counting it.** A
raw count would differ on almost every run as the 14-day window slides, so every run would look
like "the weather changed" and autopilot would churn live ads forever. Bucketing means the
signature only moves when the pattern moves. The 48-hour dwell and 14-day cooldown still apply on
top.
