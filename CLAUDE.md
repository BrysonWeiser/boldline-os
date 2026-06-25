# BoldLine OS — Project Context for Claude

> Read this first every session. It is the durable memory across sessions —
> nothing from past chats persists except what is written here and in the repo.
> When we finish a section of work, UPDATE this file and `docs/INTEGRATIONS.md`
> (Bryson asked for this explicitly so we never redo work or forget a decision).

## What this is
BoldLine OS is the internal operations platform for **BoldLine Media**, a digital
marketing agency (Google Ads management + custom landing pages for small-business
clients). Static front end (`index.html`) + Netlify serverless functions
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
- **Record to the index AUTOMATICALLY — Bryson must never have to ask whether I
  saved it.** The moment anything worth remembering happens (a finished section, a
  decision, a status change, a gotcha + its fix, a credential/env-var name, a stated
  preference), immediately update this file and `docs/INTEGRATIONS.md`, then commit +
  push. Do NOT wait to be told. Say so visibly when you do it ("✅ Index updated: …")
  so he sees it without checking. A **PreCompact hook** (`.claude/settings.json`)
  backstops this by forcing an index flush before any context is ever compacted/lost.
- **Always prompt the Netlify env-var step** at the end of each platform's
  credential setup — never skip it.
- **Confirm before irreversible or outward-facing actions.**

## Hard business constraint (do NOT violate)
**The client pays for everything. BoldLine never fronts, holds, or is financially
exposed for client ad spend** — "it gets too risky and messy." Each client's ad
account stays owned and billed by the client; BoldLine only ever holds
manager-level access. This governs all billing / ad-account / Stripe / Meta work.

## Git discipline
- Work only on branch `claude/zen-babbage-1wtcv3`. Never push to `main` without an
  explicit "merge it".
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
See **`docs/INTEGRATIONS.md`** for per-platform setup status, env-var names,
decisions, and what's still pending.
