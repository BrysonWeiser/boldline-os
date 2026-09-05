---
name: lead-attribution
topic: Forms/Leads
task: know which ad or search produced a lead, get a phone alert when one lands, and open a lead to see everything it holds
keywords: [lead attribution, where did the lead come from, fbclid, gclid, utm, attribution.js, blOrigin, lead-origin, leadOrigin, originFields, came from, paid click, new lead push, lead notification, press the lead nothing happens, lead detail, website_leads payload]
status: verified
summary: BoldLine's marketing site never recorded where a visitor came from, so the first real lead could not be traced to an ad, and the ad dashboards could never have answered it (they hold totals, not which click became a person). `marketing-site/attribution.js` now captures click ids, UTM tags, referrer and landing page on arrival and posts them in ONE declared hidden field per form (Netlify Forms silently drops fields that script creates). `netlify/lib/lead-origin.mjs` plus an inlined browser copy turn that into a sentence ("Facebook or Instagram ad", "Google search", "Typed the address in"), shown on every lead card and in the house account's Leads tab. A new lead now fires a phone push, sent only AFTER the row is written so it can never repeat. And pressing a lead card opens everything the lead holds, which it previously did not do because the card had no handler at all. 29 checks, 12 mutations caught, verified in a real browser at four widths.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04), three things in one sitting on his first real lead:**
1. *"I'm not sure where from yet though because the os ad analytics haven't updated"*
2. *"make sure I get an alert on my phone as well when a new lead lands"*
3. *"on the phone when I press the lead in the leads tab no information pops up"*

## 🔴 The ad numbers were never going to answer question 1

Spend, clicks and impressions are **totals for a campaign**. They cannot say which click became this person, so waiting for the hourly sync would never have helped. The only thing that can answer it is what the visitor's browser was carrying when they submitted the form, and the marketing site was throwing every bit of it away.

## What captures it

**`marketing-site/attribution.js`**, loaded on the homepage and `/get-started` (where the ads land).

- Reads `gclid`, `wbraid`, `gbraid`, `fbclid`, `msclkid`, `ttclid` and the five `utm_*` tags off the URL, plus `document.referrer` and the landing path.
- **First touch wins, unless this visit carries ad parameters.** Click the ad, come back tomorrow, fill the form: the lead belongs to the ad. Click a *new* ad: it belongs to the new one.
- An internal referrer (a link from one page of the site to another) is ignored, or every click would overwrite the real origin.
- 🔴 **Netlify Forms only records fields declared in the form's HTML.** A hidden input created by script at submit time is posted and then **silently dropped**, which looks exactly like working code. So every form carries one declared `<input type="hidden" name="attribution" value="">` and the script fills it with JSON. One field is also far harder to forget on a new form than eleven. **The test fails if the script ever starts creating inputs.**
- Every read and write is wrapped. A lost attribution is a shame; a lost lead is the business.

Forms wired: `contact` (homepage), `recommendation` (quiz email), `get-started`. The free-audit forms pass `window.blOrigin()` in their JSON, and `audit.mjs` stores it through an **allow list**, because that endpoint is public and copying whatever arrives onto a stored record is how a form becomes a way to write junk into the OS.

## What reads it

**`netlify/lib/lead-origin.mjs`** + an inlined copy in `index.html` (the browser cannot import a lib; the suite extracts the copy and runs every case against both).

`leadOrigin(lead)` → `{ label, detail, paid, known }`. It reads **three shapes**, because leads come from different worlds and all of them must keep working:
- **flat keys** (`gclid`, `utm_source`…) as a client's landing page has posted through `lead-intake` since 2026-08-26,
- the site's **one JSON blob** in `payload.attribution`,
- and **`origin`** on a lead mirrored onto the house account, since the mirror deliberately does not copy the whole payload across.

🔴 **`paid` is a claim about money and is only made on evidence.** A click id, or a `utm_medium` of cpc, counts. **A Facebook referrer does not**: that is far more likely someone tapping a link in a post, and calling it an ad would quietly poison the cost per lead on My Ads. A wrong number that looks right is worse than a missing one.

Shown in two places: the **Leads screen card** (a "Came from" line with a gold "Paid click" badge, plus the campaign and which ad), and the **house account's Leads tab** row.

## 🔴 Pressing a lead did nothing, and it was not a broken handler

The card had **no handler at all**. Everything it knew was already printed, so a lead that left no message printed a name and a badge and looked empty, and pressing it to find out more was both the obvious thing to do and the one thing that did nothing.

The header is now a button, and what opens is **every field the lead holds** (top-level and payload, built by iteration rather than a hand-written list) so "no information" cannot recur on a form nobody anticipated. Raw tracking codes are excluded from that list on purpose: they appear as the sentence above, not as rows of `utm_content` he cannot read.

## The phone alert

`syncHouseLeads` pushes when it mirrors a new lead. `mergeHouseLeads` now returns **`addedLeads`** (the entries, not just the count) so the alert can name who arrived and where they came from.

- 🔴 **Sent AFTER the write, never before.** If the push went first and the save then failed, the next run would see the same lead as new and buzz him again, every fifteen minutes, forever. Once the row is written the lead is no longer new to anything, so it fires exactly once per lead regardless of which caller got there first (the scheduled job or the OS asking on demand).
- **Push only, not `dispatchAlert`.** The website already emails him on every submission; routing this through the full channel would mean two emails and a text for one lead, and an alert he learns to ignore is worse than no alert.
- Fail-soft: a push failure is logged and warned, never allowed to cost the mirror.
- Latency is up to 15 minutes (the mirror's schedule). Instant would need the marketing site to hold the VAPID keys or a shared secret, which is a Netlify job; not done, and worth revisiting if 15 minutes ever proves too slow.

## Still true / not built
- **Meta adds `fbclid` by itself**, so his current ads are attributable with no change. Adding `utm_campaign` to the ad's link in Ads Manager would additionally name the campaign on the card.
- Leads that arrived **before** this shipped say "Not recorded" and explain why when opened.
- The newsletter form is untouched: those rows are filtered out of the sales lead list already.

## Files
- `marketing-site/attribution.js` (new), plus the declared field in three forms and the script tag on both pages.
- `marketing-site/netlify/functions/audit.mjs` — allow-listed `pickOrigin`.
- `netlify/lib/lead-origin.mjs` (new); inlined copy in `index.html`.
- `netlify/lib/house-leads-merge.mjs` — `origin` on the entry, `addedLeads` returned.
- `netlify/lib/house-leads-run.mjs` — the new-lead push.
- `index.html` — the card's open state, the "Came from" line, the detail block, the house Leads tab line.
- `tests/verify-lead-origin.mjs` (new).

## 🔴 When the platform counts more leads than the OS received

Bryson, 2026-09-05: his Meta campaign reported **2 leads**, the account view said **1**, and the Leads tab held only the one from the day before.

**Both numbers were correct.** They measure different things, and the card already relabels to say so: a focused campaign shows the platform's OWN conversion count ("counted by Meta"), while the account view counts leads that actually reached the OS. That distinction was built deliberately, to stop a fictional cost per lead.

**But the two sat on separate screens, so only a sharp eye caught the gap at all, and the gap is the interesting part.** A real difference means one of three things, and each is worth knowing:
- a form that submitted and never reached us (a lost customer),
- a tracker firing on something that is not a lead,
- the same person counted twice.

The account view now says so in words when the platforms report more than the OS received, and explains that a small gap is normal so it does not read as a fault.

### 🔴 And the likeliest cause was ours, fixed at source

On `/get-started` the free-audit form fired the Meta conversion **before** the fetch that saves the lead:

```js
blConversion('audit');            // told Facebook a lead happened
fetch('/.netlify/functions/audit', …)   // …then tried to save it
```

So a failed or refused save still told Facebook a lead happened. The platform counts a person we never received, **the cost per lead reads better than it is**, and the missing lead is invisible because nothing anywhere recorded it. A lead we did not save is not a lead.

It now fires inside the success path, and a non-OK response throws rather than being treated as a save.

The `get-started` Netlify form is the one exception and stays as it is: it is a normal browser post that navigates away, so there is no success to wait for.
