// Instagram handles, read and cleaned in ONE place.
//
// Bryson, 2026-09-28: *"make a section in the os that'll search instagram for those kinds of niches and
// give me a dm to copy and paste"*. Instagram offers no search a tool may use and blocks scrapers, so the
// handle comes from where businesses publish it themselves: the Instagram link on their own website
// (read during the free homepage scan), or typed in by Bryson. Sending stays manual on purpose: the only
// API that sends DMs cannot start a conversation, and automated DMs get accounts banned.

// Paths on instagram.com that are pages, not accounts. A link to a post or a reel is NOT their profile.
const RESERVED = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about",
  "developer", "legal", "web", "share", "sharer", "tags", "locations", "embed", "instagram", "privacy",
  "terms", "help", "press", "api", "static", "challenge", "oauth", "login", "signup", "emails", "session"]);

const VALID = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

// Anything a person might paste or a page might contain, down to a bare lower-case handle, or "".
export const normInstagram = (v) => {
  let s = String(v == null ? "" : v).trim();
  if (!s) return "";
  const m = /instagram\.com\/([^/?#\s"'<>]+)/i.exec(s);
  if (m) s = m[1];
  s = s.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  if (!VALID.test(s) || RESERVED.has(s)) return "";
  return s;
};

// The first profile link on a page, skipping links to posts, reels and Instagram's own pages.
export const extractInstagram = (html) => {
  const re = /instagram\.com\/(?:#!\/)?([A-Za-z0-9._]{1,30})(?=[/?#"'\s<>]|$)/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    const h = normInstagram(m[1]);
    if (h) return h;
  }
  return "";
};

export const instagramUrl = (handle) => {
  const h = normInstagram(handle);
  return h ? `https://www.instagram.com/${h}/` : "";
};
