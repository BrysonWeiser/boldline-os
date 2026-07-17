# BoldLine OS — Project Context for Claude

> Read this first every session. It is the durable memory across sessions —
> nothing from past chats persists except what is written here and in the repo.
> Detailed, per-topic memory now lives in the **task-keyed knowledge base** under
> `knowledge/` — it surfaces automatically (recall hook) when a prompt matches, so
> don't bulk-read it. When we finish a unit of work, capture it as a KB entry
> (see "Record to the knowledge base" below) so we never redo work or forget a decision.

## What this is
BoldLine OS is the internal operations platform for **BoldLine Media**, a digital
marketing agency (Google Ads management + custom landing pages for businesses of
any size). Static front end (`index.html`) + Netlify serverless functions
(`netlify/functions/`). Deployed on Netlify. Data in Supabase.

## The end goal (Bryson's vision)
Full automation **before the first client**. Bots run the ads, build the landing
pages, handle lead follow-up. Bryson's only manual jobs: cold call, close the deal
on a meeting, and occasionally check in on the bots and the OS. Everything else
automated.

## How Bryson wants me to work (standing preferences)
- **Be opinionated, not a yes-man.** If an idea is weak or there's a better way,
  say so with reasoning. Offer recommendations proactively, not only when asked.
- **Always teach the setup — never just "I set it up, let me know."** For everything
  we do (every external account, credential, platform, dashboard, or configuration),
  give granular, click-by-click instructions so Bryson can do it AND understand it
  himself. Assume zero familiarity with dev tools ("click the gear icon, top-right").
  Never silently perform/configure a setup and only report it done — he needs the HOW,
  step by step, every time. (Code I write is mine to implement, but I still explain
  what it does and how he interacts with it.) He has explicitly + repeatedly asked.
- **Record to the knowledge base AUTOMATICALLY — Bryson must never have to ask whether
  I saved it.** The moment anything worth remembering happens (a finished unit of work,
  a decision, a status change, a gotcha + its fix, a credential/env-var NAME, a stated
  preference), immediately add or update a task-keyed entry `knowledge/<slug>.md`, run
  `node knowledge/build-index.cjs` (regenerates the recall index + the slim
  `docs/INTEGRATIONS.md`), then commit + push. Do NOT wait to be told. Say so visibly
  ("✅ KB updated: <slug>") so he sees it without checking. Entry format + rules are in
  `knowledge/_README.md`. Two hooks back this up: a **PreCompact hook**
  (`.claude/settings.json`) forces a KB flush before context is ever compacted/lost, and
  a **UserPromptSubmit hook** (`knowledge/recall.cjs`) surfaces relevant entries at the
  start of each task so we don't rediscover what we already solved.
- **Responsive at every breakpoint — standing rule for ALL surfaces (Bryson, 2026-07-17).**
  Everything we ship — OS app, client portal, marketing site, emails where possible, and any
  future surface — must look intentional at **phone (~390px), tablet (~768px), laptop
  (~1280px), and desktop (~1600px+)**: no horizontal scrolling, no content crammed into a
  narrow column on big screens, no oversized empty gutters, nothing cut off or "missing".
  Before merging any UI change, verify it headlessly at those four widths (Playwright recipe
  + current coverage map in KB `responsive-standards`). Cards/sections that share a container
  should share a width — no mixed-width stacks.
- **Confirm before irreversible or outward-facing actions.**
- **Default to the cheaper model; flag when a task needs Opus (Bryson, 2026-07-02).**
  Bryson runs on **Sonnet** by default to control credit usage. Before ATTEMPTING a
  genuinely Opus-worthy task (hard multi-file debugging, architecture, subtle logic),
  say so first and let him switch (`/model`) — don't silently do hard work on the wrong
  tier. Also work **lean**: concise replies; no preview screenshots or heavy verification
  unless the task needs it or he asks; batch changes instead of many tiny round-trips;
  prefer a fresh session per new topic (this file + the KB carry continuity). Note:
  `/fast` does NOT save credits (still Opus, just faster output).

## Hard business constraint (do NOT violate)
**The client pays for everything. BoldLine never fronts, holds, or is financially
exposed for client ad spend** — "it gets too risky and messy." Each client's ad
account stays owned and billed by the client; BoldLine only ever holds
manager-level access. This governs all billing / ad-account / Stripe / Meta work.

## Git discipline
- **Auto-merge & deploy (Bryson, 2026-06-29 — overrides the old "never merge without
  permission" rule):** develop on `claude/zen-babbage-1wtcv3`; after each completed unit
  of work (committed + pushed), **automatically merge it into `main`** — `main` is what
  Netlify deploys to production. No need to ask first.
- **Always save a rollback point before merging.** This remote (the Claude-Code git
  proxy) **blocks tag pushes and branch deletions**, so the restore point is a **pushed
  branch**, not a tag: before every merge, create `rollback/<UTCtimestamp>` at the
  current `main` HEAD and push it, then `git merge --no-ff` the dev branch into `main`
  and push. These `rollback/*` branches accumulate on purpose — each is a saved
  pre-deploy snapshot (exactly what Bryson asked for). **After each merge, report the
  rollback branch + pre-merge SHA, and log that SHA in `docs/DEPLOYS.md`.** Rollback
  paths (Netlify one-click deploy history, or `git revert -m 1 <merge>` / reset to the
  `rollback/*` branch) live in `docs/DEPLOYS.md`. Keep working on the same dev branch
  after merging (it goes ahead of `main` again for the next unit of work).
- `git push -u origin <branch>`; retry 4× exponential backoff (2s/4s/8s/16s) only
  on network errors.
- Never open a PR unless explicitly asked. Never use `--no-verify` or bypass hooks.
- **Never commit secrets.** Credential values live only in Netlify env vars, never
  in the repo (not even in docs). NOTE: Netlify's secret scanner fails the build if
  the value of ANY env var (even a non-secret one like a base URL or account ID)
  appears in a committed file. So keep *all* env-var values out of code/docs — refer
  to them by name only. If a non-secret value genuinely must appear as a code default,
  add its key to `SECRETS_SCAN_OMIT_KEYS` in netlify.toml.

## Detailed state
Per-platform setup status, env-var names, decisions, gotchas, and pending items live in the
**task-keyed knowledge base** under **`knowledge/`** (one entry per topic). Two ways in:
- Let the **recall hook** surface the relevant entry automatically when you start a task, or
- Browse the generated index at **`docs/INTEGRATIONS.md`** (auto-built; slim TOC) and open the
  one entry you need. **Don't** bulk-read the whole thing — that's the habit this replaced.
Add/refresh entries as work completes (see the "Record to the knowledge base" rule above and
`knowledge/_README.md`).
