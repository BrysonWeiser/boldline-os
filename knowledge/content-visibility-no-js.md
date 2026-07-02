---
name: content-visibility-no-js
topic: Marketing site
task: keep marketing/blog content visible to crawlers and no-JS visitors instead of gating it on JS or scroll
keywords: [scroll-reveal, intersectionobserver, javaScriptEnabled, progressive-enhancement, js-tabs, prefers-reduced-motion]
status: dead-end
summary: DEAD-END — a JS IntersectionObserver scroll-reveal with .reveal{opacity:0} left the whole page blank to anything that doesn't scroll (crawlers, screenshots), which would sink the site's whole Google-review purpose. Never gate content visibility on JS/scroll — animate on load, don't hide. Verify with javaScriptEnabled:false.
verified: 2026-07-02
---

**The failed approach (do not retry):** the first v2 draft faded sections in on scroll via a JS `IntersectionObserver`, with `.reveal{opacity:0}` as the resting state. A full-page headless screenshot proved the bug — everything below the hero rendered **completely blank**, because the page was captured/composited without firing real scroll events. That is a direct risk for *this* site, whose whole purpose is to pass a Google reviewer's crawl of "content related to your application"; a non-scrolling crawler would see an empty page.

**Fix:** drop the JS/scroll dependency — `.reveal` now plays a pure-CSS `@keyframes` fade-up on load (`animation:fadeUp .8s ease both`) that resolves to fully visible with or without JS, with or without scrolling, and respects `prefers-reduced-motion`.

**Durable rules:**
- **Never gate content visibility on JS/scroll state — animate, don't hide.**
- Progressive-enhancement pattern used elsewhere to enforce this (the Services tabs): default CSS shows all panels (`display:block`); only after an early inline `<script>` adds `js-tabs` to `<html>` does CSS switch to hide/show. So with JS off, every panel's full content stays in the DOM and visible.
- **Verify with Playwright `javaScriptEnabled:false`** — confirm substantial visible text on every page with JS off. (Any later scroll-triggered UI, e.g. the process timeline, must still resolve to visible; use it for motion only.)
