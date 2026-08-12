---
name: ads-sync
topic: OS app
task: the scheduled job that pulls live ad spend from Google + Meta, alerts on over-budget pacing, and keeps continuous Ads API traffic flowing
keywords: [ads-sync, scheduled function, live spend, budget pacing, over budget, adPerf, adSyncState, ad api traffic, marketing api tier, dead token alert, netlify schedule, stub-tree test harness]
status: verified
summary: `netlify/functions/ads-sync.mjs` runs every 6 hours, reads live campaigns + last-30-day metrics from Google Ads and Meta for EVERY client with a linked ad account (the internal My Ads house account included, unlike alerts-watch), stores a snapshot at `client.data.adPerf`, and fires transition-only owner alerts — RED when an account paces over its monthly ad budget, YELLOW the first time a linked account stops reading at all. Read-only; never writes a campaign. Built 2026-08-12 for two reasons at once: it is the live-spend feed `alerts-watch.mjs:16` had a standing TODO for, AND it is the continuous Ads API traffic Meta requires before granting Marketing API standard access (see `meta-marketing-api`). 44-case harness, all passing.
verified: 2026-08-12
---

**Why it exists (two problems, one job).**
1. **The pacing gap.** `alerts-watch.mjs:16` carried a standing TODO: real spend-spike detection needs live per-client spend from the ad APIs, so until now every "is this overspending?" check used STORED proxies (`cpl`, lead counts). Nothing ever pulled live spend on a schedule.
2. **Meta's Marketing API tier rejection (2026-08-12).** Meta refused standard access for *"not a sufficient number of Ads API calls in the last 15 days"* — which was **accurate**: `meta-ads.mjs` is only ever invoked when Bryson clicks something in the OS, so outside the July demo session the app made ~zero Ads API calls. This job is the honest fix — a genuine product feature that also produces the traffic the tier request needs. Not counter-gaming: a real ad platform polls performance several times a day, which is exactly what budget pacing requires.

**Schedule: `0 */6 * * *` (four runs a day, 00/06/12/18 UTC)** in `netlify.toml`. Four rather than one is deliberate — pacing stays current AND the API-traffic signal is unambiguous. Well inside every rate limit; alerts do NOT repeat 4x/day because they are transition-only.

**What it reads.** For each client row with `googleAdsCustomerId` and/or `metaAdAccountId`:
- Google: `getCampaigns()` (GAQL, LAST_30_DAYS) — cost, impressions, clicks, conversions, daily budget.
- Meta: `getCampaigns()` (campaigns + `{act}/insights` last_30d) — spend, impressions, clicks, leads, daily budget.
- **Both `getCampaigns` (+ Google's `getAccessToken`) were made `export`ed** in their existing function files so ads-sync imports them directly instead of re-entering over HTTP with a session it doesn't have. Purely additive — no behaviour change to the interactive paths. Precedent: `alerts-watch.mjs` already exports `evalConditions` alongside its default handler.
- **One OAuth exchange per RUN, not per client** (`gadsToken()` called once, only if some client is actually linked to Google).

**What it stores — `client.data.adPerf`:**
```
{ syncedAt, google:{linked,ok,error?,campaigns,live,liveDailyBudget,spend30d,impressions,clicks,conversions},
  meta:{…same}, totals:{liveCampaigns,liveDailyBudget,projectedMonthly,spend30d,impressions,clicks,conversions},
  budget:{monthly,pacing,basis,pct,state} }
```
`state` ∈ `unset | ok | warn (>85%) | over`. De-dupe state lives separately at `client.data.adSyncState = {over, googleFail, metaFail}`.

**Pacing uses TWO independent views and trips on whichever is higher** — either alone has a blind spot: **projected** (live daily budgets × 30.4) catches a budget set too high *before* the money is gone; **actual30d** catches lifetime-budget campaigns (whose `dailyBudget` reads 0) and anything the daily figures don't model. `budget.basis` records which one drove the number, and the alert body cites that one specifically so it never claims a $0 projection is an overspend.

**GOTCHA deliberately avoided — the budget parse is COPIED from the UI, not improved.** `Number(String(adBudget).replace(/[^0-9.]/g,""))`, identical to index.html:6138. It mis-reads a `"$50/day"` string as $50/month — but so does the dashboard, and an alert that disagreed with the number on screen would be worse than one that's consistently wrong. Fix both together or neither.

**Live-campaign detection:** Google `status === "ENABLED"`; Meta `effectiveStatus || status === "ACTIVE"`. Meta's `effective_status` is the one that tells the truth — a campaign reads `ACTIVE` while its ad set is paused (`ADSET_PAUSED`), and only effective status knows it isn't delivering.

**Alerts (transition-only, so no daily spam; re-alert after a recovery is intentional):**
- **RED — over budget.** Names the client, the budget, the pacing figure + %, and which basis drove it. For the house account it says **"My Ads (BoldLine's own account)"**, never a client name.
- **YELLOW — a linked account stopped reporting.** Carries the real underlying error text (e.g. Meta's `API access blocked (code 200, OAuthException)`). This is the alert that would have caught the 2026-07-22 outage same-day instead of it being discovered by hand — and it's the one that matters most while the Meta API-call streak is being built, since a dead token silently stops the tier clock.
- Missing credentials are reported per client by NAME of the env var (`"META_SYSTEM_USER_TOKEN is not set in Netlify."`), never swallowed.
- A per-account failure never aborts the run; a total failure still reaches Bryson via `withFailureAlert` and rethrows so Netlify records it.

**Unauthenticated-endpoint care:** like every other scheduled function here it takes no session, so the **HTTP response is counts-only** (`{ok,synced,googleOk,metaOk,failures,alerts,googleConfigured,metaConfigured}`) — no client names, no dollar figures. All detail goes to the Netlify function log, which is behind login. Verified by an explicit test. Loading `boldlinemedia.netlify.app/.netlify/functions/ads-sync` in a browser is the manual "did it work" check.

**Skips nothing that matters, writes nothing that doesn't:** a client with no linked ad account is skipped entirely — no read, no DB write.

**TEST HARNESS RECIPE (reusable for any scheduled function).** `@supabase/supabase-js` isn't installed in the repo, and the real integrations can't be called from the sandbox, so: copy the REAL function file into a scratchpad tree, and place stub siblings at the same relative import paths (`./meta-ads.mjs`, `./google-ads.mjs`, `../lib/report-shared.mjs`, `../lib/alerts-shared.mjs`) plus a fake `node_modules/@supabase/supabase-js` package (Node resolves bare specifiers up the tree). The file under test is byte-identical to what ships — only its dependencies are swapped. Stubs push alerts onto `globalThis.__ALERTS` and record DB writes, so every assertion is on real behaviour. **44 cases, all passing 2026-08-12:** metric roll-ups, both over-budget bases, de-dupe across consecutive runs, re-alert after recovery, partial platform failure, unlinked-client skip, internal account inclusion, unset budget, paused-campaign handling, missing/expired credentials, response-body leak check, and total-crash alerting.

**NOT built (offered):** surfacing `adPerf` in the OS UI. `MyAdsInsights` still fetches live campaigns on demand when the Campaigns tab opens, which works — reading the stored snapshot instead would make that tab load instantly, and is the natural follow-up.
