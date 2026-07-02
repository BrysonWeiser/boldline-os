---
name: pending-seo-next-steps
topic: Pending
task: pick up the next unstarted marketing/SEO steps now that the site is live (Google Ads resubmit, Search Console, Business Profile)
keywords: [basic-access-resubmit, search-console, sitemap.xml, business-profile, GA4]
status: verified
summary: Offered-but-unstarted next steps now that boldlinemedia.com is live — (1) resubmit Google Ads Basic Access referencing the live domain + a business-model/MCC note; (2) set up Google Search Console and submit the sitemap; (3) optional Google Business Profile; (4) optional GA4.
verified: 2026-07-02
---

Context: the second Netlify site and the custom domain are **DONE** (marketing site live at `boldlinemedia.com`). These are the next steps offered but not yet started:

1. **Resubmit Google Ads Basic Access** (now that the site is live at the real domain): reference the live site URL, and — per Google's own rejection email — since the site is intentionally minimal, add a short note in the application describing the business model + intended API use (managing multiple clients' campaigns via one **MCC**), not relying on the site alone. The prior rejection was purely about the old Wix site having no relevant content; **do NOT resubmit with the same responses** (see `google-ads-api`).
2. **Google Search Console** (free; the highest-leverage step for getting the blog crawled/indexed fast): `search.google.com/search-console` → **Add property** → `boldlinemedia.com` → verify ownership (the DNS panel makes the TXT-record verification a copy/paste) → **Sitemaps** → submit `https://boldlinemedia.com/sitemap.xml`.
3. **Google Business Profile** (free, optional): `business.google.com/create`, category **Marketing Agency**, service-area business (no public office needed). Drives local "near me" search visibility — a different, often faster channel than blog SEO.
4. **Google Analytics GA4** (optional): real visitor/source data (which post drives traffic, paid vs. organic); not required to rank. Needs Bryson to create the account (walk through click-by-click when wanted).

(Related one-time setup TODOs already documented elsewhere: run `docs/sql/blog-schema.sql` in Supabase; add `SUPABASE_SERVICE_ROLE_KEY` on the marketing site; add `RESEND_API_KEY` on the marketing site; turn on Netlify Forms notifications — see `blog-backend-automation`, `supabase-access-model`, `resend-email-sending`, `netlify-forms-wiring`.)
