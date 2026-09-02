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

## ➕ 2026-09-02 — The OS was sending him to tabs that do not exist

**Bryson:** *"there isn't an assets tab can you add it"*. There was, and it held exactly what he wanted: the media library, the landing page with Publish and Regenerate, the approvals queue and a portal preview.

- 🔴 **The tab was only LABELLED "Assets" on the house account.** On a client record the same tab read **"Client View"**, which names only the first card on it. One line did it: the `.map` after `TABS` renamed `portal` to "Assets" and `package` to "Campaigns" **only when `client.internal`**.
- **That made the product wrong out loud, not just untidy.** SEVEN separate pieces of the OS's own guidance say *"on the Assets tab"* (launch checklist, autobuild alerts, pipeline next-steps), so on every client record the OS was giving directions to a tab that did not exist under that name. It had been doing that for months with nothing noticing.
- **Fix: `portal` is labelled "Assets" on every account.** `package` keeps its house-account-only rename. Now every existing instruction is true.
- 🔴 **THE NEW GUARD CAUGHT A SECOND INSTANCE OF THE SAME BUG ON ITS FIRST RUN.** Four pieces of guidance said *"on the Campaigns tab"* and **Campaigns is not a tab at all** — it is a top-level screen reached from More. All of them now say "on the Campaigns screen (More, then Campaigns)".
- **Enforced in `verify-app-boots.mjs`:** it extracts every *"on the X tab"* instruction across index.html, `autobuild-decide`, `launch-checklist` and `client-autobuild`, and asserts each names a real tab. It also pins the Assets label to those instructions so the two can only move together, and asserts the label does NOT depend on `client.internal`, which is exactly how it broke. Comments are stripped first so prose about the rule cannot be mistaken for the rule.
- 🔴 **The effective label set is the TABS literal PLUS whatever the `.map` reassigns.** Reading only the array literal reports "Assets" as missing while it is sitting on screen, which is a false failure that would get the guard deleted.
- Broken both ways to check: reverting the label to per-account, and pointing an instruction at a tab that does not exist. Both caught.
- **Same family as the two checklist bugs fixed the same day.** The pattern across all three: a second place restating something the OS already knows, drifting from it silently, and only a person noticing.

## ➕ 2026-09-02 (later) — A checklist step doing two people's jobs

**Bryson**, on the launch checklist: *"some of the stuff that says for me to do is already done or doesn't make sense. Like the cost per lead is 50 which is in the contract so that's done but he needs to connect his card still."*

- **"Billing set up" was ONE step covering TWO jobs owned by TWO different people.** Setting the monthly minimum and the per-lead rate is Bryson's and takes a minute. Putting a card on file is the client's and is a chase. The step was owned by `"you"` and ticked off a Stripe id, so it sat unticked telling him to go and do something when the only outstanding half was not his to do.
- 🔴 **A checklist that hands him a job that is not his is worse than no checklist:** it is a to-do he cannot clear, sitting above the ones he can, and it drags the completion percentage down for a reason he cannot act on.
- **Split by OWNER**, which is what the file is already organised around:
  - `rates` (owner **you**) — done when `billingMonthly != null && billingPerLead != null`
  - `card` (owner **client**) — done when `stripeSubscriptionId` exists
- 🔴 **Subscription, NOT customer.** The old check was `stripeSubscriptionId || stripeCustomerId`. A Stripe CUSTOMER exists the moment a record is created and proves nothing about a card, so the old test could tick "billing set up" while there was still no way to charge them.
- The card step now lands in `waitingOnThem`, so the banner chases it instead of the OS nagging him about it.
- **Both copies changed together** (`index.html` + `netlify/lib/launch-checklist.mjs`); `verify-trade-playbooks` compares them step by step. 🔴 That equivalence check only proves something about a field IF THE FIELD IS IN ITS VARY LIST — a note already in that file from a previous near-miss — so `stripeSubscriptionId`, `billingMonthly` and `billingPerLead` were added there in the same change. Confirmed by desyncing the copies and watching it fail.
- Required steps went from 10 to 11. Fixtures updated rather than the percentage assertion being loosened.
