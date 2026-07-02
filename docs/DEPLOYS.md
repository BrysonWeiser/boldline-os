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
