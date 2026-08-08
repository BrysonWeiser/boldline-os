---
name: website-reviews
topic: Marketing site
task: collect + approve + display customer reviews on boldlinemedia.com, and the Google-review button; how submissions flow, get moderated, and publish
keywords: [reviews, testimonials, review-submit, reviews-list, reviews-admin, ReviewsManagementCard, reviews table, star rating, Google review, GOOGLE_REVIEW_URL, social proof, moderation, approve review, featured review]
status: verified
summary: Built 2026-08-08 (Bryson: "a place on the website for people to leave reviews"). Approach = collect → approve → display (his pick, options 1+3), NOT a public wall. Nothing shows publicly until Bryson approves it (spam/fake-proof). Flow: a #reviews section on boldlinemedia.com (star rating + name/business/text form) → marketing review-submit.mjs inserts a `reviews` row status:"pending" + emails Bryson a "new review to approve" ping → Bryson approves in the OS Website tab (ReviewsManagementCard → reviews-admin.mjs) → marketing reviews-list.mjs serves status:"approved" rows → the section's script renders them as testimonial cards (hidden until ≥1). "Feature" pins a review to the top. Also scaffolded #3 the Google-review button (GOOGLE_REVIEW_URL const in the marketing #reviews script, empty until Bryson sets his Google Business Profile review link). SETUP: run docs/sql/reviews-schema.sql once; set up Google Business Profile + paste its review link into GOOGLE_REVIEW_URL for the Google button.
verified: 2026-08-08
---

**Why this shape (Bryson picked 1+3, 2026-08-08):** Google reviews outrank/outconvert self-hosted ones for an agency, and with no clients yet a public "post a review" wall would sit empty + invite spam/fakes. So: **approve-first** on-site collection (owned, spam-proof, works now) **+** a Google-review button (public trust + local ranking). Deliberately **no review gating** (only funneling happy people to Google violates Google's policy) — the thank-you invites *everyone* to also post on Google.

**Data — `reviews` table** (`docs/sql/reviews-schema.sql`, **Bryson must run once**): `id, created_at, name, business, rating(1..5), body, email, source, status(pending|approved|rejected), featured`. RLS on, **no policies** — every function uses the service-role key (bypasses RLS), like `blog_posts`; the public only ever sees approved rows, and only via `reviews-list`.

**Marketing site (boldlinemedia.com):**
- **`#reviews` section + inline `<script>`** in `marketing-site/index.html` (between `#founder` and `#faq`): a testimonials grid (`#reviewsGrid`, hidden via `#reviewsDisplay` until ≥1 approved) + a "Leave a review" `.contact-box` with a 5-star click/hover/keyboard rating input, name, business, textarea, honeypot (`company`). Cards are built with `textContent` (XSS-safe). The script fetches `reviews-list`, renders approved cards, and on submit POSTs `review-submit`, then shows a thank-you (which also invites a Google review if the URL is set).
- **`GOOGLE_REVIEW_URL`** — a `var` at the top of that script, **currently `''`**. Set it to the Google Business Profile "write a review" link and redeploy → a "Leave us a Google review" button appears above the form + in the thank-you. (Needs GBP set up first.)
- **`review-submit.mjs`** — POST/honeypot/validate (body ≥3 chars, rating clamped 1-5, optional email), service-role insert `status:"pending"`, then `notifyOwner` emails `OWNER_EMAIL` (fallback theboldlinemedia@gmail.com) a "new review to approve" ping (uses the marketing site's RESEND_API_KEY + REPORTS_FROM_EMAIL, already set). Fail-soft.
- **`reviews-list.mjs`** — GET, service-role, returns only `status:"approved"` (ordered featured desc, created desc, limit 50), never exposes email. 60s cache. Fail-soft → empty (section just hides).

**OS (boldlinemedia.netlify.app):**
- **`reviews-admin.mjs`** — owner-JWT (same auth as blog-admin). Actions: `list` (all, newest first), `set-status` ({id,status} approve/reject/back-to-pending), `feature` ({id,featured} pin), `delete`. Surfaces a "run the SQL" hint if the table is missing.
- **`ReviewsManagementCard`** in the Website tab (after Blog + Newsletter managers): a "N to review" badge, then Pending (Approve/Reject) · Published (Unfeature/Feature, Unpublish) · Rejected (Restore) sections, each row with stars/name/business/date/body + a confirm-first Delete. Approving publishes to the site.

**Both sites deploy from `main`** (OS = repo root, marketing = `marketing-site/` base dir), so one merge ships everything. **Verified 2026-08-08:** all 3 functions `node --check`; full index.html babel-compiles; marketing #reviews section rendered on the real page (testimonial cards + star form, 0 console JS errors, 0 overflow @390); OS card SSR-rendered all states (pending/published+featured/rejected) with correct actions, 0 overflow @390 (Playwright).

**PENDING — Bryson's setup:** (1) run `docs/sql/reviews-schema.sql` in Supabase (or the OS Reviews card + submissions error until then). (2) Set up **Google Business Profile** and paste its review link into `GOOGLE_REVIEW_URL` (marketing `#reviews` script) for the Google button — GBP is also the audit's highest-leverage SEO item (`site-seo-cro-audit`).
