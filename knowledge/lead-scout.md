---
name: lead-scout
topic: OS app
task: find businesses to cold call — AI prospect scraper by niche + area, scored on whether they're worth contacting, feeding into Deal Prep
keywords: [lead scout, lead scraper, prospect scraper, find leads, find businesses, cold call list, prospecting, niche dropdown, search areas, dedupe, duplicates, owner name, owner phone, business phone, contact section, employees, running ads, meta ad library, fit score, call first, waste of time, score breakdown, why it scored, affordability, can they afford, budget capacity, revenue per employee, score cap, google places, places api, GOOGLE_PLACES_API_KEY, apollo, apollo.io, APOLLO_API_KEY, data providers, verified data, scout_runs, scout_prospects, scout-shared, scout-scoring, scout-providers, lead-scout-background, LeadScoutScreen, emit_prospects, web_search]
status: verified
summary: Owner-side "Lead Scout" (BUILT 2026-08-11) — pick a niche from a ~430-entry dropdown (incl. deep e-commerce sub-niches) + one or more areas, and a background function finds real businesses and returns a full Contact block (every phone + email, tagged whose/what/source), owner name, employees, website, whether they're running Google/Meta ads, reviews, plus a 0-100 "should I call them" score that is the SUM of six visible factors with a written reason each. Affordability is computed in code from headcount/revenue and HARD-CAPS the score, so businesses that cannot pay BoldLine physically cannot rank high. Real-data providers are pluggable and optional: GOOGLE_PLACES_API_KEY (verified phone/address/rating) and APOLLO_API_KEY (owner name, title, direct contact, headcount, revenue). Results land in a permanent de-duplicated call list with per-prospect status, rich CSV export, and a one-click hand-off into Deal Prep. Needs a one-time Supabase migration (docs/sql/lead-scout-schema.sql).
verified: 2026-08-11
---

**What it is (Bryson's ask, 2026-08-11):** a prospect scraper inside the OS that works with Deal Prep.
Choose a niche from a large dropdown (e-commerce broken out in detail), choose the area(s) to work,
and get back businesses with the need-to-know facts — company name, owner name, company phone, owner
phone, employee count, website, whether they're running ads — each ranked on "should I contact them
or is this a waste of time".

**Architecture (mirrors deal-prep's background-function pattern — beats the ~10s sync limit):**
- **`netlify/lib/scout-shared.mjs`** — normalization, `dedupeKeyFor`, `areaMatches` (strict), `tierFor`,
  the two strict-output tool schemas (`CANDIDATE_TOOL`, `PROSPECT_TOOL`), and the prompt builders.
- **`netlify/lib/scout-scoring.mjs`** — the money math + `buildScore()` (see "Scoring" below).
- **`netlify/lib/scout-providers.mjs`** — the optional real-data providers (see "Providers" below).
- **`netlify/functions/lead-scout-background.mjs`** — the run. Owner-JWT auth. **Model `claude-opus-5`**
  + server tool `web_search_20260209`, adaptive thinking, effort high, **streamed** (`.stream()` +
  `finalMessage()`) because output is well past the ~16k non-streaming timeout. Handles `pause_turn`
  by re-sending with the assistant turn appended (up to 6×).
- **`netlify/functions/lead-scout.mjs`** — read/write: `?action=run|runs|prospects|facets` (GET) and
  `?action=status|delete|delete-run` (POST). Owner-JWT auth, service-role access.
- **`index.html` — `LeadScoutScreen`** (after DealPrepScreen): two tabs (New search / My call list),
  `SCOUT_NICHES` taxonomy, chip-based area input, advanced filters, live progress bar, prospect cards
  with a score ring, tel:/mailto: links (tap to dial on the phone), expandable full detail, per-prospect
  status dropdown, CSV export, and **Deal Prep →** on every card.
  Routing `screen==="leadscout"`; entry from the dashboard card pair, SideNav, and the mobile More sheet.

**TWO PHASES on purpose — this is the key design decision.** One call that "finds and researches 20
businesses" reliably produces shallow, half-invented records. So: (1) **discovery** — one call finds up
to N real businesses, told explicitly which ones are already on the list so it hunts NEW ones;
(2) **enrichment** — the new ones are researched **4 per call, 3 calls in flight**, so each business
gets real focused searching for the owner's name, headcount and ad activity. Progress is written to
`scout_runs.progress` after each batch so the UI shows a live counter.

**"Never has duplicates" is enforced three ways, not one:**
1. `scout_prospects.dedupe_key` has a **UNIQUE index**; inserts use
   `upsert(..., {onConflict:"dedupe_key", ignoreDuplicates:true})`, so a re-run that rediscovers a
   business is skipped rather than added twice. The key is normalized `name|city` — legal suffixes
   (LLC/Inc/Co…), `&`→`and`, case and punctuation all collapse.
2. A **domain check** in code (second axis, in case the name is spelled differently).
3. The **prompt** gets an "already in Bryson's list — do NOT return these" block so searches aren't
   wasted rediscovering the same businesses.
Deleting a prospect frees its key, so a future search can find it again.

**"Strict to those areas" is enforced in CODE, not just asked for in the prompt.** The AI tags each
result with the exact requested area string; `areaMatches()` then independently verifies the city /
state / ZIP it reported. A business in a neighbouring town is dropped even when the AI tags it as
in-area (verified by test). Region-style requests ("East Valley, AZ") can't be city-verified, so they
accept the AI's tag plus a state check. The check runs **twice** — after discovery and again after
enrichment, because deep research often corrects the city. Rejects are counted and shown in the run
summary. E-commerce niches may leave areas empty (nationwide).

**Anti-hallucination (the thing that would actually burn him on a call).** A lead list with invented
phone numbers is worse than no list. Guards: the schema has **no optional fields** — anything unconfirmed
comes back as the literal `"unknown"` (or 0), so there is no blank to fill; the prompt states plainly
that "unknown" is the correct and expected answer for an owner's direct line; **`sanitize()` drops an
`owner_phone` whose digits equal the main business number** (the classic way a model pads a record) and
drops a rating outside 1–5; every card shows a **% verified** completeness badge and italic *not found*
placeholders, so a thin record looks thin instead of quietly looking complete. `why_not` is required —
the model must name a reason each prospect could be a waste of time.

**Scoring — the score IS the breakdown (Bryson, 2026-08-11: "make sure I also get reasons why it's
scored as such").** The model does not pick a number. It returns five factors, each with a written
reason, and `buildScore()` in `scout-scoring.mjs` sums them — so the number and the visible reasoning can
never disagree. Weights: **demand 25 · budget 25 · gap 25 · reach 15 · momentum 10 · risk 0 to -40.**
Tiers: **80+ Call first · 62-79 Strong lead · 42-61 Maybe · 22-41 Low priority · <22 Skip.**

**Affordability is computed, not guessed, and it CAPS the score (Bryson: "rank lower on companies that
won't have enough money to work with me — you can do the math").** `budget` is deliberately absent from
the model's factor enum; `assessAffordability()` owns it:
1. Annual revenue = a reported figure if one was found (`parseRevenue` handles "$2-4M", "$500k",
   "1.5 million"), else **headcount × revenue-per-employee** for that industry group (Legal 250k,
   Medical 240k, B2B 200k, Auto/Professional 180k, Trades 150k, Pets 95k, Beauty/Senior 85k,
   Education/Hospitality 70k, e-commerce 300k, default 140k — deliberately conservative, because
   over-estimating a prospect's budget is the expensive error).
2. Monthly marketing capacity = revenue × the group's marketing % (Legal 9%, Medical 8%, Trades/Beauty 7%,
   Auto/Professional 6%, B2B/Senior 5%, Education/Hospitality 4%, e-commerce 10%) ÷ 12.
3. Compared against the **cheapest real way in**: entry package fee + the low end of its required client
   ad spend (service = Meta Launch $350 + $500 = **$850/mo** + $600 setup; ecom = Store Launch $450 +
   $500 = **$950/mo**).
4. Ratio → band → points **and a hard cap**: ≥2.5 comfortable (25 pts, no cap) · ≥1.5 workable (19) ·
   ≥1.0 tight (10, **cap 55**) · ≥0.6 stretch (3, **cap 30**) · <0.6 cannot (0, **cap 15**).
Unknown size = 9 pts, no cap, and the card says to verify budget on the call. It also computes their
**realistic ceiling package** and silently steps the recommendation down if the model pitched above it
(`packageDowngradedFrom`), so Bryson never quotes $900/mo to someone who can carry $400.
Sanity-checked: a solo nail tech or 2-person food truck with an otherwise perfect profile scores **15
(Skip)**; a 3-employee roofer scores 92; a 1-employee DTC skincare brand scores 92 (online margins).

**Providers — optional, pluggable, fail-soft (`scout-providers.mjs`).** With no keys set, behaviour is
unchanged (AI research only). Each key upgrades the data and every field carries its own `source`, so
the UI shows what is verified vs researched:
- **`GOOGLE_PLACES_API_KEY`** → Places API (New) `places:searchText`, one call per area with a field
  mask. Returns verified name, address, **the real main phone**, website, rating, review count, and
  business status (closed listings are dropped). Used for DISCOVERY, which also makes the area filter
  authoritative — a real address instead of the model's opinion about one. ~3¢ per area searched.
- **`APOLLO_API_KEY`** → `organizations/enrich` (headcount, revenue band, company phone, founded) +
  `mixed_people/search` filtered to owner/founder/president/CEO titles (name, title, LinkedIn, work
  email, any direct/mobile numbers). Masked `email_not_unlocked@…` addresses are treated as absent
  rather than handed over as real.
Provider data runs BEFORE the AI pass and is injected into the enrichment prompt as a `VERIFIED FACTS`
block the model is told to treat as ground truth and never contradict (conflicts get added as a
secondary number with lower confidence + a note). `?action=providers` reports which keys are live so the
search screen can show a Data sources strip.

**Ad detection — why NOT the Meta Ad Library API (Bryson asked for it 2026-08-11).** `ads_archive`
only covers political / social-issue ads in the US; a local HVAC company's commercial ads appear in the
Ad Library **web UI** but are never exposed through the API (all-ads API access is EU/DSA only). Wiring
it literally would have returned "no ads" for nearly every prospect — a **false negative**, strictly
worse than the honest "unknown" it replaced, and the kind of thing that puts Bryson on a call saying
"I noticed you're not running Google Ads" to someone who is. Built instead:
1. **`inspectAdTech(website)`** — fetches their public homepage (no API key needed, so it runs on every
   prospect regardless of provider config) and looks for the tags advertising requires: `AW-` conversion
   tags / `googleadservices.com` / `googleads.g.doubleclick.net` for Google, `fbevents.js` / `fbq('init'`
   / `facebook.com/tr?id=` for Meta, plus GTM / GA4 / LinkedIn / TikTok as context.
2. **A `likely` state** added to the `google_ads` / `meta_ads` enum. **CRITICAL ASYMMETRY: a tag found
   is evidence ("likely"); a tag NOT found proves nothing** — plenty of sites inject tags through Tag
   Manager — so this path can only ever raise `unknown` → `likely`, never produce a `no`, and never
   downgrade a confirmed sighting. The prompt tells the model the same rule.
3. **A per-prospect "Check Meta ads ↗" deep link** into the Ad Library web UI filtered to that business
   — one click for the definitive answer the API cannot give.
**GOTCHA — the first ad-tech build detected nothing (hit live 2026-08-11, FIXED same day).** It sent
`user-agent: BoldLineScout/1.0`, which Cloudflare and most small-business WAFs refuse, so every fetch
failed and every prospect fell back to `unknown` — silently, for the third time in this feature. Fixed
by presenting a **normal browser user-agent** (we are reading a public homepage exactly as a visitor
would) plus `accept`/`accept-language` headers and a **www ↔ bare-host retry**, and by always returning
a `note` explaining what the check concluded so an `unknown` is never unexplained again. LIVE-PROVEN on
Bryson's own prospects: `preciseairandheating.com` → Google Ads conversion tag; `aroundthesunaz.com` →
Meta Pixel (×3 signals); `georgebrazilhvac.com` → Google Ads remarketing tag; `parkerandsons.com` →
nothing in source despite being a huge advertiser, which is exactly why absence never means "no".

**`?action=recheck-ads`** re-runs ONLY the tag check over saved prospects (6 at a time, max 300) and
patches `googleAds`/`metaAds`/`adsEvidence`/`adTechNote` in place. **No AI, so it is free** — added so
the 16 prospects researched before the fix could be backfilled without paying to re-research them.
Surfaced as a "Re-check ads" button on the call list. It can only upgrade `unknown` → `likely`, same
asymmetry as everywhere else.

Unit-tested against synthetic HTML for both platforms, GTM-only (must stay `unknown`), a bare page, and
an unreachable site.

**Contact block (Bryson: "I also want a section where I get the businesses number as well").** `phones`
and `emails` are arrays of records — `{number, kind: main|direct|mobile|secondary|toll_free, whose:
business|owner, label, source, confidence}` — replacing the old single phone/email fields. The card
renders a dedicated **Contact** panel: every number found, business vs owner colour-coded, each showing
its label and where it came from, all `tel:`/`mailto:` links so they dial straight from the phone.
Verified provider rows are merged FIRST so they own the primary slot; the model's findings only fill
numbers the providers didn't supply. The old "owner phone equal to the main line" guard now runs across
the whole merged array.

**Niche taxonomy:** `SCOUT_NICHES` in index.html — ~430 niches across 25 groups. 11 service groups
(home services/trades, legal, medical & dental, beauty/wellness/fitness, automotive, professional &
financial, B2B/commercial, education & childcare, hospitality/events/food, senior care, pets) and **14
e-commerce groups** broken out as Bryson asked (apparel, jewelry, beauty, supplements, home & living,
electronics, food & bev, pets, baby & kids, sports & outdoors, auto aftermarket, hobby, digital &
subscription, business models). Ad-restricted categories (CBD, alcohol DTC, hunting) are labelled in the
dropdown. Plus a **Custom niche…** free-text option. `kind: "ecom"` flips the area field to optional and
steers the package recommendation to the `e-` packages.

**Deal Prep hand-off:** every card's **Deal Prep →** calls `openDealPrep(seed)` in App, which sets
`dealSeed` and routes to `dealprep`. `DealPrepScreen` gained `seed`/`onSeedUsed` props — it prefills
company/niche/website/location and packs everything already researched (owner, phone, employees, years,
rating, ad status, gaps) into the notes field, which the deal-research prompt treats as GROUND TRUTH.
So the briefing builds on the scout's findings instead of starting cold. The seed is consumed once and
cleared.

**⚙️ SETUP.** REQUIRED: Supabase → SQL Editor → New query → paste **`docs/sql/lead-scout-schema.sql`**
→ Run. Creates `scout_runs` + `scout_prospects`, RLS on with no policies (service-role only, same model
as `deal_briefs`). Until it exists a run errors with "Setup needed: the scout_runs / scout_prospects
tables aren't in Supabase yet."
OPTIONAL (Netlify → Site configuration → Environment variables, OS site): **`GOOGLE_PLACES_API_KEY`**
(Google Cloud → enable "Places API (New)" → Credentials → API key; needs billing enabled, ~$200/mo free
credit covers normal use) and **`APOLLO_API_KEY`** (Apollo → Settings → Integrations → API → new key).
Neither is required; the Data sources strip on the search screen shows which are live.

**GOTCHA — a silent hang that looked like a stuck run (hit live 2026-08-11, FIXED same day).** The
UI's `api()` helper throws on `{ok:false}`, and the poll's `catch` swallowed everything as "transient",
so a PERSISTENT error (most likely: the Supabase migration was never run) polled forever behind the
local "Starting the search…" text — which is the UI's own initial state, not something the server sent,
so it looked like a working run rather than a failure. Three fixes: (1) a **preflight** `action=facets`
call before the background function is even invoked, so a missing table is caught in a second instead of
after minutes of API spend; (2) the poll now counts consecutive failures, surfaces the setup message
immediately when the error text names a missing relation, and gives up after 3 strikes; (3) `status:
"unknown"` for >40s (the row was never written) now reports "the search never started" instead of
spinning. The background function also checks the initial `scout_runs` upsert error and returns 500
rather than researching businesses it can never save. **Lesson: never let a catch-all swallow a poll
error — a persistent failure and a slow success look identical from the outside.**

**GOTCHA — comma in the area chip input (hit live 2026-08-11, FIXED same day).** Comma was a commit key
alongside Enter, which made the natural "Gilbert, AZ" physically untypeable — it fired on the comma and
left you adding " AZ" as a second chip. **Enter is now the only commit key.** Regression-tested by
typing the string character-by-character and asserting one chip.

**GOTCHA — "how many to find" was not honoured (hit live 2026-08-11, FIXED same day).** Google Places
returns up to 20 results per area and the discovery loop pushed all of them in; `count` only limited the
AI top-up. A 6-count run over one area researched **16** businesses — ~3x the time and spend asked for,
and close to the 15-minute background ceiling, which is what made the first live run look hung.
`candidates` is now trimmed to `count` after dedupe + area filtering, and `stats.trimmed` tells him how
many were held back so he can raise the count deliberately. Two robustness fixes came out of the same
incident: prospects are now **saved per batch** instead of all at once at the end (a run that hits the
ceiling keeps what finished), and progress is reported on batch **start** as well as completion, with an
elapsed clock in the UI — with 3 calls in flight and minutes per call, a bar that only moves on
completion reads as frozen. Per-business web-search budget trimmed 6 -> 5.

**⚠️ FIRST THING TO CHECK when every batch fails instantly: ANTHROPIC API CREDITS.** That was the
actual root cause on 2026-08-11 — the account ran dry mid-testing and every enrichment call returned a
billing error in milliseconds. Symptom is unmistakable once you know it: sub-second "completion", zero
prospects, and a run summary blaming duplicates. Reloading credits fixed it immediately (16 HVAC
companies landed on the first run after). **Check the balance before debugging anything else** — the
model/parameter theory below was wrong, though the ladder it produced is still worth keeping as
defence.

**GOTCHA — every AI research batch failed instantly and it looked like "found nothing" (hit live
2026-08-11).** Symptom: a run returned in seconds with "Everything found was either a duplicate or
outside your areas" while the stats said 20 found / 0 duplicates / 1 out of area — i.e. 19 should have
survived. Places discovery was fine; the ENRICHMENT call was throwing immediately on every batch, the
`errors` array captured it, and **nothing ever displayed it**. Three things in the Lead Scout call
differ from the known-good `deal-research-background` call (`claude-opus-4-8`, no `output_config`, no
strict tool): the model **`claude-opus-5`**, **`output_config: {effort}`**, and **`strict: true`** tool
use — against SDK `^0.69.0`. Any of the three can be rejected outright. Rather than guess, `runToolCall`
now walks an **ATTEMPT LADDER** — opus-5+effort+strict → opus-5 plain → **opus-4-8 fallback** — dropping
one risky parameter per rung, sticking to the winning rung for the rest of the run, and recording it as
`result.engine` so the cause is visible in the UI. Content-level failures (a refusal, or a finish with
no tool call) skip the ladder, since dropping parameters cannot fix those. Errors are now rendered in a
red "Research errors" card, and a 0-prospect run says "the research step failed" rather than blaming
duplicates. **Lesson (second time this bit): a collected-but-never-displayed error is the same as no
error handling at all.** In the end the ladder was NOT what fixed it — credits were — but the
error-surfacing half of the same change is what would have diagnosed it in one minute instead of an
hour. Display the error first, theorise second.

**Gotchas:**
- Must be a **background** function — a run takes 2-6 minutes.
- `web_search_20260209` needs no beta header on `claude-opus-5`; do NOT also declare `code_execution`
  (dynamic filtering already runs it). Handle `pause_turn`.
- **Cost per run is real** — one discovery call plus one enrichment call per 4 businesses, each doing
  live web searches (~$0.01/search). Budget a few cents for a 6-count run up to roughly a dollar for 30.
  The UI says so under the button. Separate from Claude Code credits.
- Strict tool use requires every property in `required` + `additionalProperties:false` — that's why
  there are no optional fields and why "unknown" is a sentinel string rather than null.
- `max_tokens` 32k on enrichment; must stream or the SDK times out.
- Poll timeout in the UI is 13 min (background limit is 15). Results are saved regardless, so closing
  the tab mid-run doesn't lose them — they appear in My call list.

**LIVE-VERIFIED 2026-08-11** — a real Gilbert, AZ HVAC run returned 16 scored companies with the
Google Places path confirmed end to end: green "verified by Google Places" badges, real main numbers
sourced "— Google Places", real street addresses, owner names, and the affordability math computing
sensible capacities (e.g. 2-6 employees -> ~$3,500/mo, matching 4 x $150k x 7% / 12). Apollo still
unconfigured at that point. **Known gap from that run: `google_ads` / `meta_ads` came back
"unconfirmed" on every card** — web search alone is not reliably establishing whether a business is
currently advertising, which was one of Bryson's explicit need-to-know fields. Candidate fixes: a
targeted Meta Ad Library lookup, or accepting "unknown" and leaning on the other signals.

**Verified (2026-08-11, second pass):** all five modules `node --check`; affordability model
sanity-checked across 15 company profiles (solo nail tech + food truck correctly hard-capped to 15 with
a perfect factor profile; revenue parser exact on 4 formats); headless flow re-run at all four
breakpoints asserting the Contact block renders all 3 phones + 2 emails as tap-to-dial links, the score
breakdown + factor bars, the affordability math, the capped-score banner, and the verified-by badge —
no horizontal scroll, no page errors. The Google Places and Apollo calls are written to each provider's
documented API but are UNVERIFIED against a live key (no keys available in this environment) — they are
fail-soft, so a wrong assumption degrades to AI-only rather than breaking a run. **First real run with
keys set is the thing to watch.**

**Verified (2026-08-11, first pass):** all three modules `node --check`; 25 logic unit tests pass (area matching
incl. a neighbouring-town reject and an AI-lying-about-the-tag reject, dedupe key collapsing of legal
suffixes/`&`/case, domain normalization, tier boundaries); full headless flow at **390 / 768 / 1280 /
1600** — niche select → area chips → filters → run → progress → results → expanded detail → call list →
CSV → Deal Prep hand-off asserted to prefill — **no horizontal scroll at any width, no page errors,
sibling cards equal width**. Live end-to-end (real web research) is Bryson's to confirm after running
the SQL. See `deal-prep` for the sibling tool and `pricing-shared.mjs` for the per-lead fees the
scoring quotes.
