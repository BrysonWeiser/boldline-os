# BoldLine OS — Integrations & Setup Log

Detailed record of external-platform setup.

> **No secret values are stored here** — only variable names, non-secret account
> identifiers, decisions, and state. All credential values live only in Netlify
> environment variables.

Last updated: **2026-06-27**

## Netlify environment variables
All app secrets live here. Convention: ALL_CAPS_SNAKE_CASE, marked **"Contains
secret values"**, same value across Production / Deploy Previews / Branch deploys /
Preview Server & Agent Runners (Local development is dropped automatically for
secret vars — we don't use the Netlify CLI locally, so this is fine).

Pre-existing vars: `ANTHROPIC_API_KEY`, `OWNER_EMAIL`, `OWNER_PHONE`,
`REPORTS_FROM_EMAIL`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `URL`.
(`ANTHROPIC_API_KEY` was missing from this list despite being live and in use since
the original report-generation feature — added 2026-06-26 while documenting the blog
automation below, which reuses it. No action needed; just a doc gap fix.)

---

## DocuSign (e-signature) — credentials DONE ✅ · code built ✅ · LIVE-VERIFIED ✅ (demo)
- **Live-verified 2026-06-25:** test envelope sent from the Deploy-tab "Test DocuSign
  Connection" card → email delivered → signing document opened successfully. Full JWT
  round-trip (sign → token → envelope → deliver) confirmed working end to end.
- **Environment: DEMO / sandbox** (`demo.docusign.net` REST base + `account-d.docusign.com` auth server).
  - ⚠️ **Demo signatures are NOT legally binding** (watermarked). Before the first
    real client: open a **production** DocuSign account, complete the **Go-Live
    promotion** (requires ~20 successful API calls in demo first — every test send we
    make now counts toward that 20), and regenerate ALL DocuSign credentials for
    production. Known future work, deferred until a real client is close.
- Auth method: **JWT Grant** (server-to-server, unattended). One-time consent grant
  **COMPLETED 2026-06-25** (redirect landed cleanly with `?code=...`).
- Account: BoldLine Media, account #48872018. Integration type: **Private custom
  integration** (locks once Go-Live passes "Ready to Submit" — chosen deliberately).
- RSA keypair generated (public key auto-registered with DocuSign; private key
  saved to Netlify only). Placeholder redirect URI `https://www.docusign.com`
  registered — required for the consent flow, otherwise unused.
- Env vars: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`,
  `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_PATH` (DocuSign demo/sandbox REST base — value in Netlify).
- **Code:** `netlify/functions/docusign-send.mjs` — JWT Grant auth + envelope send,
  secured by the owner's Supabase session. Front end wired in two places: "Send via
  DocuSign" on a client's Contract tab (sends the rendered service agreement, marks
  contract "pending", stores `docusignEnvelopeId`), and a "Test DocuSign Connection"
  card on the Deploy tab (sends a non-binding test envelope to any email — self-serve
  credential verification). Signature tab placed on an invisible `/BL_SIGN_HERE/`
  anchor in the contract.
- **GOTCHA — the private-key paste (cost ~3 retries before it worked):**
  `DOCUSIGN_PRIVATE_KEY` kept failing at the `sign` stage. Cause: pasting a multi-line
  PEM key into Netlify's secret field collapses the internal newlines, and Node's
  `crypto` then rejects the malformed PEM. Fix in code: `normalizeKey()` now rebuilds
  canonical PEM (re-wraps the base64 body at 64 chars) whenever the BEGIN/END markers
  survived, so a flattened paste self-heals; the `sign`-stage error also returns
  non-secret structural facts (length, line count, marker presence) for diagnosis.
  **When we regenerate the key for production we'll likely hit the same paste issue —
  the code tolerates it now, but cleanest is to keep the newlines intact on paste.**
- **TODO (later, not blocking):** (1) envelope status sync (webhook/poll) so a signed
  contract auto-flips status to "active" instead of staying "pending"; (2) optional:
  exercise the real "Send via DocuSign" on a test client's Contract tab (same verified
  backend — only the contract-HTML rendering path is untested); (3) production
  promotion before first real client (see warning above).

## Google Ads API — credentials DONE ✅ · code built ✅ · awaiting Basic Access + first client ⏳
- Architecture: one **MCC** manager account (ID in Netlify) + one Developer Token +
  one OAuth refresh token operate across all linked client accounts via the
  `login-customer-id` header.
- Google Cloud project created, Google Ads API enabled. OAuth consent screen
  **published to PRODUCTION** (avoids the 7-day refresh-token expiry of Testing mode).
- Two OAuth clients exist: a **Desktop-app** one (unused — OAuth Playground rejected
  it with `redirect_uri_mismatch`) and a **Web-application** one (the one in use; has
  `https://developers.google.com/oauthplayground` as an authorized redirect URI).
  The refresh token was generated via OAuth Playground against the Web-app client, so
  the `CLIENT_ID`/`CLIENT_SECRET` in Netlify must be the **Web-app** client's.
  (Refresh tokens are bound to the client that issued them.)
- Developer Token: currently **Explorer Access** (test accounts only). **Basic Access
  application submitted 2026-06-25** (~3 business-day review). The application
  included a custom design doc that cited the Task #8 approval-queue as the
  human-in-the-loop safety story.
  - ❌ **REJECTED 2026-06-26.** Reason given: the company website on file
    (`theboldlinemedia.wixsite.com/boldline-media-4`) "does not have content related
    to your application" — Google requires a working website as part of review, and
    the email explicitly warns **do not resubmit with the same responses** (it just
    triggers the same rejection again). Not a rejection of the business model or the
    design doc — purely the website. See the new **"BoldLine Media's own marketing
    site"** section below for the fix in progress.
- Env vars: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
  `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
  `GOOGLE_ADS_MANAGER_CUSTOMER_ID` (stored WITH dashes; the code strips them when
  calling the API). Optional: `GOOGLE_ADS_API_VERSION` — see caveat below.
- **Code (built 2026-06-25, pending live-verify):** `netlify/functions/google-ads.mjs`
  — OAuth refresh-token → access-token exchange, then actions: `test`
  (listAccessibleCustomers — the smoke test), `campaigns` (GAQL read: campaigns +
  30-day metrics), `setBudget` + `setStatus` (guarded writes). Secured by the owner's
  Supabase session, same as DocuSign. Front end: a "Test Google Ads Connection" card
  on the Deploy tab (one-click connectivity check, mirrors the DocuSign test card).
  New client field `googleAdsCustomerId` added to the data model for per-client
  linking (Task #17). **Now LIVE on main** (carried along when the portal fix was
  fast-forwarded 2026-06-25). The "Test Google Ads Connection" card is on the Deploy
  tab but clearly labeled "expected to fail until Basic Access is approved" — owner-only,
  harmless, and ready to one-click verify the moment the token lands (no redeploy needed).
  - ⚠️ **API version caveat:** `API_VERSION` defaults to `v18` in the code. Google
    sunsets versions ~yearly; this is the value most likely to be stale at test time.
    If the `test` call errors with "version not found / deprecated", set
    `GOOGLE_ADS_API_VERSION` in Netlify to a current version — no code change needed.
- **Approve→execute wiring is deferred (correctly):** ARIA's `propose_action` logs a
  *descriptive* proposal (title/detail/category) to the approval queue; `decideAction`
  records the approve/reject. Turning an approval into a real `setBudget`/`setStatus`
  call needs live campaign reads first (to resolve the specific campaign + resource
  names), so it's a post-Basic-Access task. The executable pieces are ready in
  `google-ads.mjs`; only the final UI wire-up remains.
- **TODO:** fix the website blocker (below) → resubmit Basic Access (Task #16) →
  live-verify via the test card + bump API version if needed → link first client
  account to the MCC (Task #17) → wire approve→execute.

## BoldLine Media's own marketing site — code built ✅ · Netlify site + DNS + resubmit ⏳
- **Why this exists:** purely to unblock the Google Ads Basic Access rejection above.
  Bryson chose this over (a) just patching the old Wix site with real copy, or (b) doing
  the full Task #18 rebuild + AI website-builder feature right now — this is the
  middle path: a real, permanent, but minimal static site, not throwaway Wix content
  and not the bigger AI-builder feature (that stays deferred).
- **Code (built 2026-06-26, redesigned same day as v2):** `marketing-site/index.html` +
  `marketing-site/netlify.toml` — a standalone static one-pager, deliberately its own
  directory with its own `netlify.toml` so it can be deployed as a **second, separate
  Netlify site** from this same repo (Base directory = `marketing-site`) without
  touching the OS's existing routing (`netlify.toml` at the repo root still serves
  `index.html`/the OS at `/*`, untouched). No build step, no React/Babel — plain
  HTML/CSS, reuses the same `LOGO` data-URI as the rest of the product. Verified by
  rendering it in headless Chromium and screenshotting both desktop and mobile (not
  just eyeballing the HTML) — caught a real bug this way, see gotcha below.
- **v2 redesign (2026-06-26):** Bryson asked for the page to be rebuilt grounded in
  the *real* services/business rather than generic copy, and restyled darker/more
  luxury. Content is now pulled directly from the OS's own data structures instead of
  invented:
  - "Capabilities" section = the real platforms in `PACKAGES_DB` (Google Ads / Meta
    Ads / Combined Systems), e-commerce folded into a supporting note line rather than
    its own card.
  - "Every Engagement" section = real features bundled across packages (landing page
    per campaign, call tracking, weekly review, retargeting, CRM lead routing,
    plain-English reporting).
  - "Process" section = the real client-facing pipeline, condensed from the `STAGES`
    array (Discovery → Build → Launch → Optimize → Scale).
  - "You Keep the Keys" section states the hard ad-spend-ownership constraint
    verbatim as the page's one explicit promise.
  - Visual: reused the OS's existing dark theme tokens (`#080A0F` bg / `#0D0F16` card /
    gold `#C8A84B`) for consistency, added Google Fonts **Playfair Display** (serif
    headlines) + **Inter** (body) for the luxury feel — first external font dependency
    anywhere in this project (everything else uses system font stacks).
  - Deliberately **no public pricing** (CTA-only "Start a Conversation" model,
    consistent with real pricing already being gated behind the post-intake client
    portal) and **no testimonials/client counts/logos** (BoldLine has no real clients
    yet — reframed honestly as boutique/limited-roster positioning instead of
    inventing social proof).
- **v2.1 update (2026-06-26): micro-animations, real tabbed packages, Calendly
  booking.** Bryson asked for the site to "feel modern... like the best website
  company," for the Services section to actually reveal real package tiers on
  click, and for every CTA to book a call instead of just emailing.
  - **Tabbed packages section** replaces the old 3-card "Capabilities" blurbs.
    `#services` now has 4 platform tabs — Google Ads / Meta Ads / Combined
    Systems / E-Commerce (e-commerce promoted from a footnote to its own full
    tab with 3 tiers) — each showing that platform's real tiers pulled
    directly from `PACKAGES_DB` in `index.html`: tier name, real `adSpend`
    range labeled "Typical ad budget," and a feature checklist built strictly
    from each tier's actual boolean flags (no tier shows a feature it doesn't
    actually have). Deliberately still **no BoldLine dollar pricing shown** —
    same no-public-pricing model as v2, now applied per-tier instead of
    site-wide. `savings`/`roas` dollar figures from `PACKAGES_DB` are
    paraphrased into qualitative lines ("Bundled pricing — runs more
    efficiently...", "Performance bonus available once your store is
    consistently hitting strong ROAS") rather than shown verbatim with
    numbers.
  - **Progressive-enhancement tabs (no-JS safe by construction):** default
    CSS shows all 4 tab panels (`display:block`) — only once an early
    synchronous `<script>` in `<head>` adds `js-tabs` to `<html>` does CSS
    switch to hide/show (`html.js-tabs .tab-panel{display:none}` /
    `.active{display:block}`). Standard no-js/js convention, chosen
    specifically so the scroll-reveal bug class below can't recur here:
    verified with Playwright's `javaScriptEnabled:false` that all 4 panels'
    full content (every package card, every line of copy) stays in the DOM
    and visible with JS off.
  - **Micro-animations:** hero glow drifts slowly (`@keyframes glowDrift`,
    10s loop), nav links get an animated gold underline on hover, buttons
    give tactile press feedback (`scale(.96)` on `:active`), package/cap
    cards lift on hover, tab switches fade the new panel in
    (`animation:fadeUp .5s`). All pure CSS, all respect
    `prefers-reduced-motion`.
  - **Every CTA now books a call, not an email.** Hero button, new header
    button ("Book a Call"), every package card's CTA, and the contact section
    all link to `https://calendly.com/theboldlinemedia/30min` (opens in a new
    tab). Default wording is "Book a Free Consultation" (warmer than
    "Contact Us," sets the expectation it's a real conversation, not a form)
    with "Book a Call" for the compact header button.
  - **Fixed a real content-accuracy bug while in there:** the old "Every
    Engagement" section claimed weekly review, retargeting, and CRM
    integration as included on every plan — but `PACKAGES_DB` shows those are
    `false` on every family's entry-level Launch tier. Rewrote the section to
    state only what's genuinely true on every tier (landing page on every
    plan, immediate lead notification, plain-English reporting, scope locked
    before launch, full account transparency, no spend without sign-off) and
    moved the tier-gated claims into the new per-tier package cards where
    they're correctly scoped.
- ⚠️ **Gotcha + fix (2026-06-26): scroll-reveal was hiding all content from anything
  that doesn't scroll.** The first v2 draft used a JS `IntersectionObserver` to fade
  sections in as the user scrolled, with `.reveal{opacity:0}` as the resting state. A
  full-page Playwright screenshot proved the problem: everything below the hero
  rendered completely blank, because the page was captured/composited without ever
  firing real scroll events. That's a direct risk for *this specific page*, whose
  whole purpose is to pass a Google reviewer's crawl of "content related to your
  application" — a non-scrolling crawler would see an empty page. Fixed by dropping
  the JS/scroll dependency entirely: `.reveal` now plays a pure-CSS `@keyframes`
  fade-up on load (`animation:fadeUp .8s ease both`) that resolves to fully visible
  with or without JS, with or without scrolling, and respects
  `prefers-reduced-motion`. General lesson for any future scroll-triggered UI in this
  project: never gate content visibility on JS/scroll state — animate, don't hide.
- ✅ **Contact email confirmed (2026-06-26):** Bryson confirmed the real mailbox is
  `theboldlinemedia@gmail.com`. Swapped in everywhere the old `hello@boldlinemedia.com`
  placeholder appeared (contact section mailto + display text). No longer an open item.
- **v2.2 visual-polish pass (2026-06-26):** Bryson said the page still felt "kind of
  bland" and asked for more flare. Added a cohesive set of depth/motion details on top
  of the v2.1 base, all pure CSS (no new JS, no content-visibility risk — verified by
  re-running the same `javaScriptEnabled:false` regression check after this pass; all
  4 service-tab panels still render full content with JS off):
  - **Hero:** bigger dual-tone glow (warm gold + a faint cool counter-glow for depth),
    the emphasized headline word ("marketing") now renders as a slow gold gradient
    shimmer (`background-clip:text` + `@keyframes shimmer`) instead of flat color, and
    a row of small caption-style pills (Google Ads · Meta Ads · Landing Pages · Call
    Tracking · CRM Routing) under the CTA gives the hero more visual weight without
    inventing stats.
  - **Every Engagement:** the 6 identical "✓" marks became 6 distinct small inline-SVG
    line icons (document / lightning bolt / bar-chart / clipboard-check / eye / lock),
    one per benefit, for visual variety instead of repeating the same glyph.
  - **Process:** step numerals enlarged (26px → 40px) for an editorial feel, plus a
    hover state (soft gold background tint, numeral brightens to full gold) so the
    list feels interactive on desktop.
  - **Package cards:** added a diagonal gold shine-sweep on hover (pure
    `background-position` transition, deliberately NOT `overflow:hidden` + clip —
    that would've clipped the "Most Popular"/"Best Value" tag badges that intentionally
    sit half outside the card's top edge) and a soft gold glow ring around whichever
    card carries a tier tag, via `:pkg:has(.tag)`.
  - **Trust ("You Keep the Keys"):** added a soft centered ambient gold glow behind the
    text, echoing the hero's glow for visual cohesion at the page's thematic climax.
  - **Footer:** thin centered gold gradient hairline accent on the top border.
  - **Cleanup while in there:** removed `.cap-grid`/`.cap`/`.cap h3`/`.cap p`/`.cap .num`
    — dead CSS left over from the pre-v2.1 "Capabilities" 3-card layout that the tabbed
    Services section replaced; `.cap-note` (the "Not sure which fits?" line) is still
    used so it stayed.
  - Re-verified with fresh Playwright screenshots (full-page desktop/mobile at 2x
    device-scale-factor, plus per-section crops so copy is legible on review) and
    confirmed hover states render correctly (shine sweep, tag glow ring, process-step
    tint) before shipping.
- **v2.3 update (2026-06-26): SEO scaffolding + blog section, to actually rank
  organically.** Bryson asked what the "Start a Conversation" email is for (confirmed
  it's the same `theboldlinemedia@gmail.com` already logged above) and asked to add a
  blog for organic Google ranking, plus "anything else" for SEO/general improvement.
  - **SEO scaffolding added to `index.html`:**
    - Real favicon + apple-touch-icon: extracted the existing inline base64 logo
      data-URI to a standalone `marketing-site/logo.png` (292×342 PNG, via shell
      `base64 -d` — never passed through chat/model context) instead of re-embedding
      the string a second time. Reused for favicon, apple-touch-icon, and the JSON-LD
      `logo` field.
    - `<link rel="canonical">` on every page.
    - Full Open Graph + Twitter Card tags (title/description/url/image,
      `summary_large_image`), backed by a real rendered `marketing-site/og-image.png`
      (1200×630, built from a custom HTML share-card matching the site's actual design
      tokens via headless Chromium — not a placeholder).
    - JSON-LD structured data: `Organization` schema on the homepage (name, url, logo,
      description, email, `knowsAbout`); `Blog` schema on the blog index; `Article`
      schema (author/publisher/mainEntityOfPage) on every post. All real values, no
      invented ratings/review counts/social links.
    - `marketing-site/robots.txt` (allow all, points at the sitemap) +
      `marketing-site/sitemap.xml` (homepage + blog index + all 3 posts, real
      `lastmod` dates — nothing fabricated).
  - **Blog section added:** `marketing-site/blog/` — hand-coded static HTML, no CMS,
    no Supabase backend, consistent with this site's "no build step" philosophy and
    the v2.1 lesson never to gate content on JS. `blog/blog.css` is a shared
    stylesheet (duplicates the homepage's design tokens/header/footer on purpose, so
    the blog keeps working even if the homepage's CSS changes shape later).
    `blog/index.html` is the listing page (hero + 3-card grid). Three launch posts,
    each grounded in the site's own real service descriptions — zero invented client
    stats/testimonials (BoldLine has no real clients yet):
    1. `blog/is-your-business-ready-for-google-ads/` — "Is Your Business Ready for
       Google Ads?" (category: Getting Started)
    2. `blog/google-ads-vs-meta-ads/` — "Google Ads vs. Meta Ads: Which Should You
       Start With?" (category: Strategy; links internally to post 3)
    3. `blog/why-your-landing-page-matters/` — "Why Your Landing Page Matters More
       Than Your Ad" (category: Conversion)
    Header nav on every page (homepage + blog) now includes a **Blog** link.
  - ⚠️ **Gotcha + fix: real pre-existing CSS specificity bug found while reviewing
    screenshots, fixed in both files.** The "Book a Call" header button rendered with
    low-contrast gray text (and fully invisible gold-on-gold on hover) because
    `.hdr-row nav a{color:var(--muted)}` (1 class + 2 type-selectors) beat
    `.hdr-cta{color:#15110A}` (1 class + 0 type-selectors) — when class-counts tie,
    type-selector count breaks the tie. This bug predates this round of changes (it
    shipped with v2.1's header CTA) but was never caught because no earlier screenshot
    review zoomed in tight enough on that one element. Fixed in both `index.html` and
    the new `blog/blog.css` using the `:not(.hdr-cta)` exclusion pattern already used
    elsewhere in the same files for the underline-hover effect:
    `.hdr-row nav a:not(.hdr-cta){...}` / `:not(.hdr-cta):hover{...}`. Re-verified with
    fresh screenshots at rest + hover, desktop + mobile, homepage + blog — confirmed
    legible dark text in every state.
  - Verified end-to-end via headless Chromium against a local static server (not
    `file://` — these pages use absolute `/`-rooted paths that only resolve correctly
    under a real HTTP root): full-page screenshots of every page at desktop + mobile,
    a `javaScriptEnabled:false` regression pass confirming substantial visible text on
    all 5 pages with JS off, and a check that the existing homepage tabs still work.
- **v2.4 update (2026-06-26): AI-written blog, fully automated end to end.** Bryson
  asked for a posting-cadence recommendation, then for the blog to actually write and
  publish itself. Recommended **1 post/week for the first 3 months, ramping to
  2-3/week** once there's a track record to judge what's resonating — confirmed.
  Control model confirmed: **auto-publish immediately + email notify** (not a
  draft-for-approval queue), with delete and regenerate as the safety valve instead of
  a pre-publish review step.
  - **New Supabase tables** (`docs/sql/blog-schema.sql`, one-time paste into the SQL
    Editor — see TODO #7 below): `blog_posts` (slug/title/category/excerpt/
    meta_description/body_html/read_minutes, `status` enum `published|draft|deleted`
    for soft-delete, `source` enum `ai|manual`, separate `created_at` vs
    `published_at`) and a singleton `blog_settings` row (`id` pinned to `1` via a check
    constraint) holding `posts_per_week`. The same script migrates the 3 existing
    static posts in as `source:'manual'` rows with staggered `published_at`
    timestamps that reproduce their exact current display order — moving to the
    database changes nothing visible on day one.
  - **AI generation** (`netlify/lib/blog-shared.mjs`): calls the Anthropic API with a
    forced tool call (`tool_choice:{type:"tool",name:"blog_post"}`) so it always
    returns clean structured fields (title/category/excerpt/intro/3-5 sections each
    with optional body+bullets/pull-quote/conclusion) instead of free text to parse.
    Every prompt is grounded in a `BLOG_FACTS` constant — the only facts about
    BoldLine the AI is allowed to state (the real process, the real
    what's-true-on-every-plan list, the ad-spend-ownership rule, the real Calendly
    link) — with an explicit instruction to never invent client results,
    testimonials, or stats, since BoldLine doesn't have real ones yet, and to never
    repeat or closely rephrase an existing post's topic.
  - **Owner controls** (`netlify/functions/blog-admin.mjs`, new **Blog** panel on the
    ARIA Deploy tab in `index.html`): same Bearer-JWT owner-auth pattern as the Google
    Ads tools. Actions: list posts, write one on demand ("Write One Now"),
    **regenerate** a specific post, **delete** a specific post (soft-delete, with an
    inline confirm step matching the delete-confirm pattern already used elsewhere in
    the OS), and set the weekly cadence. Regenerate keeps the **same
    `id`/`slug`/`created_at` permanently** and only swaps the content fields + bumps
    `published_at` — so a regenerated post's live URL never breaks and it still counts
    as the *original* post for quota purposes, never a second new one. Regenerate is
    topic-locked: it tells the AI to take another pass at the *same subject*, not pick
    a new one.
    - ⚠️ **Worth confirming this is what you meant:** "regenerate" here is a per-post
      rewrite (pick one post, get a fresh take on the same topic), not a full
      wipe-and-rebuild of the whole blog — and there's no version history, so
      regenerating overwrites the previous text for good. Flagging in case you
      pictured something else.
  - **Auto-publish cron** (`netlify/functions/blog-autopublish.mjs`, runs Mon/Wed/Fri
    14:00 UTC via `netlify.toml`): counts posts created in the trailing 7 days (by
    `created_at`, never `published_at`, so a regenerate never double-counts toward the
    week's quota) against `blog_settings.posts_per_week`; under quota, writes and
    publishes one more AI post and emails `OWNER_EMAIL` a branded "new post is live"
    notice; at/over quota, no-ops silently. Picked a 3x/week check cadence specifically
    so the schedule never needs to change as the cadence later ramps from 1/week up to
    2-3/week — most checks just no-op early on. `?test=1` emails a quota-used-vs-limit
    status report without publishing anything, same dry-run convention as
    `lead-followup.mjs`.
  - **Static blog converted to dynamic, paginated, newest-first**: deleted the old
    hand-coded `marketing-site/blog/index.html`, its 3 static post pages, and the
    static `sitemap.xml`; replaced with `marketing-site/netlify/functions/
    blog-index.mjs` (paginated listing, 6 posts/page, newest always top-left),
    `blog-post.mjs` (single post by slug, 404 for unknown/deleted slugs), and a
    dynamic `sitemap.mjs` — all backed by `marketing-site/netlify/lib/
    blog-render.mjs`'s shared render helpers (header/footer/post-CTA/head-tags incl.
    JSON-LD, all HTML-escaped). `blog/blog.css` kept as-is.
  - **Sandbox verification limits (full disclosure):** this environment has no live
    Supabase project, no Netlify CLI, and no `ANTHROPIC_API_KEY` available, so nothing
    above could be exercised as a real end-to-end test — no real AI call was made, no
    real Supabase round-trip happened. What *was* verified: every new/changed file
    passes `node --check`; the new React component in `index.html` was verified with a
    real Babel `transformSync()` of the extracted JSX (this file has no build step, so
    that's the only way to catch a JSX syntax error here); every cross-file import was
    checked against the real exports it points at; and `blog-render.mjs`'s pure
    HTML-rendering helpers were smoke-tested against mock post data, including a
    deliberate XSS-style payload in a title/excerpt to confirm escaping holds. **Not**
    verified: a real AI-generated post end to end, or a real Supabase read/write —
    worth a real test once the env var below is in place.
- **v2.5 update (2026-06-26): bulk Rewrite-All and Rebuild-From-Scratch.** Bryson
  asked for the v2.4 "regenerate = single post only" flag to actually be addressed —
  he wants both a full rebuild and a blanket rewrite, not just per-post regenerate.
  Added two buttons to the Blog panel, both gated behind an inline confirm (this is
  the most destructive action in the panel so far — it touches every post at once):
  - **Rewrite All Posts** — regenerates every currently-live post's content in place,
    one by one. Same mechanics as the existing single-post Regenerate (same
    id/slug/created_at preserved, so no live URL breaks), just looped across the
    whole blog. Shows "Rewriting post N of T…" as it goes.
  - **Rebuild From Scratch** — soft-deletes every current post (new `delete-all`
    action in `blog-admin.mjs`), then writes that many brand-new posts on entirely
    new topics (defaults to 3 if the blog was already empty). Shows a live "Clearing
    old posts… / Writing post N of T…" status.
  - **Why these are two thin sequential loops, not one big backend call:** each AI
    generation already runs close to a single Netlify function's execution
    timeout on its own (this is exactly how the existing single-post
    generate-now/regenerate actions already work). Looping several of those *inside
    one* function invocation risked timing out partway with no good way to report
    progress. Instead both buttons drive the loop from the browser, calling the same
    proven single-post endpoints once per post and updating a progress line between
    calls — slower wall-clock for a big rebuild, but every individual step is one
    already-working call, and the owner sees progress instead of a single
    all-or-nothing spinner.
  - Both bulk buttons (and every per-post Regenerate/Delete button) disable while a
    bulk run or another single action is in flight, to avoid two writes racing on the
    same post.
  - **Side effect worth knowing:** Rebuild's new posts set `created_at` to right now,
    same as any AI post — so they count against that week's auto-publish quota
    immediately. Rebuilding right before a scheduled Mon/Wed/Fri check can make that
    check skip (quota already met), which is the same created_at-based counting rule
    already in place, just worth knowing if a rebuild and a scheduled run land close
    together. Rewrite All does **not** touch `created_at`, so it never affects quota.
  - Same sandbox caveat as v2.4: verified via `node --check`, a real Babel
    `transformSync()` of the updated JSX, and logic review — no live Supabase/Netlify/
    Anthropic credentials here to run an actual bulk rewrite or rebuild end to end.
- **v2.6 update (2026-06-27): cleaner nav + a package recommender quiz.** Bryson
  wanted the header to feel more uniform (not one heavy solid-gold "Book a Call"
  block), the per-package CTAs reworded, and the "not sure which fits?" line turned
  into a quick quiz that recommends a package and then sends them to book a call.
  - **Header CTA restyled** from a solid gold button to an **outlined gold pill**
    (transparent fill, gold border + gold text, fills gold on hover) so it sits as a
    peer of the nav links instead of dominating them. Changed in **both**
    `index.html` and `marketing-site/blog/blog.css` so the homepage and blog headers
    stay identical.
  - **Per-package CTAs** changed from "Book a Free Consultation →" to **"Book a Call
    →"** on every tier. (The big hero and contact-section buttons still say "Book a
    Free Consultation" — left as-is on purpose; easy to unify to "Book a Call" too if
    he wants.)
  - **Package recommender modal** replaces the old "Not sure which fits? Book a
    consultation" line. Three quick taps — monthly ad budget, business type, how
    customers find you — then it recommends a specific tier + platform from the real
    package set and shows two actions: **Book a Call** (Calendly) and **See this
    package** (closes the modal, switches the Services tab to the recommended platform,
    scrolls there). Carries an honest "a starting point, not a quote" line that also
    restates the ad-spend-ownership rule. No email/sign-up, no backend, no new env
    vars — pure client-side JS in `index.html`. Degrades gracefully: with JS off the
    trigger is just a plain Calendly link.
  - **Recommendation logic** (recorded so it's not a black box later): platform family
    = online store → E-Commerce; "a mix" → Combined Systems; otherwise by how
    customers find them (search → Google Ads, browse → Meta Ads, both → Combined).
    Tier = by budget band (under $1.5k / $1.5–5k / $5k+). Combined only has two tiers,
    so the top budget band maps to its Growth tier.
  - **Verified in headless Chromium** (no live backend needed — this is all static
    front-end): all three inline `<script>` blocks pass `node --check`; ran the full
    flow end to end (open → answer → recommendation) on both a Google-Ads path and an
    E-Commerce path with zero JS page errors; screenshotted the new nav (homepage +
    blog), the quiz form, and the recommendation card. The only console noise was an
    occasional Google-Fonts fetch timing out through the sandbox proxy — not a code
    issue, fonts render on the real site.
- **v2.7 update (2026-06-27): nav fully redesigned + a sharper recommender.** Bryson
  asked to completely redo the nav (more uniform/aesthetic, modern, keep micro-
  animations), to reword the recommender's third question around how they *currently*
  get clients (with "word of mouth" as an option), and to make the recommendation hit
  a pain point so it lands harder.
  - **Nav is now a floating pill** instead of a full-width bar: a rounded,
    blurred, bordered capsule that floats with margin from the top edge — logo +
    wordmark on the left, nav links centered, outlined "Book a Call" on the right.
    Modern agency/SaaS pattern. Rebuilt in both `index.html` and
    `marketing-site/blog/blog.css` (and the markup in `blog-render.mjs`'s
    `headerHTML()`) so homepage and blog stay identical.
  - **Micro-animations** (all pure CSS except where noted, all respect
    `prefers-reduced-motion`): the bar fades/slides down on load; each link has an
    animated gold underline that grows from center plus a soft rounded hover
    background; the logo mark tilts + scales and the wordmark's letter-spacing opens
    slightly on hover; the CTA fills gold + lifts on hover and presses in on click;
    and a tiny JS scroll listener makes the pill go more solid + tighten as you
    scroll (the one scripted touch — pure styling, never gates content).
  - **Real mobile menu added** (was: links just disappeared under 840px). The pill
    now shows a hamburger that morphs into an X and opens a dropdown panel with all
    the links + a full-width Book a Call. The inline top-bar CTA is hidden on mobile
    so the collapsed bar stays clean (logo + wordmark + toggle). Tapping any link
    closes the menu. Blog pages get the same behavior via a small inline script
    appended to `headerHTML()`.
  - **Recommender Q3 reworded** from "How do customers find a business like yours?"
    to **"How do you currently get new clients?"** with options Word of mouth &
    referrals / Google or online search / Social media / Paid ads already / Nothing
    consistent yet. Mapping: social → Meta, already-running-ads → Combined, and word
    of mouth / search / nothing → Google (capture high-intent demand first); online
    store still → E-Commerce, "a mix" still → Combined.
  - **Recommendation now leads with the pain.** Instead of a neutral "because…" line,
    it opens by naming the gap in how they get clients today (e.g. for word of mouth:
    "new business comes down to who happens to refer you — strong some months, quiet
    the next, never something you control") and then frames the recommended package as
    the fix. Still honest — no invented numbers — and still closes with the "starting
    point, not a quote; your ad account stays yours" line.
  - **Every CTA now says "Book a Call."** Bryson confirmed he wanted it fully uniform,
    so the hero and contact-section buttons (and the blog-post "Want a second opinion?"
    CTA in `blog-render.mjs`) were switched from "Book a Free Consultation" to "Book a
    Call" — the word "consultation" no longer appears anywhere on the site.
  - **Verified in headless Chromium:** all inline scripts pass `node --check`; ran the
    full quiz flow (new Q3 → pain-point result) and the nav (desktop pill, scrolled
    state, mobile hamburger → open menu) with zero JS page errors; screenshotted
    every state.
- **v2.8 update (2026-06-27): pain-led hero.** Bryson wanted the first thing a visitor
  sees to be the pains most business owners actually feel, instead of the old "built
  for businesses who'd rather not think about marketing" line.
  - Hero headline is now three stacked, staggered-fade-in pain statements — **"Slow
    weeks. Inconsistent leads. Ads that don't pay for themselves."** — under a small
    "Sound familiar?" eyebrow, followed by the turn: *"That's not bad luck — it's a
    missing system. BoldLine plans, builds, and runs your ads, so new business comes in
    steadily and predictably — without it ever landing on your to-do list."* (Classic
    problem → agitate → solution framing; "steadily and predictably" highlighted gold.)
  - Each pain line fades up in sequence on load (pure-CSS stagger via a `--i` index +
    `painIn` keyframes), respecting `prefers-reduced-motion`. Verified desktop + mobile
    in headless Chromium, no JS errors.
  - **Follow-up tweaks (same day):** (1) the sub was shortened from "your Google and
    Meta ads (and the landing pages behind them)" to just **"your ads"** at Bryson's
    request — cleaner, and the capability pills below already spell out the specifics.
    (2) Mobile felt too big/cluttered, so the hero was tightened: smaller headline +
    body, less top padding at ≤840px, and a new dedicated ≤480px phone breakpoint
    (27px headline, 14px body, smaller pills). Re-verified at 390px and 360px.
  - **Left alone on purpose:** the `<title>`/meta-description/Open-Graph text (still
    accurate, good for SEO) and the `og-image.png` social share card (a static image
    that doesn't carry the old headline). If we ever want the social preview to mirror
    this new hero, the OG card can be re-rendered — say the word.
- **v2.9 update (2026-06-27): "Who we work with / Are we a fit?" section.** Bryson liked
  the limited-roster line and wanted to lean into it with a qualifier. Discussed framing
  it as "Do you qualify?" but landed on **fit, not gatekeeping** — for a brand with no
  public track record yet, transparent "here's who we're right for" reads as honest
  rather than posturing, which matches the site's whole tone. Chose an always-visible
  section over a gated popup (the package recommender already does interactive
  qualification, so a second gate would be redundant).
  - New `#fit` section (placed after Process, before the "You keep the keys" trust
    block): eyebrow "Who We Work With" → heading "Are we the right fit?" → a centered
    **icon row** of the four real niches (home services / medical & wellness /
    automotive / e-commerce, each a small gold line-icon + label) with a "not on the
    list? reach out anyway" note → gold hairline divider → a centered "You're a strong
    fit if…" checklist → a gold-tinted **soft minimum-budget** callout → an honest "not
    sure? that's what the call is for" line + Book a Call.
  - **Design note (revised same day):** first draft used two bordered cards with the
    niches as pill "bubbles." Bryson said the bubbles didn't flow and it looked squeezed
    on mobile, so it was rebuilt as a single-column editorial flow with icon niches
    (2×2 on phones) and full-width text — reads cleaner and is no longer cramped on
    small screens.
  - **Minimum budget = soft ~$1,000/mo** (Bryson's call, "stay with 1000 for now"):
    phrased as "most clients start with an ad budget of around $1,000/month or more,"
    not a hard wall. The callout restates the hard constraint verbatim — the client owns
    and pays for their own ad account; BoldLine just runs it.
  - Trimmed the top boutique one-liner to just the scarcity ("…so the clients we take on
    get our full attention") since the niche list now lives in this section (no more
    duplication).
  - Verified desktop + mobile (icons reflow to a 2×2 grid on phones) in headless
    Chromium, no JS errors.
- **v3.0 update (2026-06-28): conversion + aesthetic additions.** After a full review,
  Bryson asked to add everything recommended to tighten the funnel and polish the look.
  All in `marketing-site/index.html` (+ a re-rendered `og-image.png`):
  - **Lead-capture form** in the contact section — a lower-friction path beside "Book a
    Call" (every CTA previously went only to Calendly, capturing only people ready to
    book today). Name / business / email / "biggest challenge," via **Netlify Forms**
    (no backend, no env vars) with a honeypot, AJAX submit + inline success, and a no-JS
    fallback. *Needs Bryson to switch on form notifications — see TODO #9.* (Also removed
    the raw `theboldlinemedia@gmail.com` line that used to sit under the form — redundant
    now that the form + Book a Call cover contact; the email still lives in the page's
    JSON-LD metadata only.)
  - **"Leads show up sorted" showcase** — the first real visual on the site: a pure
    CSS/HTML mockup of the lead feed (form / tracked call / Google Ads rows), clearly
    labeled an illustration. Breaks up the all-text page and shows the product.
  - **FAQ section** with a native `<details>` accordion (works with JS off) answering the
    six objections that kill conversions (cost, account ownership, contract, speed,
    "what if it's not working," platforms) — plus **FAQPage JSON-LD** for Google
    rich-results.
  - **Founder section** — a short signed note + monogram avatar to humanize the boutique
    positioning (honest trust, no fake testimonials). *Placeholder — swap the "B" for a
    real headshot + personalize the quote, see TODO #10.*
  - **Recommender quiz now also captures an optional email** at the result step (same
    Netlify Forms mechanism, recommended package attached), so quiz-takers who don't book
    still become a lead.
  - **Mobile sticky "Book a Call" bar** that slides up after scrolling — the CTA is
    always one tap away on phones.
  - **Refreshed the OG/social-share image** to the new pain-led positioning ("Slow weeks.
    Inconsistent leads." + the solution line), re-rendered from a matching share card so
    link previews match the current site.
  - **Deliberately NOT added:** testimonials / client logos / stats — no real clients
    yet, and honesty is the site's edge.
  - **Verification:** every inline script passes `node --check`; full-site overflow check
    is clean at 1440 / 390 / 360px with no JS errors; screenshotted every new section on
    desktop + mobile and exercised the quiz, the form (success state), and the sticky
    bar. Caught + fixed a CSS source-order bug (new sections' mobile overrides sat before
    their base rules, so the showcase wasn't stacking and the sticky bar stayed hidden) by
    moving them into a media block after the base rules. **Not testable in this sandbox:**
    real Netlify Forms capture only activates on the live deploy (TODO #9).
- **v3.1 update (2026-06-29): legal pages + real 404 (launch-readiness).** Before pointing
  ads at the site, added the pieces a site with a lead form + paid traffic needs:
  - **`privacy.html` + `terms.html`** — styled to match (reuse `blog/blog.css`, same
    floating nav + footer), with honest content describing the *actual* data flow (form
    submissions, Calendly, Netlify/Supabase, no data selling, the ad-account-ownership
    rule) and a clear "this is a template, not legal advice — get it reviewed" note.
    Linked from every footer.
  - **Footer links** — added **Privacy / Terms** to the homepage footer and the blog
    `footerHTML()` (so both stay in sync).
  - **Branded `404.html` + soft-404 fix** — `marketing-site/netlify.toml` had a
    `/* → /index.html 200` catch-all that made *every* unknown URL return the homepage
    with HTTP 200 (a soft-404 that hurts SEO). Removed it so unmatched paths fall through
    to Netlify's 404, which now serves a branded `404.html` with a true 404 status.
    (Gotcha fixed in the 404 page: `.article-body a` is gold, which made a `.btn`'s text
    gold-on-gold/invisible — forced the filled button's text color.)
  - Verified all three pages render at desktop + mobile, no overflow, no JS errors.
- ✅ **Gotcha + fix (2026-06-29): blog post pages 404'd in production — now fixed & live.**
  After the site went live on Netlify, the blog *index* (`/blog/`) worked but every
  individual post (`/blog/:slug/`) returned 404 — even though calling the function
  directly (`/.netlify/functions/blog-post?slug=…`) returned the article fine.
  - **First (wrong) theory:** a real `marketing-site/blog/` directory (it held
    `blog.css`) was shadowing the `/blog/:slug` redirect. We moved `blog.css` to the
    site root (`/blog.css`), updated its 4 references (blog-render `headTags`,
    privacy/terms/404), and added `force = true` to the blog redirects. This did NOT
    fix the 404 — but it WAS still worth keeping (cleaner: nothing real under `/blog/`),
    and it changed the symptom from a bare 404 to our *styled* `notFoundPage`, which
    proved the redirect WAS reaching the function. That narrowed it to the function.
  - **Real root cause:** Netlify's **NEW function format** (`export default async (req)`,
    used by `blog-*.mjs`) receives the **ORIGINAL request URL** in `req.url`, NOT the
    redirect target. So the `?slug=:slug` we set in the `netlify.toml` rewrite never
    reached the function — `new URL(req.url).searchParams.get("slug")` was always
    empty → `notFoundPage()`. (The index "worked" only because it defaults to page 1
    when `?page` is missing.) The OS's OLD-format functions (`exports.handler`,
    `event.queryStringParameters`) DO get the rewrite target's query — that's why
    `landing.js`/`portal.js` never hit this.
  - **Fix (commit `cb141a7`, deployed):** parse the slug from the **path** itself in
    `blog-post.mjs` (`/blog/<slug>/`) and the page number from the path in
    `blog-index.mjs` (`/blog/page/<n>/`), keeping the query param as a fallback for
    direct function calls. Verified live: all 3 posts return HTTP 200 with the full
    article (Article JSON-LD present), no-trailing-slash works, and a bogus slug still
    returns the styled 404. **Blog is fully working in production.**
  - **Durable lesson:** for Netlify NEW-format (`export default`) functions behind a
    rewrite, read path params from `req.url`'s path — do NOT rely on the rewrite
    target's query string (that only arrives for OLD `exports.handler` functions).
- **v3.1 update (2026-06-29): plain-English jargon popovers + inclusive wording**
  (from a round of outside feedback Bryson collected). Two changes:
  - **Glossary term explainers.** Every piece of marketing jargon in the package
    lists now has a subtle gold dotted underline; hovering it (desktop) or tapping it
    (mobile) opens a small popover with a 1–2 sentence plain-English definition. On
    desktop the bubble anchors next to the word; on mobile it centers as a card with
    the page gently dimmed/blurred behind it (close button + tap-outside to dismiss).
    Built as one reusable popover node driven by a `data-term` dictionary in a single
    inline script at the bottom of `marketing-site/index.html` (~13 terms: landing
    page, optimization & reporting, custom design, call tracking, attribution,
    retargeting, audience building, CRM integration, split testing, multi-campaign
    structure, ROAS, plus Google/Meta Ads). Keyboard-accessible (`tabindex`, Enter/Esc).
    Chose a lightweight popover over a full-screen takeover on purpose — less friction,
    keeps the reader in place, converts better.
  - **Inclusive wording (so every business feels wanted, any package).** In the "Who
    We Work With" section: reworded the intro + the "not on the list" aside so the
    listed niches read as *examples of where we have the most reps*, not a closed
    guest list ("don't count yourself out if you're not on this list… the fundamentals
    work almost anywhere"); added two more niche tiles (Professional Services, Local &
    Retail) so the grid feels open (now 6). Added an **equal-effort promise** right
    under the packages: "Big budget or small, you get the same team and the same
    effort… we don't rank clients by spend." Kept the selective positioning intact —
    we're selective on *commitment/fit* (the behavior-based "strong fit if…" list and
    the ~$1,000 start), open on *industry and budget size*.
  - Verified headless (desktop + mobile, Playwright): term click/tap opens the right
    definition, stays in-viewport, Esc/backdrop closes, 6 niche tiles, equal-effort
    block present, no code errors. Live-checked after deploy.
- **v3.2 update (2026-06-30): glossary popovers extended to the blog + shared files.**
  - **Refactored to shared assets.** Pulled the glossary CSS and JS out of `index.html`'s
    inline blocks into `marketing-site/glossary.css` + `marketing-site/glossary.js`
    (one dictionary, one runtime, one stylesheet — no more drift between homepage and
    blog). Homepage now loads them via `<link href="/glossary.css">` + `<script
    src="/glossary.js" defer>`; its package terms stay pre-wrapped in markup. The
    `.equal-effort` style stayed inline (homepage-only).
  - **Blog posts now get the same popovers.** `glossary.js` includes an `autolink()`
    that runs only on blog pages (anything with an `.article-body`): it walks the
    article's text nodes and wraps the FIRST occurrence of each known term in a `.term`
    span — skipping links, headings, code, and already-wrapped terms — so posts stay
    readable and un-cluttered. Curated match list (landing page, retargeting/remarketing,
    A/B & split testing, call tracking, attribution, ROAS, CRM, Google/Meta Ads,
    audience building, optimization). Wired site-wide on the blog via `blog-render.mjs`
    `headTags` (so index, posts, and 404 all pull the same two files; autolink no-ops
    where there's no article body). No-JS readers still get clean prose (SEO-safe).
  - Verified headless against a real rendered post (mocked-Supabase build harness):
    autolink wrapped terms once each, none inside links/headings, click/tap opens the
    right definition, Esc/backdrop closes, desktop + mobile. Homepage re-verified after
    the refactor (popover still works from external files). Live-checked after deploy.
- **✅ Netlify Forms wiring verified (2026-06-30).** Both marketing-site forms are
  correctly set up for Netlify Forms capture: `contact` (the contact section) and
  `recommendation` (the quiz email-capture) each have `data-netlify="true"`, a `name`,
  the hidden `<input name="form-name">`, and a `bot-field` honeypot; they AJAX-POST to
  `/` with the urlencoded `form-name` (Netlify's documented JS pattern). Because
  index.html is static, Netlify detects them at build and they'll appear under the
  **marketing site's** Forms tab after deploy. *Remaining: Bryson enables email
  notifications in the dashboard (steps below) — no code change needed.*
- **v3.3 update (2026-06-30): de-AI'd the copy + killed em-dashes (outside feedback).**
  A reviewer with web-design background flagged two AI tells: em-dashes (—) and the
  generally "AI-sounding" voice, both of which lower trust. Fixes:
  - **Homepage (`index.html`):** removed all 60+ em-dashes and reworded the flagged
    copy to sound like one person talking, not a model. Killed the "it's not X, it's Y"
    hero construction, trimmed rule-of-three triads, cut repeated "honestly/actually,"
    softened the founder quote, and rewrote the SEO `<title>` + meta/OG/Twitter
    descriptions + JSON-LD (Organization + FAQ) to match. 0 em-dashes left in visible copy.
  - **Glossary (`glossary.js`):** all 13 definitions rewritten dash-free and plainer.
  - **Blog chrome:** de-dashed the blog index hero (dropped the "no fluff" tell), post
    CTA, page `<title>`s (now use "|" not "—"), and meta descriptions in
    `blog-render.mjs` / `blog-index.mjs` / `blog-post.mjs`.
  - **Legal:** `privacy.html` / `terms.html` / `404.html` de-dashed.
  - **Future AI posts (`netlify/lib/blog-shared.mjs`):** added an explicit WRITING
    STYLE block to the generation system prompt (never use em-dashes; vary sentence
    length; avoid the listed AI tics) **plus a deterministic safety net** — a `deDash()`
    that strips any "—" from the generated title/excerpt/meta/body before save. So both
    the weekly auto-publish and the "Rewrite all" button now produce clean, human copy.
  - **Existing 3 live posts:** the seed used `ON CONFLICT DO NOTHING`, so re-running it
    won't update them. De-dashed the seed (`docs/sql/blog-schema.sql`) for repo
    consistency and added **`docs/sql/dedash-posts.sql`** — a one-paste `UPDATE` (uses
    `regexp_replace` with clean spacing) for Bryson to run once in Supabase to strip
    em-dashes from the live rows. (Optional fuller refresh: click "Rewrite all" in the
    OS Blog panel, which now uses the improved prompt.)
  - Verified headless after the rewrite: homepage + blog popovers still pass, blog
    re-rendered from the de-dashed seed, 0 visible em-dashes site-wide. Live-checked.
- **v3.4 update (2026-06-30): visual upgrades (Bryson: "don't want to just stare at words").**
  Since there are no client photos or real result numbers yet (and we won't fake either),
  went with polished UI mockups + motion + depth instead of stock photos. Bryson picked
  three of four proposed upgrades (skipped the results-chart/logos one to avoid anything
  that reads as invented numbers):
  - **Hero product mockup + depth.** Added a browser-framed landing-page mockup under the
    hero with a floating "Leads / month" mini bar chart (illustrative, no numbers) and a
    "New lead just came in" toast, plus a faint background grid and the existing gold glow.
    Subtle float animations; chart bars grow on load. (`.hero-stage`, `.browser`,
    `.float-chart`, `.float-toast`, `.grid-bg` in index.html.)
  - **Richer section styling.** "Every Engagement" items are now bordered cards with
    gold icon tiles and hover-lift; added soft gold top-glows behind the Services and
    Process sections for depth. (Package cards already had hover/popular accents.)
  - **Visual process timeline.** Replaced the plain numbered list with an illustrated
    vertical timeline: a gold rail that draws in on scroll, icon nodes per step (magnifier
    / layers / send / sliders / trending-up), staggered fade-in. Scroll-triggered via a
    small IntersectionObserver (`.timeline.in`); respects `prefers-reduced-motion`.
  - Mobile kept deliberately light (Bryson dislikes mobile clutter): the browser mockup
    flattens to one column, floating chart/toast are hidden, timeline compacts. Verified
    headless desktop + mobile: no horizontal overflow, no console errors, 0 em-dashes.
- **v3.5 update (2026-06-30): hero copy tweak + branded lead-notification email.**
  - **Hero copy (Bryson's wording):** opening line is now "It's not bad luck. It means
    no one has built a system to bring work in." (dropped "Usually"), and "so your
    business shows up steadily and predictably" (was "so new business shows up").
  - **Branded form-notification email.** Added `marketing-site/netlify/functions/
    submission-created.mjs`. Netlify automatically runs a function named exactly
    `submission-created` on every verified form submission; this one sends an on-brand
    HTML email (dark + gold, BoldLine wordmark, "New Website Lead" / "Quiz Lead" badge,
    fields as a clean table, a gold "Reply to <name>" mailto button, AZ timestamp)
    instead of Netlify's plain default. Sends via **Resend**, reusing the OS env vars
    `RESEND_API_KEY` + `REPORTS_FROM_EMAIL` (referenced by name only). Recipient hardcoded
    to theboldlinemedia@gmail.com (already public in the site's mailto links, so no
    secret-scan issue). Fails soft (logs + returns 200) if env vars are missing. Verified
    by rendering the generated HTML headless.
    - **Update (2026-06-30):** simplified so only **`RESEND_API_KEY`** is needed on the
      marketing site. `REPORTS_FROM_EMAIL` is now optional — if unset, the function falls
      back to `BoldLine Media <onboarding@resend.dev>`, which Resend delivers to the
      account owner's own email (theboldlinemedia@gmail.com). (Netlify hides secret env
      values once saved, so Bryson creates a fresh Resend key rather than copying the OS's.)
    - **Pending on Bryson:** (1) create a Resend API key (resend.com → API Keys) and add it
      as `RESEND_API_KEY` on the *marketing* Netlify site, then redeploy; (2) once a test
      submission confirms the branded email lands, delete the plain Netlify "Form submission
      notification" so there's one email per lead, not two.
- **v3.6 update (2026-06-30): website leads now flow into a dedicated OS "Leads" section.**
  Bryson wanted all website leads in one place in the OS, not just email. Built end to end:
  - **New table `website_leads`** (`docs/sql/website-leads-schema.sql`): BoldLine's own
    inbound leads from the marketing site (separate from per-client customer leads).
    Columns: form, name, business, email, message, recommended, status (new/contacted/
    won/lost/archived), notes, payload, created_at. RLS on, with policies for the
    `authenticated` role (the OS logs in, reads/updates via the publishable key); the
    marketing site inserts via the service-role key, which bypasses RLS. Added to the
    `supabase_realtime` publication for instant updates.
  - **Pipe-in:** `submission-created.mjs` now does two best-effort things per submission:
    insert the lead into `website_leads` (uses the marketing site's existing
    `SUPABASE_SERVICE_ROLE_KEY`) AND send the branded email. Either can fail without
    blocking the other.
  - **OS "Leads" section** (root `index.html`): new bottom-nav tab (envelope icon, green
    badge = count of `new` leads), a `LeadsScreen` with filter chips (All/New/Contacted/
    Won/Lost), and `LeadCard`s showing name/business, Contact-vs-Quiz badge, email
    (mailto), message or recommended package, a status dropdown, a Reply button, a notes
    field (saves on blur), and relative time. Live: a `leads-live` realtime channel +
    20s poll + focus refetch, and a "New lead" toast (bottom-left) that deep-links to the
    Leads tab. Degrades gracefully if the table doesn't exist yet (empty state, no crash).
    Verified: OS JSX parses (3,610 lines), function logic unit-tested (no-env / email-only
    / bad-body all return 200), Leads UI rendered as a static preview.
  - **✅ DONE 2026-06-30:** Bryson ran `docs/sql/website-leads-schema.sql` in Supabase;
    the `website_leads` table is live. The marketing site already has
    `SUPABASE_SERVICE_ROLE_KEY`, so website leads now flow into the OS Leads tab.
    (The branded *email* still needs `RESEND_API_KEY` + `REPORTS_FROM_EMAIL` on the
    marketing site, per v3.5; the Leads tab itself does not need them.)
- **✅ LAUNCHED 2026-06-30: `boldlinemedia.com` is LIVE on Netlify with HTTPS.** Wix keeps the
  registration; DNS was repointed to Netlify via **records** (Wix doesn't allow nameserver
  delegation for Wix-registered domains, so Netlify DNS couldn't be used): A `@` → `75.2.60.5`,
  CNAME `www` → `boldline-media.netlify.app`. The Wix default A records (185.230.63.x) and the
  `www`/`en` Wix CNAMEs were replaced; the unused Netlify DNS zone we'd started was deleted so
  Netlify verifies against the records. Verified live: apex serves the marketing site over HTTPS
  (Let's Encrypt cert auto-issued), `www` 301s → apex, `http` 301s → `https`. No email on the
  domain, nothing to preserve. The 3 live blog posts were also de-em-dashed via
  `docs/sql/dedash-posts.sql` (0 em-dashes live).
- **v3.7 update (2026-07-01): branded email finalized as dormant + OS notifications are dismissible.**
  - **Branded lead email (final state):** verifying `boldlinemedia.com` in Resend is blocked
    by Wix (Resend needs a subdomain MX record; Wix doesn't support subdomain MX). So the
    `submission-created` function only sends the branded email when a verified
    `REPORTS_FROM_EMAIL` is set (none is) — it's **dormant**, no spam sends. Bryson
    **re-enabled the plain Netlify form notification** to theboldlinemedia@gmail.com as the
    reliable inbox ping; the OS Leads tab is the polished view. (Reactivate later only if
    the domain moves off Wix.)
  - **OS notifications now dismissible:** upgrade requests + ARIA approvals already had
    Decline/Reject, but the derived **contract-expiry (≤7d and 8–30d) and intake alerts had
    no way to clear**. Added a dismiss control (✕ on contract cards, a "Dismiss" button on
    intake cards) in `NotificationsPanel`. Dismissals persist per client in a new
    `dismissedAlerts` array, keyed so they **auto-resurface correctly**: contract keys are
    `c7:<contractEnd>` / `c30:<contractEnd>` (a renewal changes `contractEnd`, so a fresh
    alert shows again), intake key is `intake`. The bottom-nav bell badge (`notifCount`)
    respects dismissals too. No schema/RLS change (clients are stored as a JSON blob).
  - **Website leads are deletable too (2026-07-01):** each card in the OS **Leads** tab now
    has a "Delete lead" control (inline Cancel/Delete confirm) for clearing spam/test leads.
    `deleteLead` in App does an optimistic local remove + `website_leads` delete via the
    authenticated `website_leads_auth_delete` RLS policy (already in the schema).
  - ⚠️ **Infra note (2026-07-01):** the git relay auth broke mid-session after an environment
    refresh (local proxy creds rotated; GIT_ASKPASS emptied). One commit (`af623c8`, branded
    email dormant) was relayed to `main` via the GitHub MCP `push_files` as a workaround, then
    the relay recovered and normal `git push` resumed. If pushes fail with "could not read
    Username", the remote may have been reset to an `api.anthropic.com` ingress URL — set it
    back to `https://github.com/BrysonWeiser/boldline-os.git` (the proxy's insteadOf rewrite
    handles auth) and retry.
- **TODO (Bryson's side):**
  1. ~~Create a second Netlify site~~ — **DONE** (marketing site, base dir `marketing-site`, deploys from `main`).
  2. ~~Point `boldlinemedia.com` at the site~~ — **DONE 2026-06-30** (see LAUNCHED note above).
  3. **Resubmit the Google Ads Basic Access application** once the new site is live
     at the domain — reference the live site URL, and per Google's own email, since
     the site is intentionally minimal it's worth adding a short note describing the
     business model + intended API use case (managing multiple clients' campaigns via
     one MCC) directly in the application notes, not just relying on the site alone.
  4. **Set up Google Search Console** (free) — once the site is live at the real
     domain, go to `search.google.com/search-console` → "Add property" → enter
     `boldlinemedia.com` → verify ownership (Netlify's DNS panel makes the TXT-record
     verification a copy/paste) → under "Sitemaps," submit
     `https://boldlinemedia.com/sitemap.xml`. This is what actually gets the blog
     posts crawled and indexed quickly instead of waiting for Google to stumble on
     them on its own — the single highest-leverage step for "front of Google."
  5. **Create a Google Business Profile** (free) — `business.google.com/create`,
     category "Marketing Agency," service-area business (no public office needed).
     Drives local "near me" / "[service] near [city]" search visibility, which is a
     different (and often faster) channel than blog SEO.
  6. **Optional: Google Analytics (GA4)** — real visitor data (which blog post drives
     traffic, where visitors come from) instead of guessing, and lets us compare paid
     vs. organic performance once ads are live. Not required to rank. Not set up yet —
     needs Bryson to create the actual Google Analytics account; happy to walk through
     it click-by-click whenever he wants it.
  7. **Run the blog schema SQL once** (new, v2.4) — open the Supabase dashboard for
     the BoldLine OS project → left sidebar **SQL Editor** → **New query** → open
     `docs/sql/blog-schema.sql` from this repo, paste its entire contents in, click
     **Run**. Creates the two new tables and migrates the 3 existing posts in as rows.
     Safe to re-run if you ever need to — every statement is idempotent.
  8. **Add one new env var to the *new* marketing-site Netlify site** (new, v2.4) —
     this is a separate Netlify site from the OS (see TODO #1 above), so it has its
     own separate env-var list even though it points at the same Supabase project. In
     that new site's dashboard: **Site configuration** → **Environment variables** →
     **Add a variable** → key `SUPABASE_SERVICE_ROLE_KEY`, value = the same
     service-role key already set on the OS's own Netlify site (Supabase dashboard →
     **Project Settings** → **API** → `service_role` secret, if you need to copy it
     again) → mark **Contains secret values** → save with the same
     Production/Previews/Branch-deploys/Runners scope as the OS site's vars.
     *(Correction to an earlier note: only this one env var is owed, not two —
     `SUPABASE_URL` is a non-secret constant baked directly into the code, the same
     convention the existing report-generation features already use, so it doesn't
     need an env var.)*
  9. **Turn on lead-form notifications** (new, v3.0) — the contact form and the
     recommender's email capture use Netlify Forms, which auto-activate once the
     marketing site is deployed (TODO #1). To get emailed on every submission: in the
     new site's dashboard go to **Forms** → select the `contact` form (and
     `recommendation`) → **Settings & notifications** → **Add notification** → **Email
     notification** → send to `theboldlinemedia@gmail.com`. Submissions are also always
     listed under **Forms**. Nothing to deploy — just this one-time toggle.
  10. **Personalize the founder section** (new, v3.0) — optional but recommended: drop a
      real headshot at `marketing-site/founder.png`, then in the `#founder` block of
      `index.html` change the avatar from the "B" monogram to
      `<img src="/founder.png" alt="Bryson">`, and tweak the quote/name to your own
      words. It's marked with an HTML comment so it's easy to find — or send me the photo
      and I'll wire it in.

## Stripe (BoldLine service-fee billing) — NOT started ⏳
- Purpose: bill clients **BoldLine's management/service fee only**. NOT ad spend —
  the client pays Google/Meta directly (see hard business constraint in CLAUDE.md).
- Research/walkthrough already given in chat. Task #10.

## Meta Marketing API — IN PROGRESS 🔧 (started 2026-06-25)
- **Longest approval pipeline** of all four (Business Verification + App Review — can
  take weeks). Started early on purpose so the clock runs in parallel with the Google
  Ads Basic Access wait. Task #12.
- **Starting point: from scratch** — BoldLine had nothing on Facebook/Meta (no
  personal account confirmed, no Page, no Business Manager) as of 2026-06-25.
- **Setup path (walking Bryson through it click-by-click):**
  1. Personal Facebook login — the required admin "key" behind any business (the
     personal account stays separate from the business). Use `brysonaweiser@gmail.com`.
  2. **Business Portfolio** at business.facebook.com — name `BoldLine Media`, email
     `brysonaweiser@gmail.com`, confirm via the email link.
  3. **Facebook Page** `BoldLine Media`, category Marketing Agency (needed for ads +
     verification).
  4. **Business Verification** (Business Settings → Security Center) — the weeks-long
     step; submit ASAP to start the clock.
  5. **Developer app** at developers.facebook.com (Business-type) + add the
     **Marketing API** product.
  6. **App Review** for advanced `ads_management` access.
- **Current position (2026-06-25):** Bryson is on steps 1–3 (creating the Business
  Portfolio + Page). Next session checkpoint: confirm the portfolio dashboard is up,
  then do Business Verification (step 4).
- No env vars yet — will be added once the app exists (App ID, App Secret, a
  long-lived/system-user access token). Same hard constraint applies: clients link
  and pay for their own ad accounts; BoldLine holds manager access only.

## OS internals & gotchas (read before editing the portal / landing pages)
- **The client portal HTML lives in TWO places that must be edited together:**
  `netlify/functions/portal.js` (the LIVE portal, server-rendered at `/portal?token=`)
  and a near-identical `makePortalHTML` inside `index.html` (the owner-side preview).
  Same structure, slightly different syntax (portal.js: `(r) => … .join("")`;
  index.html: `r=> … .join('')`). Change one, change the other or they drift.
  (Discovered 2026-06-25: a screenshot looked out of date because it was a cached
  pre-upgrade view — the code was already ahead.)
- **Client media upload** (the photos/logo/video clients want us to use): on the
  portal **My Info** tab. Redesigned 2026-06-25 into a prominent gold "📸 Your Photos
  & Video" card at the TOP of the tab (previously buried under the Save button, easy to
  miss) with an amber empty-state nudge that disappears after the first upload. Flow:
  `media.mjs` `action=sign` → browser PUTs the file to the signed URL → `action=confirm`
  appends `{category,label,url,path}` to the client's `mediaLibrary[]`. The AI landing
  page uses the first photo/logo as its hero image — **this is why the category
  dropdown stays even though the "Worth adding" list already tells clients what to
  bring**: the tag isn't just descriptive, the landing-page generator reads it. Uploads
  fire on their own button, independent of "Save My Information" (which only saves the
  text fields).
- **Media-category dropdown fix (2026-06-25):** client screenshot showed the
  category `<select>` rendering white text on a white background — unreadable except
  for the one option under the OS-level blue selection highlight. Cause: `.inp`
  styled the closed `<select>` dark, but the `<option>` elements in the opened native
  list inherited no override, so the browser fell back to a white dropdown with the
  inherited near-white text. Fix: added `option{background:#0D0F16;color:#F9FAFB}` to
  the CSS. Also smoothed the UX while in there: reordered options to default to
  "Photo" (the common case, was "Logo"), added a plain "What are you uploading?"
  label above the select, and added an `autoCat(input)` JS function (wired via
  `onchange` on the file input) that auto-switches the category to "Video" when the
  chosen file's MIME type starts with `video/` — logo/review still need a manual
  pick since they can't be inferred from file type. Applied identically to both
  `portal.js` and `index.html`'s `makePortalHTML` copy (see the dual-copy gotcha
  above).

- **Live alert notifications (added 2026-06-28):** Bryson noticed alerts only appeared
  after a manual page reload. Root cause: `clients` was fetched once on mount (the alert
  count and every alert are *derived* from `clients` via `getAlerts()` + `notifCount`),
  with no live refresh. Fix in `index.html`'s `App`:
  - A quiet `refreshClients()` (re-selects `clients`, no loading flash, no re-seed, no
    token backfill) is driven by three things: a **Supabase realtime** subscription on
    the `clients` table (instant), a **15s polling** interval (fallback), and a
    **refetch on tab focus / visibility**. Any of them refreshing `clients` makes the
    Alerts-tab count update on its own (it's derived state). Active client edits are
    safe — the screen being edited is bound to `activeClient`, a separate state the
    background refresh never touches.
  - New alerts pop a **bottom-left toast** (auto-dismiss ~6.5s, click → opens the Alerts
    panel). Detection diffs a `seenAlertKeys` set each time `clients` changes; the set is
    seeded on first load so existing alerts don't toast on open. Covers the same things
    the Alerts count does (intake / upgrade / contract / custom `cl.alerts` + pending
    approvals). Unit-tested the diff logic (seed→silent, new→fires once, repeat→silent).
  - **Setup owed for *instant* alerts:** enable Supabase Realtime on the `clients`
    table — Supabase dashboard → **Database** → **Replication** → the `supabase_realtime`
    publication → toggle **`clients`** on. Without it, alerts still arrive within ~15s
    via the polling fallback (and instantly on tab-focus); with it, they're real-time.
  - Sandbox note: couldn't live-click-test (needs an owner login + live Supabase
    session). Verified via Babel compile of the whole app + a unit test of the detection
    logic; the realtime/polling wiring is standard supabase-js v2.

- **Portal upgrade flow (2026-06-28):** the client portal's "Request an Upgrade" CTA
  was relabeled **"Review Selection →" → "Upgrade"** and now uses a **two-step in-page
  confirmation** (Upgrade → Cancel / **Confirm Upgrade Request**) instead of a native
  `confirm()`. On confirm it POSTs `{upgrade:<name>}` to the portal function, which
  records `data.upgradeRequest` **without** setting `intakeComplete` (a dedicated branch
  added before the intake `mergeFields`) — so the owner gets a **live alert** (ties into
  the live-alert toast above; previously the portal showed "Request Sent" but never
  persisted, so the owner never actually saw the request). Mirrored in **both**
  `portal.js` and `index.html`'s `makePortalHTML` per the dual-copy gotcha. Verified the
  client flow in headless Chromium (label → confirm step → POST body → success); the
  real Supabase round-trip needs the live env. Minor note: the owner-side preview shares
  the same JS, so confirming an upgrade *in the preview* would also persist — unlikely
  but possible.

## Reference: existing OS safety capability
- **Task #8** built a human-in-the-loop guardrail: `propose_action` → `pendingActions`
  queue → Approve/Reject. No automated process executes a real ad-account change
  without manual approval. Reused as the safety story in the Google Ads Basic Access
  design doc, and the model for how all "guarded autonomy" should work.

---

## Deferred (do not start until OS automation is done)
- **Task #18:** rebuild BoldLine Media's own website (custom-built, Netlify-hosted,
  domain `boldlinemedia.com` DNS repointed from Wix — no Wix Premium / no registrar
  transfer needed) **+** add an AI website-builder feature into the OS itself
  (extending the existing AI landing-page generator). Bryson may later sell full
  website builds as a service. Explicitly deferred until Tasks #9–17 are done.
