---
name: build-ideas-roadmap
topic: Business
task: decide what to build next for the agency, or revisit one of Bryson's parked product ideas
keywords: [roadmap, what to build next, build ideas, ai video editor, social media management, content calendar, call back ai, text back ai, missed call text back, speed to lead, website design ai, buy vs build, priorities]
status: parked
summary: Bryson listed four ideas on 2026-09-22 and asked which to start and when. Verdict, agreed: the CALL BACK / TEXT AI is the clear winner and the only one worth real build time, but it is blocked on Twilio paperwork rather than code, so the action now is to start that registration, not to build. The social page is worth HALF (a content calendar, no publishing, because Instagram publishing needs another Meta app review). The website AI is MOSTLY BUILT already and expanding it would compete with Shaun, his only partner. The AI video editor is the one to drop: months of hard work to lose to a $20/mo tool. 🔴 And the framing that matters more than the ranking: none of the four gets him client number two, so all of them come after the outreach section is actually being used.
verified: 2026-09-22
---

## 🔴 The framing, which matters more than the ranking

He has one client who has gone quiet and one verbal yes that is not signed. **None of these four ideas
gets him client number two.** The cold outreach section built on 2026-09-21 does. So the honest answer
to "when" is: after the list has been worked for a few weeks, not instead of it.

## The four, ranked

### 1. Call back / text AI — BUILD THIS, but not yet

The best idea on the list and not close.

- **It is the money.** A lead not answered within five minutes is mostly dead, and most small
  businesses answer in hours or never.
- **It is sellable.** "We answer your leads in thirty seconds, including at 2am" is a real reason to
  pick BoldLine, and nobody at this level does it.
- 🔴 **NOTHING HAS EVER BEEN TEXTED TO ANYBODY, and an earlier version of this entry said otherwise.**
  Bryson corrected it on 2026-09-22. The CODE is written and wired: `lead-intake` calls `sendSMS` the
  moment a lead arrives. But `sendSMS` returns immediately unless `SMS_ENABLED=1`, which has been
  deliberately off since 2026-07-25 because the trial account's texts just fail. Describing the code
  as though it were the behaviour is exactly the mistake that makes a build look smaller than it is,
  or larger. **Reality: zero texts sent, ever.**

- **Which splits this into THREE steps, not one, and the first is free:**
  1. **Turn it on.** Twilio paid, A2P cleared, then `SMS_ENABLED=1` in Netlify. A lead arrives, they
     get a text within seconds. 🔴 **No build at all**, one env var. He can prove the reply rate on
     his own number before anybody writes code.
  2. **Missed-call text-back.** Somebody rings, nobody answers, they get a text. A real but small build.
  3. **The conversation AI.** It answers the reply, handles the obvious questions, books the call. The
     big one, and the only part that needs the guardrail below.

**Build missed-call text-back FIRST.** Somebody rings a client's business, nobody picks up, they get a
text within seconds. Simpler than a full conversation and the highest return version for home services.

🔴 **BLOCKED BY PAPERWORK, NOT BY CODE.** Twilio is still on a free trial (KB `call-tracking`, section
"PARKED UNTIL TWILIO IS UPGRADED") and US business texting needs A2P registration, which is per business
and takes weeks. **So the action now is to start that, not to build.** By the time it clears he will
have worked the outreach list and will know whether the client count justifies it.

🔴 **THE GUARDRAIL TO INSIST ON WHEN IT IS BUILT.** This is an AI talking to a CLIENT'S CUSTOMERS, as
the client's business. It answers, it books, and it hands off the moment anything is unusual. It never
quotes a price and never promises anything. Getting that wrong once spends the client's reputation,
not BoldLine's.

### 2. Social media page in the OS — HALF of it

Content Studio already writes the posts. What is missing is a calendar of what goes out when.

**Build the calendar and the drafts. Skip the publishing.** Posting to Instagram needs a SEPARATE Meta
app review from the Marketing API one already granted, and LinkedIn's is worse. That is weeks of waiting
to save thirty seconds a day. A calendar with drafts on it and a nudge to post is ninety percent of the
value with no approval from anyone.

A quiet-afternoon job, not a priority: content is a slow channel and there is no audience yet.

### 3. Website design AI — MOSTLY BUILT, and expanding it has a cost

`generate-landing` already writes landing pages with layouts, copy and images, and KB
`landing-page-options` gives three versions to choose from. That is the part that matters for ads.

🔴 **Full multi-page websites are SHAUN'S BUSINESS.** The partnership settled on 2026-08-31 keeps web
work with him and ad work with BoldLine (KB `stencil-and-thread-deal`). Building a tool that competes
with his only partner for that work is a real cost. Improve the landing page builder when a client
needs something it cannot do; leave full sites alone.

### 4. AI video editor — DROP IT

Months of genuinely hard work (codecs, rendering, timelines) in a crowded market, to end up worse than a
$20/mo tool. It unblocks nothing: he is not stuck on video, does not sell video, and no client has asked.
**This is the one where building loses to buying by a mile.** If editing his own content is the real
problem, buy Opus Clip or CapCut and spend the saved months on the text AI.

## The order agreed

1. **Now:** work the outreach list. Start the Twilio upgrade and the A2P registration in parallel,
   because it is paperwork and waiting rather than work.
2. **The moment it clears:** flip `SMS_ENABLED=1` and watch what the plain auto-reply does. That is
   step one and it is free.
3. **Then, or at four or five clients:** missed-call text-back, then the conversation AI.
4. **Whenever:** the content calendar, publishing excluded.
5. **Not unless something changes:** the website AI and the video editor.
