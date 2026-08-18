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
| `verify-packages.mjs` | the five-way-duplicated package catalog, the greater-of billing maths, tier/budget bands, and that the marketing site quotes the same model the contract will | 968 |
| `verify-pricing-tools.mjs` | the per-lead fee finder's guard rails and the revenue-by-month rollup (KB `per-lead-fee-finder`, `revenue-tracking`) | 1,937 |
| `verify-local-conditions.mjs` | live-weather ad context and the never-advertise policy gate | 119 |
| `verify-meta-flip.mjs` | the coming-soon sentinels match `docs/META-FLIP-CHECKLIST.md` | 56 |
| `verify-meta-generator.mjs` | the Meta ad generator is wired to its background action | 26 |
| `verify-demo-client.mjs` | the demo client is safely fake (no real emails, no reports) | 18 |

None have dependencies; all run with plain `node`.

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
- **Prove the guard is load-bearing before believing it.** Every suite here has had a deliberate
  break introduced and confirmed to fail it. A guard that has never failed has never been tested.

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
