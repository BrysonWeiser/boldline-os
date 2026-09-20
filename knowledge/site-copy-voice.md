---
name: site-copy-voice
topic: Marketing site
task: change the founder quote or any headline claim on the marketing site
keywords: [founder quote, blockquote, marketing site copy, website quote, why choose us, overclaim, results only pricing, performance fee promise, site voice, boldlinemedia.com copy]
status: verified
summary: The founder quote on the marketing site is the one personal moment on the page, so it must say something no other section says and must never promise more than the pricing block delivers. Replaced 2026-09-20: the old one repeated the fit section (small roster) and made claims any agency could make. The new one puts the performance fee in Bryson's own voice, worded so it is exactly true on every plan. A test reads the blockquote and fails on a results-only promise in either direction, or a drift back onto the roster or ad account ownership.
verified: 2026-09-20
---

## 🔴 THE MARKETING SITE SHIPS ITS COMMENTS, AND IS NOW POLICED (2026-09-20)

Found while confirming the founding-offer change had reached the live site: a grep of
boldlinemedia.com for the OLD founder quote still matched. `marketing-site/` is served raw
(`publish = "."`, no build step, no minifier), so **every HTML, CSS and JS comment in it is
readable in View Source**, and indexed along with the page.

Bryson said to clean it. Pulling the thread found worse than the one first flagged:

| What was shipping | Why it mattered |
|---|---|
| The comment beside the new founder quote | Reproduced the **previous pitch word for word**, plus his private note that he thought it was weak |
| The plan recommender | Said the one-time build *"is NOT named here on purpose"* with his reason attached, which tells a reader there is an **unlisted offer** and hands them the reason to ask for it |
| The ads landing page | **Documented its own past lead-tracking failures, with dates**, on the page paid social traffic lands on |
| A comment beside the hero form | Quoted **real campaign numbers** from a previous version of that page |
| Six more | His name, his Calendly question order, and a note that there is no Google Business Profile yet |

None of it was visible on the page. All of it was one keystroke away. All of it is now gone, and
**each cleaned comment points at the KB entry that holds the reasoning**, so the next person
editing that code can still find out why.

🔴 **`tests/verify-public-source.mjs` enforces this from here.** It extracts the comments (HTML,
CSS and JS shapes) from both served pages and fails on two crisp markers: **a person's name** in a
comment, and **a date** in a comment, which in this repo is always an incident note. It also pins
the three specific leaks by name, and checks that every KB entry a comment points at actually
exists, because a pointer to a file nobody wrote is worse than no pointer. The comment reader is
proved to work before anything is asserted with it. **6 mutations: five caught, and the one that
survives is a URL in visible copy, which must NOT trip it.**

**The rule, for next time.** Technical notes about how the code works are welcome and several are
load-bearing. What may not ship is the REASONING: who asked for something and in what words, what
was tried and failed, what is deliberately not advertised, and what a campaign produced. That goes
in `knowledge/`, which is what it is for.

The OS (`index.html` at the root) is deliberately exempt: it is behind a login, and its comments
are the durable record of why it works the way it does.

## 🔴 THE FOUNDER QUOTE (2026-09-20)

Bryson: *"right now it's a very weak quote. I want to put a quote in there that will be another
reason why to choose my agency to run your ads"*, then, on the old one's angle: *"companies don't
care who runs their ads personally they usually just want the most efficient way to guarantee
their money makes them more money"*.

**The old quote:** *"I keep the roster small on purpose. At a lot of agencies you get handed to a
junior and a dashboard you never asked for. Here you work with me directly, you get straight
answers, and your ads are actually managed, not set and forgotten."*

Two things wrong with it. It **repeated the page** (the fit section already says the roster is
kept focused), and its remaining claims were ones any agency can make and none can prove. It spent
the site's one personal moment restating the site.

**The new quote:**

> "Most agencies get paid the same whether your phone rings or not. I didn't want to build that.
> I only make more when your ads do, so we're both waiting on the same thing."

**Why this one.** The pricing block states the mechanic coldly (the monthly minimum or the
performance fee, whichever is higher, never both). The quote turns that into a promise from a
person, which is the one thing a pricing table cannot do. It is the strongest reason to pick
BoldLine over an agency and nothing else on the page says it in his voice.

🔴 **"I only make more when your ads do" IS EXACTLY TRUE, AND THAT WAS DELIBERATE.** A draft read
*"a real part of what I earn only shows up when your ads produce"*, which a reader takes as "no
results, no fee". That is **false** for any client on a monthly minimum, and the pricing section
two screens up would contradict it on the same page. What is true on every plan is that the
UPSIDE is entirely performance. Keep it that way if it is ever reworded.

**Guarded, not just remembered.** `tests/verify-site-matches-packages.mjs` now reads the
`<blockquote>` and fails if it promises results-only pricing (both directions: "you only pay
when" AND "I don't get paid unless"), or drifts back onto the roster, the junior, or ad account
ownership, which is the section directly above it. Six false rewords caught; an honest reword
still passes, so it pins the CLAIM rather than the string.

**Where the quote sits:** between "You keep the keys" (ad account ownership) and the reviews. So
it must not say anything about owning the ad account, the pricing promise, or the small roster.
Those are all said elsewhere.

**The other two "team" mentions on the site are NOT the same thing and were left alone:**

| Line | Why it stays |
|---|---|
| *"Big budget or small, you get the same team and the same effort."* | Not a small-team brag. It answers the fear a $500-a-month advertiser actually has, which is being deprioritised behind bigger accounts. |
| *"We keep our client roster focused, so we're upfront about fit."* | It is there to justify the niche list that follows it, not to sell a small team. |
