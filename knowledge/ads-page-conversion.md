---
name: ads-page-conversion
topic: Marketing site
task: work out why paid traffic is not converting, or change what the ads landing page asks for
keywords: [get-started, zero conversions, landing page views, lead-leak check, audit.mjs, cold traffic, CTA, OUTCOME_TRAFFIC, LANDING_PAGE_VIEWS, meta ad not converting, conversion rate, form fields, lk-name, lk-phone, name and phone, phone number on lead, lead has no name, cannot call the lead, anonymous lead, tel link, website_leads phone column]
status: verified
summary: 4,360 impressions, 101 clicks, 88 landing page views, ZERO leads. The ads were the healthy part (2.3% CTR, roughly double the Meta average, and 87% of clicks reached the page). The break was the ASK: every button on /get-started wanted a 30-minute phone call from someone who had been scrolling Facebook ninety seconds earlier. The free automated audit that solves this existed on the homepage and was absent from the one page paid traffic lands on. 🔴 2026-09-07 PARTLY REVERSED: the free-check form now also asks for a NAME and a PHONE (both required, both copies), because a real prospect arrived as an email address alone and took fifteen minutes of licence and LinkedIn research to identify, then sat uncalled for three days. A lead nobody can phone is worth close to nothing, and the two-field version had produced zero leads here anyway, so field count was never the binding constraint. Phone is stored in `payload`, NOT a column: website_leads has no phone column and naming one fails the whole insert.
verified: 2026-09-07
---

Bryson, 2026-08-28: *"is there anything we can do better to get conversions because right now
I havent gotten any at all"*

## The numbers, and what they ruled out

| | |
|---|---|
| Impressions | 4,360 (reach 3,019, frequency 1.44, no fatigue) |
| Link clicks | 101 = **2.3% CTR**, roughly **double** the Meta cold-traffic norm |
| Landing page views | 88 = **87% of clicks**, so the page is fast and nobody bailed on the way in |
| Spend | $51.66 at $7/day, about a week |
| **Leads** | **0** |

**The ads were never the problem.** Creative and targeting were performing above average. The
page loaded. The form worked (Bryson had tested it). 88 people read it and none acted.

🔴 **The OS's own lead counter agreed at zero, independently of Meta.** That mattered: it
proved this was real and not the reporting gap described below.

## The cause: the ask was too big for the audience

Every call to action on `/get-started` wanted the same thing, four different ways: *Book a
Call*, *Book a Free Strategy Call*, *Book a time now*, *Leave your details* (so we can call
you). Paid social traffic did not come looking for you. You interrupted them. A 30-minute
phone call with a stranger is an enormous first step.

**And the answer already existed.** The **Lead-Leak Check** (`audit.mjs` →
`lead-leak-audit-background.mjs`) reads a prospect's site, has Claude write an honest 2 to 4
point mini-audit, and emails it to them automatically. Ten seconds of the visitor's time,
zero of Bryson's. It was on the homepage and **completely absent from the one page the ads
pointed at.**

## What changed (2026-08-28)

1. **The free audit is now the hero ask on `/get-started`** — two fields, website and email,
   above the fold at all four breakpoints including phone. The call demoted to a secondary
   line for people who are ready. Tagged `source:'get-started'` so ad leads are tellable
   apart from homepage leads, and it fires the Meta `Lead` pixel event on submit.
2. **The coming-soon Meta note reworded.** It read *"Meta is still going through platform
   approval, estimated October 2026"* — on the page **Facebook ads land on**, telling people
   who had just clicked a Facebook ad that BoldLine could not do Facebook ads. Now: *"Taking
   on Google Ads clients now. Facebook and Instagram open later this year, and we add them to
   your account the moment they do."* ⚠️ Still inside its `CS:META-SOON:START get-started`
   sentinel and recorded in `docs/META-FLIP-CHECKLIST.md`; **at flip the whole block goes,
   sentinels included.**
3. **Call-back form trimmed** from 7 fields to 3 (name, business, email). Phone and "biggest
   challenge" are call questions.

Verified in headless Chromium at 390 / 768 / 1280 / 1600, no horizontal scroll, no page
errors, audit form above the fold at every width.

## 🔴 Two things NOT to do, and why

- **Do not switch the Meta campaign to conversion optimisation yet.** It is true that every
  campaign the OS builds uses `objective: OUTCOME_TRAFFIC` + `optimization_goal:
  LANDING_PAGE_VIEWS`, so **Meta reports zero conversions by construction** and optimises for
  cheap clickers rather than buyers. Switching is right *eventually*. But Meta needs roughly
  50 conversions a week to learn, and at zero it would choke delivery to nothing. **Fix the
  page, get leads flowing, then switch.** This applies to client campaigns too, Sebastian's
  included, so revisit before his goes live.
- **Do not read 88 visits as proof the page is broken.** At a perfectly normal 1 to 2 percent
  a week of that traffic yields one or two leads. Zero is unlucky, not damning. The changes
  above are still right; the panic would not have been.

## Guard

`tests/verify-conversion-loop.mjs` pins the **plumbing, deliberately not the wording**, so
Bryson can rewrite the copy without a test arguing with him: the audit form exists, posts to
the audit endpoint, tags itself `get-started`, fires the Meta Lead event, keeps its honeypot,
stays under 6 visible fields, and still requires name + business + email. Five mutations,
all caught.

## 🔴 2026-09-07 — THE FREE-CHECK FORM NOW ASKS FOR A NAME AND A PHONE, WHICH REVERSES PART OF THE ABOVE

**Why (Bryson, 2026-09-07):** *"add a name and number section."* Prompted by a real prospect he
could not call.

**What happened.** A Scottsdale roofing company asked for the free Lead-Leak Check on Friday the
4th. The lead arrived as `berafordk@gmail.com` and a website, and **nothing else. No name, no
phone.** Working out who to ring took the company's own site, the Arizona contractor licence
record (ROC 343909, qualifying party Weston Robert Zellers) and a LinkedIn check to confirm he is
the owner. That is roughly fifteen minutes of research per lead, and the lead still sat uncalled
for three days.

> 🔴 **A lead nobody can phone is worth close to nothing.** The two fields "saved" were not saving
> anything worth keeping. Speed to lead is the entire product.

### The tension, stated honestly, because this entry argues the other way

The whole point of this page was **fewer fields, more submissions**, and this change adds two of
them back to the exact page paid traffic lands on. The argument for doing it anyway:

- The two-field version ran here against **4,360 impressions and 88 landing page views and
  produced ZERO leads.** Field count was demonstrably **not** the binding constraint, so buying a
  callable lead with a little friction spends something that was not being collected.
- The failure mode being fixed is not "fewer leads", it is "leads that cannot be worked".
- Adding fields cannot make zero worse.

**If fill-ins visibly drop once real traffic is running, the first thing to loosen is the PHONE on
`/get-started` only** (drop its `required`, keep it on the homepage). Do not drop the name: it is
one word, and it is what turns the lead card's title from a raw email address into a person.

### What changed

| Where | Change |
|---|---|
| Both copies of the form (homepage + `/get-started`) | `lk-name` and `lk-phone` added, all four fields required, phone is `type="tel"` + `inputmode="tel"` so a mobile shows the number pad |
| Phone validation | **Lenient on purpose.** Ten digits after stripping everything else, so `(480) 426-0885`, `480.426.0885` and `+1 480 426 0885` all pass. Punctuation must never cost a real lead |
| `audit.mjs` | Reads `body.phone`, and **deliberately does not re-validate it**. A second stricter opinion on the server would silently drop a real lead over an extension or a `+1` |
| Owner alert email | Leads with Name and Phone, the number is a `tel:` link, and a **Call** button sits next to Reply. He reads these on his phone |
| OS lead card | The Phone row is now a `tel:` link instead of plain text |

### 🔴 The gotcha that would have lost the whole lead

**`phone` goes in `payload`, NOT as a top-level column.** `website_leads` has `form`, `name`,
`business`, `email`, `message`, `recommended`, `payload` and no phone column. Naming one in the
insert makes the **entire insert fail**, which loses the whole lead in order to gain one field.
The OS lead card already read `lead.phone || lead.payload.phone` and its Text button was already
wired to it, so nothing downstream needed changing. **No Supabase migration, so nothing for
Bryson to run by hand.**

`name` needed no backend work at all: `audit.mjs` had accepted and stored `body.name` since it was
written. Only the forms never sent it.

### Verification

`tests/verify-conversion-loop.mjs`, 121 checks, **5 of 5 mutations caught** (phone stops being a
tel field, ads page stops sending the phone, homepage name stops being required, owner alert
number stops being tappable, OS card stops dialling). The field-count cap was raised 6 → 7 **with
the argument written into the test**, not silently bumped, and the honeypot is now excluded from
that count since it was quietly inflating the number the assertion argues about. Full suite: **64
suites, 0 failures.** Both forms verified headlessly at 390 / 768 / 1280 / 1600 (no horizontal
scroll, all four fields equal width) and functionally: submission blocked with no name, blocked on
a four digit phone, and a real number sent through with the right `source` on each page.

**Two copies, one shape.** The form exists on the homepage AND `/get-started`. A field added to one
and forgotten on the other is invisible until someone tries to phone the lead, so the homepage copy
is now pinned by test too rather than assumed to match.
