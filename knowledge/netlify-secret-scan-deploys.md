---
name: netlify-secret-scan-deploys
topic: Infra
task: diagnose why the OS is running old code, and fix a failing Netlify secret scan
keywords: [build credits, build minutes, out of credits, deploy did not run, stale deploy, git and live site disagree, CACHE_VERSION check, netlify, deploy failed, exposed secrets detected, SECRETS_SCAN_OMIT_KEYS, META_APP_ID, stale OS, old code, build failed, PWA cache, service worker]
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

**✅ DECIDED 2026-08-14 (Bryson: "lets keep them") — the ids STAY in the KB and docs.** Every Meta problem in this project has turned on *which id is which* (app dataset vs personal web pixel vs portfolio dataset vs ad account), and prose like "the app-scoped one" is far weaker than the number when debugging months later. **A future session must NOT strip platform ids to satisfy the "no env-var values in the repo" rule in CLAUDE.md** — that rule now carries this exception explicitly. Identifiers stay; credentials (tokens, secrets, service-role keys) are still never committed. If the scanner flags another identifier, add its KEY to `SECRETS_SCAN_OMIT_KEYS` rather than deleting the value.

**After a real deploy lands, the PWA still needs a hard refresh** (`Ctrl+Shift+R`). The installed app holds a cached shell, so closing and reopening the window is not enough. That is a genuinely separate problem from this one, and confusing the two is what makes this take an afternoon.

---

## 🔴 2026-08-20 — A SECOND WAY DEPLOYS SILENTLY STOP: BUILD CREDITS RAN OUT

Same symptom as the secret-scan failures above, completely different cause. **Git said merged,
the live site said otherwise**, and for about twenty minutes the OS ran the previous version
while I told Bryson a fix was live.

**How it surfaced.** He rebuilt a Meta campaign expecting the new `LANDING_PAGE_VIEWS`
performance goal and got `LINK_CLICKS` again. He pushed back — *"can you double check you
deployed the update"* — and he was right. `main` carried the change; the live
`service-worker.js` still read `v17`.

**Cause: the Netlify account was out of build credits, so the build never ran at all.** No red
failed deploy to find, because nothing was attempted. He bought more credits, forced a deploy,
and `v18` went live immediately.

### The rule this produced

**MERGING IS NOT DEPLOYING. Never report a fix as live off a successful `git push`.** Confirm it
against the running site:

```
curl -s https://boldlinemedia.netlify.app/service-worker.js | grep CACHE_VERSION
```

That is exactly why `CACHE_VERSION` is bumped on every deploy — it is the cheapest possible
proof that the code Bryson is using is the code that was written. A one-line curl closes the
gap between "I pushed it" and "it is running", and both known failure modes (exposed-secret
build failure, exhausted build credits) look identical until you run it.

**Ordering matters for anything Bryson then acts on.** He deleted and rebuilt a live campaign
against code that had not shipped, wasting the rebuild. When a fix changes what a build
produces, verify the deploy is live BEFORE telling him to use it.

**If the site is stale, the two causes so far:**
1. **Build failed** — red deploy in the Netlify dashboard; usually the secret scanner (above).
2. **Build never ran** — no new deploy row at all; check billing for build credits.
