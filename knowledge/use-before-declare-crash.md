---
name: use-before-declare-crash
topic: OS app
task: fix or prevent a card in the OS that dies with a red error the moment it opens; understand why a component crashes at runtime when every test is green and the app boots fine
keywords: [Cannot access before initialization, ReferenceError, TDZ, temporal dead zone, const not hoisted, MetaLaunchCard, metaLocations, useState plain object, lazy initialiser, card crashed, red error screen, component blank, verify-app-boots, babel parser, babel traverse, declaration order, use before declare]
status: verified
summary: 2026-09-02 the My Ads campaign card died with "Cannot access 'metaLocations' before initialization" the moment Bryson opened it. A useState argument read a const declared thirty lines lower down. This is VALID JavaScript, so Babel compiled it, the app booted, and all forty suites were green — it only throws when that one component renders. Fixed by moving the declaration above the useState, and pinned by a new static guard in verify-app-boots.mjs that parses the shipping script block and fails on any const/let used textually before its declaration in the same run of statements.
verified: 2026-09-02
---

**Bryson, 2026-09-02:** *"this came up when i pressed campaign under my ads"* — with
`Uncaught ReferenceError: Cannot access 'metaLocations' before initialization at MetaLaunchCard`.

---

## What was wrong

In `MetaLaunchCard` (`index.html`):

```js
const [f, setF] = useState({ ..., locationsText: toLocationLines(metaLocations) });   // ~line 8577
// ... thirty lines of other code ...
const metaLocations = (() => { ... })();                                              // ~line 8605
```

Two things combine:

1. **The `useState` argument is a plain object, not a lazy initialiser.** `useState({...})`
   builds that object on *every* render including the first. It reads like something React
   defers; it is not deferred at all. `useState(() => ({...}))` would have been.
2. **`const` is not hoisted the way `var` is.** A `var` would have been `undefined` and the
   card would have limped along with an empty box. A `const` read before its line throws.

Fix: move the six-line `metaLocations` block above the `useState`. It depends only on the
`client` prop, so it is safe up there. A comment in the file says so, and says that anything
added to that component which the `useState` reads must also be declared above it.

---

## 🔴 Why nothing caught it, which is the lasting lesson

This is **valid JavaScript**. Every existing guard was blind to it:

| Guard | Why it passed |
|---|---|
| The JSX compile check | Babel compiles it happily. It is not a syntax error. |
| The hook-destructuring check | Every hook used was destructured. |
| The app-boots check | The app boots. The bug lives inside one component. |
| Every other suite | None of them render `MetaLaunchCard`. |

It only explodes **when that component renders**, and only Bryson opening that one card makes
it render. So production was broken and CI was green — the same shape as the `useMemo` bug that
created `verify-app-boots.mjs` in the first place.

It was also **not a regression from that session's work**: `git show HEAD~1:index.html` had the
identical ordering. It had been latent, waiting for someone to open the card.

---

## The guard now in place

`tests/verify-app-boots.mjs` parses the one `<script type="text/babel">` block with
`@babel/parser`, walks every scope with `@babel/traverse`, and for each `const`/`let` binding
flags any reference whose position is **before** the declaration.

A reference is skipped if a function boundary sits between it and the binding's scope block —
that code runs later, so it is not a dead-zone read. That exemption is what keeps the rule
usable: against the fixed 1.1MB app the whole block reports **zero** hits, so no existing code
has to be bent around it.

**Broken once, as this repo requires:** pointed at the pre-fix file it reported
`metaLocations is used on line 8577 but declared on line 8605` and nothing else. Against the
fix, clean. Suite went 24 → 26 checks.

---

## If you hit this again

The error text is always `Cannot access 'X' before initialization`. Search `index.html` for
`const X` and for the first use of `X` in the same component, and move the declaration up.
Then ask why the guard missed it — the likely answer is that the use sits inside a function
that is nonetheless called immediately (an IIFE, or a callback passed to something that runs
it straight away), which the "crossed a function boundary" exemption deliberately allows.
