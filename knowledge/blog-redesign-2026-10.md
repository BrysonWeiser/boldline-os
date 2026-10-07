---
name: blog-redesign-2026-10
topic: Marketing site
task: change the blog's look, its cover pictures, the weekly AI writer, or fix/rewrite broken or weak blog posts
keywords: [blog redesign, blog covers, blog-cover.mjs, coverSVG, site-chrome.mjs, bx-card, art-body, broken blog posts, empty h2, blog writer, generateBlogPost, postProblems, htmlProblems, repairOneBrokenPost, blog lanes, BLOG_FACTS, blog-autopublish, newsletter dash, author bio local]
status: writer fix, self-repair and redesign LIVE 2026-10-07 (Bryson approved the test copy); 2 wording fixes + 4 hand-written posts shipped as scheduled drafts
summary: Bryson, 2026-10-07 - the blog "seems outdated and not worth anyones time". Found 6 LIVE posts broken (two paragraphs then ~65 empty h2s): the writer forced a tool call on claude-opus-4-8 and published whatever came back. Writer now claude-opus-5-5 with structured JSON output, a shape check + one retry, an HTML check, rotating topic lanes (ads / websites / a trade / lead follow-up) and updated facts; blog-autopublish never publishes a broken draft and repairs one broken PUBLISHED post per run (same topic, same date and address, email to Bryson). Redesign: blog pages now use the site's own stylesheet, header, footer and scripts (generated site-chrome.mjs), drawn cover art per post, featured post, topic filters, contents sidebar, author box, topic-matched offer, related posts.
verified: 2026-10-07
---

## What was wrong (2026-10-07 audit of the 19 live posts)
- 🔴 6 broken, live for weeks: why-your-ad-budget-doesnt-work-the-way-you-think, what-happens-in-the-first-30-days-of-a-new-ad-campaign,
  why-someone-clicked-your-ad-and-then-vanished, what-does-a-marketing-agency-actually-do-all-month,
  what-a-good-cost-per-lead-actually-looks-like, what-happens-to-your-ad-account-if-you-fire-your-agency. Each is 2 paragraphs + ~65
  `<h2></h2>`. Cause: `sections` came back malformed (a string iterates per character in `postToHTML`), and nothing validated.
- Old look (Playfair headings, text-only cards, no dates, old footer) next to the new site; ads only, nothing on websites.
- Author bio said "local service businesses" (banned phrase) and the newsletter box carried an em dash. Both fixed in the redesign.
- Only 2 healthy posts had wording issues: "a question we get from almost every new client" (pause-ads-on-weekends) and an
  "isn't X, it's Y" line (google-ads-vs-meta-ads).

## The writer (netlify/lib/blog-shared.mjs) - LIVE
- `BLOG_MODEL = "claude-opus-5-5"`, `output_config: {effort:"high", format: json_schema POST_SCHEMA}` (strict, additionalProperties
  false), max_tokens 16000, fallbacks "default" with a plain retry on 400 (same pattern as site-build-background).
- `postProblems(post)` (shape) -> one retry -> throw; `htmlProblems(html)` (empty headings, < 450 words, no headings) -> throw.
- `BLOG_LANES` + `laneFor(ms)` rotate weekly: ads decision / websites / a trade guide / landing pages + follow-up.
- `BLOG_FACTS` rewritten: ads + landing pages + websites, real prices ($400 minimum, $1,500 + $100/mo), Phoenix + across the U.S.,
  never "local businesses", no invented clients or "we hear this from every client".
- blog-autopublish: a due draft failing `htmlProblems` is rewritten (`regeneratePost`) or, if that fails, moved a week and Bryson is
  emailed once. `repairOneBrokenPost` fixes one broken PUBLISHED post per 15-minute run (`regeneratePost(id, {keepDate:true})`) and
  emails "Blog post repaired: <title>". The 6 broken posts heal themselves within ~90 minutes of deploy.
- Tests: tests/verify-blog-writer.mjs (fake client: good answer, malformed then good, malformed twice, cut off; the live broken
  HTML; repair picks only the broken one).

## The redesign (marketing-site) - TEST COPY, not live yet
- `scripts/build-marketing-site.mjs` generates `marketing-site/netlify/lib/site-chrome.mjs` (HEAD_ASSETS incl. /site.css, AMBIENT,
  FOOTER, STICKY, SCRIPTS, CAL, CAL_WEB) so the blog uses the exact same pieces as every page. site.css now = base + menu + new +
  `marketing-src/blog.css`. Blog pages no longer load blog.css (privacy/terms/404 still do) or their own header script (site.js does it).
- `marketing-site/netlify/lib/blog-cover.mjs` `coverSVG(post)`: drawn covers, kind from category/title: google (search result with
  the post's own words in the search box), meta (feed post), web (browser + phone), lead (alert + timer), money (chart), calendar,
  trade (job card), start (checklist titled from the post). Seeded from the slug so no two are identical.
- Index: centred hero, topic chips (client-side filter), Latest featured card, 3/2/1 column cards with cover, date (Phoenix), read time;
  24 per page. Article: crumb, chip, big title, excerpt as dek, author line, cover, contents sidebar (desktop, highlights as you read),
  readable body, author box, offer by topic (website posts: Book a website call + See the designs; else Free Lead-Leak Check + Book a
  Call), Keep reading (same topic first). Empty `<h2>`s are dropped at render time too.
- Local preview recipe: scratchpad `blog/serve.mjs` answers Supabase from the live posts (`posts.json` scraped from the site).

## 2026-10-07 later: Bryson said "go and yes to both"
- Redesign merged live.
- `netlify/lib/blog-seed.mjs`: `BLOG_EDITS` (exact find/replace on live posts, idempotent): the "a question we get from almost every
  new client" opener (pause-ads-on-weekends) and the "isn't 'which platform', it's 'which behavior'" heading (google-ads-vs-meta-ads).
  `BLOG_SEED`: four hand-written posts (what-a-1500-website-gets-you, how-we-built-a-pool-company-website,
  how-car-detailers-get-more-booked-jobs-from-google, how-we-trace-every-call-back-to-the-ad), inserted by `applyBlogContent` as
  SCHEDULED DRAFTS on the next open Monday 8am Phoenix slots (one per week, so the weekly writer skips those weeks), Bryson emailed
  once with the dates. Never re-inserted if the slug exists in any state (deleting one in the OS is final).
- To add more hand-written posts later: append to `BLOG_SEED` (HTML body, voice rules), deploy; the next autopublish run schedules it.
- 🔴 Gotcha: the redesign drops empty `<h2>`s at render, so a broken post no longer SHOWS empty headings; check broken posts by word
  count (< 450), not by counting `<h2></h2>`.

## 🔴 The 30-second limit (found 2026-10-07 afternoon): why the repairs crawled and the wording fixes never landed
- Netlify stops a SCHEDULED function at 30 seconds. One article on claude-opus-5-5 with high effort often takes longer, so
  blog-autopublish's repair step was cut off most runs (6 posts took 3+ hours and the last stuck), and every cut-off run
  also skipped the steps queued behind it, which is why the two `BLOG_EDITS` wording fixes had not applied hours later.
  The weekly writer lived in the same function with the same exposure.
- Fix: blog-autopublish now writes NOTHING. It runs the hand-written content step FIRST, publishes due drafts (a broken one is
  skipped and handed off), then starts jobs on `blog-write-background` (15-minute limit) via `startBlogJob()` in
  `netlify/lib/blog-jobs.mjs`: `job-repair` (one broken published post), `job-fix-draft` (rewrite a due broken draft in place;
  holds it a week + emails if that fails), `job-weekly` (write next Monday's post). Jobs start only on the first pass after
  each UTC hour (`getUTCMinutes() < 15`), capping a failing topic at 24 tries a day.
- Auth: header `x-blog-job-key` = sha256(service role key + ":blog-jobs"), compared with timingSafeEqual; it opens ONLY the
  three jobs. No new env var. Emails moved to `netlify/lib/blog-notify.mjs`.
- verify-blog-writer pins: publisher calls no writer function at all; all three jobs handed off; hourly cap; key refuses a wrong
  key and the owner-only actions; content step runs before publishing.
