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

---

## 🔴 SAME DAY — Bryson corrected the rule I had just written

*"the only things that shouldnt be touched are thing like phone numbers, and things like
e-commerce but the done for you doesnt need hyphens neither does the no obligation thats
what makes it seem ai written."*

He is right, and the version shipped hours earlier had it **backwards**. It protected
`done-for-you` and `no-obligation` as "hyphens inside a word are fine", and the prompt said
so out loud, which actively told the model to keep writing them.

**The distinction is not "inside a word" versus "between words". It is SPELLING versus
COPYWRITING HABIT.** Nobody says "done-for-you" out loud. The hyphens are a marketing tic,
and a tic is exactly what makes copy read as machine-written. Meanwhile `e-commerce`,
`t-shirt`, `self-employed`, `follow-up` and `24-hour` are simply how those words are spelled,
and stripping them would look illiterate rather than casual.

So `humanize()` now also de-hyphenates a **short, explicit list** of marketing compounds
(`MARKETING_COMPOUNDS`), preserving capitalisation: "Done-For-You" becomes "Done For You".

**Explicit list, never a pattern, and that is the whole design.** A rule like "de-hyphenate
adjective compounds" is the obvious implementation and would wreck every real spelling above.
Anything not on the list keeps its hyphen. Add to the list when a new one turns up in real
copy; do not generalise it.

**Our own hardcoded copy had to be fixed too**, since the runtime cleaner never sees a string
baked into a template. Five in `index.html` (the agency ad seeds and a Lead Scout
placeholder) plus the package feature label **"Priority Support (same-day replies)"**, which
turned out to live in THREE files — `index.html`, `portal.mjs` and `contract-shared.cjs`.
`verify-packages` caught the third one, because it cross-checks that every copy of the
catalog agrees.

**46 checks. Three breaks confirmed to fail:** turning the de-hyphenation off, over-reaching
so `e-commerce` gets stripped too, and reintroducing a hardcoded `Done-for-you` into a
template.

**A test can pin the wrong behaviour as firmly as the right one.** The suite had an assertion
demanding the rule say `done-for-you` was "fine and expected". It passed, and it was wrong.
Worth remembering the next time a green suite feels like proof.

## Follow-up 2026-08-24: the "local businesses" rule was only pinned on ONE surface

Bryson asked for a Deal Prep pricing sweep before his first real sales call. The pricing
itself was clean (all 12 packages match between `pricing-shared` and `report-shared`, and
the prompt block is GENERATED from the live catalog rather than hardcoded, so it cannot
drift). The wording was not.

**Deal Prep had been telling its model that BoldLine serves "local/service businesses"**,
and nobody had noticed. The standing rule was pinned by hand on Market Research only, so
every other copy-writing surface was unguarded.

The check now rides on `verify-no-dashes`'s **auto-discovered** set of copy-writing
surfaces (anything calling `anthropic.messages.create`), so every current and future writer
is covered rather than whichever ones somebody remembered. It immediately found **two more
violations nobody knew about**: `lead-leak-audit-background.mjs` (also describing BoldLine
as "Phoenix-based", which implies one city to a prospect reading a free audit) and a false
positive on `ad-gen-shared.mjs`.

🔴 **Two lessons, both about the test rather than the code.** The exemption for a prompt
that FORBIDS the phrase was first written against one file's exact wording
(`NEVER describe...`), so a file stating the same rule in different words was flagged as a
breach of it. It matches the intent now: any sentence containing "never" is the rule, not a
violation. And the comment trap was pre-empted for the fifth time by stripping comments
before asserting absence, because the line that removes a phrase always quotes it.

All three files fixed and each one broken individually to confirm the guard bites.

## 2026-09-04 — the last dashes a client could actually read

Bryson: *"Do the clean up but still make it obvious which package it is but that it's the full
system"*.

**Two surfaces the rule named and the suite was not checking.**

1. 🔴 **Every client lifecycle email. Forty-one dashes.** The welcome, the ad-account request,
   the invoice, the receipt, the past-due notice, the renewal, the approval request, the
   thank-you. All hand written by us, all shipped, and `verify-no-dashes` was only looking at
   the portal and the marketing site. Each one was rewritten into real sentences rather than
   find-and-replaced, and the file is now scanned. 🔴 **The entity form counts too**: the
   footer read `BoldLine Media &mdash; Google &amp; Meta`, which renders as a dash and would
   have survived a search for the character.

2. 🔴 **The package name, which had a carve-out saying it was exempt.** `"Full System — Growth"`
   was skipped in two places as *"a product name, not copy this suite may rewrite"*.

### The rename, and what it exposed

**The marketing site and the catalog never agreed on that package's name.** The site said
**"Full System: Growth"**; the OS said **"Full System — Growth"**. A helper in
`verify-packages` quietly normalised the two together, so **a client could read one name on the
public site and a different one inside their own portal** and nothing flagged it.

Both now use the site's colon form. That keeps the public name and the Meta flip checklist
intact, satisfies the rule (a colon is not a dash), and makes the two agree for the first time.
The em dash stays in the normaliser only so a stale record still matches.

**Both exemptions deleted**, so the guarantee is now stronger than before rather than
differently shaped. Only `Campaign Progress —` remains, a placeholder inside a graphic when
there is no stage yet, not a sentence.

## 🔴 The outreach drafts (found 2026-09-04, four places, never checked)

Bryson asked a plain question about the Book a Call button on a lead. Reading the code to answer it turned up an **em dash in the email SUBJECT LINE** ("BoldLine Media — let's book a quick call") and another in the **text message** ("it's Bryson from BoldLine Media — thanks for reaching out"), each existing twice, because the house account's Leads tab and the global Leads screen hold separate copies of the same card.

🔴 **This is the most direct client-facing copy in the whole OS and it looked internal.** Everything else the dash rule guards is obviously outward: the portal, the marketing site, ad copy, client emails. These two strings sit inside a React component in Bryson's own dashboard, so they read as app code. They are the exact words a prospect gets in their inbox and on their phone.

**Where a string lives says nothing about who reads it.**

Now checked in `verify-no-dashes`: the drafts and the subject are read out of both cards and fail on an em dash, an en dash or a spaced hyphen. The check also **counts what it matched and fails below six**, because a pattern that silently stops matching is a check that passes while reading nothing.
