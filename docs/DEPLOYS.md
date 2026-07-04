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
