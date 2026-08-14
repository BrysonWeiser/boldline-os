---
name: netlify-secret-scan-deploys
topic: Infra
task: diagnose why the OS is running old code, and fix a failing Netlify secret scan
keywords: [netlify, deploy failed, exposed secrets detected, SECRETS_SCAN_OMIT_KEYS, META_APP_ID, stale OS, old code, build failed, PWA cache, service worker]
status: verified
summary: 7 consecutive production builds failed on "Exposed secrets detected - META_APP_ID" while every merge reported success in git, so the OS silently ran day-old code. The tell was that git and the live site disagreed. Fixed by adding META_APP_ID to SECRETS_SCAN_OMIT_KEYS - it is a PUBLIC identifier (embedded in every client-side Meta SDK snippet), not a credential. Deleting the offending id from docs was tried first and was the wrong approach: the first candidate turned out to already be in the last SUCCESSFUL deploy.
verified: 2026-08-14
---

**Symptom (Bryson, 2026-08-14):** *"has everything been merged and is live because the os app still looks like this after i closed and reopened it."* Every merge had reported success. `origin/main` genuinely carried the code. The OS still showed yesterday's UI.

**THE ONE COMMAND THAT SETTLES IT.** Before touching caches, service workers or the app, curl the deployed file from outside the browser:

```
curl -s https://boldlinemedia.netlify.app/ | grep -c "<a marker only the new build has>"
curl -s https://boldlinemedia.netlify.app/ | wc -c     # served bytes vs `wc -c < index.html`
```

A curl bypasses the browser, the PWA shell and the service worker entirely. **If curl returns old bytes, it is a DEPLOY problem and no amount of refreshing will ever help.** Here it returned 829,178 bytes against 854,284 in the repo, which ended the cache theory immediately.

**Narrowing it without dashboard access:** the last commit touching `marketing-site/` was live, and everything after it (OS + functions only) was not. That dates the last successful deploy precisely and says "one deploy worked, everything after failed" rather than "nothing is deploying".

**The cause:** Netlify's secret scanner fails the build when the VALUE of any env var appears in any committed file. `META_APP_ID`'s value had been written into `knowledge/` and `docs/DEPLOYS.md` while documenting the Meta pixel work. **Netlify's Deploys tab names the offending variable** ("Here are the secrets we found: META_APP_ID") and the `Review exposed secrets` link names the file.

**A WRONG TURN WORTH RECORDING.** The first instinct was to delete the offending id from the docs. The candidate picked was `860905490103151` (the only long id that looked newly added). Before pushing, ancestry was checked:

```
git merge-base --is-ancestor <commit-that-added-it> <last-good-deploy>
```

It returned YES - the id was **already in the last SUCCESSFUL deploy**, so it could not be the cause. **Always verify a suspect value was absent from the last good deploy before "fixing" it.** Otherwise you burn another failed build per guess, and each one takes a couple of minutes.

**THE FIX: `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml`.** A Meta **App ID is a public identifier, not a credential** - Meta embeds it in every client-side SDK snippet and it is visible in the app dashboard URL. It identifies the app; it authenticates nothing. The credential is `META_SYSTEM_USER_TOKEN`, which stays fully scanned alongside Stripe, Twilio, Supabase and Google Ads. Adding the key unblocks the build no matter which file holds the value, which beats hunting the value across the repo.

**Why the id stays in the KB at all:** every Meta problem in this project has turned on *which id is which* (app dataset vs personal web pixel vs portfolio dataset vs ad account). Prose like "the app-scoped one" is far weaker than the number when debugging months later. If that trade is ever unwanted, strip all Meta ids from `knowledge/` and `docs/` instead and drop the omit key.

**After a real deploy lands, the PWA still needs a hard refresh** (`Ctrl+Shift+R`). The installed app holds a cached shell, so closing and reopening the window is not enough. That is a genuinely separate problem from this one, and confusing the two is what makes this take an afternoon.
