---
name: service-add-ons
topic: Sales
task: decide whether to add services beyond ads and landing pages (Google Business Profile, website care, reviews, SEO, social), or price them against competitors
keywords: [add-on, add-ons, upsell, google business profile, GBP, google maps, map pack, website management, website care, hosting, maintenance, review requests, reviews automation, SEO retainer, social media management, competitor pricing, what other agencies charge, car detailer, $500 a month]
status: proposed
summary: 2026-10-05 a long-running car detailer told Bryson on a cold call that his agency charges $500/mo to run ads, plus extra for managing his Google Business Profile and his website. Recommendation given: do NOT become a menu agency (pay-for-results is the differentiator and the counter-pitch to a flat $500/mo); add only add-ons that produce leads and that the OS can mostly automate. Order: (1) Google Business Profile care, (2) review-request texts after a job, (3) website care for sites BoldLine built. Skip SEO retainers and social media management. Nothing built; offer them by hand first, build only once 2 or 3 clients pay for one.
verified: 2026-10-05
---

## The intel (cold call, Mon 5 Oct 2026)

A car detailer "who's been around for a while" pays his agency **$500/month to run ads**, plus
**extra** for managing his **Google Business Profile** and his **website**. Asking a prospect what
they pay now and what they get for it is the best market research available; keep asking it.

## The recommendation (given to Bryson)

🔴 **The model is the moat.** A flat $500 a month whether the phone rings or not is exactly what
"you only pay for real leads" beats. Matching that agency service for service turns BoldLine into one
more vendor on a price list. Add only what (a) makes the client more leads and (b) the OS can mostly
run by itself (the end goal: bots do the work, Bryson calls and closes).

| Add-on | Verdict | Why |
|---|---|---|
| **Google Business Profile care** (weekly posts, photos, replying to every review, hours/services kept right) | 🟢 **First** | The map listing is where most "near me" calls come from. Cheap to run, mostly automatable, and an existing profile only needs manager access, like the ad account. Suggested **$150/mo**, or folded into a top tier. |
| **Review-request texts** after each job | 🟢 **Second** | More 5-star reviews lift the map listing AND the ads. Fully automatable. Pairs with GBP care. Needs SMS consent handled (KB `sms-consent`). |
| **Website care** (hosting, edits, keeping it fast) | 🟡 **Only for sites BoldLine built** | Steady monthly money once built, but taking over someone else's old site is a support pit. Full website BUILDS are a separate one-off project price (Brendon at Springbok has already asked about one). |
| SEO retainer | 🔴 Skip | Slow, hard to prove, and contradicts "pay for results". |
| Social media management | 🔴 Skip | The biggest time sink in the industry, does not automate well, rarely makes leads for trades. |

**Sequencing:** sell each one by hand to a real client first; build the automation only once two or
three clients are paying for it. Do not build a menu for clients that do not exist yet. The
niche lock (pool remodels, 100 calls, KB `niche-selection`) is unaffected; these are add-ons to the
same offer, not a new direction.

## 2026-10-05 — how hard each is, and the build order recommended

Bryson asked how hard the three are to build and automate, and whether to do it alongside calling.
Answer: the BUILD is Claude's time, not his; his cost is setup clicks. So yes in parallel, but calls
stay first (add-ons sell to nobody without clients).

| | Difficulty | The real blocker |
|---|---|---|
| **Review requests by EMAIL** | Small (a session or two) | None: Resend already sends from boldlinemedia.com. |
| Review requests by TEXT | Small code, slow setup | Texting is OFF (`SMS_ENABLED`, Twilio trial) and A2P is per CLIENT business (KB `client-text-back`). Email first, text later. |
| **Google Business Profile care** | Medium | Google must approve API access (form + wait, weeks, like Meta). Requirement is a verified profile ~60 days old: BoldLine's own was verified 2026-08-08/09, so eligible about 8 Oct. Until approved, the OS DRAFTS weekly posts and review replies and Bryson pastes them (~5 min per client per week). |
| Website care / full websites | Large | Landing-page hosting + custom domains already exist; multi-page sites do not. Hold until a client (Brendon) actually pays for a site. |

🔴 **Correction to "ask happy customers":** Google's policy bans REVIEW GATING (asking only satisfied
customers, or screening first). Every customer gets the same request. Any build must not filter.
