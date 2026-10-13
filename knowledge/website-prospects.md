---
name: website-prospects
topic: OS app
task: find businesses that need a website (no site, broken site, weak site), label prospects as ads / website / both, or filter Outreach by what is being sold
keywords: [website prospects, needs a website, no website, bad website, weak website, outdated website, website leads, website mode, what are you selling, selling them, pitch, ads or website, both, website check, site check, free website check, site-check, checkWebsite, analyzeSite, siteNeed, website need, not built for phones, no padlock, old copyright, parked domain, pitch filter, outreach filter, categorize prospects, hand-off package affordability, Infinity capacity]
status: verified
summary: Built 2026-10-12. Lead Scout now asks "What are you selling?" (Ads or A website). Website mode reads every business's homepage for FREE first (no AI, no key), drops the ones whose site already does the job before any research is paid for, and researches the rest worst-site-first. Each prospect is labelled Ads / Website / Both (stored in `data.pitch`, no database change; unlabelled = ads), and Outreach has a "Selling: Everything / Ads / Websites" filter with counts plus a one-tap label on each company. Website problems are only things anyone can check (no mobile layout, no padlock, footer stuck in an old year, free builder address, parked/dead domain) and a timeout, a block, or an address only the research found is NEVER called "down". Also fixed: the ads affordability math had been treating the one-time Launch & Hand Off as a $0/mo way in since early October, so every business looked affordable.
verified: 2026-10-12
---

## The ask

Bryson, 2026-10-12: *"For the lead scout section I want to make a category for companies that need websites
and or need better websites and then I also want to be able to categorize them in outreach if I want to"*.

## What he sees

- **Lead Scout → New search**: a first question, **What are you selling?** with two tiles, *Ads* and *A website*.
  Website mode hides the ads-mode "Website" filter (it is the whole point) and the button reads
  "Find website prospects".
- **Each prospect card**: a label pill (*Ads lead / Website lead / Ads + website lead*), a website pill
  (*No website / Website down / Website needs work / Website OK*), and a **Website check** box listing exactly
  what was found. In website mode the score's "Opportunity gap" becomes **Website need**, and Best package says
  *Standard website · $1,500* or *Signature website · $3,500*.
- **My call list**: a **Selling** filter (Everything / Ads / Websites). The free re-check button is now
  **Re-check websites, ads + Instagram** and backfills the website check onto the whole existing list.
- **Outreach**: a **Selling** chip row (Everything / Ads / Websites, each with how many are due), and on each
  company a **Selling them: Ads · Website · Both** control. Website leads open their pain points on the website
  ("Their website isn't built for phones and still says © 2017 in the footer."), the facts block says what the
  check saw, and the message writer pitches a website instead of ads. The add-by-hand form can label too.

## How it works

| Piece | File |
|---|---|
| The free check | `netlify/lib/site-check.mjs`: `checkWebsite` (fetch) + `analyzeSite` (pure) + `siteNeed` (score factor) + `siteRank` |
| The label | `netlify/lib/pitch.mjs` (`pitchOf`, `matchesPitch`, `pitchCounts`); mirrored in index.html as `outPitchOf` / `outMatchesPitch` |
| Website mode | `lead-scout-background.mjs` (`pitch` in the POST body), prompts in `scout-shared.mjs` (`WEBSITE_HUNT`, `enrichWebsiteSystem`) |
| Can they pay for a website | `scout-scoring.mjs` `websiteAffordability`: months of marketing budget the $1,500 build takes. ≤1.2 comfortable, ≤2 workable, ≤3 tight (cap 55), ≤5 stretch (cap 30), more = cannot (cap 15). A 1-person handyman is "workable" for a website but capped for ads, which is the point |
| Outreach | `outreach.mjs` `?action=queue&pitch=` (filters AFTER the due rules, returns `counts`), `?action=pitch&id=` (POST {pitch}) |

**Website mode order of work** (in `doRun`): Places + AI discovery → dedupe/area filter → **check up to
max(20, 3×count) websites, 8 at a time** → drop `ok` → if too few, run AI discovery again asking for
businesses without a decent site → sort none, broken, weak (most problems first), unknown → trim to count →
the paid research. The run message says how many were skipped for free.

**Ads mode** also gets the check (free), riding along with the provider lookups, so "website: dated" becomes
the specific things Bryson can see for himself.

## 🔴 The rules that keep it safe to say out loud

1. **Never a negative from missing evidence.** A timeout, a 403/429 block or a connection hiccup is
   `unknown` with the reason, never `broken`. Only a Google listing's OWN link is trusted: a DNS failure on an
   address the research came up with is `unknown` ("may be the wrong address"), because telling an owner
   "your website is down" when it is fine ends the call.
2. **Content checks need content.** "No tap-to-call button" and "no quote form" are only judged when the page
   arrived with 60+ words in it. A site that builds itself in the browser comes back as an empty shell, and
   accusing a shell of missing buttons would be false. Head-of-page checks (viewport, description) still run.
3. **The homepage, not the deep link.** A listing that links `/locations/mesa` is read at `/`, so a dead deep
   link never reads as a dead site.
4. **The words are stored with the result** (`label` for lists, `says` to finish "Their website ..."), so the
   Lead Scout card, the Outreach card, Deal Prep and the message writer all say the same thing.
5. **A website the research found but the listing never linked** is checked too (adds "Their Google listing
   doesn't link to it"), and anything that check calls broken is ignored, because the address may be wrong.
6. **The word "none" never travels as an address.** The AI's "website: none" is kept as `saidNone`, because a
   literal "none" in `website` would have been handed to the paid Google ad-record lookup.
7. A site that passes caps the website-mode score at **40**, so it can never sit at the top of a website list.
8. The bulk re-check runs **8 websites per request** and the screen loops, because a normal function gets
   about ten seconds; a later "couldn't read it" never wipes an earlier real reading.

## 🔴 Bug found and fixed on the way: the ads money math

Since the one-time **Launch & Hand Off** (`h-handoff`, $0/mo, adSpend "Any budget") was added in early
October, `entryPackageFor` picked it as the cheapest way in. Entry cost became $0/mo, every business came
out "comfortable", **the affordability cap never applied**, and cards read "Infinity× their capacity".
The math now only considers managed packages (`pricingModel !== "one_time"`), so entry is back to
$400 + $500 ad spend = $900/mo. Prospects saved in that window keep the score they were given; new searches
rank correctly.

## Tests

`tests/verify-website-prospects.mjs` (118 checks): runs the check against fake websites (timeouts, 403s, DNS,
expired certificates, http-only, forwards to Facebook, Wix addresses, www-only hosts), the scoring and caps,
the prompts, the engine's order of work, both copies of the pain points and labels by execution, the screens
and the message writer. **19 of 19 deliberate breakages caught.** Driven in a browser at 390/768/1280/1600:
the tiles, the call list filter (sends `pitch=website`, hides ads-only), the Outreach chips with counts, the
filter (sends `pitch=website`, shows 3 of 4), the one-tap label (posts `p1:both`), no sideways scroll, no
console errors. Gotcha again: uppercase labels come back from `innerText` in capitals, so match them
case-insensitively.

## Live status

Merged to main as `5de1156` on Mon 2026-10-12 about 9:45pm Phoenix. **Not live yet at 9:46pm**: the live OS
still serves the build from before the website contract update (WA-7), so Netlify has not deployed anything
since. Same stuck deploy as KB `website-builder`. Added to the 10pm reminder (`trig_01JgEpuMMMZW7KgBEd4uNW59`).
Live check: `curl -s https://os.boldlinemedia.com/ | grep -c "What are you selling"` (0 = not live).
✅ **LIVE at 10:01pm Phoenix** (the check returned 1), and the WA-7 contract update went out with it.
