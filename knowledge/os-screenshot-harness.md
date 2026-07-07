---
name: os-screenshot-harness
topic: OS app
task: self-QA the OS/portal layout, screenshot the real app headless, check a UI change before shipping
keywords: [screenshot, render, headless, playwright, chromium, self-qa, harness, visual, layout, mobile, desktop, os-screenshot, tools]
status: verified
summary: A committed render harness (tools/os-screenshot.js) that boots the REAL index.html in headless Chromium with a stubbed Supabase and captures desktop + mobile PNGs, so I can eyeball layout/overflow/popup-position myself instead of asking Bryson for a screenshot for the obvious stuff. Known limit — no browser chrome, so vh/dvh mobile bugs won't reproduce.
verified: 2026-07-07
---

**What it is.** `tools/os-screenshot.js` renders the actual `index.html` OS app offline and saves screenshots. It lets me visually check my own UI changes (layout, overflow, spacing, popup/sheet position) before deploying, instead of relying on Bryson to screenshot every change. Born from Bryson asking "why are you not able to access the os? dont you have all the code and visuals" — now I can.

**How it works.**
- Auto-detects the pre-installed Chrome under `/opt/pw-browsers/chromium-*/chrome-linux/chrome` (`findChrome()`), so it survives the browser build number changing (the scratch version hard-coded 1194 and broke).
- Resolves `react`, `react-dom`, `@babel/standalone` from `node_modules` via `require.resolve` and copies them next to the page, then swaps the 4 CDN `<script>` tags in `index.html` for the local copies — no network needed at render time.
- **Stubs Supabase**: `createClient` returns a fake with `auth.getSession` → a logged-in session (passes AuthGate), `from()` → a chainable thenable that resolves sample `clients`/`leads` rows, `channel()`/`removeChannel()` no-ops. Sample data = 3 clients (Summit Roofing, Luxe Med Spa, Apex Auto Detailing) + 2 leads.
- Serves the built page over http and captures: `os-home-desktop` (1000×1500), `os-home-mobile` / `os-client-mobile` / `os-botsheet-mobile` (390×844, `isMobile`). The mobile flow clicks a client, then Pipeline → a bot, to verify the bot-detail sheet position.
- Prints any in-page `pageerror`s at the end (a Babel syntax slip blanks the app — this surfaces it).

**Run it** (deps are ephemeral; container resets wipe scratch `node_modules`, so install + run in ONE bash call):
```
DIR=$(mktemp -d); cd "$DIR"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright react@18 react-dom@18 @babel/standalone@7.23.5
NODE_PATH="$DIR/node_modules" PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node /home/user/boldline-os/tools/os-screenshot.js "$DIR/shots"
```
Then Read the PNGs in `$DIR/shots`.

**Known limit (don't forget).** Headless Chromium has **no address bar**, so mobile-browser-chrome bugs — specifically `vh` vs `dvh` sheet clipping (see `os-overlay-mobile-gotchas`) — will NOT reproduce here. Those still need a real phone screenshot from Bryson. Everything else (layout, overflow, popup/sheet anchoring, spacing, color) is checkable.

**Portal note.** This harness renders the OS (`index.html`). The live client portal is served by `netlify/functions/portal.js` (see `os-portal-dual-copy`); it isn't wired into the harness yet — if I need to eyeball the portal, render `makePortalHTML`'s output or add a portal route to the harness.
