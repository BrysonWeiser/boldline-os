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
- **Granular, click-by-click instructions** for any external/manual setup. Assume
  no familiarity with dev tools ("click the wrench icon, top right"). He has
  explicitly asked for this level of detail.
- **After each finished section/task, update this index** (this file +
  `docs/INTEGRATIONS.md`): review what we did, record decisions and how he likes
  things done, so future sessions can check what's already done before redoing it.
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
  in the repo (not even in docs).

## Detailed state
See **`docs/INTEGRATIONS.md`** for per-platform setup status, env-var names,
decisions, and what's still pending.
