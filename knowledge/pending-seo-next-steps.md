---
name: pending-seo-next-steps
topic: Pending
task: pick up the next unstarted marketing/SEO steps now that the site is live (Google Ads resubmit, Search Console, Business Profile)
keywords: [basic-access-resubmit, search-console, sitemap.xml, business-profile, GA4]
status: verified
summary: Offered-but-unstarted next steps now that boldlinemedia.com is live — (1) resubmit Google Ads Basic Access referencing the live domain + a business-model/MCC note; (2) set up Google Search Console and submit the sitemap; (3) optional Google Business Profile; (4) optional GA4.
verified: 2026-07-04
---

Context: the second Netlify site and the custom domain are **DONE** (marketing site live at `boldlinemedia.com`). These are the next steps offered but not yet started:

1. **Resubmit Google Ads Basic Access** (now that the site is live at the real domain): reference the live site URL, and — per Google's own rejection email — since the site is intentionally minimal, add a short note in the application describing the business model + intended API use (managing multiple clients' campaigns via one **MCC**), not relying on the site alone. The prior rejection was purely about the old Wix site having no relevant content; **do NOT resubmit with the same responses** (see `google-ads-api`).
2. **Google Search Console** (free; the highest-leverage step for getting the blog crawled/indexed fast): `search.google.com/search-console` → **Add property** → `boldlinemedia.com` → verify ownership (the DNS panel makes the TXT-record verification a copy/paste) → **Sitemaps** → submit `https://boldlinemedia.com/sitemap.xml`.
3. **Google Business Profile** (free, optional): `business.google.com/create`, category **Marketing Agency**, service-area business (no public office needed). Drives local "near me" search visibility — a different, often faster channel than blog SEO.
4. ~~**Google Analytics GA4**~~ — **DONE 2026-07-22.** Property + web stream created for boldlinemedia.com; gtag `G-MG7T0687RT` live in `marketing-site/index.html`. See `ga4-analytics` (incl. the pending "GA4 data inside the OS" Data-API build, deferred until after Meta submit).

(Related one-time setup TODOs already documented elsewhere: run `docs/sql/blog-schema.sql` in Supabase; add `SUPABASE_SERVICE_ROLE_KEY` on the marketing site; add `RESEND_API_KEY` on the marketing site; turn on Netlify Forms notifications — see `blog-backend-automation`, `supabase-access-model`, `resend-email-sending`, `netlify-forms-wiring`.)

**2026-07-04 (post-audit prioritized plan, agreed with Bryson):** the site itself is done/fast
(full audit clean); remaining value is off-site, in this order:
1. ~~**Google Search Console**~~ — **DONE 2026-07-07.** Domain property `boldlinemedia.com`
   verified via DNS TXT (Wix panel, "Domain name provider" method). Apex sitemap
   `https://boldlinemedia.com/sitemap.xml` submitted. **Homepage was ALREADY indexed** ("URL is
   on Google") — no Request Indexing needed. GOTCHA found: the property carried an old
   **Wix-era sitemap** row (`https://www.boldlinemedia.com/sitemap.xml`, submitted Oct 2025,
   0 pages) — Wix's SEO tools had auto-connected the domain to Google back then; told Bryson to
   remove that stale row (⋮ → Remove sitemap). Note for a Domain property the "Add a new
   sitemap" box needs the FULL URL (no pre-filled prefix like URL-prefix properties).
2. ~~**Resubmit Google Ads Basic Access**~~ — **SUBMITTED 2026-07-07**, awaiting Google's
   decision (~3 business days). Details + form gotchas in `google-ads-api`.
3. **GA4 analytics** — site has ZERO analytics; once Bryson creates the property, wire the tag +
   events for package clicks / Calendly popup opens / form sends.
4. **Custom-domain email** (bryson@boldlinemedia.com, Google Workspace ~$7/mo or Zoho free) —
   replaces the gmail on privacy page + Calendly; root-domain MX on Wix DNS should be possible
   (the Resend dead-end was a SUBDOMAIN record) and may unlock the dormant branded lead emails.
5. **Google Business Profile** (optional, local-pitch credibility).
Small folds-in: proper square favicon; first-client testimonial section someday.