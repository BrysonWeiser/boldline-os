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
// v5 (2026-08-17): bumped after Bryson still saw the old "Priority Support + Slack
// Access" label on an app that had already deployed the rename. The SW is network-first,
// so a cached shell should never win while online, but an already-running installed PWA
// keeps the code it booted with. Bumping wipes every prior cache on activate, which
// guarantees the next launch boots the current deploy rather than the one in memory.
const CACHE_VERSION = "v33";  // v33: 2026-08-24 a national business is never shown as local
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

/* ── Web Push (PWA Phase 2): show OS alerts as phone/desktop notifications. ──
 * The server (push-shared.mjs) sends a JSON payload {title, body, severity, url};
 * we always show a notification (required under userVisibleOnly), and a click
 * focuses the open OS window or opens it. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: "BoldLine OS", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "BoldLine OS";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icon-192.png",       // large full-color icon shown in the expanded notification
    badge: "/badge-96.png",      // monochrome status-bar silhouette (Android uses alpha only)
    requireInteraction: true,    // stay on screen until tapped — don't let an alert slip by
    silent: false,
    vibrate: [120, 60, 120, 60, 120],
    // no shared tag: each alert shows as its own notification instead of collapsing
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if ("focus" in c) {
        await c.focus();
        if (target && target !== "/" && "navigate" in c) c.navigate(target).catch(() => {});
        return;
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
