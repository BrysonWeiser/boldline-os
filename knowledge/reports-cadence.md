---
name: reports-cadence
topic: OS app
task: who gets which report and when — the weekly/monthly client reports, Bryson's internal briefings, and ARIA's monthly OS health report
keywords: [reports, weekly report, monthly report, OS health report, ARIA report, internal briefing, cadence, report-shared, runReportJob, runOSHealthReport, lastOwnerBriefing, lastReportSent, owner copy]
status: verified
summary: Three scheduled report jobs, restructured 2026-07-25 to Bryson's spec. WEEKLY (Mon) = a client-facing weekly report for weekly-tier clients + an internal briefing to Bryson on EVERY active client (even monthly-tier, so he stays current). MONTHLY (per-contract-date, daily-gated) = the client-facing monthly report for monthly-tier clients + an exact COPY to Bryson of what the client got. OS HEALTH = ARIA's business+system report with OS-improvement recommendations, now MONTHLY (1st) and owner-only — this is Bryson's "monthly report: only ARIA, about the OS." All in netlify/lib/report-shared.mjs; schedules in netlify.toml.
verified: 2026-07-25
---

**Bryson's spec (2026-07-25):** "Monthly reports I get = only ARIA, about OS health + suggestions to make the OS better. Weekly reports = about each client. If something major comes up = alert." Clarified: monthly-tier clients keep their monthly client-facing report AND Bryson gets a copy of it; but Bryson wants an internal briefing EVERY WEEK on every client (even monthly ones) to stay current — the client still only gets emailed on their package cadence.

**The three jobs (all in `netlify/lib/report-shared.mjs`; thin wrappers in `netlify/functions/{weekly-report,monthly-report,os-report}.mjs`):**

1. **Weekly** — `runReportJob(period:"weekly")` → `processWeekly()`. Schedule `0 15 * * 1` (Mon 15:00 UTC). For every **reportable** client (`isReportable` = non-internal, `contractStatus==="active"`, has a known package, has an email):
   - **Owner internal briefing → Bryson** (`OWNER_EMAIL`), for EVERY reportable client regardless of tier. Gated by `gapOk(client.lastOwnerBriefing, OWNER_BRIEFING_GAP_DAYS=5)` — a separate field from `lastReportSent` so the weekly briefing never disturbs a monthly client's client-facing cadence. Uses `buildOwnerPrompt` (direct, "for his eyes only").
   - **Client-facing weekly report → the client**, ONLY if `pkg.optimizationFreq==="weekly"`, gated by `gapOk(client.lastReportSent,5)`. Uses `buildClientPrompt`.
   - Sets `lastOwnerBriefing` and/or `lastReportSent` independently based on what actually sent.

2. **Monthly** — `runReportJob(period:"monthly")` → `processMonthly()`. Schedule `0 15 * * *` (fires daily, gated per-client). Only monthly-tier clients (`pkg.optimizationFreq==="monthly"`). Gated by `dueForMonthly(client,30)` = 30+ days since `lastReportSent` (or `contractStart` for the first). Sends the **client-facing monthly report to the client** AND an **exact copy to Bryson** (subject `[Copy] … (sent to client)`, same rendered content — his ask: "a copy of that report that goes to them"). Does NOT generate a separate owner briefing here — the weekly job already keeps him current. Daily firing = at-least-once monthly delivery anchored to each contract date; most runs are cheap no-ops.

3. **OS Health** — `runOSHealthReport()` → `os-report.mjs`. Schedule **`0 16 1 * *` (1st of month, 16:00 UTC)** — CHANGED from weekly 2026-07-25. Owner-only. ARIA writes a business-portfolio + system-health report ending in **Recommendations for making the BoldLine OS itself better** (automations to add, inefficiencies to fix, features to build). Subject/label/prompt all say "Monthly" now. This is Bryson's monthly report: only ARIA, about the OS.

**SMS digests:** each report run texts `OWNER_PHONE` a one-line digest (e.g. "Weekly reports sent to X; N internal briefings for you"). Fails soft (Twilio trial A2P block — see the deploy-status note in index.html). ARIA's OS report texts "ARIA's monthly OS health report is ready."

**Data fields on each client record:** `lastReportSent` (client-facing cadence anchor), `lastOwnerBriefing` (weekly owner-briefing anchor, NEW 2026-07-25), `latestReport:{period,text,sentAt}` (last client-facing report shown in the OS).

**Testing safely:** hit any report function with `?test=1` — it picks the first eligible client, emails BOTH copies to `OWNER_EMAIL` only (subjects prefixed `[TEST]` / `[would go to <client-email>]`), and changes NO data. Weekly test needs any active client w/ email + package; monthly test needs a monthly-cadence client. `os-report?test=1` sends ARIA's report to the owner.

**OS app status tab:** `ARIADeployTab` (index.html) lists "Weekly Report Email", "Monthly Report Email", "Monthly OS Health Report" — descriptions updated 2026-07-25 to match this cadence.

**GOTCHA fixed 2026-07-25:** the old code sent Bryson an internal briefing ONLY on a client's own package cadence (so monthly clients → monthly briefing) and ran ARIA's OS report WEEKLY — the opposite of what Bryson wanted. Restructure decoupled the owner briefing (weekly, all clients, `lastOwnerBriefing`) from the client-facing send (package cadence, `lastReportSent`) and moved ARIA to monthly. Removed the old `isEligible`/`shouldSend`/`processClient` helpers; `runReportJob` no longer takes `minGapDays` (gaps are internal constants).
