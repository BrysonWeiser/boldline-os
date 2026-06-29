# Deploys & Rollback

How production deploys and rollbacks work for BoldLine OS.

## How it deploys
- Production = the **`main`** branch. Netlify auto-builds and deploys whenever `main`
  changes.
- All work happens on `claude/zen-babbage-1wtcv3`, then gets **auto-merged into `main`**
  after each completed unit of work (per Bryson's standing instruction, 2026-06-29).

## The safety net (so we can always roll back)
Two independent ways to get back to the last working version:

**1. Pre-merge git tags.** Right before every merge, the current production state of
`main` is tagged `prod-pre-merge-<UTC timestamp>` and pushed. Each tag is a frozen,
named snapshot of production *before* that merge — i.e., a guaranteed restore point.
- List every restore point, newest last:
  ```
  git tag -l 'prod-pre-merge-*'
  ```

**2. Netlify deploy history.** Netlify keeps every past deploy and can re-publish any of
them instantly, with no code changes.

## How to roll back

### Fastest (no code) — Netlify
1. Open the site in the Netlify dashboard → **Deploys**.
2. Find the last deploy that worked (each row shows the commit + time).
3. Click it → **Publish deploy**. Production reverts to that build immediately.

### Code-level — git revert (preferred for a clean history)
Undo the most recent merge and let Netlify redeploy the previous code:
```
git checkout main && git pull origin main
git revert -m 1 <merge-commit-sha>     # the "Merge … into main (deploy)" commit
git push origin main
```
(`-m 1` keeps `main`'s side and backs out everything the merge introduced.)

### Or restore to a specific saved point
```
git checkout main && git pull origin main
git reset --hard prod-pre-merge-<timestamp>
git push --force-with-lease origin main
```
Use this only if a plain revert isn't enough; force-push rewrites `main`, so prefer the
revert or the Netlify route when possible.

## Log
Restore points are the `prod-pre-merge-*` tags (listable with the command above). The
most recent tag is always the state to roll back to if the latest deploy misbehaves.
