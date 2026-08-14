---
name: campaign-geo-targeting
topic: Ads
task: why a Google Search campaign built from the OS targets the right places, and what happens if it doesn't
keywords: [geo targeting, location targeting, geoTargetConstants, suggest endpoint, PRESENCE, presence or interest, negative keywords, language targeting, worldwide targeting, createCampaign, budget waste, GoogleLaunchCard]
status: verified
summary: `createCampaign` used to build budget → campaign → ad group → responsive search ad → keywords and NO campaign criteria at all — which means Google targets ALL COUNTRIES AND TERRITORIES and all languages. On a $5/day budget bidding agency terms that burns the month on clicks that can never convert, and it reads as "the ads failed" rather than "targeting was never set". Fixed 2026-08-13: locations are now REQUIRED (the call refuses without one), resolved from plain names via `geoTargetConstants:suggest`, attached as campaign criteria alongside English-language targeting, with `geoTargetTypeSetting = PRESENCE` so only people physically in the area see the ads. Campaign-level negative keywords added too. 24 hermetic cases.
verified: 2026-08-13
---

**Found 2026-08-13, before the first campaign was ever built** — Bryson had finished conversion tracking and was ready to launch. Reading `createCampaign` before sending him to click Build showed the `mutateOperations` array contained a campaign budget, a campaign, an ad group, a responsive search ad and keyword criteria — **and not one `campaignCriterionOperation`.**

**Why that is expensive, not cosmetic.** A Google Search campaign created with **no location criteria targets every country on earth**, and with no language criteria targets every language. The house campaign bids on terms like `marketing agency`, `google ads management`, `facebook ads agency` — globally searched, and in many markets far cheaper per click than in the US, so the auction happily spends the whole daily budget abroad. At $5/day the entire month (~$150) would have gone to clicks from people who can never hire a Phoenix-area agency. **Nothing would have errored.** The campaign would simply have looked like a failure, and the natural conclusion — "Google Ads doesn't work for us" — would have been wrong.

**THE FIX (all inside the one atomic mutate, so it is still all-or-nothing):**

| Added | What it does |
|---|---|
| `campaignCriterion.location` × N | targets only the named places |
| `campaign.geoTargetTypeSetting` = `PRESENCE` / `PRESENCE` | **people physically IN the area only** |
| `campaignCriterion.language` = `languageConstants/1000` | English |
| `campaignCriterion` `negative: true` × N | blocks searchers who never buy |

**`PRESENCE` is the setting that matters most and is the easiest to miss.** Google's default is `PRESENCE_OR_INTEREST`, which also serves anyone *interested in* the targeted place — someone in another state reading about Phoenix. For a local service business paying per click that is pure waste, and it is the default, so it happens silently.

**Locations are REQUIRED, not optional** — `createCampaign` throws `at least 1 target location required` and makes **zero API calls** before it does. This is deliberate: a defaulted-to-worldwide campaign is the failure mode, so the safe state is refusing to build rather than building something that quietly drains a budget.

**Name resolution uses `geoTargetConstants:suggest`**, not hard-coded IDs. Hard-coded IDs rot and silently target the wrong place (there is a Phoenix in Arizona and one in New York). The endpoint is **not customer-scoped**, so it is called with `baseHeaders(token, false)` — **no `login-customer-id`**, same as `listAccessibleCustomers`. It returns every suggestion in one flat list rather than grouped per input, so each result is matched back to its request by `searchTerm`. Resolved constants are **deduped** — "Phoenix" and "Phoenix, Arizona" resolve to the same constant and Google rejects a campaign targeting the same location twice.

**Partial resolution creates the campaign but reports the gap.** If Google recognises 4 of 5 names, the campaign is built targeting those 4 and the response carries `locationsUnresolved`, which the OS surfaces in the success message as a ⚠ naming exactly what is NOT targeted. Silently dropping a location the user typed would be the same class of invisible failure as the original bug. If Google resolves **none** of them, the call throws instead.

**UI (`GoogleLaunchCard`)** gained two fields below match type: **Target locations** (one per line, required, defaults to the six-city Phoenix-East-Valley metro for the internal house account — Gilbert / Chandler / Mesa / Tempe / Phoenix / Scottsdale — or a client's `campaignSetup.serviceArea || targetLocations`, split on commas/semicolons/newlines) and **Negative keywords** (one per line, prefilled with the classic budget-eaters: `free`, `cheap`, `jobs`, `salary`, `hiring`, `course`, `training`, `tutorial`, `diy`, `software`, `template`, `reddit`, `resume`, `entry level`, …). The success message now reports the canonical names Google actually targeted, so there is no guessing whether it worked.

**Verified by 24 hermetic cases** (`fetch` stubbed, assertions on the exact mutate payload Google would have received): refuses with no locations **and makes no API calls when it refuses**, refuses when nothing resolves and never reaches the mutate, suggest is US-scoped and sends no `login-customer-id`, campaign is PAUSED, `geoTargetTypeSetting` is PRESENCE both ways, one criterion per resolved location carrying the right constants and attached to the temp campaign resource name, exactly one English language criterion, negatives are campaign-level and BROAD, positive keywords stay ad-group level and ENABLED, the result reports what was targeted and what was dropped, duplicates collapse to one criterion, and no negatives supplied is a clean no-op. `index.html` also parse-checked through Babel (the 820k-char JSX app compiles) — a syntax error there takes down the whole OS.

**Still true and unchanged:** everything is created **PAUSED**. The campaign, ad group and ad are all paused; only the keyword criteria are ENABLED, which costs nothing while the campaign itself is paused. Nothing spends until it is approved in Alerts or started from Your Live Campaigns.
