/* BoldLine OS service worker — NETWORK-FIRST app shell.
 *
 * Rationale (see knowledge/pwa-build.md): the OS is a single index.html of live
 * React code. We must always run the freshest deploy when online, so this SW never
 * serves cached code ahead of the network — it fetches fresh every time and only
 * falls back to the last cached shell when the device is offline. That avoids the
 * classic PWA "stale-cache after deploy" footgun.
 *
 * Bump CACHE_VERSION on any breaking change to force a clean cache rollover.
 */
const CACHE_VERSION = "v1";
const CACHE = "boldline-os-" + CACHE_VERSION;
const SHELL = "/index.html";

// Precache the shell so a cold, offline launch still boots.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
});

// Drop any older-version caches, then take control of open pages immediately.
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // never touch POST/PUT (auth, form posts, functions)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // let cross-origin pass (Supabase, unpkg CDNs)
  if (url.pathname.startsWith("/.netlify/")) return;      // never cache serverless functions
  if (url.pathname === "/portal" || url.pathname === "/lead" || url.pathname.startsWith("/lp/")) return; // dynamic function routes

  // Page navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || caches.match(req)))
    );
    return;
  }

  // Same-origin static assets (icons, manifest, etc.): network-first, refresh cache on success.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
