---
name: deploy-rollback-workflow
topic: Git/Deploy
task: deploy to production and be able to roll back a bad deploy
keywords: [rollback-branch, no-ff-merge, git-revert, tag-push-blocked, zen-babbage, force-with-lease]
status: verified
summary: Production = main (Netlify auto-deploys). Work on claude/zen-babbage-1wtcv3, auto-merge into main per unit of work. Before every merge, save+push rollback/<UTC-timestamp> at current main HEAD, then git merge --no-ff. Roll back via Netlify deploy history (fastest), git revert -m 1 <merge>, or reset to a rollback/* branch. Remote blocks tag pushes + branch deletions.
verified: 2026-07-02
---

**Deploy:** production is the **`main`** branch — Netlify auto-builds/deploys whenever `main` changes. All work happens on `claude/zen-babbage-1wtcv3`, then is **auto-merged into `main`** after each completed unit of work (Bryson's standing instruction, 2026-06-29 — no need to ask first). Keep working on the same dev branch after (it goes ahead of `main` again for the next unit).

**Before every merge (save a restore point):** create `rollback/<UTC timestamp>` at the current `main` HEAD and **push it**, then `git merge --no-ff` the dev branch into `main` and push. Report the rollback branch + pre-merge SHA and log the SHA in `docs/DEPLOYS.md`.

This git remote **blocks tag pushes and branch deletions**, so restore points are **pushed branches, not tags**, and old `rollback/*` branches accumulate on purpose (each = one saved pre-deploy snapshot). List them, newest last: `git branch -r --list 'origin/rollback/*'`.

**Three ways to roll back:**
1. **Netlify deploy history** (fastest, no code): dashboard → the site → **Deploys** → pick the last good deploy → **Publish deploy**. Reverts instantly.
2. **git revert** (clean, preferred code path): `git revert -m 1 <merge-commit-sha>` then push — every deploy merge is `--no-ff`, so its first parent is the exact pre-merge state.
3. **Reset to a saved branch** (last resort, rewrites `main`): `git reset --hard origin/rollback/<timestamp>` then `git push --force-with-lease origin main`.

The full row-by-row log of restore points lives in `docs/DEPLOYS.md` (that file stays hand-maintained). Never open a PR unless explicitly asked.
