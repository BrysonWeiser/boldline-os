---
name: netlify-secret-scan
topic: Deploy
task: fix a Netlify build that failed with "Secrets scanning found N instance(s) of secrets in build"
keywords: [SECRETS_SCAN_OMIT_KEYS, SECRETS_SCAN_OMIT_PATHS, secret scanning, secrets scan, netlify.toml, build failed secret, OWNER_EMAIL, REPORTS_FROM_EMAIL, DOCUSIGN_BASE_PATH]
status: verified
summary: Netlify's secret scanner FAILS the build if the VALUE of ANY Netlify env var (secret OR not — an email, phone, base URL, account ID) appears in any committed file inside the publish dir (publish=".", so the whole repo). Fix for genuinely non-secret values = add their KEY to SECRETS_SCAN_OMIT_KEYS in netlify.toml (comma-separated). NEVER omit a real secret — remove its value from the file instead. Currently omitted: DOCUSIGN_BASE_PATH, OWNER_EMAIL, REPORTS_FROM_EMAIL.
verified: 2026-07-15
---

**The trap:** `publish = "."` in netlify.toml means Netlify scans the **entire repo** (code,
`docs/`, `knowledge/`) against the **values of every env var** on the site. If any value —
including a non-secret one like an email address, phone number, base URL, or account ID — is
found in a committed file, the build **hard-fails**: *"Secrets scanning found N instance(s) of
secrets in build. To prevent exposing secrets, the build will fail."*

**Sneaky timing:** the offending value can have been in the code for weeks. The build only fails
on the **first rebuild AFTER the matching env var is added/changed** in Netlify (env-var changes
apply on the next build). So a failure right after adding a batch of config vars is usually this,
not the commit that happened to trigger the build. (Hit 2026-07-15: the renewal-pricing deploy
failed because `OWNER_EMAIL`/`REPORTS_FROM_EMAIL` had been added as env vars since the prior
deploy, and Bryson's email is printed on the contract in `makeContractHTML` — the deploy was
merely the first rebuild since.)

**Diagnose:** expand the failed **Building** step in the deploy log (the AI "Why did it fail?"
summary does NOT name it) — it prints `Secret env var "KEY"'s value detected at <file>:<line>`.
Or reason it out: list the site's env vars (Site configuration → Environment variables), then
`git grep` the repo for any value you can derive (e.g. the owner email). Unlocked "All scopes /
same value in all contexts" vars are the usual non-secret culprits.

**Fix — non-secret value (the normal case):** add the KEY (not the value) to
`SECRETS_SCAN_OMIT_KEYS` in `netlify.toml`, comma-separated, with a comment saying why it's safe.
Redeploy. Example:
`SECRETS_SCAN_OMIT_KEYS = "DOCUSIGN_BASE_PATH,OWNER_EMAIL,REPORTS_FROM_EMAIL"`.
(`SECRETS_SCAN_OMIT_PATHS` exists too but excluding a whole file is too broad — prefer key-based.)

**Fix — a GENUINE secret committed:** do NOT omit it. Remove the value from the file (reference
it via `process.env.X` only), rotate the key if it was ever pushed. Our real secrets (Stripe,
Supabase service role, Twilio auth, Google Ads, Resend, DocuSign private key) are NOT committed —
keep it that way. The front-end Supabase **publishable** key in index.html is public-by-design
(RLS-protected) and is fine to commit; it only needs omitting IF an env var is created holding it.

**Rule of thumb (already in CLAUDE.md):** keep ALL env-var values out of code/docs — refer to
them by name only. If a non-secret value must appear as a code default, add its key here.
