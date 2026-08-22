---
name: market-research
topic: Ads
task: run or change the automated competitor research, or work out where the ad differentiator and competitor list come from
keywords: [market research, competitors, differentiator, brandVoice, market-research-background, market-research-shared, MarketResearchCard, placesSearch, inspectAdTech, running ads, common claims, gaps, proposal, needsConfirmation, basis, record observed gap]
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
