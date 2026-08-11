---
name: lead-scout
topic: OS app
task: find businesses to cold call — AI prospect scraper by niche + area, scored on whether they're worth contacting, feeding into Deal Prep
keywords: [lead scout, lead scraper, prospect scraper, find leads, find businesses, cold call list, prospecting, niche dropdown, search areas, dedupe, duplicates, owner name, owner phone, employees, running ads, meta ad library, fit score, call first, waste of time, scout_runs, scout_prospects, scout-shared, lead-scout-background, LeadScoutScreen, emit_prospects, web_search]
status: verified
summary: Owner-side "Lead Scout" (BUILT 2026-08-11) — pick a niche from a ~430-entry dropdown (incl. deep e-commerce sub-niches) + one or more areas, and a background function web-researches real businesses and returns name, owner, company + owner phone, employees, website, whether they're running Google/Meta ads, reviews, plus a 0-100 "should I call them" score with an opener and why-not list. Results land in a permanent de-duplicated call list with per-prospect status, CSV export, and a one-click hand-off into Deal Prep. Needs a one-time Supabase migration (docs/sql/lead-scout-schema.sql); no new env vars.
verified: 2026-08-11
---

**What it is (Bryson's ask, 2026-08-11):** a prospect scraper inside the OS that works with Deal Prep.
Choose a niche from a large dropdown (e-commerce broken out in detail), choose the area(s) to work,
and get back businesses with the need-to-know facts — company name, owner name, company phone, owner
phone, employee count, website, whether they're running ads — each ranked on "should I contact them
or is this a waste of time".

**Architecture (mirrors deal-prep's background-function pattern — beats the ~10s sync limit):**
- **`netlify/lib/scout-shared.mjs`** — all the rules in one place: name/domain/area normalization,
  `dedupeKeyFor`, `areaMatches` (strict), `tierFor` (score → tier), the two strict-output tool schemas
  (`CANDIDATE_TOOL`, `PROSPECT_TOOL`), and the prompt builders (`discoverySystem`, `enrichSystem`).
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

**Scoring:** 0-100 weighing lead-dependence, ability to pay, opportunity gap, reachability of a named
decision-maker, and momentum; penalised for franchise/corporate-owned, already agency-managed, dormant,
too small, or an ad-restricted vertical. Tiers: **80+ Call first · 62-79 Strong lead · 42-61 Maybe ·
22-41 Low priority · <22 Skip.** The prompt explicitly tells it to be willing to score low.

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

**⚙️ ONE-TIME SETUP Bryson must do (no new env vars — reuses ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY):**
Supabase → SQL Editor → New query → paste **`docs/sql/lead-scout-schema.sql`** → Run. It creates
`scout_runs` + `scout_prospects` with RLS on and no policies (service-role only, same model as
`deal_briefs`). Until it exists, a run errors and the UI says "Setup needed: the scout_runs /
scout_prospects tables aren't in Supabase yet."

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

**Verified (2026-08-11):** all three modules `node --check`; 25 logic unit tests pass (area matching
incl. a neighbouring-town reject and an AI-lying-about-the-tag reject, dedupe key collapsing of legal
suffixes/`&`/case, domain normalization, tier boundaries); full headless flow at **390 / 768 / 1280 /
1600** — niche select → area chips → filters → run → progress → results → expanded detail → call list →
CSV → Deal Prep hand-off asserted to prefill — **no horizontal scroll at any width, no page errors,
sibling cards equal width**. Live end-to-end (real web research) is Bryson's to confirm after running
the SQL. See `deal-prep` for the sibling tool and `pricing-shared.mjs` for the per-lead fees the
scoring quotes.
