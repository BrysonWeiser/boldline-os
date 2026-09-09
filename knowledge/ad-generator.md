---
name: ad-generator
topic: Ads
task: generate real campaign structure (ad groups, keywords, 15 headlines, negatives, creative angles) instead of string templates
keywords: [settings not saving, does not save, resets, lost my work, campaign draft, campaignDraft, useSavedDraft, autosave, auto save, debounce, flush on unmount, stale client, draft persistence, start over, reset campaign settings, match type, keyword match type, phrase, exact, broad, quotes, brackets, auto format keywords, kwMatch, liveMatch, applyMatchType, generatedMatchType, mixed match type, campaign settings block, settings order, where do i change the budget, tick boxes, tick box, select ad groups, pick ad groups, choose ad groups, which ad groups, build these ad groups, two build buttons, build campaign paused, edit ad group, edit generated ad groups, editGroup, picked, campaign settings, daily budget generated, manual ad copy, manual fallback, ad generator, ad-generator.mjs, kicker, kicker unfinished, isLeadIn, lead-in, label not sentence, creative studio kicker, narrow input, field too narrow, scrolls sideways, adGenCall, ad groups, keyword intent, match type, responsive search ad, 15 headlines, negative keywords, creative angles, AD_ANGLES, agencySeed, kwSeed, cut off, cut short, truncated, mid-word, mid-sentence, unfinished sentence, incomplete headline, fitWords, fitPhrase, fitSentence, clPhrase, cl30, character limit]
status: verified
summary: "Fill copy" was string templates — 6-7 keywords in one undifferentiated bucket, 8 of Google's 15 headlines, 3 of 4 descriptions, and a SINGLE ad group, byte-identical on every press. New `netlify/functions/ad-generator.mjs` writes a real campaign with a model: 3-5 intent-themed ad groups each carrying its own keywords (with per-keyword match types) and its own full 15-headline ad, plus 15-30 business-specific negatives and an operator note. `createCampaign` now builds N ad groups in one atomic mutate. The Ad Creative Studio's five fixed angles can likewise be rewritten from the real niche. 32 + 27 + 22 + 31 cases.
verified: 2026-09-02
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

**UI.** The Google card gets **✨ Generate full campaign**, which shows every ad group with its intent chip, theme, keyword count and a preview of the keywords written the way Google writes them (`[exact]`, `"phrase"`, broad), plus the operator note. Generated negatives merge into the editable negatives box rather than hiding somewhere. **Build Campaign originally used the generated groups when present and silently fell back to the single manual group when not** — replaced 2026-09-09 by two explicit buttons, see the section at the end. A generated set can be discarded. The Creative Studio gets **✨ Write angles for this niche**, and shows the `why` line for whichever angle is selected.

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

**🔴 2026-08-20 — THE SAME CLASS A THIRD TIME: a CHAIN of leading words.** Bryson, off another live ad: the description read **"Steady roof leads, no"**.

**The walk-back was working.** The model wrote "Steady roof leads, no more guessing", `fitWords` cut it to "…, no more", and **"more" WAS caught and popped**. It then stopped on **"no"**, which was missing from the list, leaving a one-word fragment.

**The lesson is bigger than the missing word: popping one dangler routinely EXPOSES ANOTHER underneath it.** The list has to cover the whole chain, and a test that only pins the single reported string would not have caught this. Added the quantifiers `no`, `any`, `another`, `other`, `such`, `several` to both the server list and the OS copy.

**Still conservative, and the omissions are deliberate:** `both`, `either`, `much`, `many` and `enough` genuinely do end sentences ("we do both", "thanks so much") and stay out. **"no" is the one judgement call** — "the answer is no" is valid English but essentially never appears in ad copy, while "no contracts" and "no guessing" are everywhere.

**17 checks now, and the guards were broken BOTH WAYS**: removing the quantifiers brings the reported fragment back, and adding a word that legitimately ends a sentence (`both` / `too` / `only`) trips the over-correction test. That two-sided break is the point — this fix can fail by doing too little *or* too much.

**NOT built:** the `meta` action exists in the function but `MetaLaunchCard` still uses its template seed; wiring it is a small edit. Sitelinks, callouts and structured snippets are not generated (extra Google API surface). Neither is ad-group-level negative keywords.

---

## 🔴 2026-09-02 — the kicker "sentence is unfinished", and it was TWO bugs wearing one complaint

**Bryson, mid-way through a roofing creative:** *"for the kicker the sentence is unfinished"*, with a
screenshot of the Ad Creative Studio on his phone showing `…our budget actually gets`.

### Cause 1 — the input box, not the copy

The **Kicker** and **Footer offer** inputs shared `repeat(auto-fit,minmax(150px,1fr))`. On a 390px
phone that fits TWO columns, so each box got about 165px, and a 30-character kicker scrolled
sideways inside it showing only the tail. **The copy was complete. There was nowhere to see it.**

Raised to `minmax(220px,1fr)`: one per row below roughly 480px, still paired on a laptop.

**The generalisable bit:** the responsive rule is usually applied to pages. It applies to FORMS too.
A field whose value has to be read and checked needs enough width to be read, and a value that
scrolls out of sight looks identical to a value that was truncated.

### Cause 2 — the model really does write lead-ins

The schema said *"Small line above the headline. 30 characters or fewer."* That invites the opening
of a sentence, and the model obliged: `Your budget actually gets`, `The one thing that`,
`Everything you need to`.

🔴 **`fitPhrase` cannot catch these and it is important to understand why, because the instinct is
to "fix the trimmer" again.** `fitPhrase` walks back ONLY when something was cut — that is a
deliberate design decision recorded above, so that copy which already fits comes back byte-for-byte
and the trimmer never edits text nobody asked it to edit. These fragments are 25 characters. Nothing
was cut. Every length check in `verify-ad-copy-fit` passes on them.

So completeness is now asked as a **separate question of the final text**: `isLeadIn()` in
`humanize.mjs`. A label may not end on a verb still waiting for its object (`gets`, `brings`,
`buys`, `tells`, …), nor on a dangling article/preposition (the existing `DANGLING` set), nor on
`actually`. A rejected kicker is **replaced with the niche label** (`For Roofers`, passed in by
`ad-generator.mjs` from `body.niche`) or **dropped** — `drawAdCreative` draws nothing for an empty
kicker, and nothing reads as deliberate where half a thought reads as broken.

🔴 **THE QUESTION-WORD EXEMPTION IS LOAD-BEARING, NOT A LOOPHOLE.** `What Your Budget Buys` and
`Where Your Money Goes` end on verbs in the reject list and are good copy. A label opening on
what/how/why/where/when/who/which is exempt, and that exemption has its own test so nobody
"simplifies" it away. Without it the guard deletes better lines than it saves.

The **schema** now calls the kicker a LABEL and gives good AND bad examples. That is the real fix;
the code guard is the net. A guard firing on every angle would mean a prompt nobody repaired.

### The word list, and why it is short

Only verbs that are genuinely transitive and adverbs that genuinely always lead onward. **Left out
on purpose:** `finally`, `instantly`, `consistently`, `properly`, `run`, `go` — all of them really do
end ad copy ("get quotes instantly", "done properly"), so listing them would delete good labels.

### 🔴 The shape this deliberately does NOT catch

A fragment ending on a **noun**: `See what your money`, `Here is the reason`. Spotting those means
deciding whether an embedded clause has its verb yet, which needs a parser. Every cheap
approximation tried also rejected `See What We Do` and `Know What You Get`, which are good labels.
**A false positive costs more than a false negative here**, so the gap is written into the test as
its own named check rather than quietly left out, and the schema's counter-examples cover the shape.

**23 checks. Three mutations applied to the real files, all three caught:** guard removed, exemption
removed, schema guidance removed.

---

## 2026-09-09 — HE PICKS THE AD GROUPS, AND THE BUTTONS SAY WHAT THEY BUILD

**Bryson:** *"a way for me to select each ad group i want to use im thinking we just add tick boxes besides each ad group and then we add a build campaign (paused) button under the generated ad groups and keep the other generate campaign button that is below the manual copy meant only for the manual copy"* — then, in the same sitting: *"i still need a way to set what the campaign should be for ways to edit the ad groups that were made if I want to and also things like the campaign name daily budget etc. just like how the manual campaign creation is"*.

Three problems, and the third one is the interesting one.

**1. He could not decline a group.** The generator writes 3-5 themed groups and the build took all of them. On a small budget the groups compete for one daily pot, so a research-intent group he did not want was quietly spending against the buy-intent group he did. Now every row carries a tick box. An unticked group is **not built at all**, rather than built and paused: a paused ad group sitting in a client's account is a thing to remember to delete later, and forgetting is the normal outcome. The box is its own tap target *outside* the row that expands the group, or ticking would expand and expanding would untick. The first untick starts from **all** groups (`new Set(p||gen.adGroups.map((_,k)=>k))`), which is what makes "everything except that one" a single tap. Regenerating and discarding both clear the selection, because ticks apply **by position** and would otherwise carry over onto different groups.

**2. One button meant two different things.** It inferred its source from "is there a generation", which made the manual copy boxes unreachable the moment anything had been generated. `launch` now takes an explicit `mode` — `"gen"` under the generated list, `"manual"` at the bottom — and the manual button stays usable with a generation on screen (it renders as an outline, and says it builds a single ad group from the copy above it). The copy-length rules only guard the manual branch, and the empty-selection rule only guards the generated one, so neither can block the other.

**3. 🔴 THE NOTE ABOVE THE BUTTON WAS FALSE, AND THAT IS WHY HE ASKED FOR SETTINGS HE ALREADY HAD.** It read *"the single-group fields below are the manual fallback and are ignored while this is here"*. Only the headline / description / keyword boxes are the manual fallback. The **campaign name, daily budget, landing page, target locations, negative keywords and goal are all sent with a generated build too** — they always were. He read that sentence, concluded a generated campaign had no budget he could set, and asked for a feature that already existed. **A wrong label costs the same as a missing feature.** The block above the generated build button now prints those six settings with their live values (amber when unset), says they apply to this build, and points at the **Campaign settings** heading below; the copy boxes sit under their own **Manual ad copy** heading.

**Editing a generated group.** Opening a group now shows editable boxes, not just readable ones, so a single bad headline does not cost a whole regeneration. Keyword match type is carried in the punctuation Google itself uses (`[exact]`, `"phrase"`, bare broad), which is the same notation printed above the box, so changing the brackets changes the match type. Edits write straight back into the structure the build sends.

**`tests/verify-group-picker.mjs` — 75 checks, 17 mutations, all caught.** The real `launch` and `editGroup` are extracted from `index.html` and **run** against a recording `gadsCall`, so this asserts the payload rather than the source: ticked groups only, no manual copy leaking in, and every one of the six campaign settings present in **both** modes. Also runs the tick-box handler itself (the first untick starting from all, re-ticking restoring), proves the on-screen tick uses the identical test as the build's filter, and proves an edit reaches the payload. The false sentence has its own assertion so it cannot come back.

## 2026-09-09 (later) — THE MATCH TYPE CONTROL WAS A DECORATION, AND THE SETTINGS WERE UNDER THE WRONG HEADING

**Bryson:** *"can you make sure that when a setting like that is changed to exact or phrase or broad the keywords are automatically updated and formated to meet the keyword match type. An example would be when it is set to phrase everything is automatically put into quotes. also if the manual section doesnt effect the generate full campaign section i need a way to edit whether I want to change the keyword match type, the target location, daily budget, etc."*

Two findings in one message, and the second one is a lesson about layout rather than code.

### The dropdown did nothing to a generated campaign

Every generated keyword carries its **own** match type, and the dropdown was only ever the **fallback for a keyword that has none** — which never happens, because the generator's schema requires one. So the control could read **Phrase** while the account about to be built was part exact, part broad. A setting that renames itself without changing the thing it names is worse than no setting: it is a lie you can point at.

Now:

- **`tidyField.kwMatch(text, mt)`** re-punctuates a keyword list to a match type, in the notation Google itself uses: `[exact]`, `"phrase"`, bare broad. It **peels any existing wrapper first**, so switching back and forth can never produce `["nested"]` — which Google reads as a different keyword. It runs on the dropdown AND on the keyword box's blur.
- **`applyMatchType(v)`** writes to **both** places: the manual box's punctuation and every generated keyword's `matchType`.
- 🔴 **`generatedMatchType(gen)` reads the answer off the keywords rather than a stored value**, so the dropdown shows `Mixed` by itself when the groups disagree, and moves back to a named type the moment they agree — including after a hand-edit of one group's brackets. Same "observed, never stored" rule as every other status in the OS. `MIXED` is offered as an option **only while it is true**, and is never sent to Google (it is not a value the API accepts).
- Generating **adopts** whatever the generator chose, instead of keeping the claim from before the generation.

**Mixed is usually right and the note says so** — money terms exact, most of the rest phrase — so picking a single type is presented as an override, with what it will do spelled out.

### 🔴 THE SETTINGS WERE SPLIT IN HALF BY THE MANUAL COPY BOXES

He asked for a way to set the target location and daily budget for a generated build. **He already had one.** The card's order was: name, budget, landing page → **MANUAL AD COPY** (headlines, descriptions, keywords, match type) → locations, negatives, goal. So half the shared settings sat *below a heading that said manual*, and reading the screen top to bottom told you they were manual-only. They never were.

Reordered to: **Campaign settings** (name, budget, landing page, match type, locations, negatives, goal) → **Generate full campaign** (groups, tick boxes, its build button) → **Manual ad copy** (the three copy boxes, its build button). Settings once, then the two ways to build.

**This is the second time in one day that a wrong label cost a feature request for something that already existed** (the first was the note claiming the settings were "ignored"). Worth remembering as a class of bug: on this card, ordering and headings are not decoration, they are the documentation.

### Verified

`tests/verify-match-type.mjs` — **56 checks, 15 mutations caught**, extracting and RUNNING the formatter, the reader and `applyMatchType`: his exact example (phrase puts everything in quotes), round-trips that must not nest, `MIXED` and junk values changing nothing, and every generated keyword actually changing in both directions. `verify-group-picker` gained the ordering assertions (settings before generated before manual, and each named field inside the settings block). Rendered headlessly with the generated groups showing at **390 / 768 / 1280 / 1600** — no horizontal overflow, nothing offscreen, consistent field widths.

## 2026-09-09 (later still) — THE SETTINGS WERE NEVER SAVED ANYWHERE

**Bryson:** *"make sure when the campaign settings are changed they actually save and stay saved"*. They did not, and nothing said so, because nothing was broken.

The launch card's form was plain component state, seeded from computed defaults on mount. **The campaign name, daily budget, landing page, match type, target locations, negative keywords, goal, the typed service, and the entire generated campaign existed only in that browser tab.** Switching to another tab inside the same client threw them away. So did the app reloading while he answered a text message. Losing the generated campaign is the expensive one: it costs a model call and a minute or two of waiting, every single time.

The draft now lives on the **client record** — the thing that already syncs and is already backed up — so it also follows him from his phone to his desktop. `useSavedDraft(client, onUpdate, slot, value, active)` is written to be reusable; the Meta card can adopt it unchanged when Meta is approved.

### 🔴 The three ways an auto-save like this goes wrong, each of which is its own bug

1. **Writing on MOUNT.** A save fired just because the card rendered would replace a real saved draft with freshly computed defaults, which is precisely the loss it exists to prevent. Only a genuine edit arms it.
2. **Saving against a STALE client.** `onUpdate` replaces the **whole** record, so spreading a `client` captured 900ms earlier silently undoes a lead, an approval or a note that landed in between. The flush reads the latest through a ref, never the closure.
3. **Flushing only on a TIMER.** A debounce with no unmount flush loses the last edit every time, and leaving right after typing is exactly when he expects it kept.

### Two smaller traps, both real

- **`picked` is a `Set`.** Written to the database it comes back as `{}` — which is **not** null, so `picked.has` throws and every ad group reads as unticked. Stored as an array, restored as a Set.
- **The restore merges FIELD BY FIELD**, never `savedF || defaults`. A whole-object swap means any field added to the form later comes back `undefined` for every client who saved a draft before it existed, which React renders as an uncontrolled input that then wipes itself.

**And it says so on screen.** An invisible auto-save is indistinguishable from no auto-save, which is the state he was complaining about. The card says the settings are kept and offers **start over** (with a confirm) for when a draft goes stale — the landing page changed, the budget changed — because otherwise there is no way back to the defaults.

### Verified

`tests/verify-draft-persistence.mjs` — **58 checks, 20 mutations, all caught.** The real hook is extracted and RUN against a hand-driven React: no write on mount, one write for five keystrokes, no write for an unchanged re-render, the lead that arrived mid-debounce surviving the save, the unmount flush landing the last edit, an untouched card writing nothing on the way out, and a client with no id never being written.

🔴 **The fake `clearTimeout` had to really cancel.** It was a no-op at first, and a no-op cannot tell a working debounce from a missing one — both look like a growing pile of pending timers, so the "five keystrokes, one save" assertion would have passed a card that wrote once per character.
