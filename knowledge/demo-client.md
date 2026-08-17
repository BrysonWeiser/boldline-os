---
name: demo-client
topic: OS/Data
task: put a fake or sample client into the OS so the screens render, or check what stops test data reaching real inboxes
keywords: [demo client, makeDemoClient, fake client, sample client, demo flag, Cornerstone Plumbing, INIT_CLIENTS, seed clients, example.com, 555-01, lead-followup, isReportable, isOwnerBriefable, verify-demo-client]
status: verified
summary: Home screen has a "Load a demo client to look around" button (shown only while there are zero clients) that inserts `makeDemoClient()` through the same save path as a real client. The account is mid-pipeline with contract history and 3 leads so the screens actually populate. `demo: true` is LOAD-BEARING, not a label - without it the Monday weekly-report job would email a report built from invented numbers, and lead-followup would text and email the sample leads. Gated in report-shared (isReportable + isOwnerBriefable) and lead-followup (main loop + test mode). Contact details are also unroutable (example.com per RFC 2606, 555-01xx reserved range) as a second layer. 18 checks in tests/verify-demo-client.mjs.
verified: 2026-08-17
---

**Bryson, 2026-08-17:** *"can you generate a fake client in the os I deleted all the old ones"*

## Why the existing auto-seed did not cover it

`loadClients()` in `index.html` seeds `INIT_CLIENTS` (Apex Roofing, Luxe Med Spa, DetailKing ATL)
**only when the clients table is completely empty**. The internal **My Ads house account lives in
the same `clients` table**, so once it exists the table is never empty and the seed never fires
again. Deleting every real client therefore leaves the OS blank with no way back.

## What was built

- **`makeDemoClient()`** in `index.html`, modelled on `makeInternalClient()` so the record shape
  cannot drift from a real one.
- **Button: "Load a demo client to look around"** on the home screen, under Add New Client,
  rendered only when `clients.length === 0` so it disappears the moment a real client exists.
- **Saves via `addClient()`**, the exact same insert a real client uses. A demo that took a
  special route would not prove the real path works.
- **DEMO badge** next to the name in the client list.

The account is **deliberately mid-pipeline**, not blank: `g-growth`, stage `building`, bots done
through Keyword Research with Ads Builder active, 18 leads at $54 CPL, three comm-log entries, three
leads. An empty client renders empty screens and teaches nothing.

## 🔴 `demo: true` IS LOAD-BEARING — the whole point of this entry

The demo carries an **active contract, an email and sample leads on purpose**, because that is what
makes the screens look alive. That is also precisely what makes it dangerous: **server-side
scheduled jobs read every row in `clients` and have no idea the numbers are invented.**

Without the flag:

| Job | What would have happened |
|---|---|
| `weekly-report` (Mon 15:00 UTC) | Emailed a full performance report, built from fake numbers, to the demo's address |
| `monthly-report` (daily, gated) | Same, on the monthly cadence |
| `lead-followup` | **Texted and emailed the three sample leads** on the day-1/3/7/14 drip |

Gated in:
- **`netlify/lib/report-shared.mjs`** — `const isDemo = (client) => !!(client && client.demo)`,
  checked **first** in `isReportable`, and in `isOwnerBriefable` so fake numbers never reach
  Bryson's own inbox either.
- **`netlify/functions/lead-followup.mjs`** — skipped in `processClient` **and** in the `?test=1`
  path, so a demo lead can never even be picked as the test sample.

**Any future outbound job must add the same check.** Ads jobs are already safe by accident: the
demo has no `googleAdsCustomerId` or `metaAdAccountId`, so `ads-sync` and `ads-autopilot` skip it.

## Second layer: the contact details cannot reach anyone

Belt and braces, in case a gate is ever missed:
- **`example.com`** is reserved by **RFC 2606** and can never receive mail. Used for the client
  email, `leadDestination`, and all three sample lead emails.
- **`(xxx) 555-01xx`** is the reserved fictional phone range. Used for the business phone and all
  lead phones.
- Every sample lead is status `contacted` or `won`, never `new`, so `findDueStep` returns null even
  if the gate were bypassed.

**Note the pre-existing `INIT_CLIENTS` seed does NOT follow this** — it uses plausible real domains
(`owner@apexroofing.com`, `hello@luxemedspa.com`) with `contractStatus: "active"`. If that seed ever
fires on an empty table, those addresses are reportable. Worth fixing if the seed is ever revived.

## Guarded by `tests/verify-demo-client.mjs` — 18 checks, IN THE REPO

Run `node tests/verify-demo-client.mjs`. It evaluates the real `makeDemoClient()` straight out of
`index.html` (no restatement) and asserts the flag is set, the contract is active, every email is
`@example.com`, every phone is in the 555-01xx range, no lead is left `new`, the pipeline is
genuinely mid-flight rather than all-done, and no ad account is linked. It then greps the server
files to assert each gate is present. **The gate assertions were proved to fail** by temporarily
removing the `isReportable` gate: 1 failure, exactly the right one, then restored.

## 🟡 Unrelated pre-existing breakage found while verifying

**`tools/os-screenshot.js` does not run.** Both viewports fail with
`Failed to execute 'appendChild' on 'Node': Cannot use import statement outside a module`, then time
out. **Confirmed pre-existing** by stashing all local changes and running it against a clean tree,
where it fails identically. Not investigated further. It means the OS render harness (KB
`os-screenshot-harness`) is currently unavailable for self-QA of OS layout.

**Gotcha when re-testing that:** the harness needs `react`/`react-dom`/`@babel/standalone` on
`NODE_PATH`, and `cd`-ing into the scratchpad resets the shell cwd, so a following `git stash pop`
runs outside the repo and fails. Pop the stash from the repo root.
