---
name: service-add-ons
topic: Sales
task: decide whether to add services beyond ads and landing pages (Google Business Profile, website care, reviews, SEO, social), or price them against competitors
keywords: [add-on, add-ons, upsell, google business profile, GBP, google maps, map pack, website management, website care, hosting, maintenance, review requests, reviews automation, SEO retainer, social media management, competitor pricing, what other agencies charge, car detailer, $500 a month]
status: review requests LIVE 2026-10-05 (table created); GBP care and websites not built
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

## ✅ 2026-10-05 — REVIEW REQUESTS BY EMAIL: BUILT

Bryson: "yea lets do that". Client record → new **Reviews** tab (hidden on the house account).
- He saves the client's **Google review link** (only Google hosts accepted, server and screen run the
  same check) and a **"Name customers see"** (Springbok: legal name is Springbok Chiropractic, LLC, the
  public brand is Springbok Wellness; LLC/Inc suffixes are also stripped automatically).
- He pastes customers, one per line (`Name, email`, bare email, `Name <email>`, spreadsheet rows).
  Skips are explained: unsubscribed (forever), asked in the last 90 days, listed twice, not an email.
- `review-requests-run` (every 15 min) sends the email, then ONE reminder 3 days later. Only 10am to
  6pm Phoenix; cap **40/day across all clients** (`REVIEW_DAILY_CAP` optional override), 20/day per
  client, because Resend's free plan is 100/day for everything the OS sends.
- From `"<brand>" <REPORTS_FROM_EMAIL address>`, Reply-To = the client's own email, footer = brand +
  businessAddress + unsubscribe. Hand-written copy, tested for no dashes, no emojis, no gating, no
  incentives, exactly two links (Google + unsubscribe).
- Unsubscribe page `review-optout`: GET shows a button, POST (or Gmail one-tap) opts out, because email
  scanners open every link. An opt-out blocks that address for that client forever.
- 🔴 Data lives in its own table **`review_requests`** (`docs/sql/review-requests-schema.sql`), NOT on the
  client record: the browser writes the whole client record back and could roll "sent" back to
  "queued" (double email) or undo an unsubscribe (legal problem). Rows are claimed with a conditional
  update before sending, and every send carries a Resend Idempotency-Key. Added to the nightly backup.
- ✅ **SQL RUN by Bryson 2026-10-05** (confirmed: the table answers through the public API, 200 with no rows visible, as RLS intends). Before that, until then the tab says "one-time setup" and the
  sender skips quietly (no alert spam). The backup email will list the table as "does not exist yet".
- Health clients (Springbok) show an amber BAA warning: patient emails are protected health info.
- Not built (by design): a portal page for clients to add customers themselves. Bryson pastes for now;
  build the portal entry once a client is paying for this.
- Tests: `verify-review-requests` (74 checks, 8 mutations caught); driven at 390/768/1280/1600.

## 2026-10-05 — "what email is it sent from? from me it would look like a scam"

Answer given: NOT from Bryson. Inbox shows the BUSINESS NAME as the sender ("Springbok Wellness"),
subject "Thanks for choosing Springbok Wellness", replies go to the business's own email. The address
behind the name (visible only if the customer taps it) is BoldLine's verified sending address
(REPORTS_FROM_EMAIL, hello@boldlinemedia.com). That is how the big review tools (Podium, Birdeye,
NiceJob) work too. The footer says "Sent by <brand>", BoldLine is never named.
**Upgrade, not built:** send from the client's OWN domain (e.g. hello@springbokwellness.com). Needs the
client's web person to add ~3 DNS records once, and Resend's free plan covers only one domain, so it
means a paid Resend plan (about $20/mo, believed; check before quoting). Build when a paying client
wants it; bake the cost into the add-on price.

**Brendon:** raise it only AFTER he signs (the pay-per-show terms are still open; don't stack asks on
an unsigned deal). Recommended offer: free for the first 3 months as a founding client, for a case
study. A BAA must be signed first (patient emails are PHI). Draft text given to Bryson.
🔴 **For the GBP build later:** review REPLIES for health clients must never confirm the reviewer is a
patient (HIPAA). Generic thanks only. Same for any review content the OS drafts.
