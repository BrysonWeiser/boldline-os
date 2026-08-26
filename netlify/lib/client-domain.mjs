// Deciding whether an incoming request is for the OS itself or for a client's landing page.
//
// 🔴 WHY A CLIENT'S PAGE HAS TO LIVE ON THEIR OWN DOMAIN. Google makes the address shown on
// an ad match the address the ad sends people to. So a page served from boldlinemedia.com
// puts a marketing agency's name on a screen printer's ad, in the one spot a searcher looks
// to decide whether it is the right business. That costs clicks and it reads as wrong.
//
// The fix is a subdomain of the CLIENT's domain pointed at this site, so the ad displays
// their name while we keep the page, the lead capture and the tracking. One DNS record from
// whoever runs their site.
//
// THIS FILE IS DELIBERATELY TINY AND HAS NO IMPORTS, because the edge function that runs on
// EVERY REQUEST to the whole OS imports it. A mistake in here does not break a feature, it
// breaks the entire app for everyone. So the rules are pure string comparisons, they are
// tested, and the caller treats any failure as "this is ours, pass it through".

// Everything the OS itself answers on. Anything NOT in here is, by definition, a domain
// somebody pointed at us on purpose, which means a client landing page.
//
// Note the direction of the safety: an unknown host gets a landing-page lookup, and if no
// client claims it the lookup 404s. The bad case is a missing entry here serving a 404
// instead of the OS, which is loud, obvious and a one-line fix. The alternative design
// (allowlist the client domains) would need a database read on every OS page load.
const OWN_SUFFIXES = [
  ".netlify.app",      // the site itself plus every deploy preview and branch deploy
  ".netlify.live",     // Netlify's live-share previews
];
const OWN_EXACT = [
  "localhost",
  "127.0.0.1",
  "boldlinemedia.com",
  "www.boldlinemedia.com",
];

// Strip the port and lowercase. A Host header is "example.com:8888" in local dev and the
// casing is whatever the client sent.
export const normalizeHost = (host) => {
  const h = String(host || "").trim().toLowerCase().split(",")[0].trim().replace(/:\d+$/, "");
  // Anything that is not a plausible hostname is discarded rather than passed on. The
  // domain lookup uses a case-insensitive match, where `%` and `_` are wildcards, so a
  // crafted Host header could otherwise match somebody else's client record.
  return /^[a-z0-9.-]+$/.test(h) && h.includes(".") ? h : "";
};

// `extra` lets a new OS hostname be added through an env var without a deploy, so a
// mistake here is recoverable in a minute rather than needing a code change.
export function isOwnHost(host, extra = "") {
  const h = normalizeHost(host);
  // No host, or one that does not look like a hostname at all. Treat it as ours and pass
  // it through: refusing to serve the OS is a far worse failure than serving it once to
  // something odd.
  if (!h) return true;
  // `localhost` has no dot, so it never survives normalizeHost. Checked on the raw value.
  if (/^(localhost|127\.0\.0\.1)$/i.test(String(host || "").trim().replace(/:\d+$/, ""))) return true;
  if (OWN_EXACT.includes(h)) return true;
  if (OWN_SUFFIXES.some((s) => h.endsWith(s))) return true;
  const list = String(extra || "").split(/[,\s]+/).map((x) => normalizeHost(x)).filter(Boolean);
  return list.includes(h);
}

// Paths the edge function must never touch, whatever the host. Netlify's own routes and
// the functions themselves have to keep working on a client domain: the landing page posts
// its form to a relative /.netlify/functions/ path, so rewriting those would break the very
// lead capture this exists to preserve.
export const isReservedPath = (pathname) => {
  const p = String(pathname || "/");
  return p.startsWith("/.netlify/") || p.startsWith("/.well-known/");
};

// The one decision, in one place, so the edge function and the tests cannot disagree.
export function routeFor(host, pathname, extra = "") {
  if (isReservedPath(pathname)) return { kind: "pass" };
  if (isOwnHost(host, extra)) return { kind: "pass" };
  return { kind: "landing", host: normalizeHost(host) };
}
