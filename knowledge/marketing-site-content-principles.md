---
name: marketing-site-content-principles
topic: Marketing site
task: decide what copy, pricing, proof, and design to put on the marketing site (and where its content comes from)
keywords: [PACKAGES_DB, STAGES, no-public-pricing, calendly, playfair-display, recommender-quiz]
status: verified
summary: The marketing site pulls content from the OS's real data (PACKAGES_DB, STAGES), shows NO public dollar pricing (CTA/Calendly model), and uses NO testimonials/logos/stats (no real clients yet — honest boutique positioning). Dark+gold tokens, Playfair Display + Inter. Every CTA books a call.
verified: 2026-07-02
---

The marketing site (`marketing-site/index.html`) exists to unblock the Google Ads Basic Access rejection (a real, minimal, permanent static site — not throwaway Wix content, not the deferred AI-builder feature). Its durable content/design rules:

- **Grounded in real OS data, not invented copy:** the Services tabs (Google Ads / Meta Ads / Combined Systems / E-Commerce) show each platform's real tiers from `PACKAGES_DB` (tier name, `adSpend` range labeled "Typical ad budget," and a feature checklist built strictly from each tier's actual boolean flags — no tier shows a feature it doesn't have). The Process section is condensed from the real `STAGES` array (Discovery → Build → Launch → Optimize → Scale). Never claim a feature that `PACKAGES_DB` marks `false` on that tier.
- **No public dollar pricing:** CTA-only "Book a Call" model (real pricing stays gated behind the post-intake client portal). `savings`/`roas` figures are paraphrased qualitatively, never shown verbatim.
- **No testimonials / client logos / stats:** BoldLine has no real clients yet, so honesty is the edge — reframed as boutique/limited-roster positioning, never invented social proof.
- **Fit, not gatekeeping:** a "Who We Work With / Are we a fit?" section lists real niches as *examples* (not a closed list), with a behavior-based "strong fit if…" checklist and a **soft ~$1,000/mo** minimum ad budget (phrased as "most clients start with…", not a hard wall). An **equal-effort promise** ("same team, same effort, big budget or small").
- **The one explicit promise = the hard constraint:** a "You Keep the Keys" section states the ad-spend-ownership rule verbatim (client owns and pays for their own ad account). See `business-constraint-ad-spend`.
- **Every CTA books a call** via `https://calendly.com/theboldlinemedia/30min` (wording unified to "Book a Call"; the word "consultation" no longer appears). A client-side **package recommender quiz** (3 taps: budget / business type / how they currently get clients → recommends a real tier + platform, leads with the pain point) also optionally captures an email via Netlify Forms.
- **Design tokens:** dark theme `#080A0F` bg / `#0D0F16` card / gold `#C8A84B`, plus Google Fonts **Playfair Display** (serif headlines) + **Inter** (body) — the project's only external font dependency. Pure-CSS micro-animations throughout, all respecting `prefers-reduced-motion`.
- **Launch-readiness pieces:** `privacy.html` + `terms.html` (honest, "template not legal advice"), a branded real-status `404.html`, footer legal links, a lead-capture form + FAQ (`<details>` + FAQPage JSON-LD), a founder section (monogram placeholder — swap for a real headshot at `marketing-site/founder.png`), and a mobile sticky "Book a Call" bar. Full SEO scaffolding (canonical, Open Graph/Twitter, JSON-LD Organization/Blog/Article/FAQPage, robots.txt, sitemap, real favicon + og-image rendered from matching share cards).

**POSITIONING (Bryson, 2026-07-08): BoldLine serves ANY business, not "small businesses" — never write "small-business clients/owners" in copy, bios, or AI prompts.** The site copy already avoided it ("small roster" = boutique model, fine); the blog AI prompts + CLAUDE.md + design-doc template said it and were fixed same day. The Google Ads application (submitted 2026-07-07) said "small-business clients" — historical, left as-is.

**Business fact (Bryson, 2026-07-03): engagements start with a THREE MONTH MINIMUM, then run month to month.** The FAQ frames it as a compounding argument (month 1 learns, month 2 applies, month 3 shows judgeable momentum). Stated in the visible FAQ + FAQPage JSON-LD + BLOG_FACTS. Don't reintroduce old "no long lock-ins / month to month from day one" copy. Also a voice rule from the same session: **no parenthetical asides in site copy** (reads AI-written to Bryson) — write them as separate sentences.
