---
name: verification-harness
topic: Tooling
task: verify a code change in this sandbox (no live Supabase/Netlify/Anthropic) before shipping
keywords: [node-check, transformSync, javaScriptEnabled, playwright, chromium, xss-payload]
status: verified
summary: Sandbox has no live Supabase/Netlify CLI/ANTHROPIC_API_KEY. Verify with node --check on every file; a real Babel transformSync() of the extracted JSX (index.html has no build step); import/export cross-checks; and headless Chromium/Playwright against a LOCAL HTTP server (not file://) with full-page desktop+mobile shots + a javaScriptEnabled:false pass.
verified: 2026-07-02
---

**Sandbox limits:** no live Supabase project, no Netlify CLI, no `ANTHROPIC_API_KEY` — so real AI calls, real Supabase round-trips, and live Netlify Forms capture **cannot** be exercised here; those must be tested on the live deploy.

**What IS verifiable here:**
- `node --check` on every new/changed `.mjs` / `.js` file.
- **JSX check:** the OS `index.html` has **no build step**, so a JSX syntax error can only be caught by a real Babel `transformSync()` of the extracted JSX. Do this on any React change in `index.html` (the app was ~3,610 lines at last check).
- Cross-file imports checked against the real exports they point at.
- Pure render helpers (e.g. `blog-render.mjs`) smoke-tested against mock data, including a deliberate **XSS-style payload** in a title/excerpt to confirm HTML-escaping holds.
- **Front end:** headless **Chromium / Playwright** against a **local static HTTP server** — NOT `file://`, because these pages use absolute `/`-rooted paths that only resolve under a real HTTP root. Take full-page screenshots at desktop + mobile (e.g. 2x device-scale, per-section crops for legibility), run a **`javaScriptEnabled:false`** regression pass (confirm substantial content still visible with JS off — see `content-visibility-no-js`), and check horizontal overflow at phone widths (320/360/390/414/430).

Occasional console noise from a Google-Fonts fetch timing out through the sandbox proxy is not a code issue (fonts render on the real site).
