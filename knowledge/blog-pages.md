---
name: blog-pages
topic: Marketing site
task: change how the blog listing pages work (how many posts per page, the Newer/Older pager, topic links, the phone layout of the list)
keywords: [blog pagination, blog pages, pager, pageWindow, pageNumbers, FIRST_PAGE_SIZE, PAGE_SIZE, bx-pages, bx-pg, topic links, ?topic=, blog-index.mjs, blog scroll, compact cards]
status: LIVE 2026-11-09 (Bryson said go)
summary: Bryson, 2026-11-09 - "every blog just makes me scroll ... only a handful of the top most recent blogs and then a way to see the next page". The listing was 24 posts on one page. Now page one is the newest post shown big plus six more (two rows of three) and every later page is nine; a pager (Newer, numbered pages, Older, 44px tap targets) sits under the posts. Topic chips became real links over the WHOLE blog (/blog/?topic=X), and paging keeps the topic. On a phone the older posts are compact rows (small cover beside title, no excerpt), so page one went from ~5,100px to ~3,300px including header, newsletter and footer.
verified: 2026-11-09
---

## How it works
- `marketing-site/netlify/lib/blog-render.mjs`: `FIRST_PAGE_SIZE = 7`, `PAGE_SIZE = 9`, `pageWindow(page, count)` gives the
  range and total pages, `pageNumbers(page, total)` gives the numbers to show (all when 7 or fewer; else first, last,
  current +-1, with gap markers).
- `marketing-site/netlify/functions/blog-index.mjs`: reads every published category (for the topic links), validates
  `?topic=` against that list (anything else is ignored, never echoed), counts first (so a page past the end is a 404),
  then fetches only that page's rows. Canonical and title include the page and topic.
- The old client-side topic filter script is gone: it only filtered the posts already on screen, which made no sense
  once the list is paged.
- Styles in `marketing-src/blog.css` (`.bx-pages`, `.bx-pg*`, `.bx-where`, phone rows under the 640px media query).
  Rebuild with `node scripts/build-marketing-site.mjs`.

## Guard
`tests/verify-blog-pages.mjs` (39 checks): the window maths (no post skipped or repeated for any count), the real
listing rendered against a fake database (7 / 9 / rest, 404 past the end, pager links, topic links, topic kept while
paging, a made-up topic ignored), and the phone row layout.

## Gotcha
Netlify's new-format functions see the ORIGINAL URL, so the page number is read from `/blog/page/<n>/` in the path
(see KB `blog-dynamic-rendering`).
