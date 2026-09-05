// Look at the prospect's page the way a visitor does, not the way a server does.
//
// Bryson, 2026-09-04, after the audit told a roofing company they had no contact form when one
// sat at the bottom of their homepage: *"Is there a way we can also have the ai visually look
// at the site too not just the code that way we hit every possible angle"*.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 READING THE HTML IS NOT SEEING THE PAGE, AND THAT GAP CAUSED A REAL MISTAKE.
//
// Our own inspection fetches the first HTML response. Wix, Squarespace, GoDaddy, Webflow and
// every React site assemble most of what a person actually sees AFTERWARDS, in the browser.
// So the check was reading a skeleton and describing it as the house.
//
// Google PageSpeed Insights loads the page in a REAL Chrome, waits for it to finish, and
// hands back a screenshot of the rendered result plus Lighthouse's own measurements. That
// fixes both halves at once: the model can look at the page, and the report can finally say
// "it takes 4.2 seconds to load on a phone" instead of our guess that it "seems heavy".
//
// 🔴 FREE, BUT NOT FREE WITHOUT A KEY. Keyless requests are rate limited hard and return 429
// almost immediately from a shared address, which is exactly what a Netlify function is. With
// a free key it is 25,000 a day. So `PAGESPEED_API_KEY` is what turns this on, and everything
// below is written to degrade to today's behaviour when it is missing rather than to fail.
//
// 🔴 AND IT SAYS WHETHER IT ACTUALLY RAN. A visual check that quietly does nothing is worse
// than not having one, because the report would go out sounding just as confident. Every
// return carries a `note` in plain words, and the caller records it on the lead.

const PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

// Anthropic resizes anything larger, but a very tall full-page shot of a long site is mostly
// wasted tokens and can exceed the hard limit outright. Past this we fall back to the
// above-the-fold frame, which is the part that decides whether a visitor stays anyway.
export const MAX_SHOT_PX = 8000;
export const MAX_SHOT_BYTES = 4_500_000;      // base64 length, under Anthropic's 5MB ceiling

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Pull the base64 payload out of a data URI, and say what kind of image it is. Lighthouse has
// shipped both JPEG and WebP over the years, so the type is read rather than assumed.
export function parseDataUri(uri) {
  const s = String(uri || "");
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(s);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  return { mediaType, data: m[2] };
}

// Which screenshot to send, and why. The whole page is better when it is a sane size, because
// the thing that started this was a form BELOW THE FOLD. The first frame is the fallback.
export function pickScreenshot(lighthouse) {
  const lr = lighthouse || {};
  const full = lr.fullPageScreenshot && lr.fullPageScreenshot.screenshot;
  if (full && full.data) {
    const parsed = parseDataUri(full.data);
    const tooTall = num(full.height) != null && full.height > MAX_SHOT_PX;
    const tooBig = parsed && parsed.data.length > MAX_SHOT_BYTES;
    if (parsed && !tooTall && !tooBig) {
      return { ...parsed, kind: "full page", width: num(full.width), height: num(full.height) };
    }
  }
  const first = lr.audits && lr.audits["final-screenshot"] && lr.audits["final-screenshot"].details;
  const parsedFirst = first && parseDataUri(first.data);
  if (parsedFirst) return { ...parsedFirst, kind: "first screenful", width: null, height: null };
  return null;
}

// The measurements worth putting in front of a business owner. Lighthouse reports dozens;
// these are the ones that mean something to somebody who is not a developer.
export function readMetrics(lighthouse) {
  const lr = lighthouse || {};
  const a = lr.audits || {};
  const cat = lr.categories || {};
  const pct = (c) => (c && num(c.score) != null ? Math.round(c.score * 100) : null);
  const shown = (k) => (a[k] && a[k].displayValue ? String(a[k].displayValue) : null);
  return {
    performance: pct(cat.performance),
    seo: pct(cat.seo),
    accessibility: pct(cat.accessibility),
    firstPaint: shown("first-contentful-paint"),
    largestPaint: shown("largest-contentful-paint"),
    layoutShift: shown("cumulative-layout-shift"),
    interactive: shown("interactive"),
    blockingTime: shown("total-blocking-time"),
    pageWeight: shown("total-byte-weight"),
  };
}

// One rendered look at a page. Never throws: a failure here must leave the report exactly as
// good as it was before this existed, never worse.
export async function lookAtSite(rawUrl, { fetchImpl = fetch, timeoutMs = 60000, key = process.env.PAGESPEED_API_KEY } = {}) {
  const url = String(rawUrl || "").trim();
  if (!url) return { ok: false, note: "no website address to look at" };
  if (!key) {
    // 🔴 Said out loud rather than silently skipped. Without this the report would go out
    // sounding just as sure of itself, and nobody would know the visual half never ran.
    return { ok: false, skipped: true, note: "no PageSpeed key set, so nobody looked at the page" };
  }
  const q = new URLSearchParams({ url, strategy: "mobile", key });
  // Mobile first and mobile only: it is where the traffic is, and a page that works on a
  // phone almost always works on a desktop. A second run would double the time for little.
  for (const c of ["performance", "seo", "accessibility"]) q.append("category", c);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${PSI}?${q}`, { signal: ctrl.signal });
    if (!res.ok) {
      const why = res.status === 429 ? "Google is rate limiting the look-up" : `Google answered ${res.status}`;
      return { ok: false, note: `could not load the page in a browser: ${why}` };
    }
    const data = await res.json();
    const lr = data && data.lighthouseResult;
    if (!lr) return { ok: false, note: "the page loaded but no report came back" };
    const shot = pickScreenshot(lr);
    const metrics = readMetrics(lr);
    return {
      ok: true,
      screenshot: shot,
      metrics,
      finalUrl: (lr.finalDisplayedUrl || lr.requestedUrl || url),
      note: shot
        ? `looked at the ${shot.kind} as a phone renders it`
        : "measured the page in a browser, but no screenshot came back",
    };
  } catch (e) {
    const msg = String((e && e.name) === "AbortError" ? "it took too long to load" : (e && e.message) || e);
    return { ok: false, note: `could not load the page in a browser: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

// The measurements as sentences, for handing to the writer alongside the picture. Only what
// actually came back: a missing number must never become a claim.
export function metricLines(vision) {
  const v = vision || {};
  if (!v.ok) return [];
  const m = v.metrics || {};
  const out = [];
  if (m.performance != null) out.push(`Google's own speed score for this page on a phone: ${m.performance} out of 100.`);
  if (m.largestPaint) out.push(`Time until the main content appears on a phone: ${m.largestPaint}.`);
  if (m.firstPaint) out.push(`Time until anything appears at all: ${m.firstPaint}.`);
  if (m.blockingTime) out.push(`Time the page is frozen and unresponsive while loading: ${m.blockingTime}.`);
  if (m.layoutShift) out.push(`How much the page jumps around while loading (lower is better, 0.1 is the target): ${m.layoutShift}.`);
  if (m.pageWeight) out.push(`Total page weight: ${m.pageWeight}.`);
  if (m.seo != null) out.push(`Google's basic SEO checks: ${m.seo} out of 100.`);
  if (m.accessibility != null) out.push(`Accessibility score: ${m.accessibility} out of 100.`);
  return out;
}
