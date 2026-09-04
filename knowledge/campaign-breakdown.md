---
name: campaign-breakdown
topic: Ads/Campaigns
task: see one campaign's own numbers, or work out why a new campaign appears to do nothing
keywords: [my ads, live ad performance, per campaign stats, campaign breakdown, adPerf list, liveList, paused campaign invisible, campaign not doing anything, new campaign nothing, totals not one campaign, ads-sync, trimCampaign, CAMPAIGN_LIST_CAP, running paused pill, approve campaign, ENABLED ACTIVE]
status: built
summary: My Ads showed account-wide TOTALS that looked like one campaign's numbers while there was only one, and silently became a blend once there were two. Worse, the snapshot kept only live campaigns, so a campaign created PAUSED (which is every campaign the OS builds) appeared nowhere at all. Now every campaign gets its own row, paused ones included, saying in words why their numbers are zero. 14 checks, ten mutations caught.
verified: 2026-09-04
---

## The two questions that were one bug

Bryson, 2026-09-04, back to back:

> *"Why is the new campaign that I made not doing anything?"*
> *"when I press my ads it only shows one ads statistics and I can't change it"*

### 🔴 Why it was invisible

**The Live Ad Performance card renders `adPerf.totals`, which is the whole account added
together.** With one campaign that is indistinguishable from that campaign's own numbers, so
nobody ever noticed. Build a second and the figures quietly become a blend of the two, with
nothing on screen saying so and no way to look at either one.

**And the snapshot kept only `liveList`.** A campaign created PAUSED appeared **nowhere** —
not as paused, not as zeros, nowhere. Since **every campaign the OS builds starts paused on
purpose** (nothing spends before Bryson approves it), the newest campaign was invisible on the
one screen he checks, while the totals above it had not moved. That reads exactly like a
broken campaign rather than one waiting on a press.

🔴 **THE TRANSFERABLE LESSON: a screen that is correct with ONE of something, and wrong with
TWO, will ship.** There was nothing to see until the day there were two.

## What it does now

`ads-sync` stores `google.list` and `meta.list` — **every** campaign the platform returns
(REMOVED excluded), trimmed to the fields a row needs, live first then by spend, capped at 50
because this sits on the client record that every screen reads.

My Ads gains a **By campaign** section under the totals, with the line *"The figures above are
every campaign added together. These are each one on its own."* Each row carries the platform,
the name, a green **Running** or amber **Paused** pill, and either its own views, clicks,
spend, conversions and daily budget, or, when paused:

> Not running, so it has not been seen by anyone and has spent nothing. Approve it on the
> Campaigns screen to set it live.

## Details that matter

- 🔴 **`live` is computed in the sync, not on screen.** Google says `ENABLED`, Meta says
  `ACTIVE`. Making the UI re-derive that from two vocabularies is how one platform ends up
  permanently mislabelled, which already happened once on the campaign detail panel.
- 🔴 **Google reports `cost`/`conversions`, Meta reports `spend`/`leads`.** Both are normalised
  to `spend`/`conversions` in `trimCampaign`, so the row is one template. A Google-shaped read
  would show every Meta campaign as zero.
- **The row still calls them what they are on screen**: "leads" on Meta, "conversions" on
  Google. Normalising the storage is right; normalising the label would be a lie.
- **`(g.list||[])`** — every client record in production predates this field, so without the
  fallback the screen crashes for all of them.
- **Empty is not broken**: "No campaigns in the ad account yet" shows only when there are also
  no read errors, or a failed sync would masquerade as an empty account.
- `liveList` is kept as well: the scale check uses it to name the one campaign a budget change
  would land on.

## The answer to "why is it not doing anything"

Almost always: **it is paused, waiting to be approved.** That is by design, and it is now said
out loud on the row instead of being inferred from an unchanged total.

---

## 2026-09-04, same day — pressing a campaign drives the big tiles

Bryson: *"I want when I press a campaign for my internal campaign I want the one I press the
have the numbers come up to the big section of analytics instead of the small numbers on each
campaign"*.

Each row is now a button. Pressing it puts **that campaign's** views, clicks, spend,
conversions and cost per lead into the five big tiles; pressing it again, or **Show all**,
returns to the account total. The header always names what is on screen: *"Showing every
campaign added together"* or *"Showing <campaign>"*.

### 🔴 The card had to become a real component first

It was an inline arrow inside `ClientHub`, called from a `&&`. **A hook cannot live there** —
the day the condition flips, the hook order changes and React tears the screen down. Hence
`LiveAdPerformanceCard`, with `focus` as real state.

### 🔴 THE FAKE COST PER LEAD, which is the trap worth remembering

The account tiles read leads from **`leadsLog`**, every enquiry the business received from
anywhere. **A single campaign has no such number.** Showing the account's lead count beside one
campaign's spend produces a cost per lead that is **pure fiction and looks entirely
plausible**, which is the worst kind of wrong number.

So a focused campaign reports the **platform's own conversion count**, and the tile is
**relabelled** — "Conversions (counted by Google)" or "Leads (counted by Meta)" — rather than
quietly changing what the word "Leads" means. Two checks pin this and both mutations were
caught.

Account-wide notes ("No leads yet, and the lead check is running normally") are hidden while a
campaign is focused, because beside one campaign they answer a question nobody asked.

### The answer to "only the old one shows numbers"

Nothing is broken. `ads-sync` runs **hourly** and both platforms are queried over the **last 30
days**, so a campaign that went live an hour ago genuinely has almost nothing. The card now
says so instead of showing five bare zeros: *"Running, but nobody has seen it yet. A brand new
campaign usually takes a few hours to start showing, and these figures refresh once an hour."*

### Testing note

22 checks, ten mutations all caught, plus a real-browser run that presses a campaign and
confirms the top tile shows **that campaign's** 4,360 views rather than the account's 5,260.

🔴 One mutation escaped first: `/Show all/` passed with the button behind `false&&`, because
the string was still in the file. **Checking a line EXISTS is not checking it is SHOWN** —
re-pinned on the render gate.

🔴 And two existing checks broke because they pinned the card's inline arrow rather than the
rule. `verify-house-leads` reported "clients lost the card" when the card had merely been
extracted into a component. **A pattern that pins a signature pins more than it means to.**

