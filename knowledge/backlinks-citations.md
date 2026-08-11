---
name: backlinks-citations
topic: Marketing/SEO
task: work the off-site backlink / citation push for boldlinemedia.com (social profiles, map listings, directories) or check what's already claimed
keywords: [backlinks, citations, NAP, bing-places, apple-business-connect, yelp, facebook-page, instagram, clutch, upcity, directories, off-site-seo, nofollow]
status: in-progress
summary: Running list of every off-site profile that links to / cites boldlinemedia.com, with status. Started 2026-08-11 after the on-site SEO work was done. DONE - Facebook Page (username + links), Instagram (2 links + nationwide bio), Google Business Profile, personal LinkedIn. BLOCKED - LinkedIn Company Page (needs ~50 connections). NEXT - Bing Places, Apple Business Connect, Yelp. Social links are nofollow, so their value is entity/NAP consistency, not ranking power.
verified: 2026-08-11
---

## Why we're doing this (set expectations honestly)
On-site SEO is done (see `site-seo-cro-audit`, `pending-seo-next-steps`). The remaining
value is off-site. **Facebook / Instagram / most social links are `nofollow`** — they do
NOT pass ranking power. Their real value is as **citations**: Google cross-references the
business name, website, phone and category across profiles to confirm BoldLine is a real
operating business, which strengthens the Google Business Profile and the brand entity.
Links that actually pass authority come later from directories, press and partner mentions.
**Keep name / website / phone / category identical everywhere** — that consistency IS the
signal.

## Status board

| Source | Status | Notes |
|---|---|---|
| Google Business Profile | ✅ done | **Business location = "No location; deliveries and home services only" (NO address at all). Service area = United States** (confirmed in GBP → Edit profile → Location, 2026-08-11). That is the correct setting for the not-just-local positioning — keep it. It also means there is NO city on Google to match citations against, so a city-anchored listing elsewhere (Yelp needs one) creates no NAP conflict. Set up 2026-08-08/09. Review link `https://g.page/r/CSBqWru1WFp7EBM/review` wired into the site (`website-reviews`). Description is deliberately national: "Based in Phoenix and working with businesses locally and remotely across the U.S." |
| Google Search Console | ✅ done | 2026-07-07, domain property + sitemap (`pending-seo-next-steps`) |
| LinkedIn — personal | ✅ done | `linkedin.com/in/brysonweiser` — see `linkedin-brand-presence` |
| LinkedIn — Company Page | ⛔ blocked | "not enough connections" (2026-08-11). Needs ~50 connections + an account that isn't brand new. Copy is ready to paste in `linkedin-brand-presence`. Retry in 2-3 days. |
| Facebook Page | ✅ done | see below |
| Instagram | ✅ done | see below |
| **Bing Places** | ✅ done | see below |
| Apple Business Connect | ⛔ blocked | 2026-08-11: Apple Account creation failed with "Your account cannot be created at this time" — Apple's fraud/rate-limit block, not a user error. Bryson has NO Apple device (Samsung S25), which is fine: Business Connect is a website and Apple supports SMS 2FA. **Decision: use `brysonaweiser@gmail.com`** (he'll want that Apple Account on a future iPhone; two accounts sharing one phone number causes 2FA-code ambiguity + iMessage routing bugs). Workarounds, in order: incognito + no VPN/adblock, switch networks, create the account through the **Apple Music Android app** (far more permissive than the web form), or wait ~24h. |
| Yelp for Business | ⬜ todo | Free listing, high domain authority |
| Clutch / UpCity / DesignRush | ⏸ later | Agency directories — real backlinks + occasional leads, but the listing looks thin until there's a client review. Revisit after client #1. |
| BBB | ❌ skip | Costs money, low return pre-revenue |

## Facebook Page — done 2026-08-11
- Page was created during the Meta setup; it existed but was under-configured.
- **Username set: `facebook.com/BoldLineMedia`** (was the default numeric
  `facebook.com/profile.php?id=61591465304908`). Camel case on purpose — Facebook resolves
  usernames case-insensitively so the lowercase form still works, and it reads as the brand.
  Facebook limits username changes, so treat it as permanent.
- **Links (Public), added via Edit → Links** (Facebook allows up to 10):
  1. `https://boldlinemedia.com` — "BoldLine Media — Google & Meta Ads + Landing Pages"
  2. `https://calendly.com/theboldlinemedia/30min` — "Book a free 30-minute call"
- Bio already good: "Google Ads and Meta Ads management with custom landing pages. Your ad
  account stays yours." Category: Marketing Agency. Cover art on-brand.
- Optional leftover: the **Book now** action button under the cover → Calendly.

## Instagram — done 2026-08-11
`@boldlinemedia` (username already clean). 61 posts, 10 followers, dark+gold carousels.
- **Name field → `BoldLine Media | Ads & Landing Pages`** (was "…| Client Acquisition").
  The name field is what Instagram search indexes, and nobody searches "client
  acquisition." **First draft was "Google Ads Agency" — Bryson corrected it: he is not just
  a Google Ads agency.** "Ads" covers Google + Meta without picking one.
- **Bio rewritten** to kill the local ceiling (126/150 chars):
  > We build client acquisition systems
  > Ads + Landing Pages + Follow-Up
  > Based in Arizona · Working nationwide
  > Book a call below
- **Two bio links** (Instagram allows 5; only the first shows when collapsed, so the
  booking action goes on top):
  1. Calendly — "Book a Free Call"
  2. `boldlinemedia.com` — "See How It Works" (was titled "Book a Free Call", renamed when
     Calendly took that name)
- Also: confirm Professional account **Category = Marketing Agency** with *Display category
  on profile* ON, and an **Email** contact button (`theboldlinemedia@gmail.com`).

## Strategic call on Instagram (Bryson told, 2026-08-11)
61 posts → 10 followers. The content is good; the reach is zero. Recommendation given:
**keep the profile polished as a credibility check** (when a cold-call prospect googles
BoldLine, a real IG with 61 professional posts makes him look established) but **stop
investing hours in it**. Instagram is a slow, low-intent channel for a B2B agency — his
pipeline is cold calling + referrals. The only levers that would actually work there are
Reels + commenting on target accounts, which is real time he doesn't have pre-first-client.

## Bing Places — done 2026-08-11
Microsoft account = `brysonaweiser@gmail.com` (see `account-email-map`). Store code
`01799870380496599947`. Status after setup: **verified**, "Pending publish, ETA 7-12 days"
(normal for a new Bing listing — nothing is broken).

- **Setup path that worked:** bingplaces.com → sign in → **Import from Google Business
  Profile** → sign into the Google account that owns the GBP → select BoldLine Media →
  Import. That carried over name, phone `(602) 784-4228`, website
  `https://boldlinemedia.com/`, category "Marketing agency", hours, and the full
  description. Verification was automatic via the Google sync (no phone/postcard step).
  Address correctly left blank — service-area business.
- **The import does NOT carry:** photos, email, services, or social profiles. Filled in
  manually: email `theboldlinemedia@gmail.com`, Facebook + personal LinkedIn added to
  Social profiles (Instagram came across on its own), photos reused from the GBP set.
- **GOTCHA — Bing's Services field is a FIXED CATALOG, not free text.** I first gave Bryson
  Google-style free-text service names ("Google Ads Management", "Meta Ads Management",
  "Landing Page Design"…) and all seven landed in the *"Add a new service type"* pending-
  review queue instead of applying — only "Lead Generation" matched a real chip. **Always
  pick from Bing's existing chips.** The nine that fit BoldLine: Digital Marketing, Paid
  Advertising, Pay Per Click Consulting, Lead Generation, Social Media Marketing, Web
  Design, Email Marketing, Marketing Reports, Marketing Analysis. Deliberately NOT selected
  (he doesn't sell them, and listing them invites unqualified inquiries + price-shoppers):
  Search Engine Optimization / Seo Services, Branding, Logo Design, Graphic Design,
  Content Management, Affiliate Marketing.
- **Microsoft Advertising `$500 for $250` credit** was flagged to Bryson as a real later
  opportunity (not chased): Microsoft Ads has a one-click **import from Google Ads**, CPCs
  are typically cheaper, and the audience skews older/higher-income/desktop. Revisit once
  his own Google campaigns are running and converting — it's also a service almost no small
  agency offers clients.

## Outbound links FROM the site (added 2026-08-11)
Bryson asked to "add any backlinks we can to the website (facebook, instagram, linkedin)".
**Terminology correction given to him:** links from his site TO a profile are not backlinks
(a backlink points the other way) — but they still matter, because they complete the entity
graph so Google can confirm those profiles belong to the same business.

- **Footer social row** — Instagram, Facebook, LinkedIn as inline monochrome SVG icons
  (34x34 bordered squares, gold on hover, `rel="noopener noreferrer me"`). Added to every
  footer that has a nav: `index.html`, `404.html`, `privacy.html`, `terms.html`, and all
  blog pages via `netlify/lib/blog-render.mjs`. CSS lives in both `index.html` and
  `blog.css` (the two stylesheets). **`get-started/index.html` deliberately left bare** —
  it's a conversion page and social links only leak clicks off it.
- **Organization JSON-LD `sameAs`** → Instagram + the Facebook Page (org-owned profiles).
- **`founder` Person `sameAs`** → the personal LinkedIn. Deliberate: a personal profile
  does NOT belong on the Organization; on the founder object it links Bryson-the-person to
  BoldLine-the-business. **The LinkedIn Company Page goes on Organization `sameAs` when it
  exists.**
- **Fixed two "local" contradictions in the schema** (Bryson's standing not-just-local
  rule): `areaServed` was `"Arizona"` on Organization and `{State: Arizona}` on Service —
  both now `{Country: United States}` — and the Service description said "for local service
  businesses", now "for businesses across the United States, served locally and remotely."
- Verified headlessly at 390/768/1280/1600 (three icons, one row, inside the footer, zero
  overflow) and all three JSON-LD blocks re-parsed after editing.

## NEXT UP: Yelp for Business — everything a cold session needs
Bryson asked to do Yelp next (2026-08-11). Claim/create at `biz.yelp.com`. Free listing,
high domain authority. **Use these exact values so the NAP matches every other listing —
consistency is the whole point of this push:**

| Field | Value |
|---|---|
| Business name | `BoldLine Media` |
| Phone | `(602) 784-4228` |
| Website | `https://boldlinemedia.com` |
| Category | Marketing / Advertising agency |
| Location | **Gilbert, AZ 85296** — city/state/ZIP only; the street-address field is optional on Yelp, so LEAVE IT BLANK (the preview then shows just "Gilbert, AZ"). Gilbert is Bryson's real city; Google has no city at all, so there is nothing to conflict with. |
| Login email | **`theboldlinemedia@gmail.com`** — confirmed by Bryson 2026-08-11, recorded in `account-email-map` |

**Description** — reuse the GBP/Bing wording verbatim so all listings match:
> BoldLine Media is a digital marketing agency that helps businesses get more customers
> through paid advertising. We plan, build, and manage Google Ads and Meta (Facebook and
> Instagram) campaigns, and build custom landing pages designed to turn clicks into calls
> and leads. Based in Phoenix, we work with clients across the U.S. and remotely, so it
> doesn't matter where you are.

**Carry these rules in:**
- **Never write "local businesses"** anywhere — hard standing rule (see `linkedin-brand-presence`).
  Location fields say Phoenix; the pitch stays national/remote.
- **There is NO inbox at boldlinemedia.com** — Resend only SENDS from
  `hello@boldlinemedia.com`. Any "verify via your business domain email" flow silently
  fails. **Choose phone verification.**
- Expect a services/category picker that may be a **fixed catalog** (the Bing gotcha) —
  pick from what's offered rather than typing custom names, and don't claim SEO, branding,
  or logo design, which Bryson doesn't sell.
- Yelp will hard-sell paid ads during signup. Decline; the free listing is the whole goal.
- Add photos from the same set used on GBP/Bing, and the social links.

## Follow-ups
- **When the LinkedIn Company Page goes live, SWAP the personal LinkedIn for it** in every
  listing's social-profile field — Bing Places and the Google Business Profile both point at
  `linkedin.com/in/brysonweiser` right now, which was the correct call while the Company Page
  doesn't exist (solo founder, headline names BoldLine, better than an empty slot). Also add
  the Company Page to the marketing site's Organization JSON-LD `sameAs` and the site footer.
- **Which Google account owns the Google Business Profile?** Still not recorded in
  `account-email-map` — add it next time it comes up (the Bing import needed it).
