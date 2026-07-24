---
name: ad-landing-page
topic: Marketing site
task: BoldLine's own ad landing page (boldlinemedia.com/get-started) that My Ads campaigns point to
keywords: [get-started, ad landing page, my ads, landing, calendly, unlisted, noindex, conversion, get more customers]
status: verified
summary: BoldLine's paid ads (My Ads) point to a hand-built premium landing page at boldlinemedia.com/get-started (marketing-site/get-started/index.html) — NOT the AI /lp generator and NOT the homepage. Unlisted (noindex + not in nav/sitemap) so only ad clicks reach it, keeping lead tracking clean. Primary CTA = Book a Call (Calendly popup w/ UTMs); backup Netlify "get-started" form → website_leads (main OS Leads screen) with a professional success state. Built 2026-07-24.
verified: 2026-07-24
---

**Decision (Bryson, 2026-07-24):** for BoldLine's OWN ads, use a **dedicated landing page, not the homepage** (message-match + focus + Quality Score + clean tracking — it's literally what BoldLine sells), hosted **under boldlinemedia.com** for professionalism but **unlisted** so only ad clicks reach it. Hand-crafted (not the AI /lp generator) because it's the flagship and must be perfect.

**The page:** `marketing-site/get-started/index.html` → served at **boldlinemedia.com/get-started** (Netlify serves the folder's index.html at both /get-started and /get-started/; no redirect needed; marketing netlify.toml has no catch-all so real files serve directly).
- **Design:** reuses the marketing site's exact tokens (`--gold #C8A84B`, dark `--bg #080A0F`, Playfair Display + Inter, gold-line borders, reveal animations). Hero with cursor-following glow + shimmer gradient headline, 4 value cards (hover lift), 5-step process, founder trust band (`/founder.jpg`), final CTA. Micro-animations + scroll-reveal (IntersectionObserver, **reduced-motion + no-JS safe** via `html.js-anim .reveal` gate + a 2.2s showAll safety net so nothing sticks hidden). Verified 0px overflow at 390/768/1280/1600.
- **CTAs:** "Book a Free Strategy Call" opens **Calendly in an on-page popup** (`Calendly.initPopupWidget`, falls back to the plain link) with UTM params (`utm_campaign=get_started`). Backup: a "Leave your details" **Netlify form `name="get-started"`** → flows through the existing `submission-created.mjs` into **`website_leads`** (the main OS Leads screen, `form:"get-started"` so ad leads are identifiable) → **professional success state** ("Got it — thank you! Bryson will reach out within one business day…").
- **Unlisted / ad-only:** `<meta name="robots" content="noindex,nofollow">`, not in the site nav, not in the sitemap. Practical "only via the ad" (URL isn't discoverable elsewhere). No content fabrication — process + what-you-get only, per BLOG_FACTS (no fake testimonials/stats); the true "limited number of businesses" line is used.
- **Honesty rule intact:** "You own your ad account and pay Google/Meta directly — BoldLine never touches your spend."

**OS wiring:** My Ads → **Assets** tab shows a **"Your Ad Landing Page"** card (internal-only) with the URL `boldlinemedia.com/get-started`, Preview + Copy-Ad-URL buttons, and the lead-flow note — REPLACING the AI "Generate Landing Page" card for the house account (regular clients still get the AI generator).

**Deploys with `main`** (both the marketing site and OS build from the repo). 

**Lead outreach on the MAIN Leads screen (added 2026-07-24):** the book-a-call outreach tool now also lives on `LeadCard` (the main Leads screen), so every inbound prospect — website contact form AND ad-landing `get-started` form — can be worked from one place with one-tap Email/Text (personalized draft + Calendly link) + Copy + status. `LEAD_STATUSES` gained a **`meeting`** stage ("Meeting Booked", purple) with `LEAD_STATUS_LABEL`. Phone comes from `lead.phone || lead.payload.phone`. Calendly is still the PRIMARY self-book path; this handles the form leads.
