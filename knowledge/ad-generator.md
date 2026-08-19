---
name: ad-generator
topic: Ads
task: generate real campaign structure (ad groups, keywords, 15 headlines, negatives, creative angles) instead of string templates
keywords: [ad generator, ad-generator.mjs, adGenCall, ad groups, keyword intent, match type, responsive search ad, 15 headlines, negative keywords, creative angles, AD_ANGLES, agencySeed, kwSeed, cut off, cut short, truncated, mid-word, mid-sentence, unfinished sentence, incomplete headline, fitWords, fitPhrase, fitSentence, clPhrase, cl30, character limit]
status: verified
summary: "Fill copy" was string templates — 6-7 keywords in one undifferentiated bucket, 8 of Google's 15 headlines, 3 of 4 descriptions, and a SINGLE ad group, byte-identical on every press. New `netlify/functions/ad-generator.mjs` writes a real campaign with a model: 3-5 intent-themed ad groups each carrying its own keywords (with per-keyword match types) and its own full 15-headline ad, plus 15-30 business-specific negatives and an operator note. `createCampaign` now builds N ad groups in one atomic mutate. The Ad Creative Studio's five fixed angles can likewise be rewritten from the real niche. 32 + 27 + 22 + 31 cases.
verified: 2026-08-19
---

**Bryson, 2026-08-14:** *"the keywords the angles for the ad creative studio and everything is just to basic and isnt advanced at all."* Correct, and it was a known gap: the Ad Creative Studio was shipped with the honest note that *"the words are angle TEMPLATES, not a live model call"*.

**MEASURED, not asserted.** Running the shipped `agencySeed()`:

| | Before | Google allows |
|---|---|---|
| Keywords | **6-7**, one bucket, no match-type strategy | hundreds |
| Headlines | **8** | 15 |
| Descriptions | **3** | 4 |
| Ad groups | **1** | many |
| Variation between presses | **none, byte-identical** | |

**The single ad group was the worst part.** One group holding every keyword means the ad can never match the search, so Quality Score and CTR both suffer and every click costs more. That is the structural difference between a basic campaign and a real one, and no amount of better copy fixes it.

**`netlify/functions/ad-generator.mjs`** — three actions, all tool-use structured output on the `content-studio` pattern (`claude-sonnet-5` with an `opus-4-8` fallback, owner Supabase session required):
- **`google`** — 3-5 ad groups, each with a theme, an intent tier (`high`/`medium`/`research`/`local`/`emergency`/`competitor`), 8-15 keywords scoped to that theme with per-keyword `EXACT`/`PHRASE`/`BROAD`, exactly 15 headlines and 4 descriptions; plus 15-30 negatives specific to the business and an operator note on what to watch in weeks one and two.
- **`meta`** — 3-4 complete variants written per awareness stage (unaware → most-aware), because the same words cannot work on someone who has never considered the problem and someone already comparing providers.
- **`creatives`** — 5-7 angles in the same `{id,label,kicker,head[],accent,sub,why}` shape the Studio already renders, so the picker and canvas need no special case.

**TWO PROMPTS, NOT ONE.** Selling BoldLine's service to a business owner and selling a client's service to their customer are different jobs; one shared prompt is what produced the bland copy. The agency prompt also carries the standing rules: no invented results (BoldLine has no clients), the three honest differentiators, and never say "local businesses".

**LIMITS ARE ENFORCED IN CODE, NOT JUST ASKED FOR.** A prompt is guidance; a 31-character headline fails the entire `googleAds:mutate`. `cleanGoogle()` drops over-length headlines/descriptions/keywords, rejects keywords over 10 words, lowercases and de-brackets, dedupes headlines, **dedupes keywords across the whole campaign** (the first group to claim a term keeps it, so two groups never bid against each other), and strips em dashes through the same transform as `humanizeAdCopy`. A group that loses too much copy to survive is dropped rather than sent broken.

**`createCampaign` now takes `adGroups[]`** and emits one ad group + one responsive search ad + that group's keywords per theme, with temp resource names counting down from `-3`, all inside the same single atomic all-or-nothing mutate. **The legacy flat `{headlines, descriptions, keywords}` shape still works** and is normalised into a one-element array, so the manual fields and any older caller are unaffected. **A keyword appearing in two ad groups is a hard error, not a silent dedupe** — at the API layer it means the operator built something wrong and should see it.

**UI.** The Google card gets **✨ Generate full campaign**, which shows every ad group with its intent chip, theme, keyword count and a preview of the keywords written the way Google writes them (`[exact]`, `"phrase"`, broad), plus the operator note. Generated negatives merge into the editable negatives box rather than hiding somewhere. **Build Campaign uses the generated groups when present and silently falls back to the single manual group when not**, so the card still works with no AI call. A generated set can be discarded. The Creative Studio gets **✨ Write angles for this niche**, and shows the `why` line for whichever angle is selected.

**Verified by 32 + 27 + 22 + 31 cases.** Campaign build (hermetic, `fetch` stubbed, asserting the exact mutate payload): three ad groups with unique temp resource names counting down from -3, all PAUSED, each attached to the temp campaign, one ad per group bound to its OWN group, each carrying the full 15 headlines and 4 descriptions, per-keyword match types respected, the legacy shape still building one group with string keywords and the default match type, duplicate keywords across groups erroring, over-length headlines naming their ad group, empty groups rejected, locations still required. Cleaning: over-length copy dropped, duplicates collapsed, em dashes stripped, keywords lowercased and length/word-count filtered, lowercase match types normalised, negatives de-bracketed and deduped, an unsalvageable group dropped. Wiring: all the UI paths, plus assertions that the generator's own prompt contains **zero** em dashes (a model mirrors the style it is given) and carries the honesty and positioning rules.

**🔴 THE SYNC VERSION 504'd ON ITS FIRST REAL USE — now background + poll.** The risk was recorded here as a hypothetical; it took one press to become real. A synchronous Netlify function gets roughly **10 seconds**, and the Google action writes 3-5 ad groups x 15 headlines x 4 descriptions, which is far more output than that. `content-studio` gets away with sync because 6 ideas is a fraction of the tokens.

**Architecture now:**
- **`netlify/lib/ad-gen-shared.mjs`** holds the prompts, tools, limits and every cleaning function. Both entry points import it, so the sync and background paths **cannot diverge** — asserted in the tests.
- **`ad-generator-background.mjs`** runs `google` and `meta`. Netlify runs any `*-background` function for up to **15 minutes** and returns 202 immediately.
- **`ad-generator.mjs`** keeps `creatives` synchronous (small enough to answer inline, and it was already working) and adds a **`poll`** action.

**RESULT STORAGE: on the client record at `data.adGenJob`, NOT a new table.** The existing `deal_briefs` background pattern needs a Supabase migration, and **a migration nobody ran is exactly what made Lead Scout hang silently** — so this reuses the migration-free path `contentIdeas` already uses. The write is read-merge-write on the `adGenJob` key alone, so a concurrent edit to the rest of the record is not clobbered. A `running` row is written **before** the model call, so the OS can tell "started" from "never started".

**The OS** fires the background function, accepts **202** as success (anything else is a real refusal and surfaces immediately), then polls `poll` every 3s for up to 4 minutes. A job carries an **id** so an abandoned run can be ignored. On timeout the message says the job may still finish and to press Generate again to pick it up, rather than implying the work was lost.

**Cost note:** one bounded model call per press (8000 max tokens for Google).

**Verified by 31 more cases:** the long job is a `-background` file, the sync path refuses `google`/`meta` and says where they moved, `creatives` stayed sync, **the only Supabase table touched is `clients`** (asserted by extracting every `.from("…")` in the file, since `deal_briefs` still appears in a comment explaining why it is not used), the running row is written before the model call, done/error rows carry result and friendly message, poll requires a clientId, a missing job polls as `ok:true` rather than an error, and the OS accepts 202, stops on done, surfaces error, and bounds its wait.

**🔴 FIXED SAME DAY — copy was being cut mid-word.** Bryson caught a live creative reading **"When the calls should be ringi"**. Cause: every length-capped field went through a plain `.slice(0, N)`, which counts characters and does not care where a word ends. Replaced with two word-aware trimmers, both exported and tested:
- **`fitWords(s, max)`** — trims back to the last whole word, strips any trailing comma/period left behind, and returns **empty** if not even the first word fits, because a dropped field is always better than a visible fragment. Used for kicker, label, ad-group name, and the Meta headline and description.
- **`fitSentence(s, max)`** — for prose, ends on the last COMPLETE sentence inside the limit (terminator kept) and falls back to `fitWords` when there is no sentence break. Used for the creative sub-line.

The same bug existed in the OS's own template seeds (`cl30`/`cl90` in `GoogleLaunchCard` were `.trim().slice(0,30)`), so a long client name or offer could be cut mid-word there too. Both now route through a `clWords` helper with identical behaviour. The model is also instructed to count characters and finish the thought inside the limit, so trimming is the safety net rather than the mechanism.

**Verified by 22 cases**, including a **400-string property test** asserting the output is never over the limit, is always a prefix of the input, and never ends mid-word; plus the exact reported string, a single over-long word being dropped rather than mangled, null/empty safety, and prose keeping a complete terminated sentence. Two assertions failed on the first run and were **wrong themselves** (one input was exactly at the limit so it was legitimately untouched, the other was malformed) — corrected to actually exercise the trim rather than loosened.

**🔴 2026-08-19 — THE SAME BUG AGAIN, ONE LEVEL UP: copy was being cut mid-THOUGHT.** Bryson caught a live Meta ad whose description read **"Steady roofing leads, not just"**.

**This was NOT a regression of the mid-word fix above.** That string is exactly 30 characters and ends on a whole word, so `fitWords` did precisely what it was written to do. It is still broken English, because **a whole word is not a whole thought**. The 2026-08-14 fix solved word-safety and stopped there; nothing ever checked whether the surviving text ended somewhere a person could actually stop.

**Why short fields make this near-certain rather than rare.** The Meta description is capped at **30 characters**, about four or five words. Any sentence-shaped idea that overruns will land mid-clause when cut at the limit, so on a hard-capped field word-safety alone is not enough. The same exposure existed on the 30-character Google headline and the 30-character creative kicker.

- **`fitPhrase(s, max)`** (new, in `ad-gen-shared.mjs`) — trims to a whole word, then **walks back off any trailing word that cannot end an English sentence** until it can, and drops the field if fewer than two words survive. On the reported string: `…, not just` → drop `just` → `…, not` → drop `not` → `Steady roofing leads,` → strip the comma → **"Steady roofing leads"**. Twenty characters, complete, same meaning.
- **It only fires on text that was actually CUT.** A field already inside the limit is returned byte-for-byte. Without that guard the walk-back would edit copy nobody asked it to edit ("Tell us what you need" would lose its last word). This is pinned by its own test.
- **The `DANGLING` list is deliberately conservative.** A false positive is worse than a false negative here: an awkward ending merely reads plain, but deleting a good final word turns working copy into worse copy. So phrasal-verb particles and adverbs that genuinely end sentences are **excluded on purpose** — "check it out", "call now", "members only", "we do that too", "start here" all survive. The first draft of the list included `now`/`only`/`out`/`here`/`there` and was tightened before shipping.

**Wired into:** the Meta headline (40) and description (30), the creative kicker (30), `fitSentence`'s fallback, and `fitAll`. `fitAll` also changed behaviour: an over-length Google headline is now **trimmed instead of discarded**, because dropping them could pull a group under the 3-headline minimum and discard the whole ad group.

**The OS's own seeds needed it too.** `cl30`/`cl90` in `index.html` pre-fill the campaign builder from the client's niche, offer and service area **before the AI is ever called**, and the server-side fix does not reach them. A long niche produced "Commercial Roofing And Restoration Experts" → **"Commercial Roofing And"**. The browser now carries its own copy of the walk-back (`clPhrase`, same word list, same only-when-cut rule), and the two agency seed arrays gained a `.filter(Boolean)` since a trimmed-to-nothing field must not ship as an empty headline.

**The prompt carries its half.** Trimming is the safety net; the fix is the model finishing the thought inside the limit. The Meta `description` field description now states the limit in characters AND in words, requires a finished phrase, forbids ending on a leading word, and gives the reported string as the named bad example. The Google `headlines` field and the Meta prompt got the same treatment.

**Verified by `tests/verify-ad-copy-fit.mjs` (12 checks, several sweeping every length).** The exact reported string end to end through `cleanMeta`; copy that already fits returned untouched, including strings that legitimately end on dangling-list words; legitimate endings surviving the walk-back; a sweep asserting nothing ever exceeds the limit at any length; a sweep asserting no trimmed output ends on a dangler; an unfittable word dropped rather than mangled; a long Google headline salvaged rather than discarded; and assertions that the tool schemas actually demand a complete thought. **Every guard was proved to fail when the fix is removed** (four separate deliberate breaks, server side and OS side). One expectation failed on the first run and was **my arithmetic, not the code** — I expected a 32-character result under a 30-character limit; corrected rather than loosened.

**NOT built:** the `meta` action exists in the function but `MetaLaunchCard` still uses its template seed; wiring it is a small edit. Sitelinks, callouts and structured snippets are not generated (extra Google API surface). Neither is ad-group-level negative keywords.
