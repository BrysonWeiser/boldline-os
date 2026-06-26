# BoldLine OS — Integrations & Setup Log

Detailed record of external-platform setup.

> **No secret values are stored here** — only variable names, non-secret account
> identifiers, decisions, and state. All credential values live only in Netlify
> environment variables.

Last updated: **2026-06-26**

## Netlify environment variables
All app secrets live here. Convention: ALL_CAPS_SNAKE_CASE, marked **"Contains
secret values"**, same value across Production / Deploy Previews / Branch deploys /
Preview Server & Agent Runners (Local development is dropped automatically for
secret vars — we don't use the Netlify CLI locally, so this is fine).

Pre-existing vars: `OWNER_EMAIL`, `OWNER_PHONE`, `REPORTS_FROM_EMAIL`,
`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `URL`.

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
- ⚠️ **Placeholder needing Bryson's input:** the contact section currently shows
  `hello@boldlinemedia.com` — a guess, not a confirmed live mailbox. Needs Bryson to
  either confirm that address (and make sure it's actually receiving mail once DNS
  is repointed) or give a different one to swap in. Asked three times in chat now,
  unanswered as of 2026-06-26 — still open.
- **TODO (Bryson's side, click-by-click owed before resubmitting):**
  1. **Create a second Netlify site** from this same repo — in the Netlify dashboard,
     "Add new site" → "Import an existing project" → pick the `boldline-os` repo
     again (yes, the same repo as the OS) → in that new site's build settings, set
     **Base directory** to `marketing-site`. Netlify will then read
     `marketing-site/netlify.toml` for this site instead of the root one, so it serves
     completely independently from the OS.
  2. **Point `boldlinemedia.com` at the new site** — in that new Netlify site's
     "Domain management," add `boldlinemedia.com` as a custom domain, then update the
     domain's DNS at the registrar (wherever it's currently pointed for Wix) to
     Netlify's nameservers/records (Netlify shows the exact records once the domain
     is added). No registrar transfer needed, just a DNS change.
  3. **Resubmit the Google Ads Basic Access application** once the new site is live
     at the domain — reference the live site URL, and per Google's own email, since
     the site is intentionally minimal it's worth adding a short note describing the
     business model + intended API use case (managing multiple clients' campaigns via
     one MCC) directly in the application notes, not just relying on the site alone.

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
