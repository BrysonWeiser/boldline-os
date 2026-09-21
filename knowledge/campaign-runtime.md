---
name: campaign-runtime
topic: OS app
task: show when a campaign started and how long it has been running, on BoldLine's own ads and on a client's
keywords: [campaign start date, how long running, run length, ads running for, campaign age, first spend, foldFirstSpend, runtimeLabel, accountRuntime, campaign-runtime, start_date, start_time, adPerf runtime, live ad performance card]
status: verified
summary: The Live Ad Performance card now says when the ads started and how many days they have been running, at account level and per campaign, on the house account and every client. 🔴 It does NOT use the platforms' own start dates. Google's `campaign.start_date` and Meta's `start_time` say when a campaign was ALLOWED to start, and every campaign the OS builds is created paused, so that date makes a two-day-old campaign look weeks old. The date shown is the day `ads-sync` first saw the campaign SPENDING, and a day count is printed ONLY when the sync watched it cross from not-spending to spending. Anything already running when the OS started watching says when it was first seen and never claims an age. Built 2026-09-21. 71 checks, 10 mutations caught.
verified: 2026-09-21
---

## Why the obvious answer is the wrong one

Bryson, 2026-09-21: *"in the os with the ads can we also add when they started and how long they
have been running for not only for my ads but also clients ads"*.

Both platforms hand us a start date. **Neither is when the campaign ran.** It is when the campaign
was configured to be allowed to start, and **every campaign the OS builds is created PAUSED** and
switched on later, sometimes weeks later. So the platform date is routinely wrong in the one
direction that matters: it makes a campaign look older than it is.

That number would be read as *"this has had three weeks to work"* on a campaign that has had two
days, and the ads judged on it. It would go into a client report. The same question was already
settled for contract start dates in `campaign-live.mjs`: **spend is the proof**, because money
leaving the account is recorded by Google and Meta rather than by us, and it cannot happen without
the campaign actually serving.

## 🔴 The second trap, which is worse

The day this shipped, every campaign already running had been running a while. **Stamping "today"
the first time the sync sees one spending would say a three-month-old campaign is one day old**,
confidently, on the screen used to judge whether the money is working.

So an age is **earned, not assumed**:

| What the sync saw | What is shown |
|---|---|
| Campaign seen with no spend, then seen spending | `Running 15 days, since Sep 7, 2026` |
| Campaign already spending the first time we saw it | `Running, first seen spending Sep 10, 2026, set to start Jun 1, 2026` — **never a day count** |
| Never spent, configured start in the future | `Set to start Oct 1, 2026` |
| Never spent, configured start in the past | `Has not spent yet, was set to start Aug 1, 2026` |
| Nothing at all | `Has not spent yet` |

At account level an **exact stamp always beats an older inexact one**, however much older the
inexact one looks, because a run length must never be derived from a date we only know we noticed.

## How it works

- `netlify/lib/campaign-runtime.mjs` is the definition. `foldFirstSpend` merges each sync run onto
  what was already known: a stamp is never overwritten, a paused campaign keeps the date it
  earned, and a campaign missing from a run keeps its entry. Capped at 200, pruned oldest-seen
  first, because the map lives on the client record and is read on every load.
- `ads-sync` folds it every run and stores it at `adPerf.runtime`. 🔴 It must start from
  `cl.adPerf.runtime`, not `{}`, or every campaign is re-stamped as new on every pass.
- Both fetchers now request the configured start (`campaign.start_date`, `start_time`) and it is
  carried through `trimCampaign`. It is a SECOND fact beside the observed date, never an age.
- `index.html` carries a mirror of the label rules, because it cannot import. A test evaluates
  both and compares them on seven cases.

## 🔴 The bug the tests did not catch

The card carries **two keys for the same campaign**: a focus key `platform-id` that decides which
row is selected, and the runtime key `platform:id` that the library writes the map with. The
campaign rows reused the focus key to look the map up, matched nothing, and **every row read "Has
not spent yet"** including campaigns running for weeks.

Every test was green, because the library was right and the mirror was right and **the join
between them was wrong**. Found by driving the OS in a browser with campaigns in all three states.
Now pinned: both sides build the key through one builder, the screen is checked to actually use
it, and the two key shapes are asserted to stay visibly different so the bug cannot start working
by accident.

## Testing notes

`tests/verify-campaign-runtime.mjs`, 71 checks. **10 mutations, all caught**, including: using the
platform's configured start as the age, treating a mid-flight catch as exact, overwriting a stamp
on a later run, letting the older inexact date win at account level, the sync starting from an
empty map, the OS mirror drifting, and the key bug above restored. Verified in a browser at
390/768/1280/1600 with one campaign of each kind.
