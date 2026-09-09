---
name: field-formats
topic: OS
task: make fields with a required shape (one per line, City State, ten-digit id, a URL) format themselves
keywords: [one per line, target locations, format field, auto format, tidyField, locationNotes, lineNotes, FieldNotes, customer id dashes, https prefix, keyword commas, headline 30 characters, character limit]
status: verified
summary: Fields whose label explains a required format now apply it. `tidyField` (index.html) formats on BLUR, never on keystroke: `locations` (one place per line, splitting on and/&/;/newline and pairing City+State only when the second half really is a state), `adLines` and `keywords` (one per line, de-duplicated, keywords also split on commas), `customerId` (ten digits to 123-456-7890), `digits`, `url` (adds https://), `tidy`. What needs a human decision is never guessed at — `locationNotes` and `lineNotes` flag it in amber through one shared `FieldNotes` component. 🔴 Over-length ad copy is FLAGGED, never truncated: auto-trimming to 30 characters is what produced the live headline "Serving Eugene and Lane". Built 2026-09-09.
verified: 2026-09-09
---

**Why (Bryson, 2026-09-09):** *"make sure that anything that requires a specific format like
the one area per line is automatically formatted like that"*, after typing

```
Eugene and Lane County
Oregon
```

into a box whose own label says *one per line*. Google would have been asked to target a
place called "Eugene and Lane County" and then **the entire state of Oregon**, on a $17 a day
budget. The box explained the format underneath it. **Explaining a format is not applying
one**, and the cost of getting this one wrong is money spent in the wrong town.

## The rules

`tidyField` in `index.html`, one contiguous block of plain JS so the suite can extract and
run it:

| Formatter | Does | Used by |
|---|---|---|
| `locations` | One place per line. Splits on newline, `;`, **and**, `&`. Pairs `City, State` only when the second half really is a state. De-duplicates. | Target locations (both launch cards), `campaignSetup.targetLocations` |
| `adLines` | One per line, trimmed, de-duplicated. **Never truncates.** | Headlines, Descriptions |
| `keywords` | Same, and **splits on commas** | Keywords, Negative keywords, `excludedKeywords` |
| `customerId` | Ten digits → `123-456-7890`; anything else left alone | `googleAdsCustomerId` |
| `digits` | Strips everything else (`act_123` → `123`) | Meta account / page / pixel ids |
| `url` | Adds `https://` when there is no scheme; blank stays blank | The three carrier-filed pages, in the OS **and** the client portal |

## Three decisions worth keeping

🔴 **On blur, never on keystroke.** Reformatting text under a cursor while somebody is still
typing moves the cursor and eats characters, which is worse than the mess it tidies.

🔴 **It only does what is unambiguous.** Splitting "Eugene and Lane County" into two places is
mechanical. Deciding the "Oregon" underneath was meant as the state for both is a **guess**,
and a wrong guess here buys ads in the wrong town silently. Anything needing a person is
flagged instead: `locationNotes` says *"Oregon is a whole state… put the town first"* and
*"Eugene has no state or country after it"*, naming the line, because "one of these is wrong"
is useless on a phone with eight lines on screen.

🔴 **Over-length ad copy is flagged, not cut.** The campaign on screen carried the headline
**"Serving Eugene and Lane"** — an auto-trim of "Serving Eugene and Lane County" to 30
characters. That is not a shorter sentence, it is a broken one, and it would have run on a
real client's ads. `lineNotes` reports the line, its length, and how much to cut. Cutting text
to fit is a decision about wording and belongs to a person.

A comma inside a keyword is the quiet one: **Google reads a comma as the end of the keyword**,
so `screen printing, Eugene` runs as something other than what was typed. Splitting on it is
what was meant every time.

## "Let the AI shorten these"

Bryson, 2026-09-09: *"for the headline fix and other fixes like it can we make it so there is
a way for me to press a button to have the ai fix it if I want"*. Flagging an over-length
headline is right, and it still leaves him holding the pen at 8pm.

`FieldNotes` takes an optional `fix`, so any field that flags a length problem gets the
button for free. `fixLines(text, max, onApply, ctx)` builds it, or returns **null** when
there is nothing a rewrite could solve — no button appears next to *"Google needs at least 3
headlines"*, because a button that cannot help is worse than no button.

New `shorten` action on `ad-generator.mjs`, reusing the existing `systemFor` / `HONESTY` /
`VOICE` rules and the client's own brief, so a shortened headline still names their town and
their service instead of turning into filler.

Four guards, each of which is a way this could quietly do harm:

1. 🔴 **Only the lines actually over the limit are sent.** He wrote some of these himself and
   a "fix" that rewrites the ones already fine is a fix that loses his words.
2. 🔴 **A rewrite still over the limit is REFUSED, never trimmed.** Trimming here would
   reproduce the exact bug the button exists to fix. The prompt names the real failure in the
   words it happened in: *"Serving Eugene and Lane County" must not come back as "Serving
   Eugene and Lane"*.
3. **An unchanged line counts as a failure.** Handing back the same text reads as "the button
   does nothing".
4. 🔴 **Lines it could not shorten stay in the box.** `apply` takes a swap FUNCTION over the
   whole list rather than a replacement list, so a line the model failed on comes back
   through unchanged and in place instead of being dropped out of a headline set.

Dashes are stripped with the shared `stripDashes` (now exported) rather than a second copy,
because the em dash rule is a standing one and must not fork.

## Gotcha for the next session

`FieldNotes` (the amber renderer) is JSX and deliberately sits **outside** the helper block,
next to `AreaConditionsCard`. Two tests extract `const US_STATE =` … `function FieldNotes(`
and `eval` it; a component in the middle of that range breaks both. `verify-campaign-launch`
also had to be repointed when `toLocationLines` became `tidyField.locations` — same seeder,
same rule, so its cases were kept rather than rewritten.

`tidyField` is NOT called `fmt`: that name is already the date formatter at the top of the file.

## Tests

`tests/verify-field-formats.mjs`, 60 checks, extracting and RUNNING every formatter against
the exact text he typed. 18 mutations, all caught, including truncating headlines, accepting a rewrite that is still too long, dropping the lines the model could not fix, pairing
bare cities into a place that does not exist, and dropping the comma split from keywords.
