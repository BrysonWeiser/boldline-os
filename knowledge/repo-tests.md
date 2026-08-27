---
name: repo-tests
topic: Workflow
task: write or re-run verification tests for this project, or find out why an earlier session's test suites are missing
keywords: [tests, verify suites, scratchpad, ephemeral container, tests/verify-packages.mjs, verify-pricing-tools, playwright executablePath, chromium-1194, pw-browsers, regression test]
status: verified
summary: Verification suites written into the session scratchpad DO NOT SURVIVE — the container is reclaimed between sessions, so "16 suites passing" was true when reported and then simply gone. Anything guarding a live invariant belongs in `tests/` in git. Also records the Playwright launch fix for this container (the bundled browser build does not match /opt/pw-browsers, so pass executablePath explicitly).
verified: 2026-08-17
---

## 🔴 The problem: suites written to the scratchpad evaporate

Through mid-August 2026 a large amount of verification work was written into the session
scratchpad (`/tmp/claude-0/.../scratchpad/`) and reported as, for example, *"all 16 test suites
passing: verify-detail-split 47, verify-ghosts 16, verify-house-reports 32, …"*. Those numbers were
accurate **at the moment they were reported**. They are also **gone** — this is a cloud/ephemeral
container, the working copy is reclaimed between sessions, and only what is committed to git
survives. A later session went looking for `verify-*` and found nothing: `find . -name "verify-*"`
returned zero results and `scripts/` held a single unrelated file.

**Consequence to be honest about:** none of that work is re-runnable, so no current claim can rest
on it. A regression in any of those areas would not be caught today.

## The rule going forward

**A test that guards a live invariant goes in `tests/` and gets committed.** A throwaway probe
(one-off curl, a scratch parse check, an exploratory screenshot) can stay in the scratchpad. The
distinction is whether a future session needs to be able to re-run it.

## The committed suites (run them all before merging anything)

```
for t in tests/*.mjs; do node "$t"; done
```

| Suite | Guards | Size |
|---|---|---|
| `verify-packages.mjs` | the five-way-duplicated package catalog, the greater-of billing maths, tier/budget bands, the one-time hand-off, and that the marketing site quotes the same model the contract will | 1,140 |
| `verify-pricing-tools.mjs` | the per-lead fee finder's guard rails, the revenue-by-month rollup, and that the contract renders two independent agreements (KB `per-lead-fee-finder`, `revenue-tracking`, `hand-off-product`) | 1,958 |
| `verify-meta-creative-testing.mjs` | the second thing allowed to change a live ad account unattended: the spend-less-never-more invariant, the judging maths, the Development-tier gate, and the test/multi-angle switch (KB `meta-creative-testing`) | 114 |
| `verify-campaign-launch.mjs` | the path between Build Campaign and money being spent: that starting a campaign starts its ad groups and ads too, that no campaign can quietly target the whole country, and that any location worldwide resolves (KB `campaign-launch-bugs`) | 104 |
| `verify-approval-cleanup.mjs` | deleting a campaign takes its approval requests with it, the self-heal never fires on a failed API call, and the approval card names the platform it will actually act on (KB `campaign-launch-bugs`) | 46 |
| `verify-market-research.mjs` | the automated competitor research proposes and never writes: an unevidenced claim is dropped rather than flagged, only what the business itself stated may be used unchallenged, and a business is never its own competitor, a national business is searched nationally while a local one is not, the fields it needs are editable in the OS, and a national business is never advertised as serving one town (KB `market-research`) | 144 |
| `verify-market-research-run.mjs` | the Market Research function **executed for real**, outside world stubbed: a good run reports success rather than "could not finish", the national search covers every market, failures say something actionable, and a completed run never writes `brandVoice` (KB `market-research`) | 55 |
| `verify-live-stats.mjs` | every number on a screen or in a report is computed from live data, both definitions of cost per lead stay identical, and no invented figure is seeded onto a real account (KB `live-stats`) | 32 |
| `verify-house-pipeline.mjs` | the My Ads pipeline tells the truth: every step's panel reports observed facts with no invented narrative and no empty panels, a step's detail agrees with its row, client-only steps stay off the house account, and the page his ads land on counts (KB `house-pipeline-honesty`) | 92 |
| `verify-sheet-layering.mjs` | a panel opened from inside a screen still paints above the bottom nav, the chat bar clears the home indicator, and the stylesheet is still a valid template literal. Measures the layering in a real browser both ways (KB `sheet-layering`) | 19 |
| `verify-scale-prompt.mjs` | the OS suggests spending MORE only when the account is both performing and genuinely out of budget, suggests a step rather than a leap, and never raises a budget itself (KB `scale-prompt`) | 35 |
| `verify-house-leads.mjs` | BoldLine's own website leads reach the house account exactly once, a status he set by hand is never overwritten by the next poll, a lead is never pruned for falling off a page, and a zero lead count is distinguishable from a broken sync (KB `house-leads-mirror`) | 86 |
| `verify-calendly-leads.mjs` | a booked call becomes a lead exactly once, deduped on the Calendly event id so a repeating poll cannot duplicate it (KB `calendly-leads`) | 16 |
| `verify-creative-safe-zone.mjs` | a story creative's footer stays clear of the CTA button Instagram paints over the image, on BOTH renderers (KB `ad-creatives`) | 7 |
| `verify-no-dashes.mjs` | no copy BoldLine writes contains a joining dash of any kind, and every model-writing surface both cleans its output and carries the rule (KB `ad-copy-voice`) | 39 |
| `verify-ad-copy-fit.mjs` | ad copy never ships over the character limit AND never ships as a fragment, on both the server trimmers and the OS's own seeds (KB `ad-generator`) | 12 |
| `verify-local-conditions.mjs` | live-weather ad context, recent-weather history, county matching, and the never-advertise policy gate | 176 |
| `verify-meta-flip.mjs` | the coming-soon sentinels match `docs/META-FLIP-CHECKLIST.md` | 57 |
| `verify-meta-generator.mjs` | the Meta ad generator is wired to its background action | 26 |
| `verify-demo-client.mjs` | the demo client is safely fake (no real emails, no reports) | 18 |

None have dependencies; all run with plain `node`.

## 🔴 The blind spot every one of these shared until 2026-08-24

Suites here do one of two things: import a **pure module** and run it, or read the **source
text** and assert on it. Both are good. Neither ever executes a **Netlify function body** —
the glue between the pure parts.

Market Research shipped with a reference to a variable that had been renamed, on the last
line of the happy path. 144 pure checks passed, the regex checks passed, the syntax check
passed, and the feature failed on **every single run** after two minutes of real work.

**The rig that closes it lives in `tests/helpers/`** and works for any function:

```js
import { register } from "node:module";
register("./helpers/stub-hooks.mjs", import.meta.url);      // BEFORE the dynamic import
process.env.ANTHROPIC_API_KEY = "test-key";
const handler = (await import("../netlify/functions/whatever.mjs")).default;
```

`stub-hooks.mjs` redirects `@supabase/supabase-js`, `@anthropic-ai/sdk` and
`scout-providers.mjs` to recorders. They read `globalThis.__STUB`, which lives on the main
thread with the test, so a test sets every answer (`row`, `ai`, `aiThrows`, `placesResult`,
`adTechResult`, `auth`) and reads back everything the function tried to do (`writes`,
`calls`, `places`, `inspected`). The function is then called with a real `Request`.

Two details that matter:
- `register()` only affects imports made **after** it, so the handler must be a dynamic
  `await import`, not a top-level one.
- The Supabase stub applies each update to its own row, so the next read sees the last
  write. Without that, a read-merge-write bug is invisible.

**Assert on `writes`, not on the source.** "This never writes brandVoice" as a regex is a
promise about text; as an assertion over what the function actually tried to save, it is a
guard. Both breaks were confirmed to fail.

Patterns worth copying, learned from `verify-packages.mjs`:

- **Extract the real data out of the source files** (slice the block, evaluate it) rather than
  restating it in the test. Restating a duplicated catalog just creates one more copy to drift.
- **Assert the two encodings of the same fact agree.** The bug that hid from inspection was a
  capability flag saying `true` while the feature-id list omitted it. Cross-checking the pair
  found it immediately.
- **Compute expectations from the data, don't hardcode counts.** The site-bullet assertions compare
  against the number of packages carrying each flag, so adding a package cannot silently pass.
- **If a test must re-implement logic it cannot import, PIN THE ORIGINAL.**
  `verify-pricing-tools.mjs` re-implements the fee clamp and the invoice rollup (the modules need
  Supabase and Anthropic at import time), so it also asserts the exact expressions still exist in
  the source. Move a bound and the test fails by name, which forces the re-implementation to be
  updated rather than quietly testing a fossil.
- **🔴 IF THE TEST OWNS A COPY OF THE LOGIC, BREAKING THE ORIGINAL PROVES NOTHING.**
  `verify-house-leads` re-implemented its merge (the function imports Supabase and cannot be
  imported bare) and pinned the source with regexes. Deleting the hand-set-status guard and
  renaming the dedupe key BOTH left it green: the copy in the test was still right, and the
  pins matched unrelated lines. The fix is structural, not a better regex — move the pure
  logic to a `netlify/lib/*.mjs` module with no I/O and import the real thing, leaving regex
  pins for only the wiring the logic cannot see. Prefer this over the "pin the original"
  pattern below whenever the logic can be lifted out.
- **Prove the guard is load-bearing before believing it.** Every suite here has had a deliberate
  break introduced and confirmed to fail it. A guard that has never failed has never been tested.
- **🔴 ANY "THIS TEXT IS GONE" ASSERTION MUST RUN ON COMMENT-STRIPPED SOURCE.** This has now
  bitten THREE times: a nationwide-default check matched the comment explaining the bug, a
  padding check matched the comment naming the old variable, and the check that invented
  work-log prose was removed matched the comment listing which phrases were removed. The
  code that deletes something almost always quotes it while explaining why. Strip
  `^\s*(//|\*|/\*)` lines before asserting absence, every time.
- **🔴 A GUARD YOU HAVE NOT BROKEN IS NOT A GUARD.** The Meta tier-gate assertion was
  `/cl\.internal/.test(block)` — which matched an unrelated `systemFor(!!cl.internal)` a few
  lines away and **passed with the gate deleted**. It was guarding the one thing that would
  have Meta rejecting writes every two hours forever. Nothing but deliberately breaking it
  would have found that. Break every guard once, before believing any of them.
- **🔴 ASSERT THE INVARIANT, NOT A PROXY FOR IT.** `verify-local-conditions` required
  `let localCond` within **400 characters** of the loop opening, as a stand-in for "declared
  inside the loop". Adding an unrelated guard and a comment at the top of that loop broke the
  test while the scoping stayed perfectly correct. It now asserts structurally: declared after
  the loop opens, exactly once, and nowhere above it. A proxy assertion fails on the wrong
  things and, worse, tempts you to loosen it rather than fix it.

## Playwright in this container: pass `executablePath`

The standing four-breakpoint rule (390 / 768 / 1280 / 1600, KB `responsive-standards`) needs a
browser, and the naive launch fails:

```
browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/...
```

The scratchpad's `playwright` package expects browser build **1234**; the image ships **1194**. Do
**not** run `npx playwright install` (the environment notes forbid it and it wastes the disk
allowance). Launch with the real binary instead:

```js
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
```

Confirm the build number with `ls /opt/pw-browsers` before trusting the path — it will change when
the image updates.

## Gotcha when measuring "do these cards share a width"

Selecting cards with a loose class pattern (`[class*=pkg]`) also matches the **grid wrapper**, which
reports the full row width and produces a false "widths differ" failure. Select the real cards by
structure instead — an element with both a direct `h3` and a direct `ul`:

```js
[...pane.querySelectorAll("*")].filter((e) =>
  e.querySelector(":scope > h3") && e.querySelector(":scope > ul"))
```

## 2026-08-26 — 🔴 A HARNESS MORE PERMISSIVE THAN REALITY IS NOT A TEST

Shipped a crash that blanked the whole OS. A new component used `useMemo`, which
`index.html` never destructured off `React` (line 37 had useState, useEffect, useRef,
useCallback, useContext, createContext, and nothing else). Bryson pressed **New Client** and
got a red `ReferenceError: useMemo is not defined` screen.

**Two checks had just passed, and neither could have caught it.**

1. **Compiling the whole file through Babel.** Babel compiles a call to an undefined name
   perfectly happily. A syntax check can never catch an undefined reference, and treating a
   clean compile as "it works" is the mistake.
2. 🔴 **The throwaway Playwright harness, which is the real lesson.** It began
   `const {useState,useEffect,useMemo,useRef}=React;` — written from what the component
   NEEDED rather than copied from what the app ACTUALLY PROVIDES. So the harness supplied
   the very binding the real page lacked. It rendered perfectly, screenshots and all, and
   proved nothing about production. **A harness that supplies what the real environment does
   not is a second implementation that happens to work.**

**Rule going forward:** when standing up a harness around a slice of `index.html`, take the
surrounding bindings **from the file itself** (slice line 37) rather than writing them by
hand. If that is impractical, the thing being verified must also be checked against the
shipping file statically.

**Guard added: `tests/verify-app-boots.mjs`.** Scans the stripped source for every React
hook that is CALLED (`(?<![.\w])useX\s*\(`, so `React.useX(` and `foo.useState(` do not count)
and asserts each is either on the destructuring line or fully qualified. Also pins
`createContext`, and fails on a hook destructured but never used so the line stays honest.
11 checks, broken once by removing `useMemo` and confirmed to reproduce the exact shipped
failure.

## 🔴 2026-08-27 — THE SAME BUG ON THE SERVER, AND IT COST THE FIRST CLIENT SEND

Bryson pressed "Send via DocuSign" on Stencil & Thread's agreement and got **"Send failed
— try again."** Extracting the DocuSign JWT auth into `netlify/lib/docusign-auth.mjs`
earlier the same day had taken `SIGN_ANCHOR` with it, and that constant belongs to the
**document**, not to auth. Building the envelope threw a `ReferenceError` before it ever
reached DocuSign.

**Everything said the file was fine:**

| Check | Verdict, with the bug present |
|---|---|
| `node --check docusign-send.mjs` | passes |
| `import("./netlify/functions/docusign-send.mjs")` | passes |
| all 29 other suites | pass |

Because the name is read **only inside a function body**. Nothing runs at import time, and
no suite calls that handler. This is the useMemo crash again in a different room: **the
compiler is not a reference checker**, and a missing name is invisible until the exact
moment the code runs. On the front end that moment was "press New Client". On the server it
was a client contract going out.

I had already been bitten by this once in the SAME refactor — `escapeHtml` was in the block
I sliced out, I noticed, and I restored it. Then I "scanned for bare calls" by eye and
missed `SIGN_ANCHOR`. **Reading the diff for missing names does not work. Walk the scope.**

**Guard added: `tests/verify-functions-resolve.mjs`.** Parses every file in
`netlify/functions` and `netlify/lib` with Babel's parser (`@babel/standalone` exposes
`packages.parser` and `packages.traverse`) and, for every `ReferencedIdentifier`, asserts
`path.scope.hasBinding(name, true)` or membership of a **deliberately tight** globals list.
A generous globals list would hide the exact bug this exists for. `.cjs` files get the
CommonJS wrapper names and `sourceType: "script"`.

**It found a second one immediately, live in production and worse than the first.**
`buildSearchCampaign` in `google-ads.mjs` passed `customerId` to `resolveLanguages`, but the
variable in that function is `cid`. **Every Google campaign build had thrown a
ReferenceError at that line since language targeting shipped (`3af13d9`), creating nothing.**
It never worked once, and `verify-campaign-launch.mjs` (133 checks) does not execute that
line. A suite with a big number on it is not coverage of the line you changed.

**The takeaway to keep:** any refactor that MOVES code between files must be followed by
the scope scan, not by re-reading the diff. Two bugs of this class in one day, in two
different files, both invisible to the compiler.
