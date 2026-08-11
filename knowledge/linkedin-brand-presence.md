---
name: linkedin-brand-presence
topic: Marketing/SEO
task: set up, edit, or reference BoldLine's LinkedIn personal profile + Company Page (copy, positioning, images, backlinks)
keywords: [linkedin, company-page, personal-brand, headline, backlinks, sameAs, banner, cover-image, profile-url, services, positioning, not-local, national]
status: in-progress
summary: LinkedIn is backlink source #1 of the backlink push (started 2026-08-11). Personal profile "Bryson Weiser" is LIVE; the BoldLine Media Company Page is NOT created yet. HARD POSITIONING RULE from Bryson — never say "local businesses" anywhere; he serves businesses nationally/remotely. Approved copy for every field (headline, About, services, tagline, page About) is recorded here verbatim so it stays consistent with the GBP wording. LinkedIn image assets are generated + committed at brand/linkedin/.
verified: 2026-08-11
---

## Why LinkedIn (the point)
First source in the **backlink push** for boldlinemedia.com. The link that actually
matters is the **Website field on the Company Page** (plus Contact info on the personal
profile). Once the Company Page URL exists it goes into the marketing site's
**Organization JSON-LD `sameAs`** array (`marketing-site/index.html`) alongside Instagram,
so Google connects site ↔ LinkedIn. **PENDING: Bryson must send the Company Page URL.**

## HARD RULE — never limit to "local" (Bryson, 2026-08-11)
> "remember I dont want to limit myself to just being local"

I had drafted a headline ending in "…for local businesses". **Wrong.** Bryson is
Phoenix-*based* but serves businesses **across the U.S. and remotely** — Google/Meta Ads +
landing pages are 100% remote-deliverable. Applies to LinkedIn, GBP, the marketing site,
and any future profile/directory copy.

- **Positioning copy = outcome-based, geography-free.**
- **Location *fields* = Phoenix, Arizona** — anchors the local network for cold outreach
  and referrals without capping reach. The "anywhere" message lives in the headline/About,
  never in the location dropdown.
- Anywhere there's a remote toggle (LinkedIn Services "available to work remotely",
  Location type "Remote"), **turn it on** — that's what puts him in nationwide results.
- Matches the GBP description line already in use: *"Based in Phoenix and working with
  businesses locally and remotely across the U.S."* Keep all profiles worded consistently
  so Google sees matching business info everywhere.

## Personal profile — LIVE (approved copy)
- **Name:** Bryson Weiser · **Location:** Greater Phoenix Area
- **Headline** (98/220):
  `Founder at BoldLine Media | Google & Meta Ads + Landing Pages that bring businesses more customers`
- **Experience → position:** Founder · BoldLine Media · Phoenix, Arizona ·
  Location type **Remote** · Self-employed · started **August 2026** · currently working here
- **Industry:** Advertising Services
- **Skills:** Google Ads, Meta Ads, Pay Per Click (PPC), Landing Page Optimization, Digital Marketing
- **About / summary:**
  > I build the ad campaigns and landing pages that turn strangers into booked customers — for businesses that want to grow, wherever they are.
  >
  > BoldLine Media runs done-for-you Google & Meta Ads paired with custom, high-converting landing pages. You focus on serving customers; we handle filling the pipeline. Based in Phoenix, working with businesses across the U.S. and remotely.
- **Services section** (adds a "Services" button + puts him in LinkedIn's service-provider
  search): services = Advertising, Digital Marketing, Search Engine Marketing (SEM), Social
  Media Marketing, Lead Generation, Web Design, Marketing Strategy. Work location = Greater
  Phoenix **+ "available to work remotely" checked**. Pricing = **Contact for pricing**
  (never an hourly rate — anchors low + invites price shopping instead of a call; same
  reason the marketing site shows no public pricing). Messages = **Open Profile ON** so
  non-connections can message free (free inbound lead channel).
  Description (330/500):
  > I build and manage Google & Meta Ads campaigns paired with custom, high-converting landing pages, so your ad spend turns into booked customers instead of just clicks. Done-for-you setup, ongoing optimization, and straight reporting on what's actually working. Based in Phoenix, working with businesses across the U.S. and remotely.
- **Public URL: `https://www.linkedin.com/in/brysonweiser`** (confirmed 2026-08-11).
  Was the auto-generated `linkedin.com/in/bryson-weiser-649b70369`; changed via
  Public profile & URL → pencil → Edit your custom URL.

## Company Page — NOT CREATED YET (approved copy, ready to paste)
Create at `linkedin.com/company/setup/new` (or grid icon "For Business" → Create a
Company Page +) → type **Company**.
- **Name:** BoldLine Media · **Public URL:** `linkedin.com/company/boldlinemedia`
- **Website:** `https://boldlinemedia.com` ← **this field IS the backlink; must include https://**
- **Industry:** Advertising Services · **Size:** 0-1 employees · **Type:** Privately Held (it's an LLC)
- **Tagline** (≤120): `Google & Meta Ads + high-converting landing pages that bring businesses more customers.`
- **About / Overview** (third person, mirrors GBP):
  > BoldLine Media builds the ad campaigns and landing pages that turn strangers into booked customers.
  >
  > We run done-for-you Google & Meta Ads paired with custom, high-converting landing pages. The two work together on purpose: strong ads pointed at a weak page waste money, and a great page nobody sees does nothing. We own the whole path — from the click to the booked customer — so business owners can stop guessing about their marketing and get back to running their business.
  >
  > Every dollar into ads should come back as leads you can actually close. That means tight targeting, pages built to convert, and follow-up that reaches people while they are still interested. No long contracts, no jargon, no unmeasurable "brand awareness."
  >
  > Based in Phoenix and working with businesses locally and remotely across the U.S.
- **Location:** Phoenix, Arizona · **Custom button:** "Visit website" → `https://boldlinemedia.com`
- **Hashtags:** #GoogleAds #DigitalMarketing #LeadGeneration
- After creating: go back to the personal profile's Founder position and **re-select
  BoldLine Media from the Organization dropdown** so it links the real page (it's plain
  text until the page exists). Then **Invite connections** — a 0-follower page reads abandoned.

## Where the website / Calendly links live on LinkedIn
1. **Contact info** (profile → "Contact info" → pencil → **+ Add website**): boldlinemedia.com
   (type Company) and Calendly (type Other). This is the personal-profile backlink.
2. **Featured section** (Add profile section → Recommended → Add featured → Add a link):
   big visual cards, highest CTR. One for the site, one for Calendly titled
   "Book a free 30-minute call."
3. **Custom profile button** (Edit intro → very bottom, "Website" field with a button-label
   dropdown) — set to "Book an appointment" → Calendly. Not on every account; skip if absent.
4. **Company Page:** Website field + custom button (above).

CALENDLY_URL = `https://calendly.com/theboldlinemedia/30min` (see os-calendar / account-email-map).

## Image assets — committed at `brand/linkedin/`
Generated from `marketing-site/logo.png` (the gold BP mark) on the site palette
(bg `#070810`, gold `#C8A84B`, text `#F0F2FF`, dim `#8B91B8`). Regenerate with the two
Python scripts in that folder (PIL; they write next to themselves).

| File | Size | Used for |
|---|---|---|
| `linkedin-logo.png` | 400×400 | Company Page logo (LinkedIn min 300×300) |
| `linkedin-cover-company.png` | 1128×191 | Company Page cover |
| `linkedin-banner-personal.png` | 1584×396 | Personal profile background |

**Gotcha:** on a personal profile the profile photo overlays the **bottom-left** of the
banner, and on a Company Page the logo overlays the bottom-left of the cover. The personal
banner was rebuilt with all content shifted **right of x≈520** for this reason — keep any
future banner's content out of the bottom-left and vertically centered (LinkedIn crops
top/bottom on mobile).

## Open items
- [ ] Bryson sends the **Company Page URL** → add to Organization JSON-LD `sameAs` in `marketing-site/index.html`
- [ ] Add a **LinkedIn link in the marketing-site footer** next to Instagram (the reciprocal link)
- [x] ~~Confirm the final personal custom URL~~ → `linkedin.com/in/brysonweiser` (2026-08-11)
- [ ] Continue the backlink list past LinkedIn (citations/directories next)

## GOTCHA — brand-new accounts can be blocked from creating a Company Page
LinkedIn gates Page creation behind personal-profile requirements: a profile photo, a
listed **current position at the company you're creating the page for**, some
**connections**, and an account that isn't brand new (roughly a week / "Intermediate"
profile strength). Bryson's account was created 2026-08-11, so if "Create page" errors
out ("we couldn't create your page / complete your profile and try again"), it is NOT a
copy problem — send ~20-30 connection requests, confirm the Founder position is listed,
and retry in a few days. Everything else in this entry is ready to paste when it unblocks.
