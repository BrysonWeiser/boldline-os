---
name: knowledge-base-system
topic: Tooling
task: add to, maintain, or understand the knowledge base and recall system
keywords: [knowledge-base, recall, build-index, recall.cjs, UserPromptSubmit, entry, slug, THRESHOLD]
status: verified
summary: BoldLine's task-keyed memory — entries in knowledge/<slug>.md, a UserPromptSubmit recall hook surfaces the relevant ones per prompt, build-index.cjs regenerates the index. Full runbook in knowledge/_README.md.
verified: 2026-07-02
---
Task-keyed memory so we stop re-reading the whole index every session (built 2026-07-02 to cut context/credit burn).

- **Entries:** `knowledge/<slug>.md`, frontmatter `name, topic, task, keywords, status, summary, verified`. `task` = what you're trying to DO (recall matches intent, not feature names). status = verified | stale-able | dead-end (dead-ends are gold — they stop re-spinning a failed approach).
- **Recall hook:** `knowledge/recall.cjs` (UserPromptSubmit, wired in `.claude/settings.json`) scores the prompt against `_index.json` — sum of `weight × IDF` over each entry's keywords+task+summary+topic+name — and injects the top ≤2 pointers when the score clears `THRESHOLD` (7). Silent otherwise; never throws.
- **Rebuild after editing entries:** `node knowledge/build-index.cjs` → regenerates `knowledge/_index.json` (recall) + `docs/INTEGRATIONS.md` (slim human index). Then commit + push, and merge to main so new sessions get it.
- **Rules:** never put secret VALUES in entries (Netlify scanner runs over this committed dir); `/knowledge/*` is blocked from public serving in `netlify.toml`; files starting with `_` (e.g. `_README.md`) are ignored by the indexer and recall.
- **Capture discipline (standing rule):** at the end of a unit of work, add/update the relevant entry, rebuild, commit — don't wait to be asked. Full details, tuning knobs, and "what we deliberately skipped" are in `knowledge/_README.md`.
