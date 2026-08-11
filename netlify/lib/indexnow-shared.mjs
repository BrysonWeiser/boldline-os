// IndexNow -- tell search engines the instant a page goes live instead of
// waiting days for a crawl. One POST to api.indexnow.org fans out to every
// participating engine (Bing, Yandex, Naver, Seznam), so Monday's auto-published
// blog post is indexable within minutes. Google does NOT participate; it still
// discovers posts through the sitemap.
//
// The key is PUBLIC by design: the protocol proves ownership by requiring the
// same key to be readable at https://<host>/<key>.txt. That file lives in the
// MARKETING site's root (marketing-site/<key>.txt) while this pinger runs on the
// OS site -- two Netlify sites, one repo -- so the constant below and that
// filename must always be changed together. Because it's public it is
// deliberately hardcoded rather than an env var (no Netlify setup step, and
// nothing for the secret scanner to trip on).
//
// Fail-soft on purpose: publishing must never break because a search engine is
// down or slow. Every failure is logged and swallowed.

export const INDEXNOW_KEY = "fc29627c596d165a137c66cdaa931672";

const HOST = "boldlinemedia.com";
const SITE_URL = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_MS = 8000;

export const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

// Absolute URL for a site path ("/blog/foo/" -> "https://boldlinemedia.com/blog/foo/").
// Already-absolute URLs pass through so callers can mix the two.
const absolute = (p) => (/^https?:\/\//i.test(p) ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`);

// Submits one or more site paths/URLs. Returns { ok, status } -- callers can log
// it but should never branch on it for correctness.
export async function pingIndexNow(paths) {
  const urlList = [...new Set((Array.isArray(paths) ? paths : [paths]).filter(Boolean).map(absolute))];
  if (!urlList.length) return { ok: false, skipped: "no urls" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList }),
      signal: ctrl.signal,
    });
    // 200 = accepted, 202 = accepted but key still being validated. Both fine.
    if (!res.ok && res.status !== 202) console.error(`indexnow: ${res.status} for ${urlList.join(", ")}`);
    else console.log(`indexnow: submitted ${urlList.length} url(s) -- ${res.status}`);
    return { ok: res.ok || res.status === 202, status: res.status, urls: urlList };
  } catch (err) {
    console.error("indexnow ping failed:", err && err.message);
    return { ok: false, error: err && err.message };
  } finally {
    clearTimeout(timer);
  }
}

// A published post changes its own page AND the blog index (and paginated
// listings pull from the same feed), so submit both together.
export const pingPostPublished = (slug) => pingIndexNow([`/blog/${slug}/`, "/blog/"]);
