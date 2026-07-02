---
name: nav-scroll-hide-reveal
topic: Marketing site
task: change or tune how the header/nav bar behaves while the page is scrolled (not nav-link clicks)
keywords: [nav-hidden, onScroll, lastY, header.scrolled, translateY, auto-hide nav, sticky header]
status: verified
summary: Header auto-hides (slides up) on scroll-down past 80px and reveals instantly on scroll-up or near top, instead of staying permanently fixed/visible.
verified: 2026-07-02
---
Bryson didn't want the pill nav permanently glued to the top of the viewport while
scrolling (felt "out of place"), but still wanted it reachable without hunting. Fix:
auto-hide-on-scroll-down / reveal-on-scroll-up, same pattern as most modern sites.

**Where it lives:** `marketing-site/index.html`.
- CSS: `header{...transform:translateY(0);transition:transform .35s cubic-bezier(.4,0,.2,1)}`
  and `header.nav-hidden{transform:translateY(-140%)}` near the top `<style>` block (by the
  existing `header`/`header.nav-in` rules, ~line 56).
- JS: the existing `onScroll` handler in the `header.scrolled` script (~line 1145–1157) now
  also tracks `lastY`, computes `delta = y - lastY`, and toggles `.nav-hidden`:
  - `y < 80` or mobile menu open → always show (removes `.nav-hidden`).
  - `delta > 4` (scrolling down) → add `.nav-hidden`.
  - `delta < -4` (scrolling up) → remove `.nav-hidden`.
  - Small jitter (±4px) is ignored so it doesn't flicker on trackpad noise.

**Gotchas:**
- This is a *different* script/concern from `nav-scroll-transition` (that one is the
  eased-glide + fade veil that runs when you *click* a nav link; this one is about the
  header's own visibility while the user free-scrolls). Don't conflate the two — they
  coexist in the same file but don't interact.
- Mobile menu (`.nav-mobile.open`) forces the header visible so opening the menu never
  gets hidden mid-interaction.
- Verified headless via Playwright (scroll down 1500px → hidden; scroll up 300px →
  reappears; scroll back to top → visible + `.scrolled` cleared). Playwright itself isn't
  in this repo's node_modules; it's only globally available at
  `/opt/node22/lib/node_modules/playwright` — run test scripts from that directory (`cd`
  there) so ESM resolution finds it, since `NODE_PATH` doesn't affect ESM resolution.
