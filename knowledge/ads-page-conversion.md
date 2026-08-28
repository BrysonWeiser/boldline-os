---
name: ads-page-conversion
topic: Marketing site
task: work out why paid traffic is not converting, or change what the ads landing page asks for
keywords: [get-started, zero conversions, landing page views, lead-leak check, audit.mjs, cold traffic, CTA, OUTCOME_TRAFFIC, LANDING_PAGE_VIEWS, meta ad not converting, conversion rate, form fields]
status: verified
summary: 4,360 impressions, 101 clicks, 88 landing page views, ZERO leads. The ads were the healthy part (2.3% CTR, roughly double the Meta average, and 87% of clicks reached the page). The break was the ASK: every button on /get-started wanted a 30-minute phone call from someone who had been scrolling Facebook ninety seconds earlier. The free automated audit that solves this existed on the homepage and was absent from the one page paid traffic lands on.
verified: 2026-08-28
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
