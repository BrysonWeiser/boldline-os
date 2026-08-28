---
name: os-load-speed
topic: OS app
task: make the OS load faster, or work out why it takes seconds before anything appears
keywords: [data-presets, babel standalone, env preset, in-browser compile, time to first render, slow load, precompile at build, unpkg, 1MB index.html, load performance]
status: verified
summary: APPROVED AND SCHEDULED for 2026-09-02 (see 'Fix 2'). The OS compiles its own ~1.1 MB of JSX in the browser on EVERY page load. The `env` preset was doing that AND rewriting all modern JavaScript down to 2015 syntax, for browsers nobody uses. Removing one word took time-to-first-render from 10.5 s to 3.5 s in a real browser. The remaining 3.5 s is Babel running at all; killing that needs a build step, which also drops a 2.8 MB download. Not yet done.
verified: 2026-08-27
---

Bryson, 2026-08-27: *"Is there a way we can optimize the os so it loads faster? Right now
it takes a couple seconds to load."*

## What actually happens on every page load

| | |
|---|---|
| `index.html` | **1,093 KB**, of which **1,078 KB is JSX the browser must compile** |
| Downloaded before anything renders | **~3.1 MB**, and **2.77 MB of that is `babel.min.js`** — a compiler shipped to the browser |
| Then | Babel compiles the whole app, **every load**, on the viewer's CPU |

## ✅ Fix 1, done: drop the `env` preset (one word, ~3x)

`data-presets="env,react"` → `data-presets="react"`.

`env` transpiles every modern JavaScript feature down to what a 2015 browser understood.
Nothing needs that. Measured in a **real headless browser rendering the actual sign-in
screen**, not a Node benchmark:

| presets | time to first render | page errors |
|---|---|---|
| `env,react` | **10.5 s** | none |
| `react` | **3.5 s** | none |

(That container's CPU is slower than Bryson's laptop, so his absolute numbers are lower.
The ratio is the finding.) Cost: the OS now needs a browser from roughly 2020 or later.

**Pinned** in `verify-app-boots.mjs` — the guard fails if `env` reappears, because it is one
word and it is worth two thirds of the load.

## ⏳ Fix 2, NOT done: compile once at deploy instead of in every browser

Netlify already has `[build] publish = "."`. Adding a build command that runs Babel over
`index.html` and publishes plain JS would remove **both** remaining costs: the whole 3.5 s
compile AND the 2.77 MB Babel download. Expected result is a near-instant load.

**The trade Bryson has to accept:** the file he edits stops being the file that ships, and a
broken build means a dead OS rather than a broken page. Rollback branches cover it, but it
is his pipeline and his call.

**✅ APPROVED 2026-08-27** — *"Let's do that just remind me down the road."* Deliberately
deferred because his first client's contract was out for signature that day and a dead OS
would have been the worst possible timing.

**Scheduled: Tue 2 Sep 2026, 09:00 Phoenix** (trigger `trig_0135ndbkkZxf9r736RXcaXrb`, fires
a fresh session with the full brief). **The reminder is a backstop, not the record — if a
session picks this up sooner, do it and delete the trigger.**

Build it defensively: it must **fail loudly rather than publish a half-transformed page**.
Keep the `@babel/standalone` pin at `7.23.5`; the build has to use the version that was
verified in a browser. Tests that read `index.html` read the SOURCE, which does not change,
so do not "fix" them when the published artifact differs.

Secondary, only worth doing alongside fix 2: self-host react / react-dom / supabase
(345 KB total) instead of unpkg, to drop a third-party DNS and TLS round trip.

## 🔴 Two harness lessons from doing this

1. **`@babel/standalone` was never in `package.json`.** Two suites imported it and it
   happened to be present as a transitive dependency. Installing anything could remove it,
   and did. It is now an explicit devDependency, **pinned to `7.23.5`, the exact version the
   browser loads** — a test that runs on a different version of the tool than production is
   the useMemo harness mistake one dependency further out.
2. `verify-functions-resolve` reached into `Babel.packages`, which exists in Babel 8 but not
   in 7.23.5. It now imports the real `@babel/parser` and `@babel/traverse`.

**How to measure this again:** serve `index.html` over local HTTP with the four unpkg
scripts swapped for `node_modules` copies (this container cannot reach unpkg), load it in
Playwright's Chromium at `/opt/pw-browsers/chromium`, abort `**://*.supabase.co/**`, and
poll until `#root` has real content. The sign-in screen renders without a backend, which is
enough to prove Babel and React both ran.
