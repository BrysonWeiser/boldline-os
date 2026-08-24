---
name: market-research
topic: Ads
task: run or change the automated competitor research, or work out where the ad differentiator and competitor list come from
keywords: [market research, no place to add in edit, campaign details, service area field missing, setIn, brandVoice edit, TONES, dead input, total leads generated box, national search, researchAreas, sellsNationally, NATIONAL_MARKETS, splitAreas, only searched gilbert, competitors anywhere, competitors, differentiator, brandVoice, market-research-background, market-research-shared, MarketResearchCard, placesSearch, inspectAdTech, running ads, common claims, gaps, proposal, needsConfirmation, basis, record observed gap]
status: built
summary: Market Research went from a hand-tracked step with no artifact to an automated one. It finds real competitors through Google Places, reads their sites to see who is actually buying ads, researches positioning with web search, and proposes up to four differentiators. It PROPOSES only, never writes brandVoice, and any proposal without evidence is dropped rather than shown with a caveat.
verified: 2026-08-22
---

## What he asked for

Bryson, 2026-08-22: *"Can you automate that so that way the bots research my own
competitors (same thing for clients for the future) and then also ads what makes me
different"*, after being shown that Market Research and Offer Creation were sitting on
empty fields.

**Half of it already worked.** `brandVoice.competitors` and `brandVoice.differentiator`
are read by `brief()` in `ad-gen-shared` (so every Google and Meta ad), by
`generate-landing`, and by the rendered landing page. They were simply always empty,
because filling them was a job nobody had automated.

## What it does

`market-research-background.mjs`, a Netlify background function (202 immediately, up to
15 minutes), with **three sources, two of them measured**:

1. **Google Places** — real businesses in the niche and area, with real ratings and review
   counts. Needs `GOOGLE_PLACES_API_KEY`. Without it the step is skipped **and said to be
   skipped** on the card, never quietly dropped.
2. **Their own websites** — `inspectAdTech` reads each competitor's homepage for Google and
   Meta ad tags. **A competitor already buying ads is bidding against you today**, which is
   the single most useful fact in the report, and it ranks them.
3. **Claude with web search** — what they claim, what reviews say, how they price.

Output lands on the client record at `data.marketResearch`. No new table, so no migration
to forget (the mistake that made Lead Scout hang silently), and the OS's existing live
refresh fills the card in with no polling endpoint.

## 🔴 The invariant: it proposes, it never writes

A differentiator is a **promise made in public, in a paid ad, with money behind it**. A
model asked "what makes them different" will happily answer "24 hour emergency response"
for a business that offers no such thing, and it will sound completely reasonable. That is
not a copy problem. It is a business making a promise it cannot keep, to customers.

So the gates in `market-research-shared.mjs` are **mechanical, not prompt text**:

- **Every proposal must carry evidence.** One with none is **dropped entirely**, not shown
  with a warning beside it. A warning next to a good-sounding line is not a defence: the
  line still gets read, remembered and used.
- **Every proposal names its basis**, and the basis decides whether it can be trusted:
  `record` (traceable to what the business itself stated) needs no confirming; `observed`
  and `gap` do. An unrecognised basis is forced to `gap`. **The valuable kind and the
  dangerous kind are the same kind** — a gap is an opening nobody has verified this
  business can fill.
- **Nothing writes `brandVoice`.** The card shows the evidence and waits for a click. The
  background function does not contain the string `brandVoice` at all, and there is a test
  for that.

The prompt asks for the same things, plus an explicit list of the traps (same day service,
24 hour response, lifetime warranties, free anything, price guarantees, years in business,
certifications, crew size) and the instruction that **a short true report is worth more
than a long invented one**.

## Wiring

- The card renders on the Campaigns tab for **the house account and clients alike**.
- `research` came **off** `MANUAL_BOTS` — the first of the five hand-tracked steps to earn
  its way out by gaining a real artifact.
- 🔴 The step reads **done only when the research has been USED**, meaning both fields are
  set. A finished report nobody acted on has changed nothing about the ads, so calling it
  done would be the same false progress as the invented work logs.
- An unreadable competitor site records `runningAds: null` and shows as unknown, never as
  "no ads". Only a definite yes counts as yes.
- **No service area means it refuses to run** and says why. Searching the wrong city
  returns real businesses that are the wrong competitors, and every conclusion drawn from
  them is wrong.

71 checks in `verify-market-research.mjs`, running the real gate. Guards broken and
confirmed to fail: unevidenced claims allowed through, everything trusted without
confirming, and a business becoming its own competitor.

## Follow-up: one city is not always the market

Bryson, minutes after it shipped: *"when researching competitors don't just search only in
Gilbert search in other places as well because marketing agencies can be anywhere"*.

He was right, and the first version was wrong in a way that mattered. **A roofer's
competitors are the roofers a customer could actually call**, so one metro genuinely is
the whole market. **BoldLine works with businesses remotely and nationally**, so its
competitors are every agency a business owner could hire, wherever they sit. Searching one
suburb returned a handful of small shops and called that the competition.

`sellsNationally(cl)` is **derived, not hardcoded to the house account**, because the same
is true of any client who sells remotely and of every e-commerce brand, whose buyer does
not care where they are:

- the internal account, always;
- a service area or target list saying nationwide / nationally / United States / anywhere
  / remote / worldwide;
- an e-commerce, online store, subscription box or DTC niche.

A national account searches its **own area first** (that is where it bumps into people
most) plus six metros where agencies cluster. A local one searches its own area plus the
places it actually serves, and **must not** be padded out with national metros, or every
conclusion about its market would be wrong. There are tests for both directions.

The prompt says which case it is. Without that, a model treats the searched markets as a
boundary and reports "these six cities" as the whole picture, when the most relevant
competitor may operate entirely online with no office anywhere near.

Lookups run in parallel and every market's results are **pooled before ranking**, so the
strongest competitors win on merit rather than on which city was searched first.

### 🔴 Splitting a service area is a solved problem here and I resolved it wrong first

The naive comma split turned `"Mesa, Arizona, Tempe, Arizona"` into **four** entries and
would have searched for competitors in a place called "Arizona". `toLocationLines` in
`index.html` hit exactly this and its comment records the fix: only pair two chunks when
the **second** one actually looks like a state, or a bare list of cities silently becomes
"Phoenix, Mesa", a place nobody meant. `splitAreas` applies the same rule and both
known-bad inputs are pinned by test.

**98 checks now.** Three more deliberate breaks confirmed to fail: a national search
collapsing to one city, a local business being given national metros, and the naive comma
split coming back.

## Follow-up: the card enforced a rule the server does not have, and pointed at a field that did not exist

Bryson, on a card reading "Set a service area in Edit first": *"This doesn't make sense also
there isn't a place to add that in edit"*. Both halves were true, and there was a third
problem in the same screen.

**1. The card kept its own copy of "can this run".** It required a service area, which
directly contradicted the change made minutes earlier: BoldLine sells nationally, so the job
searches six metros with **no service area at all**. The button is no longer gated here. The
server is the only authority on whether there is anywhere to look; it writes a plain reason
when there is not, and the card renders it. **One rule, in one place** — the same lesson as
the leads mirror and the landing page.

**2. 🔴 THE FIELD GENUINELY DID NOT EXIST.** Every `campaignSetup` field — service area, main
offer, average job value, target locations, exclusions, lead destination, CRM — and all of
`brandVoice` lived **only on the client portal**, the page a CLIENT fills in. The house
account has no portal. So on his own account there was no way to set any of them, and the
OS had been telling him to for a while: the pipeline's Market Research step said "Add
competitors and a differentiator in Edit", and Edit had no such field.

Edit → Campaign now has **Campaign Details** and **Brand Voice** cards writing the real
nested groups through a new `setIn(group, key, value)`. `TONES` was hoisted to module scope
so the portal and the OS cannot offer different lists.

**3. Two dead controls, removed.** "Total Leads Generated" and "Average CPL ($)" were
editable number boxes in that same section. Both values are now **computed** from the lead
log and live ad spend (KB `live-stats`), so typing in them changed nothing on any screen. A
control that looks like it sets something and does not is worse than no control. The section
now says plainly that both are worked out from real leads and real spend.

**123 checks.** Five more deliberate breaks confirmed to fail. **One did not bite on the
first attempt** and had to be tightened: asserting `setIn("brandVoice"` appeared anywhere
matched the tone select's own call while both text inputs were broken, so it now names the
keyed write the inputs actually use.
