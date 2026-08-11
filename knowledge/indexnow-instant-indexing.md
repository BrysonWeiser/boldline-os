---
name: indexnow-instant-indexing
topic: Marketing/SEO
task: understand, debug, or change how new blog posts get pushed to search engines instantly (IndexNow)
keywords: [indexnow, instant-indexing, bing, key-file, blog-publish, crawl, api.indexnow.org, pingIndexNow, webmaster-tools]
status: verified
summary: Built 2026-08-11. Every blog publish POSTs the new URL to api.indexnow.org, so Bing/Yandex/Naver/Seznam index it within minutes instead of waiting on a crawl. netlify/lib/indexnow-shared.mjs owns the protocol; all three publish paths call it. Key is PUBLIC and hardcoded (no env var) with the proof file at marketing-site/<key>.txt. Verified live — a real POST returned HTTP 202. Google does NOT participate (sitemap still covers it).
verified: 2026-08-11
---

## What it does
IndexNow is a ping protocol: one POST tells every participating search engine that a URL
is new or changed, and they fetch it within minutes instead of waiting for their next
crawl. **Participants: Bing, Yandex, Naver, Seznam. Google does NOT participate** — Google
still discovers posts through `sitemap.xml` on its own schedule, so this speeds up the Bing
side only. Worth it because Bing's index feeds DuckDuckGo, Yahoo, Microsoft Copilot and
ChatGPT web search (see `backlinks-citations`).

## Where the code lives
`netlify/lib/indexnow-shared.mjs` exports:
- `INDEXNOW_KEY` / `KEY_LOCATION`
- `pingIndexNow(paths)` — accepts relative paths or absolute URLs (mixed is fine), dedupes,
  makes them absolute, POSTs `{host, key, keyLocation, urlList}` to
  `https://api.indexnow.org/indexnow`
- `pingPostPublished(slug)` — submits `/blog/<slug>/` **and** `/blog/` (the index listing
  changes too)

**All three code paths that can flip a post to `published` call it:**

| File | Trigger |
|---|---|
| `netlify/functions/blog-autopublish.mjs` | the Monday 08:00 AZ scheduled publish |
| `netlify/functions/blog-admin.mjs` (`publish-now`) | owner clicks "Publish now" on a draft |
| `netlify/lib/blog-shared.mjs` (`createAndPublishPost`) | "Write + Publish Now" |

If a fourth publish path is ever added, wire `pingPostPublished` into it too.

## THE KEY — read this before changing anything
The IndexNow key is **public by protocol design**: ownership is proven by serving the same
key as plain text at `https://boldlinemedia.com/<key>.txt`. So it is deliberately
**hardcoded** in `indexnow-shared.mjs` rather than an env var — no Netlify setup step for
Bryson, and nothing for Netlify's secret scanner to trip on (which it would if the value
were an env var that also appeared in a committed file).

**Current key:** `fc29627c596d165a137c66cdaa931672`
**Proof file:** `marketing-site/fc29627c596d165a137c66cdaa931672.txt` (contents = the key,
no trailing newline needed)

⚠️ **CROSS-SITE GOTCHA:** the proof file lives in the **MARKETING** site's root while the
pinger runs on the **OS** site — two Netlify sites, one repo. The constant in
`indexnow-shared.mjs` and that `.txt` filename must ALWAYS be changed together, or every
ping starts failing key validation. The marketing site publishes from its own root with no
catch-all redirect, so a plain file at the root serves directly (same as `BingSiteAuth.xml`).

## Fail-soft contract
8-second `AbortController` timeout; every error is logged and swallowed; `pingIndexNow`
returns `{ok, status}` but callers must never branch on it. A slow or down search engine
can never break publishing.

## Verified
- Unit-tested with a mocked `fetch`: correct payload shape, dedupe, relative/absolute
  mixing, empty-input guard, and a throwing fetch returns instead of propagating.
- Live end-to-end POST to `api.indexnow.org` returned **HTTP 202** (= accepted, key
  validating). 200 and 202 are both success; the code treats them as such.

## Related setup done the same day
Bing Webmaster Tools was set up for boldlinemedia.com (see `backlinks-citations`).
**GOTCHA:** Bing's "Import from Google Search Console" found nothing because the GSC
property is a **DOMAIN property** (DNS-verified) and Bing's importer only reads URL-prefix
properties — this is NOT an account problem. Verified manually instead via
`marketing-site/BingSiteAuth.xml` (token `D413496F0923036675E7804199C0ACA6`). Bing then
auto-discovered both sitemaps (apex + www) and crawled 12 URLs; no manual sitemap
submission was needed.
