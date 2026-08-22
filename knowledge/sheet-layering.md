---
name: sheet-layering
topic: OS UI
task: fix a panel, sheet or modal in the OS whose bottom is hidden, cut off or covered by the bottom nav, or add a new full-screen overlay
keywords: [bot chat, message box missing, chat bar hidden, bottom nav covering, z-index not working, stacking context, os-content, osIn animation, fill-mode both, createPortal, Sheet component, safe-area-inset-bottom, os-chatbar, os-sheet-actions, home indicator, white screen, template literal backtick]
status: verified
summary: A panel's z-index stopped meaning anything because the screen wrapper `.os-content` animates opacity with `fill-mode: both`, which makes it a PERMANENT stacking context, so the fixed bottom nav (z-index 50) painted over overlays asking for 80, 200 and 400. Fixed twice over, `backwards` instead of `both` plus portalling every Sheet to <body>, both measured in a headless browser. Also records that a backtick inside the CSS template literal blanks the entire app.
verified: 2026-08-22
---

## What he saw

Bryson, 2026-08-22: *"when I try to chat with the bots I can't see the message box"*. His
screenshot showed the bot sheet open on the Chat tab, the empty-state prompt, a large blank
area, and then the bottom nav. No input, no send button.

**The box was always rendered.** The nav was painting on top of it. The giveaway in the
screenshot is that the page behind the sheet was dimmed by the overlay while **the nav was
not** — so the nav was above the overlay, not below it.

## 🔴 The cause: a z-index that could not compete

`BottomNav` is `position:fixed; bottom:0; z-index:50`. `Sheet` is `z-index:80`. On paper the
sheet wins. It did not, because:

```
.os-content { animation: osIn .35s ease both }   /* the screen wrapper */
@keyframes osIn { from { opacity: 0 } to { opacity: 1 } }
```

**An element animating opacity forms its own stacking context**, and `fill-mode: both` keeps
the animation *filling* forever after it finishes — so the context never goes away. Every
z-index inside `.os-content` is then only comparable **within** it. `.os-content` itself sits
at the default level, so the nav, a sibling at z-index 50, painted over the entire wrapper and
everything in it, no matter how high the number inside.

**This is why only the BOT sheet was affected.** The notification, ARIA and More sheets are
rendered as siblings of the nav at the top level of the app. The bot sheet opens from inside
the client hub, deep inside `.os-content`. **Same component, different ancestor, opposite
result** — which is what makes this class of bug nearly impossible to spot by reading the
component. Two centred modals (`z-index: 400`) had the same latent flaw and nobody had
noticed, because their content sits mid-screen where the nav does not reach.

Raising the z-index would not have helped. The number was never the problem.

## The fix, done twice on purpose

1. **`.os-content` uses `backwards`, not `both`.** It still fades in from opacity 0 and still
   prevents the first-frame flash, but stops applying when the animation ends, so the stacking
   context is released. This is what rescues the centred modals too.
2. **`Sheet` portals to `<body>`** via `ReactDOM.createPortal`. A sheet is then outside every
   screen's stacking context wherever it is opened from — the durable guarantee, independent
   of how any given engine treats a filling animation. React keeps portalled events bubbling
   through the component tree, so `onClose` and every handler behave exactly as they read.

**The app shell sets the typeface on itself, not on `<body>`**, so the portalled overlay has
to carry `fontFamily` and `color` or it renders in the browser's default serif. `APP_FONT`
exists for that.

Also: **`ChatBar` never cleared the phone's home indicator.** Pinned Save bars already had
`.os-sheet-actions { padding-bottom: calc(16px + env(safe-area-inset-bottom)) }`; the chat bar
was simply missed and had a flat `20px`. It now has `.os-chatbar` with the same treatment.

## Measured, not asserted

`tests/verify-sheet-layering.mjs` (19 checks) builds a minimal page with the real structure —
a wrapper running the app's own keyframes, an overlay inside it, the nav as a sibling — and
uses `document.elementFromPoint` inside the nav's band **both ways round**:

| fill-mode | element on top |
|---|---|
| `both` | `nav` (the reported bug, reproduced) |
| `backwards` | `overlay` (the fix) |

A regex suite could not have told a real fix from a plausible-looking edit. The browser step
is skipped, not failed, where Playwright is unavailable (launch notes in KB `repo-tests`).
Every guard has been broken individually and confirmed to fail.

## 🔴 A backtick in the CSS blanks the whole app

The app's stylesheet lives inside a JSX template literal:

```jsx
<style>{`  ...all the CSS...  `}</style>
```

**One backtick in a CSS comment ends the string early and the entire file fails to parse** —
not a broken style, a blank OS. The first draft of the comment explaining this very fix used
backticks around `backwards` and `both`, and did exactly that. Caught before deploy by running
the file through Babel; there is now a dependency-free assertion that the style block contains
no backtick at all.

**Worth keeping as a habit:** `index.html` is one ~1MB Babel block, so any syntax error takes
the whole OS down. Parse it before merging anything that touches it.
