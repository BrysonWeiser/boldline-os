# BoldLine Knowledge Base — how it works

A task-keyed memory of hard-won findings that resurfaces **only when relevant**, at prompt
time — so Claude stops re-reading the whole 1,000-line index every session (that was burning
credits). Recall-on-relevance, not bulk-load.

Built 2026-07-02. Adapted from Mike's runbook, scoped down hard for this project (see "What we
deliberately skipped" below).

## The pieces

| Path | What it is |
|---|---|
| `knowledge/<slug>.md` | **One entry per finding**, keyed by the *task* it helps with. Frontmatter: `name, topic, task, keywords, status, summary, verified`. |
| `knowledge/build-index.cjs` | Rebuilds `_index.json` (for recall) **and** regenerates `docs/INTEGRATIONS.md` (the slim human index). Run after any entry change. |
| `knowledge/recall.cjs` | **UserPromptSubmit hook.** Scores the prompt against `_index.json` and injects 1–2 pointers only on a confident match. Silent otherwise. Never throws. |
| `knowledge/_index.json` | Generated. keyword → doc-frequency + entry list, read by `recall.cjs`. **Committed on purpose** so recall works the instant a fresh container starts. |
| `docs/INTEGRATIONS.md` | **Generated** slim table of contents. Do not hand-edit — edit the entries. |
| `_README.md` (this) | Ignored by the indexer/recall (underscore prefix). |

## Why it lives inside the repo (not outside, like the original runbook said)

This is a **cloud/ephemeral** environment: the container is wiped between sessions and only what
is **committed to git** survives. The original runbook kept the KB outside the repo because *that*
machine's disk persisted. Ours doesn't — so everything here is versioned, and the hook config in
`.claude/settings.json` persists automatically too.

## Writing an entry (the capture step — do this at the end of every task)

1. Create `knowledge/<kebab-slug>.md` with this frontmatter, then the body:
   ```
   ---
   name: netlify-forms-wiring
   topic: Forms/Leads
   task: wire up or debug website form submissions and notifications
   keywords: [netlify-forms, submission-created, honeypot, bot-field, form-name]
   status: verified
   summary: One or two lines — the takeaway, not the whole story.
   verified: 2026-07-02
   ---
   Body: the finding, the steps, the gotcha + its fix.
   ```
2. **`status`** is one of:
   - `verified` — confirmed working.
   - `stale-able` — true today but has volatile bits (line numbers, file locations); re-check before trusting.
   - `dead-end` — **tried and failed.** These are gold: they stop the next session re-spinning on the same dead approach.
3. **`keywords`** = *rare, specific* terms (platform names, function names, env-var **names**, error signatures). Skip generic words — the recall math down-weights common terms automatically, but noise still dilutes.
4. **`task`** = what you're *trying to do* when this helps ("wire up form email", "roll back a bad deploy") — NOT the feature name. Recall matches on intent.
5. **NEVER put a secret value in an entry** — env-var **names** only. Netlify's secret scanner fails the build if any real value appears in any committed file, and this dir is committed.
6. Run **`node knowledge/build-index.cjs`**, then commit + push (and merge to main like any other unit of work).

## Tuning knobs

- Recall too noisy / too quiet → `recall.cjs` `THRESHOLD` (default 1.3, higher = quieter) and `MAX` (default 2).

## What we deliberately skipped (and why)

- **Transcript-harvest Workflow** (distill/consolidate/prefilter): unnecessary. We commit after each
  task with full context, so entries are authored *then* — higher quality than mining transcripts.
- **The HTML cluster-graph viewer + sound effects**: overkill for a solo operation.

If the KB ever grows past ~50 entries and hand-capture slips, revisit the harvest pipeline. Until
then, recall + hand-authored entries is the whole system.
