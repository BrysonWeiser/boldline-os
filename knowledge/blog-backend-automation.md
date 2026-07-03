---
name: blog-backend-automation
topic: Blog
task: understand or change how the blog stores posts and how AI writes, regenerates, and auto-publishes them
keywords: [blog_posts, blog_settings, blog-shared.mjs, blog-admin.mjs, blog-autopublish.mjs, BLOG_FACTS, posts_per_week]
status: verified
summary: Blog is DB-backed (blog_posts + singleton blog_settings). REVIEW-FIRST pipeline (2026-07-03): AI writes posts ahead as scheduled drafts (status='draft' + future published_at = exact go-live time); blog-autopublish runs every 15 min (publishes due drafts, keeps ≥1 scheduled, self-healing); owner reviews/edits/reschedules in the OS Website tab before they go live.
verified: 2026-07-03
---

**Tables** (`docs/sql/blog-schema.sql`, one idempotent paste into the Supabase SQL Editor):
- `blog_posts`: slug/title/category/excerpt/meta_description/body_html/read_minutes; `status` enum `published|draft|deleted` (soft-delete); `source` enum `ai|manual`; separate `created_at` vs `published_at`.
- `blog_settings`: singleton row, `id` pinned to `1` via a check constraint, holds `posts_per_week`.
- The seed migrates the 3 original static posts in as `source:'manual'` with staggered `published_at` reproducing their exact prior display order (nothing visible changed on day one). Seed uses `ON CONFLICT DO NOTHING`.

**AI generation** (`netlify/lib/blog-shared.mjs`): Anthropic API with a **forced tool call** (`tool_choice:{type:"tool",name:"blog_post"}`) so it always returns clean structured fields (title/category/excerpt/intro/3-5 sections with optional body+bullets/pull-quote/conclusion). Every prompt is grounded in a `BLOG_FACTS` constant (the only BoldLine facts the AI may state: real process, what's-true-on-every-plan, the ad-spend-ownership rule, the real Calendly link), with explicit "never invent client results/testimonials/stats" and "never repeat or rephrase an existing post's topic." Also carries the `deDash()` safety net (see `dedash-ai-voice`).

**Owner controls** (`netlify/functions/blog-admin.mjs` + the **Website tab** in the OS bottom nav — moved there from the ARIA Deploy tab 2026-07-03; the Deploy tab now just shows a pointer note. The Website tab also carries quick links to the live site pages): same Bearer-JWT owner-auth as the Google Ads tools. Actions:
- list posts; **get** (one post incl `body_html`, for the editor); **update** (manual owner edit of title/category/excerpt/meta_description/body_html via the Edit modal — publishes immediately, same slug/URL, recomputes `read_minutes` at ~200wpm when the body changes, never touches slug/created_at/published_at so URLs + quota are safe); **write one now**; **regenerate** a post (UI label: "AI Rewrite"); **delete** a post (soft, inline confirm); **delete-all**; set weekly cadence.
- **Regenerate** keeps the **same id/slug/created_at permanently**, only swaps content fields + bumps `published_at` — the live URL never breaks, and it still counts as the *original* post for quota (never a second new one). Topic-locked (another pass at the same subject). No version history — overwrites for good.
- **Rewrite All Posts:** loops regenerate across every live post ("Rewriting post N of T…"). Same id/slug/created_at preserved; does **not** touch `created_at`, so never affects quota.
- **Rebuild From Scratch:** soft-deletes every post (`delete-all`), then writes that many brand-new posts on new topics (defaults to 3 if empty). New posts set `created_at`=now, so they **count against that week's auto-publish quota immediately** (can make a nearby scheduled check skip).
- **Why bulk buttons loop from the browser, not one backend call:** each AI generation runs close to a single Netlify function timeout on its own; looping several inside one invocation risked timing out mid-run with no progress. So both bulk buttons call the proven single-post endpoints once per post and update a progress line. All bulk/per-post buttons disable while any run is in flight (avoids two writes racing the same post).

**Publishing pipeline** (`netlify/functions/blog-autopublish.mjs`, scheduled **every 15 minutes** via root `netlify.toml`) — **review-first model (Bryson, 2026-07-03; replaced the old Mon/Wed/Fri publish-immediately quota model):**
- **A scheduled post = `status='draft'` with `published_at` set to the future go-live time.** No schema change was needed; the public blog/sitemap filter `status='published'`, so drafts never leak. When the time arrives the cron just flips status to published (the timestamp already on the row becomes the official publish time) and emails the "now live" notice.
- **Pipeline top-up:** after publishing due drafts, if no future-dated draft remains, the cron writes a new AI post and schedules it one cadence-interval (`7 / posts_per_week` days, from `nextPublishSlot()`) after the latest post on the books (never sooner than now+1h), then emails a "scheduled for <date> — review it" notice. This guarantees **always ≥1 scheduled post awaiting review** and self-heals if the owner deletes or early-publishes the pending one (next 15-min check refills).
- **Gotcha fixed in the same change:** `regeneratePost` used to bump `published_at` to *now* — on a draft that would have made it instantly due. It now preserves a draft's scheduled time (published posts still bump to newest).
- OS Website tab shows two sections: **Scheduled — awaiting your review** (gold rows, exact local publish time, actions: Review/Edit, AI Rewrite, Reschedule via `datetime-local` picker, Publish Now, Delete) and **Posted — live on the site**. Primary write button is "Write & Schedule" (`generate-scheduled`); "Write + Publish Now" (`generate-now`) remains as the skip-review escape hatch. New admin actions: `generate-scheduled` (optional `{when}`), `publish-now`, `reschedule` (drafts only, future-time validated).
- `?test=1` emails a pipeline report (due drafts / pending count / next slot) **without doing anything** (same dry-run convention as `lead-followup.mjs`).
- Cadence still lives in `blog_settings.posts_per_week` (slot spacing = 7/N days). Recommendation unchanged: 1/week first 3 months, then ramp.
