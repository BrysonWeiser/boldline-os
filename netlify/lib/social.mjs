// A business's social media or online listing, read and cleaned in ONE place (Website demos, Outreach add-by-hand).
//
// Bryson, 2026-11-05: "I need a way to build it for businesses without a website in general whether they are on
// instagram or another social media platform or they don't even have social media and they are just starting out".
// Takes a pasted link from any platform, or a bare @handle plus the platform it is on. Never fetched: it is stored so he
// can reach them, and named so the OS can say where they are.
import { normInstagram } from "./instagram.mjs";

// Host (or the end of it) to the name people use. A link elsewhere is still accepted, named by its domain.
const HOSTS = [
  [/(^|\.)instagram\.com$/, "Instagram"], [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"], [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(x\.com|twitter\.com)$/, "X"], [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"], [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)nextdoor\.com$/, "Nextdoor"], [/(^|\.)yelp\.com$/, "Yelp"], [/(^|\.)threads\.(net|com)$/, "Threads"],
  [/(^|\.)pinterest\.com$/, "Pinterest"], [/(^|\.)snapchat\.com$/, "Snapchat"], [/(^|\.)thumbtack\.com$/, "Thumbtack"],
  [/(^|\.)angi\.com$/, "Angi"], [/(^|\.)houzz\.com$/, "Houzz"], [/(^|\.)linktr\.ee$/, "Linktree"],
  [/^(maps\.app\.goo\.gl|g\.page|business\.google\.com)$/, "Google"],
];
// The platforms a bare @handle can be on, and how a handle becomes a link there.
export const HANDLE_PLATFORMS = {
  Instagram: (h) => `https://www.instagram.com/${h}/`,
  TikTok: (h) => `https://www.tiktok.com/@${h}`,
  Facebook: (h) => `https://www.facebook.com/${h}`,
  X: (h) => `https://x.com/${h}`,
};
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\.|^m\./, ""); } catch { return ""; } };
// A website box holding one of these is a social link, not a website (and a domain like facebook.com must never be used
// to tell two companies apart).
export const isSocialHost = (host) => {
  const h = String(host || "").toLowerCase().replace(/^www\.|^m\./, "");
  return HOSTS.some(([re]) => re.test(h)) || /^google\.[a-z.]+$/.test(h);
};
export const platformOfHost = (host) => {
  const h = String(host || "").toLowerCase().replace(/^www\.|^m\./, "");
  const hit = HOSTS.find(([re]) => re.test(h));
  return hit ? hit[1] : /^google\.[a-z.]+$/.test(h) ? "Google" : h;
};

// { platform, url, handle } or null. `hint` names the platform for a bare handle (default Instagram).
export const normSocial = (v, hint = "Instagram") => {
  let s = String(v == null ? "" : v).trim();
  if (!s) return null;
  // A bare "tint.ninja.az" is an Instagram handle (dots are common there), not a domain. Without https:// it is read as a
  // link only when it has a path ("facebook.com/tintninja") or is a known platform on its own ("linktr.ee").
  const looksLink = /^https?:\/\//i.test(s) || (!/^@/.test(s) && (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(s) || isSocialHost(s)));
  if (looksLink) {
    const url = (/^https?:\/\//i.test(s) ? s : `https://${s}`).replace(/^http:/i, "https:");
    const host = hostOf(url);
    if (!host || !/\./.test(host) || url.length > 300 || /[\s<>"']/.test(url)) return null;
    const platform = platformOfHost(host);
    const handle = platform === "Instagram" ? normInstagram(url) : "";
    if (platform === "Instagram" && !handle) return null;   // a link to a post, not their profile
    return { platform, url: platform === "Instagram" ? HANDLE_PLATFORMS.Instagram(handle) : url, handle };
  }
  const h = s.replace(/^@+/, "").toLowerCase();
  const plat = HANDLE_PLATFORMS[hint] ? hint : "Instagram";
  if (!/^[a-z0-9._-]{1,50}$/.test(h)) return null;
  if (plat === "Instagram") { const ig = normInstagram(h); return ig ? { platform: plat, url: HANDLE_PLATFORMS.Instagram(ig), handle: ig } : null; }
  return { platform: plat, url: HANDLE_PLATFORMS[plat](h), handle: h };
};
