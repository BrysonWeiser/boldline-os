---
name: white-screen
topic: OS/App
task: diagnose the OS loading to a blank page, or add a new failure that must not be silent
keywords: [white screen, blank page, os won't load, app not loading, unpkg, CDN, React missing, Babel missing, service worker cache, CrashScreen, error boundary, window.onerror, silent failure, PWA stuck, clear and reload, CACHE_VERSION v71, offline libraries]
status: built
summary: The OS loaded to a silent white screen on Bryson's phone. The app was fine. React, Babel and Supabase come from unpkg and the service worker cached the shell but not them, so one dropped bar of signal meant the babel block was never compiled, nothing ran, nothing threw, and no error handler could fire. Now the libraries are cached, a missing one says so in plain English, and a React crash shows a readable message with a copy button. 13 checks, reproduced in a real browser both before and after.
verified: 2026-09-04
---

## What happened

Bryson, 2026-09-04: *"the os won't load it just keeps going to a white screen"*, from his
phone. **An hour went into hunting a bug in the app. The app was fine.**

## 🔴 The failure had NO REPORTER, which is why it cost an hour

Three safety nets existed and not one could fire:

| Net | Why it stayed silent |
|---|---|
| `window.onerror` | Nothing threw. There was no error to catch. |
| A React error boundary | There wasn't one, and it could not have helped: React was the missing piece. |
| The service worker | It cached the shell and waved **every** cross-origin request straight through. |

React, ReactDOM, Babel and the Supabase client all load from **unpkg**. Lose any one of them
and the babel-compiled block is never transformed, because **Babel is the thing that
transforms it**. Nothing runs, nothing throws, the page is blank forever, and the person
looking at it has no way to tell anybody anything.

🔴 **THE TRANSFERABLE LESSON: an error handler only catches errors.** The worst failures do
not raise one, they just fail to happen, and nothing that waits to be told will ever notice.

## What was ruled out first, and how

Worth keeping, because the same checks answer "is it my last deploy" in two minutes:

- **Does the app compile and mount?** Yes. Run it headlessly with LOCAL React/Babel/Supabase.
  🔴 The sandbox cannot reach any CDN, so a blank page in a naive harness proves **nothing** —
  that mistake was made once here and corrected. `scratchpad/boot-offline.mjs`.
- **Does it render with real data?** Yes, signed in, on the exact screen he was on.
  `scratchpad/signedin.mjs` stubs Supabase with a realistic client.
- **Did the deploy land?** `curl` the live site and grep for a string from the newest change.
  It was there, all of it, 1.23 MB.
- **Did the page balloon?** No. It grew 7 KB across the whole day.
- **Is there a saved screen it keeps reopening?** No `localStorage` at all.

## The three fixes

1. **The service worker now caches unpkg, cache-first** (`CACHE_VERSION` bumped to **v71**, or
   installed apps keep the old worker and none of it activates). Those URLs are pinned
   versions that never change, so there is nothing to go stale, and it takes them off the
   critical path on every launch. Everything else stays network-first so a deploy is never
   stale. An error response is never cached: a cached 404 for a library would break the app
   permanently, offline or not.
2. **A plain-DOM check that the libraries actually arrived**, and if not, a message: *"The OS
   could not finish loading... almost always the connection rather than the OS. Nothing is
   lost."* plus a Try again button and the list of what did not arrive. 🔴 It uses **no
   library and sits outside the babel block**, because everything it might depend on is
   exactly what has gone missing. It never paints over a `#root` that already has content.
3. **A React error boundary (`CrashScreen`)** so a render crash shows the reason instead of a
   blank page, with **Reload**, **Clear and reload** (unregisters the service worker and wipes
   the caches, the only thing that frees a phone holding a half-loaded app) and **Copy
   details**. The detail is shown on screen, not just logged: a console he does not have is
   the same as no message at all.

## Gotchas hit while building it

- 🔴 **A comment containing the literal babel script tag broke two other suites.** They find
  the app's code with that pattern and suddenly matched twice. Reworded the comment rather
  than loosening the check, and the new suite asserts the detector's position **by index, not
  by spelling**, so it cannot repeat the trick.
- 🔴 **`verify-portal-preview` evaluates the OS in Node with a hand-written React stub**, and
  `class CrashScreen extends React.Component` throws at **definition** time when `Component`
  is undefined, taking the whole file down before one check ran. The stub gained a `Component`
  class.

## Testing note

`tests/verify-white-screen.mjs`, 13 checks. Reproduced in a real browser with
`scratchpad/whitescreen.mjs`, which aborts every unpkg request: blank before, explained after.
`scratchpad/crashtest.mjs` makes the root component throw and confirms the boundary catches it.
