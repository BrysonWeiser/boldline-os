# BoldLine OS — Project Context for Claude

> Read this first every session. It is the durable memory across sessions —
> nothing from past chats persists except what is written here and in the repo.
> Detailed, per-topic memory now lives in the **task-keyed knowledge base** under
> `knowledge/` — it surfaces automatically (recall hook) when a prompt matches, so
> don't bulk-read it. When we finish a unit of work, capture it as a KB entry
> (see "Record to the knowledge base" below) so we never redo work or forget a decision.

## What this is
BoldLine OS is the internal operations platform for **BoldLine Media**, a digital
marketing agency (Google Ads management + custom landing pages for businesses of
any size). Static front end (`index.html`) + Netlify serverless functions
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
- **PLAIN ENGLISH ALWAYS — he does not code (Bryson, 2026-08-17: "make sure when your
  telling me stuff its very simple because remember I dont know anything about coding
  databases or anything like that").** This governs every reply, not just setup steps.
  Do NOT name files, functions, variables, tables, commits, branches, or test counts
  unless he asks — those are noise to him. Say what CHANGED for him, WHERE he sees it,
  and WHAT he should do. One idea per sentence. If a technical detail genuinely matters
  (a risk, a cost, a thing he must decide), explain it with an everyday comparison, not
  the jargon term. Never assume he knows what a database, deploy, cache, API, repo, or
  test suite is. Keep answers SHORT — a wall of text is its own kind of unclear. The
  full technical record belongs in `knowledge/` and `docs/DEPLOYS.md`, which is exactly
  what they are for; his replies do not need it.
- **Record to the knowledge base AUTOMATICALLY — Bryson must never have to ask whether
  I saved it.** The moment anything worth remembering happens (a finished unit of work,
  a decision, a status change, a gotcha + its fix, a credential/env-var NAME, a stated
  preference), immediately add or update a task-keyed entry `knowledge/<slug>.md`, run
  `node knowledge/build-index.cjs` (regenerates the recall index + the slim
  `docs/INTEGRATIONS.md`), then commit + push. Do NOT wait to be told. Say so visibly
  ("✅ KB updated: <slug>") so he sees it without checking. Entry format + rules are in
  `knowledge/_README.md`. Two hooks back this up: a **PreCompact hook**
  (`.claude/settings.json`) forces a KB flush before context is ever compacted/lost, and
  a **UserPromptSubmit hook** (`knowledge/recall.cjs`) surfaces relevant entries at the
  start of each task so we don't rediscover what we already solved.
- **Responsive at every breakpoint — standing rule for ALL surfaces (Bryson, 2026-07-17).**
  Everything we ship — OS app, client portal, marketing site, emails where possible, and any
  future surface — must look intentional at **phone (~390px), tablet (~768px), laptop
  (~1280px), and desktop (~1600px+)**: no horizontal scrolling, no content crammed into a
  narrow column on big screens, no oversized empty gutters, nothing cut off or "missing".
  Before merging any UI change, verify it headlessly at those four widths (Playwright recipe
  + current coverage map in KB `responsive-standards`). Cards/sections that share a container
  should share a width — no mixed-width stacks.
- **No emojis in anything a CLIENT sees — standing rule (Bryson, 2026-08-03).** Emojis read
  unprofessional. Keep every client-facing surface emoji-free: all client/lead/subscriber emails,
  the AI performance reports, the client portal, the marketing site, and any future client-facing
  copy. Functional monochrome UI glyphs (✓ ✕ ▶ → carets) are fine — they're not emojis.
  Internal-only surfaces Bryson alone sees (OS UI icons, owner alert severity emojis) are exempt.
  Details + what was stripped in KB `client-email-center`.
- **Nothing may read as AI-written — standing rule for ALL copy (Bryson, 2026-08-14).**
  The tell he named is the **em dash**: never use `—` or `–` in ad copy, creatives, emails,
  the marketing site, landing pages, blog/newsletter, or AI-generated content. Write two
  sentences or use a comma. Also avoid the rest of the giveaways: "it's not just X, it's Y",
  "in today's world", "let's dive in", unlock/elevate/leverage/seamless/robust/game-changer,
  rule-of-three lists where two would do, every line opening on a rhetorical question, and
  uniform sentence length. Use contractions; write how he'd say it out loud. **Enforced, not
  just remembered:** `humanizeAdCopy()` in `index.html` rewrites any dash out of every ad
  field at submit time, and the Content Studio prompt bans them explicitly (the prompt itself
  is written without them, because a model mirrors the style it's given). Exempt: internal
  campaign names, OS UI labels Bryson alone sees, and code comments. Details in KB `ad-copy-voice`.
- **Never say "local businesses" — he serves businesses nationally/remotely (standing).**
  Applies to all public copy. See KB `linkedin-brand-presence`.
- **ARIZONA TIME IS THE ONLY CLOCK — check it, never assume it (Bryson, 2026-08-31: "do you
  know what time I am, always look at what time and day it is in Arizona unless I say
  otherwise").** Bryson is in **Phoenix, MST, UTC-7, and Arizona never observes daylight
  saving**, so the offset is 7 hours year round with no seasonal exception to remember.
  🔴 **THE SESSION CLOCK IS UTC AND IS ALREADY A DAY AHEAD OF HIM EVERY EVENING** (after 5pm
  his time), which has now caused two real errors: a reminder set for 10pm that fired at 5pm,
  and an email to a client's developer that said the contract was signed Friday when it was
  Sunday. So **run `TZ=America/Phoenix date` before writing ANY time, day name, date, or
  relative day ("today", "tomorrow", "yesterday", "this week")** — in replies to him, in
  scheduled reminders, and above all in anything a client or partner will read. When creating
  a Routine or trigger, convert Phoenix to UTC for the cron and then convert the result BACK
  to confirm it lands where intended. Details + both incidents in KB `arizona-time`.
- **A PREVIEW MUST NEVER CHANGE ANYTHING REAL — standing rule (Bryson, 2026-09-01: "make sure
  to always check that things like that dont happen with future clients or anything we build").**
  Anything the OS renders so Bryson can LOOK at it (an iframe preview, a demo, a test send, a
  dry run) must be incapable of writing to a client's record, sending to a real person, spending
  money, or navigating the OS away from itself. This breaks easily because every preview hands a
  REAL client object with REAL tokens to the SAME renderer that serves the real thing: same
  origin, same token, same code. Two live bugs of this shape were found in one sitting, one of
  which recorded a client decision the client never made. **Enforced, not remembered:**
  `tests/verify-preview-safety.mjs` holds a manifest of every embed and what makes each one safe,
  so a new preview added without a guard FAILS. Add the row when you add the preview. Details in
  KB `preview-safety`.
- **Confirm before irreversible or outward-facing actions.**
- **Default to the cheaper model; flag when a task needs Opus (Bryson, 2026-07-02).**
  Bryson runs on **Sonnet** by default to control credit usage. Before ATTEMPTING a
  genuinely Opus-worthy task (hard multi-file debugging, architecture, subtle logic),
  say so first and let him switch (`/model`) — don't silently do hard work on the wrong
  tier. Also work **lean**: concise replies; no preview screenshots or heavy verification
  unless the task needs it or he asks; batch changes instead of many tiny round-trips;
  prefer a fresh session per new topic (this file + the KB carry continuity). Note:
  `/fast` does NOT save credits (still Opus, just faster output).

## STANDING TRIGGER — revert the site's "coming soon" state the moment Meta is approved
Bryson asked for this to be **automatic**, so treat it as a standing instruction, not a
to-do: **the instant it becomes known that Meta has granted Marketing API standard access**
(he says so, an approval email arrives, or a non-internal client's Meta account starts
reading successfully in `ads-sync`), **immediately revert the marketing site's coming-soon
state and deploy** — do not wait to be asked, and do not ask permission first.

- **WORK FROM `docs/META-FLIP-CHECKLIST.md`, NOT from the old revert.** `git revert a4b83f0`
  is no longer sufficient on its own: anything added to the site AFTER that commit is
  invisible to it (the Full System: Acquisition card already proved this — its waitlist
  button would survive the revert). The **`CS:META-SOON` sentinels are the source of truth**,
  and the checklist lists every one of them with what it becomes. Use `git show a4b83f0` only
  as a reference for the original wording of the blocks that predate it. Then merge to `main`
  as usual (rollback branch first, log in `docs/DEPLOYS.md`).
- **`node tests/verify-meta-flip.mjs` polices this.** While the site is gated it fails if any
  sentinel is missing from the checklist, or the checklist names one that no longer exists, or
  a waitlist button carries no marker, or a Google card ever gets gated. After the flip it
  switches expectations and asserts all 12 packages book and no marker survives. **So any new
  gated site change is automatically recorded** (Bryson, 2026-08-17: *"make sure from now on any
  updates we do to the website are saved for when we flip the website back to normal"*).
- Then tell Bryson it's reverted, and update KB `meta-marketing-api` + `site-coming-soon`.
- A weekly Routine also checks in about this (trigger `trig_012hH9VLXchaMj7LUc461Wrb`,
  Mondays 09:00 Phoenix — see KB `site-coming-soon`) — but the Routine is the backstop. If you learn Meta is live in ANY
  session, revert there and then.
- **Then RAISE (do not silently build) the work parked behind Meta approval** — Meta creative
  split testing and the conditions-triggered Meta refresh. Full list, why each is blocked, and
  what each is worth in KB **`meta-parked-work`** (Bryson, 2026-08-17: *"mark the meta thing for
  later once meta is approved"*). The site revert is automatic; these are features, so surface
  them with a recommended order and let him choose.

## Hard business constraint (do NOT violate)
**The client pays for everything. BoldLine never fronts, holds, or is financially
exposed for client ad spend** — "it gets too risky and messy." Each client's ad
account stays owned and billed by the client; BoldLine only ever holds
manager-level access. This governs all billing / ad-account / Stripe / Meta work.

## Git discipline
- **Auto-merge & deploy (Bryson, 2026-06-29 — overrides the old "never merge without
  permission" rule):** develop on `claude/zen-babbage-1wtcv3`; after each completed unit
  of work (committed + pushed), **automatically merge it into `main`** — `main` is what
  Netlify deploys to production. No need to ask first.
- **Always save a rollback point before merging.** This remote (the Claude-Code git
  proxy) **blocks tag pushes and branch deletions**, so the restore point is a **pushed
  branch**, not a tag: before every merge, create `rollback/<UTCtimestamp>` at the
  current `main` HEAD and push it, then `git merge --no-ff` the dev branch into `main`
  and push. These `rollback/*` branches accumulate on purpose — each is a saved
  pre-deploy snapshot (exactly what Bryson asked for). **After each merge, report the
  rollback branch + pre-merge SHA, and log that SHA in `docs/DEPLOYS.md`.** Rollback
  paths (Netlify one-click deploy history, or `git revert -m 1 <merge>` / reset to the
  `rollback/*` branch) live in `docs/DEPLOYS.md`. Keep working on the same dev branch
  after merging (it goes ahead of `main` again for the next unit of work).
- `git push -u origin <branch>`; retry 4× exponential backoff (2s/4s/8s/16s) only
  on network errors.
- Never open a PR unless explicitly asked. Never use `--no-verify` or bypass hooks.
- **Never commit secrets.** Credential values live only in Netlify env vars, never
  in the repo (not even in docs). NOTE: Netlify's secret scanner fails the build if
  the value of ANY env var (even a non-secret one like a base URL or account ID)
  appears in a committed file. So keep *all* env-var values out of code/docs — refer
  to them by name only. If a non-secret value genuinely must appear as a code default,
  add its key to `SECRETS_SCAN_OMIT_KEYS` in netlify.toml.
- **PUBLIC PLATFORM IDs ARE THE DOCUMENTED EXCEPTION (Bryson decided 2026-08-14: "lets
  keep them").** Meta app / dataset / pixel / ad-account ids and Google Ads customer ids
  are **identifiers, not credentials** — Meta ships its app id in every client-side SDK
  snippet. They stay written out in `knowledge/` and `docs/` on purpose, because every
  Meta problem in this project has turned on *which id is which*, and "the app-scoped
  one" is far weaker than the number when debugging months later. **Do NOT strip them
  to satisfy the rule above.** If Netlify's scanner flags one, add that KEY to
  `SECRETS_SCAN_OMIT_KEYS` (as `META_APP_ID` already is) rather than deleting the value.
  Real credentials — tokens, secrets, service-role keys — are still never committed.
  Diagnosis runbook in KB `netlify-secret-scan-deploys`.

## Detailed state
Per-platform setup status, env-var names, decisions, gotchas, and pending items live in the
**task-keyed knowledge base** under **`knowledge/`** (one entry per topic). Two ways in:
- Let the **recall hook** surface the relevant entry automatically when you start a task, or
- Browse the generated index at **`docs/INTEGRATIONS.md`** (auto-built; slim TOC) and open the
  one entry you need. **Don't** bulk-read the whole thing — that's the habit this replaced.
Add/refresh entries as work completes (see the "Record to the knowledge base" rule above and
`knowledge/_README.md`).
