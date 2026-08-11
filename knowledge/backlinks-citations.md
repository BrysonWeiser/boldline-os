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
| Google Business Profile | ✅ done | Set up 2026-08-08/09. Review link `https://g.page/r/CSBqWru1WFp7EBM/review` wired into the site (`website-reviews`). Description is deliberately national: "Based in Phoenix and working with businesses locally and remotely across the U.S." |
| Google Search Console | ✅ done | 2026-07-07, domain property + sitemap (`pending-seo-next-steps`) |
| LinkedIn — personal | ✅ done | `linkedin.com/in/brysonweiser` — see `linkedin-brand-presence` |
| LinkedIn — Company Page | ⛔ blocked | "not enough connections" (2026-08-11). Needs ~50 connections + an account that isn't brand new. Copy is ready to paste in `linkedin-brand-presence`. Retry in 2-3 days. |
| Facebook Page | ✅ done | see below |
| Instagram | ✅ done | see below |
| **Bing Places** | ⬜ next | One-click import from the Google Business Profile. Underrated: Bing feeds DuckDuckGo, Yahoo, Microsoft Copilot, and ChatGPT web search — this is how you show up in AI answers. |
| Apple Business Connect | ⬜ todo | Free, puts him on Apple Maps (the default for every iPhone "near me" search) |
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

## Open questions to resolve
- **Which Google account owns the Google Business Profile?** Not recorded in
  `account-email-map`. Bing Places' import requires signing into that exact account.
  Record it in `account-email-map` once known.
- Does Bryson have a **Microsoft account**? Bing Places requires one (can be created using
  `theboldlinemedia@gmail.com` as the address — a Microsoft account doesn't need an
  @outlook address).
