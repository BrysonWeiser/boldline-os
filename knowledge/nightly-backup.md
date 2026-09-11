---
name: nightly-backup
topic: OS app
task: understand, change or restore from the nightly backup of the database
keywords: [backup, backups, nightly backup, backup-run, backup-shared, keep the last 5, restore, restore a backup, recover data, data loss, deleted a client, deleted leads, lost data, undo a delete, disaster recovery, 1am backup, morning backup email, backups bucket, snapshot, database backup, supabase backup, gzip snapshot, signed url, verifyAgainst, toPrune, countWarnings, table emptied overnight, is my data safe]
status: built
summary: Nothing was backing up the database. The OS and the marketing site are code and GitHub already keeps every version of them, so "back up the OS" was a job silently already done; the Supabase project holding every client, lead, campaign and contract was the half with no copy at all. `netlify/functions/backup-run.mjs` runs at 08:00 UTC (1:00am Phoenix) and copies 13 tables into a PRIVATE `backups` bucket as one gzipped JSON file named by day, downloads the file back and compares row counts before trusting it, then prunes to the newest 5. Emails OWNER_EMAIL every morning whether or not anything is wrong, with row counts, a comparison against yesterday (a table that shrank or emptied goes red and also fires dispatchAlert), and a 7-day signed download link. 96 checks, 28 mutations caught.
verified: 2026-09-11
---

**Bryson, 2026-09-11**: *"I want to start keeping a backup data base of everything we have (the
os, website, data base, etc.) I want to keep the last 5 and have you manage it but I also get an
email each morning. I want you to run this everyday at 1am. Send the email to <his gmail>."*

## 🔴 What actually had no backup

He asked for three things and two of them were already safe:

| Thing | Was it at risk? |
|---|---|
| The OS (`index.html`) | **No.** It is code. GitHub keeps every version forever. |
| The marketing site | **No.** Same. |
| **The database** | **YES.** One Supabase project held every client record, every lead, every campaign draft, every contract state, and there was no copy anywhere. A bad write, a wrong delete, or a lost project took all of it with nothing to go back to. |

The email says this split out loud rather than claiming to have copied three things when two of
them were never in danger. Pretending otherwise is how the real gap stays hidden.

## The pieces

- `netlify/lib/backup-shared.mjs` — the table list, the keep limit, the prune, the
  verification, the day-over-day comparison, and the email text. All pure, all tested.
- `netlify/functions/backup-run.mjs` — the job. Scheduled `0 8 * * *` in `netlify.toml`.
- `tests/verify-backup.mjs` — 96 checks.

## Design decisions worth not re-litigating

**The bucket is PRIVATE (`public: false`).** The other two buckets in this project
(`page-archives`, `media`) are created public because they hold images meant to be looked at.
This file is every client's contact details and lead list in one document. Copying that flag
here would publish the customer database on a guessable URL. The suite asserts `public: false`,
asserts `getPublicUrl` never appears in the file, and asserts the download link is a
`createSignedUrl` that expires in 7 days.

**Named by DAY, uploaded with `upsert: true`.** A second run on the same date replaces that
day's file instead of eating one of the five slots, so re-running by hand can never cost
history. "The last 5" therefore means five days.

**The file is downloaded again and unpacked before anything is deleted** (`verifyAgainst`).
The classic way a backup job lies is by succeeding for months while writing a file that is
truncated, empty or unreadable, discovered on the one morning it is needed. `if (verified)`
guards the prune: a job that has stopped working must not spend its failing runs deleting the
last good copies it made while it still worked.

**The keep limit can never resolve to zero.** `toPrune` falls back to 5 on anything that is not
a sane number. keep=0 meaning "delete every copy" is the one bug there is no recovering from.

**It emails every morning, working or not.** A backup that only speaks when it breaks is
indistinguishable from a backup that has itself died, and that is precisely the state you
cannot afford to be in about backups. The suite asserts the send is gated on whether email is
*configured* and on nothing else.

**Row counts are compared with yesterday** (`countWarnings`). A table that shrank is a note; a
table that lost a quarter or more, or emptied entirely, is red and also goes down
`dispatchAlert` (SMS + push), because "every client disappeared overnight" is not a thing to
find in an inbox at leisure. Capped log tables are excluded from the comparison, since their
row count is the cap and not the truth.

**🔴 EVERY TABLE THE CODE TOUCHES MUST BE IN `BACKUP_TABLES`.** The suite walks `netlify/`,
collects every `.from("table")` and fails if one is missing from the list — and also fails if
the list names a table the code no longer uses. **So adding a table next month and forgetting
to back it up is caught by CI rather than on the morning somebody needs it back.**

**The three append-only logs are capped** (`scout_runs` 200, `login_events` 500,
`health_checks` 500, newest first). They grow forever and are the least valuable rows here. A
capped table is recorded as truncated in the manifest and said out loud. `clients` and
`website_leads` are never capped and the suite asserts that.

**Storage buckets are inventoried, not copied.** `page-archives`, `media` and `stock-photos`
hold files. The backup records what existed and where, which is what tells you later what is
missing; five copies of the same megabytes every night buys nothing.

**It times itself and warns at 20 seconds.** Netlify kills a scheduled function at 30. Today
this handles a few clients in a second or two; the run that first goes over the line just stops
mid-copy with no file. The duration is in every email so that gets noticed with room to fix it.

## How to restore

There is deliberately **no restore button**. Restoring is rare, destructive, and belongs in a
conversation, not behind a tap.

1. Open the download link from that morning's email (works 7 days), or get the file from the
   Supabase dashboard: Storage → `backups` → the dated file.
2. It is a gzipped JSON file: `{ manifest, data, bucketFiles }`. `data` is keyed by table name,
   each holding the full rows exactly as they were read.
3. `manifest.commit` records which version of the OS that data belongs with. Restoring rows into
   a different version of the app is how a "successful" restore produces a broken system.
4. Write the rows back with the service-role key. **Restore only the table that was damaged**,
   never all thirteen.

## Environment

No new variables. Uses `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REPORTS_FROM_EMAIL` and
`OWNER_EMAIL` (all already set). `BACKUP_EMAIL` is an optional override if the backup mail
should ever go somewhere other than the owner alert address. The address itself is never
written into the repo: `OWNER_EMAIL` is in `SECRETS_SCAN_OMIT_KEYS`, but committing an env
var's value is the habit that fails Netlify builds (KB `netlify-secret-scan`).

## First run

Scheduled functions cannot be poked over HTTP in production (Netlify answers 403), so there is
no manual trigger. The first run is 1:00am Phoenix and the email arriving is the proof.
A crash instead sends an alert through `withFailureAlert`.
