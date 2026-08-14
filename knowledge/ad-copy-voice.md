---
name: ad-copy-voice
topic: Marketing
task: keep ad copy and generated content from reading as AI-written
keywords: [ad copy, AI generated, em dash, sounds like AI, humanizeAdCopy, voice, tone, ad tells, content studio ground rules, local businesses positioning]
status: verified
summary: Standing rule (Bryson, 2026-08-14) — no ad may read as AI-written, and the em dash is the tell he named. Every customer-facing string in the launch cards, the Ad Creative Studio angles and the 69 offline creatives was rewritten without dashes, `humanizeAdCopy()` now strips them from every ad field at submit time as a backstop for hand-typed and future model-written copy, and the Content Studio prompt bans them plus the usual AI giveaways. The prompt itself was de-dashed too, since a model mirrors the style it is given. Also fixed a violation of the older "never say local businesses" positioning rule found in the same sweep. 26 cases.
verified: 2026-08-14
---

**Bryson, 2026-08-14:** *"in the ads copy and this goes for all ads remember to not make it sound ai generated (the - as an example)."*

**The em dash is the tell.** It is the single most reliable signal that copy came out of a model, and it was in the shipped seed copy in six places. Rewritten by hand rather than mechanically, so the replacements read like a person wrote them:

| Where | Was | Now |
|---|---|---|
| Google client headline | `Free Quote — Get Started` | `Get Your Free Quote Today` |
| Google client description | `…you can trust — fast, friendly, and local.` | `…you can trust. Fast, friendly, and local.` |
| Meta primary text (general) | `…ads for you — plus the landing pages…` | `…ads for you, plus the landing pages…` |
| Meta primary text (niche) | two dashes in one sentence | commas |
| Creative angle "search-first" | `…put you there instead — and build the page…` | `…put you there instead, and build the page…` |
| Creative angle "you own it" | `We manage it — we never hold it hostage.` | `We manage it, we never hold it hostage.` |

**ENFORCED, NOT REMEMBERED.** Seed copy being clean today is worth little — copy also gets hand-typed in the launch cards and will eventually be model-written. `humanizeAdCopy()` (defined beside the budget helpers in `index.html`) runs on every ad field at submit time: a dash joining two clauses becomes **two plain sentences** (which is how a person would have written it anyway), leading/trailing dashes are dropped rather than left as stray punctuation, the following letter is capitalised, and `..` can never be produced.

**Deliberately NOT sanitised:** **keywords** (a dash in a search term is real, not a stylistic tell) and **campaign names** (`BoldLine Media — General`, `Acme — Search`) — those are internal labels in the Google Ads / Meta UI that no searcher ever sees, and a dash is a useful separator there. The test asserts the exemption explicitly so a future session doesn't "fix" it.

**The AI-written surface got rules, not a sanitiser.** Content Studio's `GROUND_RULES` now bans the em dash by name plus the rest of the giveaways: "it's not just X, it's Y", "in today's world", "let's dive in", unlock/elevate/leverage/seamless/robust/game-changer/supercharge, "the truth is", rule-of-three lists where two would do, opening every line on a rhetorical question, ending on a neat inspirational bow, and uniform sentence length ("a wall of same-length balanced clauses is what a model sounds like"). Contractions encouraged.

**The prompt itself was de-dashed — this is the part that is easy to miss.** `GROUND_RULES` and `BUSINESS` were written full of em dashes, and **a model mirrors the style of its prompt**, so instructing it to avoid dashes in prose that is full of them fights itself. Nine prompt strings rewritten. The only dash left in model-facing text is inside the rule that names the character. Scripts are not machine-sanitised after generation (unlike ads) because Bryson reviews them before shooting and a blind rewrite could mangle script formatting.

**Caught in the same sweep — a violation of an older standing rule.** `"For Local Service Businesses"` appeared as a creative kicker in both `index.html` and `scripts/build-ad-creatives.js`, against the recorded hard rule in KB `linkedin-brand-presence`: **never say "local businesses"; he serves businesses nationally/remotely.** Changed to `"For Service Businesses"`, and the Content Studio prompt now tells the model the same thing. **Note the distinction that makes this correct:** a CLIENT's own ad may say "local" (a roofer genuinely is local to their customers, and "fast, friendly, and local" survives above) — the rule governs how **BoldLine** describes its own audience. There is real tension with the geo-targeting work that limits the house campaign to the Phoenix metro; that is a targeting choice, not a positioning claim, and Bryson can overrule either way.

**Verified by 26 cases** against the shipped files, with the sanitizer extracted from `index.html` and executed rather than reimplemented: joining dash becomes two sentences, en dash caught too, headline dash breaks cleanly, leading/trailing dashes dropped without stray punctuation, no `..` ever produced, clean copy passes through byte-identical, `boldlinemedia.com` not mangled, `Done-for-you` hyphens survive, null/undefined safe, output never contains a dash; no dash in any of the four copy regions; the sanitizer is wired into both cards; keywords are provably left alone; Content Studio carries the rules; the prompt contains exactly the one intentional dash; and `Local Service Businesses` appears nowhere.
