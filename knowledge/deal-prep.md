---
name: deal-prep
topic: OS app
task: research a prospect before a sales call, get a pitch + recommended package to close the deal; edit per-niche lead pricing; work on the Deal Prep tool
keywords: [deal prep, deal-prep, pre-call research, prospect research, close deals, sales call, pitch, recommended package, per-lead fee, lead fee, niche pricing, web search, deal-research, deal_briefs, pricing-shared, getNicheLeadFee, DealPrepScreen, web_search, background function]
status: verified
summary: Owner-side "Deal Prep" tool (BUILT 2026-08-01) — Bryson types a prospect's name/niche/website/notes; a background function web-researches the company with Claude and returns a pre-call briefing (company snapshot, digital-presence gaps, talking points, objection handling) + a recommended package with the per-lead ROI math + the full package lineup priced for that niche. Needs a one-time Supabase table (deal_briefs); no new env vars. Per-lead fees are a STARTER table in pricing-shared.mjs for Bryson to edit.
verified: 2026-08-01
---

**What it is (Bryson's ask):** a pre-call closer. Input a prospect's details before a meeting →
AI researches the company (live web) → get everything useful to close: who they are, their digital
gaps, personalized talking points, objection handling, the recommended BoldLine package with the lead
math, and the full package list priced for their niche. Owner-only; entry from the dashboard card + the
desktop SideNav ("Deal Prep").

**Bryson's decisions (2026-08-01):** (1) per-lead pricing = a **starter table for ~common niches + AI
fallback** for anything unmatched; (2) **live web search** on (small Anthropic-API cost per run).

**Architecture (mirrors the blog's background-function pattern — beats the ~10s sync-function limit):**
- **`netlify/functions/deal-research-background.mjs`** — a Netlify **BACKGROUND** function (name ends in
  `-background` → async, returns 202, up to 15 min). Web-search research + synthesis takes 30–90s. Owner-JWT
  auth (same as blog-write-background). POST `{id, companyName, niche, website?, location?, notes?}`; writes
  a `pending` row to `deal_briefs`, runs the research, updates to `done`+result (or `error`).
  - Model **`claude-opus-4-8`** + server tool **`web_search_20260209`** (`max_uses:6`, adaptive thinking).
    Handles `pause_turn` by re-sending with the assistant turn appended (server-tool loop), up to 6×.
  - Output contract: first line `RECOMMENDED: <package-id>`, then a markdown briefing (sections: Company
    Snapshot / Digital Presence & Gaps / Why They Need BoldLine / Talking Points / Recommended Package & the
    Money Math / Likely Objections). We parse the RECOMMENDED line off the top; the rest is the brief.
- **`netlify/functions/deal-research.mjs`** — poll/get: `GET ?action=get&id=` returns the brief row;
  `?action=recent` lists the last 10. Owner-JWT auth, service-role read.
- **`netlify/lib/pricing-shared.mjs`** — `getNicheLeadFee(niche)` (keyword table, first match wins,
  DEFAULT_LEAD_FEE=45; keeps the OS's existing Roofing 75 / Med Spa 35 / Auto Detailing 15) + `PACKAGES`
  catalog (backend copy of index.html PACKAGES_DB, prices included) + `packagesPromptBlock()` for the prompt.
  **Bryson: edit LEAD_FEE_TABLE to set your real per-lead fees** — these are my value-scaled estimates.
- **`index.html` — `DealPrepScreen`** (before HomeScreen): a form → kicks off the background job with a
  client-generated brief id → polls `deal-research?action=get` every 3s (180s timeout). Renders the brief
  via a small markdown renderer (`briefMdToNodes`: bold headers / bullets / paragraphs) + a package table
  built from the front-end PACKAGES_DB, highlighting the recommended id, showing `$X/lead` on lead-fee
  packages. Routing: `screen==="dealprep"`; entry via `onDealPrep` from the dashboard card + SideNav.

**⚙️ ONE-TIME SETUP Bryson must do (no new env vars — reuses ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY):**
Create the Supabase table. Supabase → SQL Editor → New query → Run:
```sql
create table if not exists deal_briefs (
  id text primary key,
  status text not null default 'pending',
  input jsonb,
  result jsonb,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table deal_briefs enable row level security;
```
(RLS on + no policies → locked to the service role; the functions bypass it. Correct.) Until the table
exists, a research run errors with a Supabase "relation does not exist" message.

**Gotchas:**
- Must be a **background** function — a synchronous function 502s at ~10s; web-search research needs 30–90s.
- `web_search_20260209` needs no beta header on `claude-opus-4-8`; do NOT also declare `code_execution`
  (dynamic filtering already runs it). Handle `pause_turn`.
- Per-lead fees are estimates; the AI reasons a number in-prose for niches not in the table (fallback 45).
- Each run costs a few cents of Anthropic API (web search + tokens) — separate from Claude Code credits.
- Prices in the UI table come from the front-end PACKAGES_DB (canonical); the backend PACKAGES copy is only
  for the prompt — keep them in sync if pricing changes (dual-copy, like report-shared's PACKAGES_DB).

**Verified (2026-08-01):** all modules `node --check`; getNicheLeadFee spot-checked (Roofing 75, Med Spa 35,
Auto Detailing 15, Personal Injury 125, Dentist 55 / Dental Implants 75, Solar 90, HVAC 75, unmatched 45);
index.html Babel-transforms clean; full app boots 0 errors; DealPrepScreen renders on-brand at 390px (form +
gold CTA, no overflow). Live end-to-end (real web research) is Bryson's to confirm after creating the table.
See `pricing-shared.mjs` for pricing, `service-agreement` for how packages/per-lead fees flow into contracts.
