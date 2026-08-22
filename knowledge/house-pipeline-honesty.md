---
name: house-pipeline-honesty
topic: OS UI
task: fix the My Ads pipeline showing a wrong status, a step whose detail panel disagrees with its row, steps that make no sense on the house account, or the OS saying there is no landing page when one is live
keywords: [pipeline, work log, botWorkLog, invented narrative, fabricated log, on the record, what actually happened, to move this forward, bots, my ads, house account, says running but waiting, has not started yet, getBotLogs, work log, deriveBotStatuses, botsFor, HOUSE_HIDDEN_BOTS, intake, ceo director, client success, landing page not built, get-started, adLanding, HOUSE_LANDING_URL, ad health score landing page]
status: verified
summary: Three complaints in one message, all the same root shape. A step's detail panel printed "has not started yet" purely because `getBotLogs` had no canned entry, and 10 of 20 steps have none, including the four that go Running off real signals. Three pipeline steps only exist because there IS a client, so they can never move on BoldLine's own account. And the OS scored the house account as having no landing page while showing a card elsewhere saying that same page is live.
verified: 2026-08-22
---

## What he said

Bryson, 2026-08-22: *"For my own ads pipeline it's not working properly. Some things say
running but when I press on them they say they are waiting on the previous step and there are
some bots that just don't make sense to have there ad well. Another thing is the landing page
was made a while ago and is being used but the os is still telling me there isn't a landing
page that's been made."*

Three separate defects. All three are the same shape: **a screen reporting from a narrower
source than the one that holds the truth.**

## 🔴 1. The detail panel was not looking at the status at all

The Pipeline row derives its badge from things the OS can observe (`deriveBotStatuses`). The
detail panel behind it did something completely different: it rendered

> This bot has not started yet. It will begin when the previous step completes.

**whenever `getBotLogs` had no canned entry for that step** — regardless of the status the row
had just shown. `getBotLogs` covers **10 of the 20 steps**:

| | steps |
|---|---|
| has a work log | intake, ceo, research, avatar, offer, builder, copy, qc, budget, perf |
| **no work log** | funnel, architect, keywords, **ads**, **tracking**, automation, **terms**, **leads**, scaling, success |

The bolded four are precisely the ones that go Running or Complete off real signals (a live
campaign, a linked account, real spend, real leads). **So the steps most likely to be genuinely
live were the ones most likely to claim they had not begun.** Not a status bug at all — the
panel simply had no idea what the status was.

The panel now **leads with the same badge the row showed plus `bot.why`**, the derived reason
behind it, so the two cannot contradict each other again. Where there is no canned log it says
what it actually knows: either *"no automatic signal for this step, so its status is whatever
you set"* for the five hand-tracked steps, or *"no detailed log yet, the status above is read
from what the OS can see"*. The false sentence is gone.

Worth being clear about what was NOT changed: `getBotLogs` is **invented narrative** ("Research
complete: Buyer = homeowner triggered by storm damage…"). It was left alone rather than
extended, because the fix for a panel that says something untrue is not more fiction. If those
logs ever need to be real, they need real artifacts behind them.

## 2. Three steps only exist because there is a client

`intake` (Client Intake), `ceo` (CEO Director) and `success` (Client Success) are not "ad work
done for someone", they are the work of **having** a someone: taking a brief off a client,
assigning that brief across the pipeline, and reporting back to them. On BoldLine's own account
Bryson is all three parties, so each was guaranteed to sit at a meaningless status forever and
drag the completion percentage down with it.

`botsFor(cl, pkg)` hides exactly those three on the internal account, and `pipelineProgress`
filters the same set, so the percentage matches the rows on screen. **Everything that is real
work on his own ads stays**, including the five hand-tracked steps, which say so honestly.

## 🔴 3. The landing page: the OS contradicted itself on one screen versus another

`client.landingPage` means a page **the OS generated** and hosts at `/lp/<slug>`. BoldLine's
own ads have never used one. They point at **`/get-started` on the marketing site**, which is
written, live, taking traffic and booking calls.

The OS already knew this **in three places**: both launch cards hard-code that URL as the
default ad destination, and the Assets tab renders a card headed *"Your Ad Landing Page"* with
a green **Live** badge and the URL on it. Meanwhile the Overview tile said **"Not built"**, the
Ad Health Score docked a point for *"No landing page yet"*, and three pipeline steps
(architect, copy, builder) sat waiting.

`adLanding(cl)` is now the single answer, and every one of those screens reads it:

1. a **published generated page** always wins, including on the house account (if he ever
   builds one for his own ads, that is deliberately the newer decision),
2. otherwise, on the **internal** account, `/get-started` counts as published,
3. otherwise the generated page's real state (published / drafted / not built).

**A client can never inherit the house fallback** — their ads point at a page we generate for
them, and pretending otherwise would score every new client as finished before anything was
built. There is a test for exactly that.

The URL is now written out **once** in the whole file, as `HOUSE_LANDING_URL`. The launch
cards, the Preview link, the Copy button and the displayed text all read it, so the page his
ads point at and the page the OS scores cannot drift apart.

## Testing note

`tests/verify-house-pipeline.mjs` (43 checks) **slices the real functions out of `index.html`
and executes them** rather than re-implementing them — the lesson recorded in `repo-tests` and
learned the hard way on `verify-house-leads`. `index.html` has no module system, so extraction
is the closest honest equivalent to importing, and it means a change to the shipped code shows
up here. Nine deliberate breaks confirmed to fail, including both directions of the landing
fallback (removed from the house account; leaked to clients).

**One assertion in the first draft could not fail** — it compared a count to itself. Caught by
reading it back rather than by running it, which is the only way that kind of mistake surfaces.
It now asserts the URL appears exactly once and that the one occurrence is the constant.

## Follow-up, same session: the work logs are now real

Bryson, told plainly that the logs were invented and offered a rebuild: *"Yes do that."*

**What was there.** `getBotLogs` generated prose from the client's niche and presented it as
a report on completed work:

> Research complete: Buyer = homeowner triggered by storm damage | Differentiator: same day
> estimate | Negative category: DIY repair | No direct competitors currently leading with same
> day estimate

Nothing in that sentence was ever looked up. It covered 10 of 20 steps, which is what produced
the "has not started yet" bug above.

**What replaced it.** `botWorkLog(cl, pkg, botId)` reads the client record and returns four
parts, each answering a different question:

| part | what it is |
|---|---|
| `facts` | what is on the record right now, each ticked or not. A checklist, not a report. A missing value shows as **"Not set"**, never as an invented one. |
| `events` | real dated entries from the account's own `commLog`, filtered to this step by keyword, verbatim. Nothing when there is nothing. |
| `next` | the one thing that would move this step forward, derived from the **same rule that sets the status**, so the panel can never suggest a no-op. |
| `unobservable` | for the three steps the OS genuinely cannot see (avatar, funnel, scaling), one sentence saying so. Stated, not papered over. |

Every one of the 20 steps was run against a realistic record and confirmed to render
something. **Rendering nothing would have been the same failure wearing a different coat** —
the original bug was ten steps rendering a false sentence.

**Two design points worth keeping:**

- **Google-only steps check Google, not the combined totals.** Keyword Research and Search
  Term Analyst are Google Search concepts. On his Meta-only account, judging them on total
  clicks would report a problem that does not exist. They now say *"Keywords only apply to
  Google Search. Link a Google Ads account in Edit to run one."*
- **A ticked fact must have a value behind it.** There is a test that no fact is marked done
  while its value reads "Not set" / "None" / "No" — a green tick beside an empty value is
  exactly the class of lie this rebuild is about.

The Pipeline row's subtitle also changed: it used to print a line of that narrative (and only
for the 10 steps that had any). It now shows `bot.why`, the derived reason behind its own
badge.

**76 checks (was 43), seven more deliberate breaks confirmed to fail** — an invented number, a
tick with nothing behind it, a canned event line, a no-op suggestion, and three wiring breaks.

**🔴 The comment trap bit for the THIRD time in this repo.** The check that the invented
phrases are gone matched **my own comment explaining which phrases were removed**. Comments are
now stripped before that assertion, as several other suites already do. Recorded again in
`repo-tests` because it keeps recurring: *any* assertion that some text is absent must run
against comment-stripped source.
