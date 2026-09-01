---
name: stencil-and-thread-deal
topic: Business rules
task: pick up the Stencil and Thread deal, prep the call, or set up their campaign
keywords: [stencil and thread, stencilandthread.com, first client, screen printing, custom apparel, Eugene Oregon, Lane County, 805screenprints, contact@stencilandthread.com, close rate, qualified lead, first deal, prospect, Shaun Smith, referral, referrals, partnership, finder's fee, referral fee, subcontract, in house, developer partner]
status: signed
summary: BoldLine's FIRST real client. SIGNED Sunday 2026-08-30. Screen printer in Eugene, Oregon selling custom apparel to businesses and organizations. ~$1,000 average order, ~50% margin, closes 7-8 of every 10 leads, wants $500-750/mo of ad spend on Google Search only. Their developer Shaun Smith is also BoldLine's first partnership conversation, settled 2026-08-31 as a no-money two-way referral swap with dev work kept in house.
verified: 2026-08-31
---

## Who they are

**Stencil & Thread**, stencilandthread.com. Screen printing and custom apparel, targeting
businesses, churches, clubs and organizations rather than one-off consumers. Their sweet
spot is **25+ piece orders**.

🔴 **THEY HAVE A SECOND BRAND AND IT MUST STAY OFF THIS CAMPAIGN.** Their site lists
**Eugene, Oregon AND Ventura County, California**. Ventura is the 805 area code, which is
the other brand, `805screenprints`. Bryson was told explicitly: *"Please do not advertise
the 805screenprints email anywhere on this campaign."* So the 805 address must never appear
on an ad, the landing page, the form, an auto-reply, or anywhere in the account. The intake
address for everything here is **contact@stencilandthread.com**.

**Open question for the call:** is Ventura County deliberately out of scope, or something
they would want later? Do not assume either way.

## The numbers that decide everything

| | |
|---|---|
| Average order | ~$1,000 |
| Margin | ~50%, so ~$500 profit per order |
| Close rate | **7 to 8 out of 10** (his own figure) |
| Ad budget | $500 to $750/mo, wants it billed as it spends |
| Market | Eugene / Lane County, Oregon |

**So a qualified lead is worth about $375 in profit**, before any reorder. His own AI
adviser suggested keeping cost per lead under $100, which is a good target but **nowhere
near the real break even of ~$375**. The constraint on this account is therefore **search
volume in Lane County, not efficiency**. That reframes month one: watch whether there is
enough demand, not whether leads are cheap.

At $500 with 5 qualified leads: 3-4 customers, ~$3,500 revenue, ~$1,750 profit, customer
acquisition cost near **$133** rather than the $250 he was braced for.

🔴 **CAVEAT TO CARRY INTO THE FORECAST.** That 75% is his track record with the leads he
gets *today*, which are probably weighted to referrals and people who already know his work.
Cold Google traffic will close lower, at least at first. Plan conservatively for month one.
**Ask on the call:** is 7-8 of 10 across everyone who reaches out, or only the ones he
chooses to quote? Those are very different numbers.

## History

- **2026-08-18** — turned down the OLD pricing model in writing. A management fee plus a
  per-lead fee was too much of their budget. That rejection is what caused the whole
  greater-of rewrite (KB `pricing-model`). Pricing has since been settled with him.
- **2026-08-25** — he emailed to say he is going ahead, attached a detailed AI-written ad
  plan, asked for a technical conversation, named the intake address, and asked whether the
  budget could be spent day by day rather than paid up front.
- **2026-08-25** — Bryson sent the reply. **Waiting on his answers.**

## What the reply committed to

The plan he was sent is sound and was largely agreed with: **one campaign, three ad groups**
(contractors, churches, clubs) rather than three campaigns, since $500/mo is ~$16/day and
splitting it three ways starves all three. **Qualified lead as the primary conversion, form
fill secondary.** **Maximize Conversions first, a cost target only once there is history.**

Added on top:
- Search only, Display Network and Search Partners OFF.
- Location set to people **physically in** Lane County, not merely interested in it.
- The negative keyword list built BEFORE launch (one shirt, DIY, cricut, students, jobs,
  wholesale blanks).
- Month one framed as a cleanup, not a verdict. Cost per lead settles in month two or three.
- Start at $500, move to $750 once the traffic is clean, roughly three or four weeks in.

**On his cash-flow question the answer is yes, and it needed no change:** Google bills as
spend accrues against a card on file, in small amounts at first. Nothing is prepaid. The
account is opened in HIS name on HIS card and BoldLine only takes manager access, which is
the standing hard constraint anyway.

**Asked of him before the call:** his last five best customers and last five time-wasters,
in bullet points, plus whether a Google Ads account already exists and who runs his website.

## Decisions already made

- **BoldLine grades the leads, not the client.** A client-facing "mark qualified" screen was
  deliberately NOT built (Bryson, 2026-08-25). For month one he reviews leads with them on a
  weekly 15-minute call, which teaches him their definition of qualified far faster than
  reading one lead at a time. Revisit when a weekly call per client stops scaling.
- **The landing page should sit on THEIR domain, not boldlinemedia.com.** Google displays the
  address the ad points to, so a page on our domain makes his ad look like a marketing
  agency's. **This is not built yet** and is a launch-day blocker, not a sales blocker.
- **DocuSign is not ready.** If they sign this week, email the agreement as a PDF and take
  written acceptance by reply. That is binding, and the contract already says so. Do not
  promise a DocuSign link. See KB `docusign-integration`.

## Related

`conversion-loop` (built for this deal), `pricing-model`, `hand-off-product`, `deal-prep`.

## 🔴 SCOPE CHECK, 2026-08-26 — we are building above his tier in one place

Bryson asked, correctly, whether the CRM and landing-page work exceeds what he is paying for.
Checked against the catalog rather than guessed:

| Thing | His tier (`g-launch`) | Verdict |
|---|---|---|
| Standard landing page | **In scope.** Every package includes one (`stdLanding !== false`); `customLandingPage` only distinguishes a bespoke build, which is Growth and up. | Not over-delivery |
| Page served on **his own domain** | Not listed on ANY tier. It is new. | A correctness fix, not a feature: Google displays the address the ad points to, so a client's ad must not show BoldLine's domain |
| **Forwarding leads to his CRM** | **`crmIntegration: false` on `g-launch`.** Listed as Growth and up on the Google packages. | 🔴 **Genuinely above his tier** |
| Dual-post to Shaun's specific endpoint | Not a product feature at all | Bespoke work for one client's developer |

**The argument for including the CRM forward at Launch anyway:** the model bills **per
qualified lead**. Faster follow-up turns more leads into customers, which produces more
qualified leads, which is BoldLine's own revenue. It is self-interested, not a giveaway. The
per-client cost after the one-time build is pasting one URL. Moving it to Launch also leaves
the upgrade ladder intact (call tracking, weekly optimization, retargeting, split testing and
the custom page all stay at Growth).

**🔴 THE PART THAT MUST NOT BECOME STANDARD:** the dual-post arrangement exists because
Sebastian happens to have a competent developer. Most clients will have neither a developer
nor a CRM. Fitting BoldLine's engineering to one client's stack is exactly the work that does
not scale, and it should stay an accommodation rather than a promise.

**✅ DECIDED SAME DAY (Bryson, 2026-08-26): include it, and change the catalog to match.**
`crmIntegration` is now true on every lead-gen package (`g-*`, `m-*`, `c-*`) and on
`h-handoff`; e-commerce is unchanged because a store has no lead to forward. Full reasoning
and the four catalog copies involved in KB `pricing-model`. So Sebastian is no longer being
given something above his tier: the tier now includes it.

## The developer relationship (Shaun Smith) — 2026-08-26

**Technical call set: Saturday 2026-08-29, 10am Phoenix / 9am his.** He sends the Meet link
once the time is confirmed.

**Prep page (Bryson's own, internal):**
https://claude.ai/code/artifact/092d8c4b-77c7-4299-b0ce-a1f3f82b4bb9
Plain-English glossary (gclid, wbraid/gbraid, UTM, CORS, opaque response, endpoint, payload,
dual post, backstop, shared secret, lead ID, DNS record, API, MST), the lead's journey in
seven steps, the three asks, the partnership options, and a say / do-not-say list. Built
because he asked what the acronyms meant. **Reminders scheduled Fri + Sat 8am**
(`trig_01We7Ajm9aahnxTg594JTnQ3`, `trig_01Sq3y8tao9UhitcAaQVkkYY`).

### The partnership question, and the recommendation given

Bryson asked how a deal between him and Shaun would work. The fit is real: Shaun builds
sites for businesses that mostly are not advertising, Bryson runs ads and cannot build sites,
and **neither wants the other's job**. More importantly Shaun solves BoldLine's worst
recurring bottleneck, since every client needs the same small developer jobs (one DNS record,
a form wired up, a CRM connection) and most clients have nobody who can do them.

| Shape | Verdict |
|---|---|
| **Swap referrals, no money** | ✅ **Start here.** No contract, no bookkeeping, can start immediately |
| One-time finder's fee | Revisit at 3-6 months, once referral volume is actually visible |
| Ongoing % of the monthly | 🔴 **Not yet.** Commits forever on one client's worth of evidence, with no churn history and no real cost-to-serve. Do not agree on a call |
| **Paid subcontract for dev work** | ✅ **Set up now, separately.** Agree his rate for small jobs. Turns a launch delay on every client into a phone call, costs nothing until used |

**🔴 TIMING CONSTRAINT:** Shaun works FOR Sebastian. If Sebastian has not signed, do not raise
a partnership at all. A side arrangement with a client's developer before the client has
signed reads as going around him however innocent it is.

**Product fit worth remembering:** `h-handoff` (one-time build, no monthly) suits a web
developer's clients far better than a managed retainer does, and is a much easier thing for
Shaun to hand over.

## ✅ 2026-08-31 (Phoenix) — SETTLED: no referral fee, and the dev work stays in house

The timing constraint above is now clear: **Sebastian signed Sunday 2026-08-30** (Bryson
confirmed the day himself the next afternoon, correcting a "Friday" I had put in the draft
email; see the date-keeping note at the end of this section), so the partnership
may be raised. Bryson asked what referral payments would cost him, saying plainly he **cannot
pay out of pocket right now**, then reached the conclusion himself and instructed:
*"Make sure that there isn't a fee for referring someone."*

**The decision, which supersedes the finder's-fee row in the table above:**

| Question | Decision |
|---|---|
| Referral fee to Shaun | 🔴 **NONE. No money in either direction.** Two-way swap only, exactly the "start here" row above |
| Ongoing % of the monthly | Still no, and still not to be agreed on a call. One client of history, no churn data |
| Small dev jobs (DNS record, form wiring) | **In house.** Not subcontracted by default. This reverses the "set up now" verdict in the table above |
| Paying Shaun at all | Only a **one-off quote for one specific job**, and only when a client's existing site must be touched and nobody will give Bryson access. Never a retainer |

**Why the fee was dropped rather than deferred.** A finder's fee was sized first ($150 at
~$400/mo, $250 at ~$700/mo, $400 at ~$1,200/mo, always paid *after the client's first invoice
clears* so it is never funded out of pocket). That structure is sound and is kept here in case
it is ever wanted. Bryson declined it anyway, and he is right to: the swap costs nothing, needs
no bookkeeping, and buying referrals from a partner who has sent zero so far prices something
with no evidence behind it.

**Why the dev work came back in house** (Bryson: *"realistically why can't we just do all of
this in house?"*). Almost none of it is actually needed:

- The landing page is already built, written, hosted and form-wired by the autobuild bot. Shaun
  adds nothing to the page the ads point at, and that is the only page that affects performance.
- Pointing a client's domain is one DNS record, roughly ten minutes, walked through on a call.
- A form on the client's *existing* site is not needed at all, because the ads never point there.

🔴 **AND THE REAL REASON, WHICH IS STRATEGIC, NOT FINANCIAL: do not sell websites.** Building a
site by hand is the one job in this business that no bot does and that never ends, because the
client then owns you for every photo change forever. That is the direct opposite of the stated
goal (full automation; Bryson's only manual jobs are cold call, close, and check on the bots).
The cost of taking website work is not the money, it is that it bolts a second, lower-margin,
un-automatable services business onto the first one. **If this comes up again, the answer is no.**

**The relationship was flipped.** Shaun is worth far more as a source of clients *to* BoldLine
than as somewhere to send work. He already talks daily to owners who have a website and no
traffic, which is precisely BoldLine's customer. Bryson would only ever refer people who have
*no* website, who by definition he would not be talking to in the first place, so the outbound
half of the swap is close to worthless and should not be paid for.

**The email was written and handed over 2026-08-31** to send immediately: Sebastian signed, the
dual-post is built and ready to test, the DNS record is the one outstanding ask, referrals are
two-way with no fees, one-off paid jobs are possible but are not a retainer, and the call is
offered **Thu 2026-09-03 09:30-11:00 or Fri 2026-09-04 09:00-11:30 Phoenix** (Bryson dropped the
Wednesday and moved that window to Friday, 2026-08-31). It states the signing secret will be
sent separately and **not** over email.

### 🔴 Date-keeping gotcha, worth carrying forward

The first draft of that email said Sebastian signed **Friday** and called Wednesday the 2nd
**"tomorrow"**. Both were wrong, and Bryson caught them: *"he signed the agreement yesterday
which was Sunday."*

**The cause is a real trap, not a typo.** The session clock runs on **UTC**, and Bryson is in
**Phoenix (MST, UTC-7, no daylight saving ever)**. Any time after 5pm his time, UTC has already
rolled to the next calendar day, so the date handed to the assistant is **a day ahead of his**.
That afternoon UTC read 2026-09-01 while his own Monday 2026-08-31 was still going.

**So never write a weekday or a relative day ("tomorrow", "yesterday", "later this week") into
anything a client or partner reads without converting to Phoenix first and checking the day
name.** Getting it wrong in an internal note is harmless. Getting it wrong in an email to a
client's developer makes BoldLine look like it is not paying attention, which is the exact
opposite of the impression the first client's launch needs to make. This is the same class of
mistake as the mis-scheduled 10pm reminder that fired at 5pm.
