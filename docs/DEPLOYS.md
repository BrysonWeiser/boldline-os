# Deploys & Rollback

How production deploys and rollbacks work for BoldLine OS.

## How it deploys
- Production = the **`main`** branch. Netlify auto-builds and deploys whenever `main`
  changes.
- All work happens on `claude/zen-babbage-1wtcv3`, then gets **auto-merged into `main`**
  after each completed unit of work (Bryson's standing instruction, 2026-06-29).

## The safety net (so we can always roll back)
Three independent ways back to the last working version:

1. **Netlify deploy history** — Netlify keeps every past deploy and can re-publish any
   of them instantly, no code changes. This is the fastest path.
2. **`rollback/<timestamp>` branches** — right before every merge, the current production
   state of `main` is saved to a branch named `rollback/<UTC timestamp>` and pushed.
   Each is a frozen snapshot of production *before* that merge. They accumulate on
   purpose (each = one saved restore point).
   - List them, newest last: `git branch -r --list 'origin/rollback/*'`
3. **The merge commit's first parent** — every deploy merge is a `--no-ff` merge commit,
   so its first parent is always the exact pre-merge state, recoverable via `revert`.

> Note: this git remote **blocks tag pushes and branch deletions**, so restore points
> are pushed *branches* (not tags), and old `rollback/*` branches can't be deleted —
> that's fine, we want them kept. (A leftover `zz-rollback-test` branch from setup is
> harmless and can't be removed.)

## How to roll back

### Fastest (no code) — Netlify
1. Netlify dashboard → the site → **Deploys**.
2. Find the last deploy that worked (each row shows commit + time).
3. Click it → **Publish deploy**. Production reverts immediately.

### Code-level — git revert (clean, preferred)
Back out the most recent deploy merge and let Netlify redeploy the prior code:
```
git checkout main && git pull origin main
git revert -m 1 <merge-commit-sha>     # the "Merge … into main (deploy)" commit
git push origin main
```

### Restore to a specific saved branch
```
git checkout main && git pull origin main
git reset --hard origin/rollback/<timestamp>
git push --force-with-lease origin main
```
Prefer the revert or Netlify route; force-push rewrites `main`.

## Log of restore points
Each row = the production state saved *before* that merge (the rollback target).

| Date (UTC) | Pre-merge SHA | Rollback branch | What the merge shipped |
|---|---|---|---|
| 2026-06-29 | `3c96043` | `rollback/20260629-000411` | First auto-merge: full session — marketing-site rebuild + blog automation, OS live-alert toasts, portal upgrade-CTA + confirmation, the auto-merge/rollback workflow itself. |
| 2026-06-29 | `048b491` | `rollback/20260629-DOCS` | Doc fix: switch rollback mechanism from tags → branches (tags can't push to this remote). |
| 2026-06-29 | `e071d85` | `rollback/20260629-003813` | Marketing site: privacy + terms + branded 404 pages, footer legal links, soft-404 fix (removed catch-all rewrite). |
| 2026-06-29 | `dcf2828` | `rollback/20260629-022514` | Blog 404 fix attempt #1: moved blog.css out of /blog/ and added force=true to blog redirects (routed to the function but didn't fully fix it). |
| 2026-06-29 | `f709686` | `rollback/20260629T224622Z` | Blog 404 real fix: read slug from /blog/&lt;slug&gt;/ and page from /blog/page/&lt;n&gt;/ in the path — Netlify new-format functions don't receive the redirect's `?slug=`/`?page=` query. |
| 2026-06-29 | `65fcc2b` | `rollback/20260629T224744Z` | Docs only: logged the blog-fix rollback points in this file. |
| 2026-06-29 | `f7d1713` | `rollback/20260629T224957Z` | Docs only: corrected the blog-404 root-cause writeup in INTEGRATIONS.md. |
| 2026-06-29 | `5d1ac42` | `rollback/20260629T233952Z` | Marketing site: plain-English jargon popovers on package terms + inclusive wording (niches as examples, equal-effort promise). |
| 2026-06-30 | `2a067dd` | `rollback/20260630T001347Z` | Glossary popovers refactored to shared /glossary.css + /glossary.js and extended to blog posts (runtime auto-linker). Netlify Forms wiring verified (no change). |
| 2026-06-30 | `44846e4` | `rollback/20260630T045451Z` | De-AI'd the copy: removed all em-dashes + reworded AI-sounding text site-wide (homepage, glossary, blog chrome, legal); updated blog-gen prompt + deterministic deDash safety net; added dedash-posts.sql for the live posts. |
| 2026-06-30 | `5c34928` | `rollback/20260630T060411Z` | Visual upgrades: hero browser/landing-page mockup + floating chart/toast + grid depth, "Every Engagement" cards, illustrated scroll-drawn process timeline. Mobile kept light. |
| 2026-06-30 | `33dc4e2` | `rollback/20260630T061426Z` | Hero copy tweak (Bryson wording) + branded form-notification email (submission-created.mjs via Resend). |
| 2026-06-30 | `4d2c2eb` | `rollback/20260630T063103Z` | Website leads now flow into a dedicated OS Leads section: website_leads table, submission-created DB insert, OS Leads tab (filters, status, notes, realtime). |
| 2026-07-01 | `c5c0f0f` | `rollback/20260701T060723Z` | Branded lead email set dormant (Wix blocks Resend domain verification); relayed via GitHub MCP after a git-relay hiccup, then git recovered. |
| 2026-07-01 | `af623c8` | `rollback/20260701T063124Z` | OS notifications: contract-expiry + intake alerts are now dismissible (per-client dismissedAlerts; bell badge respects them). |
| 2026-07-01 | `77c6fa8` | `rollback/20260701T180426Z` | OS Leads tab: each lead card now has a Delete control (Cancel/Delete confirm) that removes the row from website_leads. |
| 2026-07-01 | `80a7d55` | `rollback/20260701T182745Z` | Mobile optimization: fixed 720px section-glow overflow that expanded the phone viewport to 555px (disabling phone styles); clipped it + tightened mobile section padding/type. |
| 2026-07-01 | `f2017d0` | `rollback/20260701T183735Z` | Mobile density pass: compacted package cards, engagement cards, timeline, and fit section (authoritative trailing @media block); homepage ~18% shorter on mobile. |
| 2026-07-02 | `4275062` | `rollback/20260702T062315Z` | Knowledge-base system (task-keyed entries under knowledge/ + recall hook; docs/INTEGRATIONS.md now the auto-generated slim index). Marketing site: boutique statement restyled as a contained card; nav-link clicks now glide + soft-fade to the section. |
| 2026-07-02 | `aeb32f2` | `rollback/20260702T063642Z` | Marketing site tweak: deepened the nav-transition fade veil (peak 0.5 -> 0.7) for a stronger mid-transit dim. |
| 2026-07-02 | `d2c897f` | `rollback/20260702T162611Z` | Docs/KB only: captured today's work as KB entries (nav transition, design system, KB-system) + recorded the Sonnet-default / flag-Opus / lean working rule in CLAUDE.md. No site behavior change. |
| 2026-07-02 | `c5376fc` | `rollback/20260702T180118Z` | Marketing site: nav bar now auto-hides on scroll-down and reveals on scroll-up (was always fixed at top) so it stays out of the way of content but is one scroll away. |
| 2026-07-02 | `522e6d5` | `rollback/20260702T180218Z` | Docs/KB only: captured the nav auto-hide/reveal behavior as a KB entry. No site behavior change. |
| 2026-07-02 | `d4379b9` | `rollback/20260702T181014Z` | Bugfix: nav auto-hide never triggered on real trackpad/momentum scrolling (per-event delta threshold vs. many small-px events). Switched to cumulative distance since last direction change; verified with fine-grained Playwright scroll simulation. |
| 2026-07-02 | `67f999e` | `rollback/20260702T181605Z` | Real fix for nav still not hiding: the header intro animation (header.nav-in, fill-mode both) permanently held transform:translateY(0), overriding .nav-hidden. Moved the intro animation onto .nav-inner so the header transform is free. Verified via the header's actual computed transform/bounding rect (off-screen), not just the class. |
| 2026-07-02 | `2305564` | `rollback/20260702T182037Z` | Nav polish: reveal now slower/smoother than the hide. Asymmetric transform transition — reveal .6s easeOutQuint (base header) vs hide .35s (.nav-hidden), since CSS uses the destination state's transition. Verified reveal ~475ms vs hide ~344ms. |
| 2026-07-02 | `d8bd187` | `rollback/20260702T183712Z` | Living ambient background (aurora orbs + gold constellation canvas + film grain, fixed z-index -1) + micro-motion pass: safe scroll-settle reveals w/ stagger, divider draw-in, scroll-progress hairline, orb parallax, hover polish. Also fixed pre-existing no-JS gap on timeline steps (opacity:0 now gated behind html.js-tabs). Full Playwright suite: no-JS visibility, reduced-motion, jump-to-bottom stuck-check, mobile. |
| 2026-07-02 | `27dedee` | `rollback/20260702T200319Z` | Ambient background v2: nine floating ad-ecosystem glyphs (search, cursor, chart, trend, pin, bullseye, lead bubble, megaphone, AD badge) in gold line-art drifting in the desktop side gutters; layer joins the parallax loop; hidden <900px; static under reduced-motion. |
| 2026-07-03 | `83063fe` | `rollback/20260703T045316Z` | Ambient v3 (Bryson: icons read "lazy/childish", band looked off): flattened the .alt section bands to transparent so the background flows uniformly, and replaced the 9 small icons with 4 large fine-line "campaign blueprint" wireframes (ghost search-ad skeleton, slow-rotating targeting reticle, 5→3→1 conversion funnel, rising performance curve w/ pulsing endpoint). Nearly still; parallax provides depth. |
| 2026-07-03 | `c81cfa7` | `rollback/20260703T045906Z` | No-black-boxes sweep: .trust ("You keep the keys") still painted an opaque gradient band and #contact a card band — both flattened to transparent (trust keeps its gold radial glow). Verified no structural element paints a full-width background anymore. |
| 2026-07-03 | `0586a32` | `rollback/20260703T050520Z` | Package cards: tap/click = single selection (.sel); featured "Most Popular" ring steps aside via :has() when another card is selected/hovered — fixes mobile "two packages look selected" (sticky tap-hover + permanent featured ring). |
| 2026-07-03 | `4aed06a` | `rollback/20260703T054100Z` | Mobile living background: constellation now runs on phones (20–26 pts, LINK 110, DPR ≤1.25) and two blueprints join mobile (reticle cropped top-right, curve bottom-right); ghost-ad card + funnel stay desktop-only. No overflow (ambient clips). |
| 2026-07-03 | `5822d02` | `rollback/20260703T054549Z` | Blueprint background v4: added an ads-manager dashboard wireframe (right gutter) + Instagram and Meta marks as hairline line-art outlines (left gutter) — 7 desktop pieces total, all still; mobile keeps its curated reticle + curve pair. |
| 2026-07-03 | `74685ed` | `rollback/20260703T055315Z` | Blueprint declutter (v5, per Bryson): desktop down to 5 pieces — ghost search-ad, Google Ads mark (replaces Instagram), Meta loop, ads-manager dashboard, performance curve. Funnel removed; reticle retired from desktop but kept on mobile (approved composition there). |
| 2026-07-03 | `8786d98` | `rollback/20260703T055819Z` | Google Ads mark made visible: 92px @ .105 opacity (was 62px @ .075, washed out in the orb glow), moved to darker background, stroke weight matched to the Meta loop. |
| 2026-07-03 | `3c12a08` | `rollback/20260703T060517Z` | Blueprint v6: Google "G" replaces the Ads mark; staggered scatter layout (varied insets/tilts, no more two straight columns); mobile now shows Google G + Meta loop + curve; reticle fully removed. |
| 2026-07-03 | `76c0e48` | `rollback/20260703T060950Z` | Google G upgraded to the actual official four-segment geometry (sign-in asset paths), solid monochrome gold fill instead of a thin-stroke approximation. |
| 2026-07-03 | `d6d11c4` | `rollback/20260703T061309Z` | Google G switched from solid fill to outline (same official geometry, stroke 1.5, opacity .11) per Bryson — "not colored in". |
| 2026-07-03 | `2976647` | `rollback/20260703T061829Z` | Google G downsized (84px/.11 → 66px/.095) — stood out too much vs the rest of the background set. |
| 2026-07-03 | `5c2c996` | `rollback/20260703T062702Z` | OS: new bottom-nav Website tab — site quick-links + full blog manager (cadence, write-now, per-post Edit modal w/ live-publishing manual editor, AI Rewrite, delete, bulk ops). blog-admin.mjs gains get/update actions (update recomputes read_minutes, never touches slug/dates). Deploy-tab blog panel replaced by a pointer. |
| 2026-07-03 | `5257e2e` | `rollback/20260703T154231Z` | Blog review-first pipeline: AI posts are now written ahead as scheduled drafts (status='draft' + future published_at) with exact publish times; blog-autopublish runs every 15 min (publish due drafts + keep ≥1 scheduled, self-healing, email on schedule + on publish); OS Website tab split into Scheduled (Review/Edit, AI Rewrite, Reschedule, Publish Now, Delete) and Posted sections; new admin actions generate-scheduled/publish-now/reschedule; regenerate preserves a draft's schedule. |
| 2026-07-03 | `f033f77` | `rollback/20260703T155132Z` | Copy: removed "at a time" from the boutique card + fit intro; "fundamentals work everywhere" (was "almost anywhere"); BLOG_FACTS aligned. |
| 2026-07-03 | `31f23e1` | `rollback/20260703T155643Z` | FAQ copy: parentheses removed (cost + results-link); contract FAQ replaced with "Why is there a three month minimum to start?" + compounding rationale; JSON-LD schema mirrored; BLOG_FACTS gains the 3-month-minimum fact. |
| 2026-07-03 | `7a05ab0` | `rollback/20260703T160759Z` | Parenthesis purge site-wide (homepage, privacy, terms, glossary titles); Meta is now a glossary popover term in the platforms FAQ; blog style prompt bans parentheses (it previously suggested them); contact copy "good fit". |
| 2026-07-04 | `6ac3487` | `rollback/20260704T064719Z` | Blog fixed weekly schedule: publish Mondays 8am Arizona, write+schedule Tuesdays 8am; replaced the buggy "spacing from last post" cadence (which flooded same-day posts) with azMostRecent/weeklyTargetMs + a once-per-Tue→Mon-cycle guard in blog-autopublish; manual Write&Schedule uses next open Monday slot; OS cadence input replaced with the fixed-schedule line. Timezone math + no-flood behavior unit-tested. |
| 2026-07-04 | `8dbba65` | `rollback/20260704T070713Z` | Fix "Request failed" on blog write buttons: AI generation exceeded the ~10s synchronous function limit (502). Added netlify/functions/blog-write-background.mjs (Netlify *-background async fn, 15-min limit) for generate-now/generate-scheduled/regenerate; OS kicks it off + polls list() for the result (callBg/pollList). Rewired both write buttons, per-post AI Rewrite, and both bulk flows. |
| 2026-07-04 | `5ad0853` | `rollback/20260704T071612Z` | Package CTAs: turned the small underlined "Book a Call →" text links into prominent full-width gold buttons (soft-outlined default, solid gold on the Most Popular card, fill+lift on hover, bottom-aligned via flex-column). |
| 2026-07-04 | `52652ed` | `rollback/20260704T072551Z` | Package CTAs: (1) all start non-highlighted, fill gold on hover or when the card is selected (removed featured solid default); (2) Book a Call opens Calendly in an on-site popup (widget assets + delegated interceptor, falls back to link, excludes the recommender trigger); (3) package name passed as utm_content so the booked Calendly event shows which package. |
| 2026-07-04 | `db0e679` | `rollback/20260704T073501Z` | Calendly prefill: book-a-call now prefills the "Which package are you interested in?" custom answer (customAnswers[a1]) with the package name (card heading, or recommender's recommended tier), keeping the utm_content backup. PKG_ANSWER_KEY constant if the question isn't first. |
| 2026-07-04 | `6cc53df` | `rollback/20260704T073830Z` | Calendly prefill key a1 -> a2 (test booking showed the package landing in "Briefly describe your business"; a2 is the "Which package" question). |
| 2026-07-04 | `0bad145` | `rollback/20260704T074050Z` | Calendly prefill key a2 -> a3 (form order confirmed by testing: a1 describe business, a2 budget, a3 which package). |
| 2026-07-04 | `434e273` | `rollback/20260704T200333Z` | Site audit fixes: nav's 109KB inline base64 logo → /logo.png reference; logo.png quantized 81→14.5KB and og-image 159→25KB (visually identical); _headers with 1-week image caching; Calendly widget.css made non-blocking + preconnect; meta/og description 179→145 chars; engagement cards h4→h3 (heading-skip fix). Audit found the rest clean (links, anchors, alts, form attrs, overflow, no-JS, 404/robots/sitemap, blog voice rules). |
| 2026-07-04 | `6a37b19` | `rollback/20260704T202345Z` | Founder headshot replaces the "B" monogram (founder.jpg, 17KB, lazy, alt); og-image rebuilt without the baked-in em-dash + with current hero copy (og-image.jpg 57KB via headless render with real Playfair/Inter; metas now point at .jpg, old .png kept for scraped shares); both images added to _headers caching. |
| 2026-07-05 | `f441702` | `rollback/20260705T005830Z` | Client media management: media.mjs action=delete (storage object + mediaLibrary entry); portal media rows get thumbnails + per-file ✕ remove (both portal copies); owner-side Client Media gallery card in Client View tab (image/video previews + delete via client's portalToken); AI landing generator now receives the media list and OPTIONALLY picks the hero (heroIndex → landingPage.heroPath, video rejected, renderers fall back photo→logo) — bots use what they need, never required to use everything. |
| 2026-07-05 | `8ebd676` | `rollback/20260705T015818Z` | AI vision media selection: generate-landing.mjs now attaches the client's actual images (URL image blocks, own-Supabase-host only, no videos, max 10) so the hero is picked by looking at the pixels — sharp/well-lit/real-work wins, weak images skipped (-1 allowed). Text-only retry if the vision request fails on a bad image. A/B split testing assessed + deferred until first live-traffic client. |
| 2026-07-06 | `0b9c0fd` | `rollback/20260706T171223Z` | Visual refresh: client portal living-gold aesthetic (ambient orbs + halo + grain, glass cards, gold conic progress ring N/8, 8-node stage tracker, welcome hero, tab fade) mirrored across BOTH portal copies (portal.js + index.html makePortalHTML); plus a lighter OS-app shared-layer pass (subtle ambient, card depth + hover, screen fade, gold scrollbar/focus). Dark+gold brand kept. |
| 2026-07-06 | `6552b34` | `rollback/20260707T035202Z` | Fix OS bot-sheet (and in-screen overlay) positioning — the .os-content screen-fade left a lingering transform (fill:both) that became the containing block for position:fixed children; switched to opacity-only fade. Also brightened the OS ambient orbs+halo and added grain so the background reads. |
| 2026-07-07 | `e6226ec` | `rollback/20260707T043601Z` | Mobile fix: bottom sheets (ARIA panel, notifications, recommender) were sized in vh, which on phones counts the area behind the browser address bar — clipping the sheet header behind the chrome. Switched to dvh (dynamic viewport height) with a vh fallback (.os-sheet class + !important). |
| 2026-07-07 | `2165d6e` | `rollback/20260707T051846Z` | Tooling/docs only (no app change): committed tools/os-screenshot.js — a headless-Chromium render harness that boots the real index.html with a stubbed Supabase and captures desktop + mobile PNGs, so UI changes can be self-QA'd before shipping. Auto-detects the pre-installed Chrome build; loads react/babel from node_modules. KB: os-screenshot-harness. |
| 2026-07-07 | `1f462ac` | `rollback/20260707T062952Z` | Home MRR card is now tappable → new RevenueScreen ("Revenue by Client"): total MRR + one row per client sorted high→low (monthly management fee, package/platform, setup fee, share-of-revenue bar), each row taps through to the client. Wired as screen==="revenue" (sub-page of home, back button). |
| 2026-07-07 | `dd93f97` | `rollback/20260707T064419Z` | Desktop layout: ≥1024px now renders a real desktop shell — persistent left sidebar (Dashboard/Revenue/Leads/Website + Alerts/ARIA/Log Out) replaces the bottom tab bar, home KPIs form one row (MRR hero + 3 stat tiles), client list / revenue rows / leads flow into responsive multi-column grids, client detail width-capped at 1000px, toasts bottom-right. Mobile untouched (useIsDesktop() hook + display:contents wrapper). |
| 2026-07-07 | `4053868` | `rollback/20260707T181131Z` | Dashboard stat tiles now tap through: Alerts / Expiring / Clients tiles open a SegmentScreen (one component, 3 modes) — Alerts = clients with active alerts (messages inline, red first), Expiring = contracts ending ≤30d (most urgent first, days left + end date), Clients = full roster (stage + health). Rows deep-link to the client hub. Desktop grid + mobile column. |
| 2026-07-08 | `318f408` | `rollback/20260708T163649Z` | Positioning: "any business, not small businesses" (Bryson) — blog AI prompts (blog-shared.mjs) no longer target "small-business owners"; CLAUDE.md + design-doc template updated. Plus session KB updates: Search Console done, Google Ads Basic Access resubmitted (design doc at docs/google-ads-api-design-doc.html), Meta portfolio created then restricted (review requested), pre-client-readiness entry. |
| 2026-07-09 | `ff20d1a` | `rollback/20260709T163210Z` | Site feedback round (outside opinion via Bryson): "limited" reworded to select/focused; every package card shows "Management starting at $X/mo" (real PACKAGES_DB prices; FAQ + JSON-LD name the $350 floor — REVERSES the no-public-pricing rule); new #system 5-step diagram section (budget → campaigns → landing page → tracked leads → reporting), stacks under 900px. Desktop+mobile verified via headless render. |
| 2026-07-09 | `1d12513` | `rollback/20260709T163914Z` | Dedupe after Bryson flagged overlap: #included ("Every Engagement") cut from 6 cards to the 3 true guarantees (scope locked / transparency / no spend without sign-off), retitled "The ground rules on every plan.", 3rd card centered; deliverable cards removed since the #system diagram covers them. |
| 2026-07-10 | `dbc63f7` | `rollback/20260710T071000Z` | Stripe billing build: stripe-billing.mjs (owner-authed create-checkout/sync/portal — subscription-mode Checkout, card+ACH, monthly price + one-time setup fee) + stripe-webhook.mjs (signature-verified, syncs billingStatus to the client) + BillingCard in the Contract tab. Service fee ONLY, never ad spend. Inert until STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are set in Netlify + the webhook endpoint is created (see KB stripe-billing). |
| 2026-07-10 | `2e79e5c` | `rollback/20260714T053009Z` | Fix client→owner data sync: refreshClients/loadClients now re-sync the open activeClient from fresh data by id (was only updating the clients array), so a client editing their portal info now shows on the owner side. Preserves _initialTab; owner edits unaffected. |
