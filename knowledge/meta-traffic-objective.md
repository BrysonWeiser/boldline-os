---
name: meta-traffic-objective
topic: Ads
task: work out why a Meta campaign gets clicks but no leads, or change what a Meta campaign optimises for
keywords: [meta no leads, clicks but no leads, zero leads, 0 leads, OUTCOME_TRAFFIC, OUTCOME_LEADS, LANDING_PAGE_VIEWS, optimization_goal, promoted_object, meta objective, why no conversions, cheap clicks, high ctr no leads, meta pixel, fbq Lead, house account ads, my ads]
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
