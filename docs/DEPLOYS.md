# Deploys & Rollback

How production deploys and rollbacks work for BoldLine OS.

## How it deploys
- Production = the **`main`** branch. Netlify auto-builds and deploys whenever `main`
  changes.
- All work happens on `claude/zen-babbage-1wtcv3`, then gets **auto-merged into `main`**
  after each completed unit of work (Bryson's standing instruction, 2026-06-29).

## The safety net (so we can always roll back)
Three independent ways back to the last working version:

1. **Netlify deploy history** — Netlify keeps every past deploy and can re-publish any
   of them instantly, no code changes. This is the fastest path.
2. **`rollback/<timestamp>` branches** — right before every merge, the current production
   state of `main` is saved to a branch named `rollback/<UTC timestamp>` and pushed.
   Each is a frozen snapshot of production *before* that merge. They accumulate on
   purpose (each = one saved restore point).
   - List them, newest last: `git branch -r --list 'origin/rollback/*'`
3. **The merge commit's first parent** — every deploy merge is a `--no-ff` merge commit,
   so its first parent is always the exact pre-merge state, recoverable via `revert`.

> Note: this git remote **blocks tag pushes and branch deletions**, so restore points
> are pushed *branches* (not tags), and old `rollback/*` branches can't be deleted —
> that's fine, we want them kept. (A leftover `zz-rollback-test` branch from setup is
> harmless and can't be removed.)

## How to roll back

### Fastest (no code) — Netlify
1. Netlify dashboard → the site → **Deploys**.
2. Find the last deploy that worked (each row shows commit + time).
3. Click it → **Publish deploy**. Production reverts immediately.

### Code-level — git revert (clean, preferred)
Back out the most recent deploy merge and let Netlify redeploy the prior code:
```
git checkout main && git pull origin main
git revert -m 1 <merge-commit-sha>     # the "Merge … into main (deploy)" commit
git push origin main
```

### Restore to a specific saved branch
```
git checkout main && git pull origin main
git reset --hard origin/rollback/<timestamp>
git push --force-with-lease origin main
```
Prefer the revert or Netlify route; force-push rewrites `main`.

## Log of restore points
Each row = the production state saved *before* that merge (the rollback target).

| Date (UTC) | Pre-merge SHA | Rollback branch | What the merge shipped |
|---|---|---|---|
| 2026-06-29 | `3c96043` | `rollback/20260629-000411` | First auto-merge: full session — marketing-site rebuild + blog automation, OS live-alert toasts, portal upgrade-CTA + confirmation, the auto-merge/rollback workflow itself. |
| 2026-06-29 | `048b491` | `rollback/20260629-DOCS` | Doc fix: switch rollback mechanism from tags → branches (tags can't push to this remote). |
| 2026-06-29 | `e071d85` | `rollback/20260629-003813` | Marketing site: privacy + terms + branded 404 pages, footer legal links, soft-404 fix (removed catch-all rewrite). |
| 2026-06-29 | `dcf2828` | `rollback/20260629-022514` | Blog 404 fix attempt #1: moved blog.css out of /blog/ and added force=true to blog redirects (routed to the function but didn't fully fix it). |
| 2026-06-29 | `f709686` | `rollback/20260629T224622Z` | Blog 404 real fix: read slug from /blog/&lt;slug&gt;/ and page from /blog/page/&lt;n&gt;/ in the path — Netlify new-format functions don't receive the redirect's `?slug=`/`?page=` query. |
