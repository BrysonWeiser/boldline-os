---
name: site-seo-cro-audit
topic: Marketing site
task: the 2026 SEO / GEO / conversion audit of boldlinemedia.com — what was researched, what got implemented, and what's left (mostly Bryson's DIY)
keywords: [SEO, GEO, AI Overviews, conversion, CRO, E-E-A-T, llms.txt, schema, Service schema, lead magnet, Lead-Leak Check, audit.mjs, mobile sticky CTA, blog author byline, Google Business Profile, backlinks, Core Web Vitals, ranking, front page]
status: verified
summary: Site audit done 2026-08-06 (Bryson asked to research current Google ranking + conversion best practices and compare to boldlinemedia.com). 2026 landscape: E-E-A-T + helpful content + Core Web Vitals + backlinks for SEO; GEO/AI-Overviews read the first ~200 words + entity signals + llms.txt; conversion needs value-prop-in-5s, social proof, low-friction forms, speed, strong CTA, risk-reversal. IMPLEMENTED (2 deploys): llms.txt, Organization founder + Service JSON-LD, answer-first keyword hero line, hero risk-reversal trust bar, a "Lead-Leak Check" lead magnet (audit.mjs -> website_leads form:lead_leak -> OS Leads), mobile sticky Book-a-Call bar, and blog E-E-A-T (named Person author Bryson Weiser + byline + author-bio box). PENDING = Bryson's DIY: Google Business Profile (highest leverage + fixes the entity/logo mixup), backlinks/citations, PageSpeed/Core-Web-Vitals check, phone/click-to-call (Twilio, deferred), pricing-grid trim, A/B testing.
verified: 2026-08-06
---

**Research basis (2026):** SEO — E-E-A-T (real experience/expertise/trust), genuinely helpful original content, Core Web Vitals (LCP/INP/CLS), mobile-first, authoritative backlinks; mass AI content is suppressed. GEO (AI Overviews on a large share of searches) — first ~200 words must answer directly, strong entity signals, `llms.txt` emerging. Conversion — clear value prop <5s, social proof, 3–5 field forms, speed (1s ≈ 3× a 5s page), mobile, one strong CTA, risk-reversal.

**Site baseline (already good):** clear pain hook + value prop, FAQ + Organization schema, sitemap (dynamic `sitemap.mjs`) + robots + canonical + OG, "you own your account" trust, ~2,500 words, fast static hosting, weekly blog + newsletter, a founder-credibility section with a real headshot (`founder.jpg`) + "you work with me directly" quote.

**IMPLEMENTED (marketing-site):**
- **`llms.txt`** (new, site root) — GEO: guides AI crawlers, restates the entity (what BoldLine is, services, owner, Phoenix).
- **Schema (head of index.html):** Organization gained `founder` (Bryson Weiser, E-E-A-T); new **Service** JSON-LD (Google/Meta ads mgmt + landing pages, areaServed AZ, $350 offer).
- **Hero answer-first line:** the lead `<p>` now opens "BoldLine Media is a Phoenix agency that plans, builds, and runs your Google & Meta ads…" — SEO keywords + AI-Overview answer + entity/logo disambiguation, while keeping the pain-hook H1.
- **Risk-reversal trust bar** under the hero CTA (own your account / month-to-month after 90 days / we tell you before you spend).
- **#2 Lead-Leak Check lead magnet:** a low-friction `<section id="lead-leak">` (website + email + honeypot) before the contact form; AJAX → new **`marketing-site/netlify/functions/audit.mjs`** → inserts `website_leads` row `form:"lead_leak"` (reuses SUPABASE_SERVICE_ROLE_KEY; honeypot + email validation; fail-soft). Shows in the **OS Leads** screen (loadLeads only filters out `form:"newsletter"`). **No new table, no setup — works on deploy.** Bryson delivers the mini-audit manually (could be automated later). What a Lead-Leak Check is: a free mini-audit of a prospect's site/funnel/ads showing where they lose customers + the top fixes — a value-first hook that captures people not ready to book a call.
- **#5 Mobile sticky CTA:** fixed bottom "Book a Free Call" bar at ≤760px (desktop keeps the header CTA); body bottom-padding so it never covers content.
- **#8 Blog E-E-A-T (`blog-post.mjs`):** Article `author` Organization→**Person "Bryson Weiser"** (+url to /#founder); visible "By Bryson Weiser" byline; author-bio box (headshot + one-line bio) after the article; publisher logo → icon.png.

**PENDING — Bryson's DIY (highest-leverage first):**
1. **Google Business Profile** (google.com/business) — service-area business (Phoenix metro, hide address), category Advertising agency, upload icon.png logo, services, Calendly booking link, verify. Biggest single win + the real fix for the wrong-logo/knowledge-panel/AI-Overview entity mixup.
2. **Backlinks/citations** — Clutch, UpCity, local Chamber, LinkedIn company page; consistent NAP; earn links via the blog. New domain = slow without authority.
3. **Core Web Vitals** — run pagespeed.web.dev + Search Console → Experience; if Calendly/fonts drag it, ask me to lazy-load Calendly (load on click).
4. **Phone / click-to-call** — ties to the deferred Twilio tracking number (post-first-client).
5. **Pricing-grid trim** to "3 starting points" (I can do). 6. **A/B test** headlines/CTAs ~2–3/mo once there's traffic.

**Deploys:** rollback/20260806T173621Z (batch 1) + rollback/20260806T175721Z (batch 2). See docs/DEPLOYS.md.
