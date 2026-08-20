---
name: ad-copy-voice
topic: Marketing
task: keep ad copy and generated content from reading as AI-written
keywords: [plain hyphen, spaced hyphen, dash, humanize.mjs, humanizeDeep, NO_DASH_RULE, sounds AI written, AI tell, em dash, en dash, ad copy, AI generated, em dash, sounds like AI, humanizeAdCopy, voice, tone, ad tells, content studio ground rules, local businesses positioning]
status: verified
summary: Standing rule (Bryson, 2026-08-14) — no ad may read as AI-written, and the em dash is the tell he named. Every customer-facing string in the launch cards, the Ad Creative Studio angles and the 69 offline creatives was rewritten without dashes, `humanizeAdCopy()` now strips them from every ad field at submit time as a backstop for hand-typed and future model-written copy, and the Content Studio prompt bans them plus the usual AI giveaways. The prompt itself was de-dashed too, since a model mirrors the style it is given. Also fixed a violation of the older "never say local businesses" positioning rule found in the same sweep. 26 cases.
verified: 2026-08-20
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

---

## 🔴 2026-08-20 — THE PLAIN HYPHEN WAS NEVER CAUGHT, AND NINE SURFACES CLEANED NOTHING

**Bryson:** *"make sure for all of the ad copy for my ads and clients and anything we write
that we avoid using - because it makes it seem ai written."*

He had already asked for this on 2026-08-14 and it kept reaching him. Two reasons, and the
second is why it kept happening.

### 1. Only the LONG dashes were ever matched

Every implementation used `/[—–]/`. So `Roof repair - done right` shipped completely
untouched. That is the same tell wearing the character that is **actually on a keyboard**,
which is precisely the one a model reaches for. The prompts made it worse: they said *"never
use an em dash or en dash"*, which a model can reasonably read as **permission to use a
spaced hyphen instead**.

### 2. Nine of thirteen model-writing surfaces cleaned NOTHING

Measured, not assumed. Only `ad-gen-shared`, `blog-shared`, `newsletter-shared` and
`handover-pack` touched model output at all. Everything else relied on the prompt, including:

| Surface | Who reads it |
|---|---|
| `generate-landing` | **every visitor to a client's landing page** |
| `report-shared` | **the client's monthly performance report** |
| `lead-leak-audit-background` | **a prospect's inbox, as BoldLine's first impression** |
| `portal-assistant` | **clients, live, in their portal** |
| `content-studio` | video scripts and content ideas |
| `deal-research-background` | Bryson, read out loud on sales calls |

And the three that did clean had **already drifted**: `blog-shared` handled only the em dash,
never the en dash.

### The fix: one implementation, `netlify/lib/humanize.mjs`

`humanize(s, {join})` and `humanizeDeep(v, {join})`, plus `NO_DASH_RULE`, the single prompt
line every writer now carries. `join: ". "` splits into two sentences (ad copy);
`join: ", "` keeps one sentence (prose, where a hard stop reads clipped).

**A hyphen only counts when it has a real space on BOTH sides.** That is the whole reason
this is not a find-and-replace, and the test pins all of it:

```
done-for-you   no-obligation   24-hour   e-commerce   day-to-day
602-555-0199   AW-18269689296  act_1045064901242944  1080x1920
```

**Horizontal whitespace only (`[ \t]`, never `\s`).** Using `\s` treats a newline as a
space and turns a bulleted list into a paragraph. That break was tested and does exactly
that.

Also fixed: a **hardcoded `&mdash;`** sitting in the prospect audit email's footer.

### Verified by `tests/verify-no-dashes.mjs` — 39 checks

The surface list is **discovered from the source**, not written by hand, so a copy-writing
function added later is caught automatically instead of quietly shipping dashes. Each one is
asserted to both clean its output and carry the rule.

**🔴 THE TEST THAT COULD NOT FAIL, again.** The first version checked for the word
`humanize` anywhere in the file, so when the actual CALL was deleted from `generate-landing`
it still matched the leftover `import` and **passed**. Found only by deliberately breaking
it. It now strips import lines and requires a real call. This is the second time in this
project a source-matching assertion has passed on a mention rather than a use.

Four breaks confirmed to fail: dropping the plain-hyphen rule, swapping `[ \t]` for `\s`,
and removing the cleaning from `generate-landing` and from `report-shared`.
