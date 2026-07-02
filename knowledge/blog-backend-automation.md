---
name: blog-backend-automation
topic: Blog
task: understand or change how the blog stores posts and how AI writes, regenerates, and auto-publishes them
keywords: [blog_posts, blog_settings, blog-shared.mjs, blog-admin.mjs, blog-autopublish.mjs, BLOG_FACTS, posts_per_week]
status: verified
summary: Blog is DB-backed (blog_posts + singleton blog_settings). AI writes posts via blog-shared.mjs (Anthropic forced tool call, grounded in BLOG_FACTS); owner controls via blog-admin.mjs + Deploy-tab Blog panel (write/regenerate/delete/rewrite-all/rebuild); blog-autopublish.mjs auto-publishes on a Mon/Wed/Fri quota check.
verified: 2026-07-02
---

**Tables** (`docs/sql/blog-schema.sql`, one idempotent paste into the Supabase SQL Editor):
- `blog_posts`: slug/title/category/excerpt/meta_description/body_html/read_minutes; `status` enum `published|draft|deleted` (soft-delete); `source` enum `ai|manual`; separate `created_at` vs `published_at`.
- `blog_settings`: singleton row, `id` pinned to `1` via a check constraint, holds `posts_per_week`.
- The seed migrates the 3 original static posts in as `source:'manual'` with staggered `published_at` reproducing their exact prior display order (nothing visible changed on day one). Seed uses `ON CONFLICT DO NOTHING`.

**AI generation** (`netlify/lib/blog-shared.mjs`): Anthropic API with a **forced tool call** (`tool_choice:{type:"tool",name:"blog_post"}`) so it always returns clean structured fields (title/category/excerpt/intro/3-5 sections with optional body+bullets/pull-quote/conclusion). Every prompt is grounded in a `BLOG_FACTS` constant (the only BoldLine facts the AI may state: real process, what's-true-on-every-plan, the ad-spend-ownership rule, the real Calendly link), with explicit "never invent client results/testimonials/stats" and "never repeat or rephrase an existing post's topic." Also carries the `deDash()` safety net (see `dedash-ai-voice`).

**Owner controls** (`netlify/functions/blog-admin.mjs` + a **Blog** panel on the ARIA Deploy tab in root `index.html`): same Bearer-JWT owner-auth as the Google Ads tools. Actions:
- list posts; **write one now**; **regenerate** a post; **delete** a post (soft, inline confirm); **delete-all**; set weekly cadence.
- **Regenerate** keeps the **same id/slug/created_at permanently**, only swaps content fields + bumps `published_at` — the live URL never breaks, and it still counts as the *original* post for quota (never a second new one). Topic-locked (another pass at the same subject). No version history — overwrites for good.
- **Rewrite All Posts:** loops regenerate across every live post ("Rewriting post N of T…"). Same id/slug/created_at preserved; does **not** touch `created_at`, so never affects quota.
- **Rebuild From Scratch:** soft-deletes every post (`delete-all`), then writes that many brand-new posts on new topics (defaults to 3 if empty). New posts set `created_at`=now, so they **count against that week's auto-publish quota immediately** (can make a nearby scheduled check skip).
- **Why bulk buttons loop from the browser, not one backend call:** each AI generation runs close to a single Netlify function timeout on its own; looping several inside one invocation risked timing out mid-run with no progress. So both bulk buttons call the proven single-post endpoints once per post and update a progress line. All bulk/per-post buttons disable while any run is in flight (avoids two writes racing the same post).

**Auto-publish cron** (`netlify/functions/blog-autopublish.mjs`, scheduled **Mon/Wed/Fri 14:00 UTC** via `netlify.toml`):
- Counts posts created in the trailing 7 days (by `created_at`, **never** `published_at`, so a regenerate never double-counts) against `blog_settings.posts_per_week`. Under quota → writes & publishes one more AI post and emails `OWNER_EMAIL` a branded "new post is live" notice. At/over quota → no-ops silently.
- The 3x/week check cadence was chosen so the **schedule never needs changing** as the cadence ramps from 1/week to 2-3/week — most checks just no-op early on.
- `?test=1` emails a quota-used-vs-limit report **without publishing** (same dry-run convention as `lead-followup.mjs`).
- Cadence recommendation (confirmed): **1 post/week for the first 3 months, then ramp to 2-3/week.** Control model: **auto-publish immediately + email notify** (not draft-for-approval); delete/regenerate is the safety valve.
