---
name: lead-double-count
topic: Forms/Leads
task: work out why an ad platform reports more leads than the OS holds, or change when a conversion is reported
keywords: [leadGap, cost per lead wrong, cpl too low, spend divided by, counted by meta, best case, gap warning campaign view, two leads one lead, meta counted two, more leads than the os, lead mismatch, double counting, conversion fires early, blConversion, fired kind, honeypot counted as lead, bot-field, cost per lead too good, platform vs os leads, ad platforms counted, submit listener, preventDefault]
status: built
summary: Meta reported 2 leads on the house campaign while the OS held 1. The backup form on the marketing site had TWO submit listeners: an AJAX one that posts and only shows the thank-you on success, and a second that fired the conversion on the submit EVENT under a comment claiming the form "posts normally" - which was false, since it is intercepted with preventDefault. So a honeypot hit (Netlify answers 200 then bins it), a refused post or a dropped connection all told Meta a lead had happened. The identical bug had been fixed on the audit form four days earlier and this copy was missed. Also fixed: the dedupe was per-kind, so one visitor filling both forms sent two Lead events. 21 checks, 8 mutations caught.
verified: 2026-09-09
---

**Bryson, 2026-09-09:** *"why the os is showing two leads but I only got one"*. Meta reported **2** conversions on the Roofers house campaign; the OS lead log held **1**. The OS already flagged the gap on screen, which is how he saw it.

## The mechanism

`marketing-site/get-started/index.html` had **two submit listeners on the same form**:

1. The AJAX one: `preventDefault()`, `fetch('/')` to Netlify, thank-you shown only when the post is accepted.
2. A second one, further down the page:
   ```js
   // The backup form. Netlify posts it normally, so fire just before it leaves.
   form.addEventListener('submit', function(){ window.blConversion('form'); });
   ```

🔴 **That comment was simply false.** Nothing posts normally; the form is intercepted. So the conversion was reported on the submit *event*, before anything had been saved, which means each of these counted as a lead:

- **A honeypot hit.** Netlify answers a bot submission with **200** and then throws it away. Ad traffic attracts bots, so this is the likeliest single cause.
- A refused post, or a dropped connection.
- Anything the user retried after an error.

**The person is invisible either way**, because nothing anywhere recorded them, and the cost per lead reads better than it is. That last part is what makes it expensive rather than untidy: a campaign looks like it is converting at $39 when the real figure is $78.

## The same bug, four days earlier, on the other form

The audit form had this exact defect and it was fixed on **2026-09-05** by moving the report into the success branch. The backup form's copy was left behind.

> **A second implementation of one thing is how half of it silently stops happening.** This file already carried that lesson in a comment, about the audit form calling `fbq` directly instead of the shared tracker. The lesson was written down and the sibling was still missed.

## The quieter third defect

`blConversion` deduped on **`fired[kind]`**, per kind. The audit form and the backup form are different kinds and both report **Lead**, so one visitor who filled in both sent Meta **two** Lead events. Now every lead-shaped action shares one slot; a booking keeps its own, because `Schedule` is genuinely a different event.

## What it looks like now

- The backup form reports its conversion **inside the success branch**, after `r.ok`, and **only when the honeypot field is empty** — because an accepted post is not the same as a saved lead.
- Nothing anywhere reports a conversion off a raw submit event.
- GA4 and Google Ads still ride the same shared call, which is the whole reason it exists.

## Verified

`tests/verify-lead-double-count.mjs` — **21 checks, 8 mutations, all caught**, including the dedupe lifted out and run (audit then backup form counting once between them, a booking still counting separately). `verify-conversion-loop` had pinned the old `if(fired[kind]) return;` literal and now asserts the intent plus the fact that keying on `kind` is gone.

**Worth remembering:** an ad platform counting more leads than the OS is almost never the platform being generous. It is a conversion reported before the lead was saved.

## The display half, same evening

**Bryson:** *"can you fix the glitch that saying I have two leads but in reality it's one, or is that not possible"*.

🔴 **Half of it is not possible.** The 2 is **Meta's own number**, in Facebook's records. Nothing on this side un-counts it. The cause is fixed at source above, so it will not recur, but the historic figure stays what Meta says it is.

**The other half was very possible, and was the part that misled about money.**

The account view already carried an honest note about the difference. It was gated on **`!sel`** — so tapping into the campaign, **which is the screen he was actually looking at**, showed the 2 bare.

Worse, the cost per lead there is spend ÷ that number: **$78 ÷ 2 = $39**, when the real figure for a lead that reached him is **$78**. A cost per lead reading half its true value is not a display quirk, it is the number a budget gets decided on.

Now:

- `leadGap` is one named test (`leadsSyncedAt` present, and the platforms' count above the OS's, both coerced from strings because `"10" > "9"` is false), used by **both** views.
- The campaign view warns in amber, names whose count it is, gives both figures, and says **"treat the cost per lead above as a best case. The real one is higher."**
- The cost-per-lead caption becomes **"spend ÷ what Meta counted"** whenever the two disagree, instead of "spend ÷ leads".
- 🔴 It says **"across the whole account"**, because an account-level gap does not say WHICH campaign lost the person. Inventing a per-campaign arrived-count would be a worse lie than the one being fixed, and `verify-campaign-breakdown` already forbids pairing the account's leads with one campaign's spend.
- Warning only fires when the platforms counted **more**. More in the OS than the platforms counted is normal (a phone call, a direct visit, a click outside the attribution window) and warning about it would cry wolf.

**25 checks, ten mutations, all caught.** Three existing suites had pinned the old inline expressions and now assert the intent.

🔴 **One mutation first survived: a fixed 600-character slice of the campaign warning ran straight into the NEXT warning, which is also amber**, so downgrading this one to grey passed. Bounded at its own closing tag. Any "this block is styled X" assertion taken on a fixed-length slice has this hole.
