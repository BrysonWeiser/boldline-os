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
client's web person to add ~3 DNS records once. **Resend pricing, checked 2026-10-05:** Free = 3 domains,
100 emails/day, 3,000/mo (boldlinemedia.com uses one, so TWO client domains fit free); Pro = $20/mo,
10 domains, 50,000/mo, no daily cap. Build when a paying client
wants it; bake the cost into the add-on price.

**Brendon:** raise it only AFTER he signs (the pay-per-show terms are still open; don't stack asks on
an unsigned deal). Recommended offer: free for the first 3 months as a founding client, for a case
study. A BAA must be signed first (patient emails are PHI). Draft text given to Bryson.
🔴 **For the GBP build later:** review REPLIES for health clients must never confirm the reviewer is a
patient (HIPAA). Generic thanks only. Same for any review content the OS drafts.

**2026-10-05, Bryson asked "in general, how do we get it to show the business's email":** explained
that writing their address in the From line without their domain's permission is spoofing (DMARC sends
it to spam or rejects it), so their domain must authorize us via DNS records. Three cases: (1) default,
business name + our address, replies to them, works for everyone; (2) business has its own domain:
their web person adds the records once, then mail shows e.g. reviews@theirbusiness.com; (3) business
only has a gmail/yahoo address: (2) is impossible, stays on (1). Offered to build a "send from their own
address" button (Resend domains API: add domain, show the records, check verified, then use it).
Not built yet.

## ✅ 2026-10-05 — ON EVERY ADS PACKAGE, IN THE AGREEMENT (terms v7), AND THE CLIENT CAN SAY NO

Bryson: "yes add that" + "is there a safeguard incase a client doesnt want it so its not added into the
contract". Decided in the reply before: included (not separately priced) on all 8 lead-gen packages
(g-*, m-*, c-*); NOT on shop packages (e-*, no "jobs") or the one-off hand-off build (no ongoing).
- Feature `review_requests` "Automatic Google Review Requests" added to ALL_FEATURES + PKG_FEATURES in
  all three copies (index.html, contract-shared.cjs, portal.mjs); website cards got the bullet
  "Automatic Google review requests" (8 cards, mapped in verify-site-matches-packages); Deal Prep picks
  it up automatically from PKG_FEATURES.
- 🔴 **Why it is in the contract at all:** the codebase rule (verify-site-matches-packages) is that the
  site may only advertise what the agreement lists. So it is a listed deliverable, with clause **1.4**:
  same request to every customer, no incentive, client confirms it may email the customers it gives,
  unsubscribe honored, and **client may switch it off any time by email or text, no fee change**.
- 🔴 **Terms v7** (TERMS_CURRENT 7, TERMS_V7_FROM 5 Oct 2026 20:00 UTC, CONTRACT_TERMS_VERSION 7). Without
  it, adding the feature would have added a line to agreements already SIGNED (they re-render fresh).
  `FEATURE_FROM_VERSION = { review_requests: 7 }`; Sebastian (v1) and Springbok's 28 Sep envelope (v6)
  are unchanged.
- **The safeguard:** Reviews tab checkbox "<client> doesn't want review requests" sets
  `declinedFeatures: ["review_requests"]`. Before the agreement goes out, it leaves the line AND clause
  1.4 out. Sending freezes the choice (`contractOmits`), so flipping it later never rewrites what they
  were sent (a voided envelope froze nothing). Either way it blocks queueing (screen + server) and stops
  anything already queued, reminders included. Clients whose agreement predates v7 see an amber note:
  get their OK in writing (a text) before sending.
- One function decides the list: `contractFeatureIds(cl)` (+ `omittedFeaturesOf`), in contract-shared
  and mirrored in index.html; used by the contract, the client portal's "included" list, the OS
  Included Features card and the OS portal preview. Parity tested on 5 cases.
- Tests: verify-review-requests now 91 checks (4 new mutations caught: no version gate, not frozen at
  send, sender ignores "no", OS copy drifts). Four contract test harnesses widened their lifted slice.
  Driven at 390/768/1280/1600 (tab checkbox + site cards).

**2026-10-05, Bryson: "make sure ... the service we just added is displayed on the website as well".**
Package-card bullets were already live (8 cards, confirmed on boldlinemedia.com). Also added: a 6th step
"More 5-star reviews" in the homepage "What we actually build for you" flow (between Leads and
Reporting), and a full-width 5th card "More 5-star reviews, automatically" on /get-started (the ad
landing page), full width so the 2-column grid has no orphan. Checked at 390/768/1280/1600.
/get-started's other four cards used emoji icons (against the no-emoji rule); Bryson saw a before/after and said
"update it": all five are now gold line SVG icons matching the homepage. New `tests/verify-site-no-emoji.mjs` reads
every marketing-site page (proven to fail on the old page).

## 🔴 2026-10-06 — WEBSITES: DECIDED, WE SELL THEM (reverses the 2026-08-31 "answer is no")

Bryson: "Ok now I want to work on adding the website service." Reminded of the 31 Aug decision (no
websites, refer to Shaun, because sites are manual forever and that was his side of the swap). What
changed: real demand (Brendon asked; the detailer's agency sells them), the OS already builds and hosts
landing pages so a templated site is mostly bot work, and Shaun has sent zero referrals (and said he
wanted to see BoldLine's work first, which Sebastian's silence now makes impossible).

**Decisions (Bryson, 2026-10-06):**
| | |
|---|---|
| Price | **$1,500 build + $100/month** care (hosting, upkeep, up to 2 small edits a month). Was $99 until 2026-10-07. |
| Who can buy | **Anyone**, not only ads clients |
| Pairing | Cross-sell both ways: a website buyer gets offered ads; an ads prospect with a weak site gets offered the website |
| Shaun | Heads-up is optional (see below) |

**Recommended shape (agreed in principle, details pending):** templated multi-page site generated by
the OS from client info (Home, Services, About, Reviews, Contact), not custom design; edits capped by
the care plan so "change this photo" is paid for and bounded; CLIENT OWNS THE DOMAIN (same principle as
ad accounts), and leaving means handing them a copy. Review requests then send from their own domain.

**Shaun:** neither side has referred anyone. The one reason for a heads-up: the 31 Aug email told him in
writing that BoldLine "steps out of any website job entirely", so changing course silently could read as
going back on your word if he hears it elsewhere. One line, optional, offered as a draft.

Build NOT started: flagged as an Opus-level multi-session build per CLAUDE.md, waiting on his go.


## Domain setup for website clients (decided + LIVE 2026-10-09)

Bryson asked whether a new website client should buy and connect their own domain from step-by-step
instructions, or whether BoldLine should do it for an extra fee as an optional add-on. Recommendation given:
- Offer both: free step-by-step (the OS already gives the DNS records), or a paid "we set it up" add-on.
- 🔴 Either way, the domain is bought **in the client's name, on the client's card**. Never on BoldLine's.
  This follows the hard constraint (the client pays for everything) and avoids "who owns the domain"
  fights if they ever leave.
- Done-for-you means they buy it (a 5 minute link) and give BoldLine delegate access at the registrar, then
  BoldLine connects it and sets up their business email on the domain.
- Suggested about $99 one time, including the business email setup.
- Build it only after the My Businesses side is finished (his order: his businesses first, then clients).

**Decided 2026-10-09 (Bryson chose the recommended option):** connecting the domain stays INCLUDED in every
website build, because agreement section 6 already promises it and charging extra on a $1,500 build would feel
nickel-and-dimed. The paid add-on became **Business email setup, $99 once** (WEBSITE_OFFER.emailSetup), a
checkbox and price in the Website deal card. Agreement **WA-4** adds section 6a only when it is chosen: up to
three mailboxes with the provider the client picks (Google Workspace, Microsoft 365), in the client's name, paid
by the client directly to the provider. The free option is the **"how to buy an address" guide**, copied from
the domain card ("Their web address") when no address is set: buy it in your own name, with your own email and
card, auto-renew on, then reply with the address. Pinned in verify-website-deal.

## Still to raise with Bryson (2026-10-09)
- **Google Business Profile creation and management.** Recommended first add-on (above), not built.
- **Review requests.** Already built for his own businesses (KB `business-emails`), so offering it to clients
  is mostly switching it on for them.
- **A "fully custom website" tier.** He floated it as an upsell; see KB `site-editor` (the AI editor is the
  engine for it).

## 2026-10-11 (Sun ~1am Phoenix): his questions, my answers (nothing built)
- **Automated texts for website clients ("like how Shaun does for his clients")**: yes, as a paid add-on, but only the
  texts that make money: an instant text back to every new enquiry and missed call, a reminder before a booked job,
  and a review request after it. Blocker is real: every business sending texts needs its own carrier registration
  (A2P 10DLC brand + campaign, a few weeks and some fees), and BoldLine's own texting is still off until that is done
  (KB website-booking-intake). Price it monthly; build once one client says yes.
- **"SEO ranking" retainers**: still no (same reasoning as above: hard to prove, easy to cancel). The SEO that moves
  the needle for these businesses is the Google Business Profile (already the #1 add-on recommendation) plus the blog
  add-on and the on-page work every site already gets.
- **Website designs, 3 -> 5?**: recommended holding at 3 (Cinematic, Aurora, Editorial). Each client already gets its
  own motion mix and 3D scene, Signature covers "custom", and every feature (booking, payments, brand kit, editor,
  before/after) must work and be checked in every design, so 5 means about two-thirds more upkeep and a slower choice
  for the client. Add a design only when a real prospect turns all three down, and aim it at that gap.


## 2026-10-14 (Wed ~8:30pm Phoenix): "Are we able to offer Google profile management yet?"
Answer: not built; sellable by hand today (client adds BoldLine as Manager on their profile; ~10 to 15 min/client/week;
~$150/mo). Automation needs Google's Business Profile API approval (form, days to weeks; BoldLine's listing passed the
60-day mark ~Oct 7). Recommended: apply now, and meanwhile a "Google listing" card that drafts the weekly post and review
replies (not built, offered). He asked for the application steps at 8am Thu Oct 15: reminder trig_01VEcPbVCrFhuiYhf1PqUT4s.
Requirements found: verified 60+ days, a website on the listing, a Google Cloud project NUMBER, "Application for Basic API
Access" on the GBP API contact form, an owner/manager email; quota stays 0 until approved.
- ✅ APPLIED 2026-10-19 (Mon, Phoenix): Google Business Profile API "Application for Basic API Access" submitted for
  Cloud project "BoldLine OS" (project id boldline-os, business gmail). Support case ID **9-0183000041683**. Google
  quoted 7 to 10 business days. 🔴 Submit only ONE request; a second case for the same project delays it. Answers given:
  website https://boldlinemedia.com, heard via the API documentation, reason = agency managing clients' profiles with
  their permission, verified 60+ days = Yes, already-allowlisted project = No. Approval check: the project's Business
  Profile API quota shows 300 QPM (0 = not approved). Also asked him to add business hours to BoldLine's listing.
- ✅ **APPROVED 2026-10-23 (Fri ~10:18am Phoenix)**: Google emailed that project 69639870912 ("BoldLine OS", id
  boldline-os) is allowlisted for the Google Business Profile API, default quota 300 queries per minute. Their next
  steps: enable the APIs in Cloud Console (API Library); the Workspace note does not apply (business gmail, no Workspace).
  Policy reminder from the email: never say or imply Google partners with, sponsors or endorses BoldLine.
  🔴 **Different Cloud project from Google Ads**: the Ads OAuth client and its verified consent screen live in
  `boldline-ads-api` (600403499313); Business Profile calls must come from an OAuth client in `boldline-os`, so that
  project needs its own consent screen set to In production (Testing expires refresh tokens every 7 days) and a
  refresh token from the Google account that is Manager on the profiles, scope `business.manage`.
  APIs to enable: My Business Account Management API, My Business Business Information API, Google My Business API
  (reviews and posts, v4), Business Profile Performance API. Nothing built yet; build offered (the Google listing card:
  drafted weekly posts, drafted review replies for approval, profile numbers), BoldLine's and owned businesses first.
- ✅ BUILT 2026-10-26: the Google listing card (KB `google-listing`). Waits on Bryson's setup (OAuth client in the
  BoldLine OS project, GBP_CLIENT_ID/GBP_CLIENT_SECRET in Netlify, Connect Google). Shown for BoldLine's own account and
  owned businesses; clients next, once one buys the add-on.
