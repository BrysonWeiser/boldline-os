---
name: meta-traffic-objective
topic: Ads
task: work out why a Meta campaign gets clicks but no leads, or change what a Meta campaign optimises for
keywords: [campaign goal, goal picker, leads or clicks, choose objective, GoalPicker, CAMPAIGN_GOALS, resolveGoal, campaign-goals.mjs, bidding strategy, maximizeConversions, targetSpend, manualCpc, maximize clicks, meta no leads, clicks but no leads, zero leads, 0 leads, OUTCOME_TRAFFIC, OUTCOME_LEADS, LANDING_PAGE_VIEWS, optimization_goal, promoted_object, meta objective, why no conversions, cheap clicks, high ctr no leads, meta pixel, fbq Lead, house account ads, my ads]
status: confirmed
summary: Every Meta campaign the OS builds is set to OUTCOME_TRAFFIC with optimization_goal LANDING_PAGE_VIEWS and no promoted_object, so Meta is told to buy the cheapest page views rather than leads. That is the likely cause of BoldLine's own house ad getting 6,997 views and 171 clicks at $0.51 for $87 with ZERO leads. The code's own comment says to switch to a leads objective "once the client's pixel + lead events exist" — on BoldLine's own site they now DO exist, and nothing revisits the decision. Not yet changed: a live campaign's objective cannot be edited, it needs a NEW campaign, and that spends money, so it is Bryson's call.
verified: 2026-09-02
---

## The numbers that started it

Bryson, 2026-09-02, on the house account's Live Ad Performance card: *"we need to look at the meta ad we are currently running and figure out why i am not getting any leads."*

| | |
|---|---|
| Views | 6,997 |
| Clicks | 171 (2.4% CTR) |
| Spent | $87 ($0.51 a click) |
| Leads | **0** |

## What was ruled OUT, by checking rather than assuming

- **The form works.** `POST /` with `form-name=get-started` returns **200**; a made-up form name returns **404**. So Netlify Forms has the form registered and is accepting submissions. Probed with the honeypot field filled so nothing was recorded.
- 🔴 **A red herring that looks damning:** the served page has NO `data-netlify="true"`, while the source does. Netlify's HTML post-processing strips it AFTER form detection (it also re-quotes and reorders the attributes). **Missing `data-netlify` on the served page is normal and is not evidence of a broken form.** The 404-vs-200 probe is what settles it.
- The Meta pixel IS on the page and DOES fire `fbq('track','Lead')` on submit.

## The cause

`netlify/functions/meta-ads.mjs` builds EVERY Meta campaign as:

- `objective: "OUTCOME_TRAFFIC"`
- `optimization_goal: "LANDING_PAGE_VIEWS"`
- no `promoted_object`

So Meta is told **"find people who will load this page"**, not "find people who will fill in the form". It then does that job well and cheaply, which selects for idle scrollers. **A high CTR with a low CPC and zero conversions is the textbook signature of a traffic-objective campaign**, not of a broken funnel.

The code comment at the objective says the reasoning and names its own expiry:

> OUTCOME_TRAFFIC ... is the correct, pixel-free objective. (OUTCOME_LEADS ... needs a pixel/promoted_object and gets rejected; **switch to OUTCOME_SALES/LEADS + a promoted_object later, once the client's pixel + lead events exist.**)

That condition is now met on BoldLine's own site. Nothing revisits the decision, so the house account is still buying page views.

## Not changed yet, and why

**A live Meta campaign's objective cannot be edited** — it requires creating a NEW campaign, which spends money. So this is a recommendation, not something to do unasked. What it needs when done: `OUTCOME_LEADS`, `optimization_goal: "OFFSITE_CONVERSIONS"`, and a `promoted_object` of `{pixel_id, custom_event_type: "LEAD"}`.

🔴 **It cannot become the default for CLIENTS until each client has a pixel and a firing Lead event**, which is exactly what the original comment says. A client without one would have the campaign rejected at creation. So the change is per-account, gated on the pixel existing, not a blanket switch.

## CONFIRMED 2026-09-02 — every other explanation eliminated

Bryson checked Netlify Forms (on the MARKETING site; 🔴 I first sent him to the OS site, which has no forms at all and offers a misleading "Enable form detection" button — **Forms lives on the site serving boldlinemedia.com, not `os.boldlinemedia.com`**).

| Form | Verified | Spam | Last |
|---|---|---|---|
| **`get-started`** (where the ad points) | **2, both old** | **NONE** | Aug 24 |
| `contact` (homepage wizard, NOT ad traffic) | 9, all his own tests | 12, all obvious bots | 2:12 AM |

**The four things that had to be ruled out, and how each died:**
1. *Form broken* — no. `POST /` with `form-name=get-started` returns **200**, a made-up name returns **404**.
2. *Pipeline broken* — no. He SAW the test entries in the OS Leads tab and deleted them, so submissions do travel Netlify -> `website_leads` -> OS.
3. *Leads hidden in spam* — no. **`get-started` has ZERO spam submissions.**
4. *Honeypot eating real people* — no. Every spam entry is unmistakable bot junk (the same "Hi, I wanted to know your price" template in Bulgarian, Bengali, Afrikaans, Hawaiian and Igbo, plus SEO and backlink pitches). **The spam filter is working correctly.**

So: **171 clicks in 30 days produced zero submissions of any kind on the page the ad points at.** Nothing is broken. The campaign is buying page views and getting them.

🔴 **Change ONE thing.** The objective is the primary fix. The page converting 0 of 171 is not separately damning while the traffic is low-intent by construction — changing the objective and the page at once would leave no way to tell which mattered.

## ✅ 2026-09-02 — BUILT. The objective is now a per-client choice, and the pixel is the switch.

**Bryson asked the right question first:** *"would going for leads still be good especially because the original purpose of this campaign was to send to meta?"* The campaign exists to earn Meta's Marketing API tier, not to sell. 🔴 **Checking the rejection settled it: chasing leads SERVES that purpose rather than fighting it.** The plan of 2026-08-28 says the reviewer wanted live impressions, clicks, reach, spend **and conversions**, and that *"one column is still empty, and it is the one the reviewer named: CONVERSIONS"* — which is exactly why resubmission was pushed from 4 Sep to **Thu 10 Sep**. A page-views campaign can never fill that column. The other rejection reason (API call volume) is fed by `ads-sync` hourly and is unaffected by which campaign exists.

**What changed in `meta-ads.mjs` `createCampaign`:**
- `objective`: `OUTCOME_LEADS` when a pixel id is supplied, else `OUTCOME_TRAFFIC` as before
- `optimization_goal`: `OFFSITE_CONVERSIONS` vs `LANDING_PAGE_VIEWS`
- `promoted_object`: `{pixel_id, custom_event_type: "LEAD"}`
- `destination_type: "WEBSITE"` — 🔴 **stated explicitly, or Meta may serve an on-Facebook instant form**, which bypasses the landing page, the lead pipeline and the CRM forward completely.

🔴 **THE SWITCH IS A PASTED PIXEL ID, NEVER SOMETHING DETECTED.** New client field `metaPixelId` ("Meta Pixel ID (turns the ad into a lead chaser)"). Two failure modes justify that: a client with no pixel gets the campaign **rejected at creation** (the original comment's reason for hardcoding traffic), and worse, optimising for a LEAD event on a pixel that never fires one makes Meta under-deliver and buy nothing — quieter and worse than rejection.

**BoldLine's own pixel: `2164699294444030`** (web dataset "BoldLine Website"). `blConversion('form')` fires on the `get-started` submit and maps to the `Lead` event, so there is a real event to optimise toward. Caveat: the pixel has never recorded a Lead, so early delivery may be slow while Meta has no signal to learn from.

**Advice given, not yet done:** run the new Leads campaign alongside the existing Traffic one for 2-3 days before pausing the old one, so impressions and spend never dip in the days before the 10 Sep resubmission. Roughly $20 of overlap against a rejection that costs weeks.

**Loose end, stated rather than hidden:** the ads page carries a SECOND form (the Lead-Leak Check) that posts to `/.netlify/functions/audit`, not Netlify Forms. So "zero in Netlify Forms" does not strictly prove zero submissions; an audit request would appear in the OS Leads tab instead.

---

## ✅ 2026-09-02 — RESOLVED, and then made a choice rather than a default

Two changes on the same day, in this order.

**First**, the objective became switchable: supplying a pixel id switched the campaign from
`OUTCOME_TRAFFIC` + `LANDING_PAGE_VIEWS` to `OUTCOME_LEADS` + `OFFSITE_CONVERSIONS` +
`promoted_object`.

**Then Bryson asked for the real thing:** *"Can you make a way for me to be able to select
whether I want an ad I'm making to go for leads clicks etc"*. He is right, and the first
version was still wrong in the same way the bug was: **the campaign's entire purpose was
decided by a field nobody was looking at.** It is now picked on the card.

### What exists now

`netlify/lib/campaign-goals.mjs` holds `GOALS`, `DEFAULT_GOAL` and `resolveGoal()`. Both
launch cards render one shared `GoalPicker`.

| Goal | Meta | Google |
|---|---|---|
| **Leads** | `OUTCOME_LEADS` + `OFFSITE_CONVERSIONS` + `promoted_object` + `destination_type: WEBSITE` | `maximizeConversions` |
| **Visits** | `OUTCOME_TRAFFIC` + `LANDING_PAGE_VIEWS` | `targetSpend` (Maximise Clicks) |
| *(no goal named)* | as Visits | **`manualCpc`, unchanged** |

### 🔴 A goal is never silently downgraded

Asking for **leads with no tracking FAILS** before anything is created. It does not fall
back to traffic. The fallback is **strictly worse than the original bug**: he would have
deliberately chosen Leads, seen a success message, and still be buying clicks, with the OS
agreeing with him. A build that refuses costs nothing.

The two platforms give **different** instructions, because one generic "set up tracking"
line sends him to the wrong screen. Meta names the pixel and My Ads → Edit; Google names
conversion tracking.

### 🔴 Silence keeps its old meaning

`client-autobuild` builds client campaigns without naming a goal, on live accounts spending
real money on their owners' cards. So an unnamed goal keeps **manual CPC** on Google and
traffic on Meta. `askedGoal` is what distinguishes "unnamed" from "traffic" — without it the
two cannot behave differently, and every existing client campaign would quietly re-bid.

**Still open:** those auto-built client campaigns therefore still use manual CPC. Switching
them to Maximise Clicks is probably an improvement for a hands-off account, but it is a
change to live spend and is Bryson's call, not a tidy-up.

### Why only two goals

`LINK_CLICKS` is strictly worse than `LANDING_PAGE_VIEWS` for the same money: it optimises
for thumbs that touched the ad rather than browsers that finished loading the page. Offering
both is offering a worse option with no way to tell them apart. Reach and awareness buy
views that cannot become a customer for a business paid per job. Pinned in the test so they
are not added back without reading why they were left out.

### Two copies

The browser cannot import a server module, so `CAMPAIGN_GOALS` in `index.html` duplicates
`GOALS`. `verify-campaign-goals` **extracts the browser copy out of the shipping file** and
compares ids, labels and blurbs word for word. The blurb matters as much as the id: it is
the only explanation he ever gets of what the button does, so a drift means the OS is
describing behaviour the server does not implement.

**19 checks, plus 2 rewritten in `verify-campaign-launch`. Eight mutations, all caught.**
🔴 One had to be rewritten because it failed on a PRECONDITION rather than on the thing it
guards: it anchored on `CAMPAIGN_GOALS.map` and the mutation inserted a `.filter` in front,
moving the anchor. A guard that fails for the wrong reason is one edit from failing for no
reason, and then somebody deletes it.
