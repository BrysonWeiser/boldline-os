---
name: lead-leak-delivery
topic: Forms/Leads
task: make sure the free Lead-Leak Check report actually reaches the prospect, and find out when it does not
keywords: [lead leak check, free audit not sent, AUDIT_TRIGGER_SECRET, lead-leak-sweep, auditLead, auditStatus, auditTries, audit never ran, silent failure, free report, lead_leak, scheduled safety net]
status: verified
summary: The free Lead-Leak Check's ONLY trigger was a cross-site POST gated on `AUDIT_TRIGGER_SECRET` set by hand on BOTH Netlify sites. It was not set, so no request was ever made and a real prospect asked for a free report and received nothing, in total silence, with not even an error row to find. New `lead-leak-sweep.mjs` runs every 10 minutes INSIDE the OS, where no shared secret can be missing, and sends anything the trigger missed using the SAME `auditLead` function (lifted out of the background handler, not copied). Three attempts then a red owner alert naming the prospect. The lead card now says whether the report was sent, is pending, or failed. 🔴 A lead moved off "new" is skipped, so a prospect Bryson has already answered by hand is never sent a canned report on top. 18 checks, 10 mutations caught.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04):** *"can we fix it so the lead thing automatically sends like it's supposed to"*, after a Scottsdale roofing company asked for the free Lead-Leak Check at about 1:20pm and, an hour later, had received nothing.

## 🔴 What failed, and why nothing noticed

The bot's **only** trigger was a POST from the **marketing** site (`audit.mjs`) to the **OS** site (`lead-leak-audit-background.mjs`), gated on `AUDIT_TRIGGER_SECRET` being set **identically on two separate Netlify sites**:

```js
if (leadId && process.env.AUDIT_TRIGGER_SECRET) { ...fetch(OS)... }
```

It was not set. So the gate was simply false. **No request was made, the OS never heard about the lead, and nothing was written anywhere**: no error, no failed status, no log line. The lead record carried **no audit stamp of any kind**, which is the only reason it was possible to work out afterwards what had happened (a run that *failed* would have left `auditStatus: "error"`; a run that *started* would have left `"running"`).

> 🔴 **A feature whose only trigger is a cross-site call gated on a hand-copied secret is a feature that is off by default, and it cannot report its own absence, because the code that would do the reporting is the code that never runs.** Setting the env var fixes today and leaves the trap for the next thing built this way.

## The fix: the trigger no longer has to work

**`netlify/functions/lead-leak-sweep.mjs`**, every 10 minutes (`netlify.toml`). It runs inside the OS, where the database credentials already exist and **there is no shared secret to be missing**. It finds recent `lead_leak` requests that have not been sent and sends them.

**One implementation, not two.** The audit body was lifted out of the background handler into an exported `auditLead(supabase, {leadId, website, email, name})`; the POST path now calls it too. The instant path is kept, so with the secret set the report still goes out in about a minute. This turns **never** into **within ten minutes**.

### `needsAudit(row, now)` — the guards, and why each exists

| Guard | Why |
|---|---|
| `form === "lead_leak"` | a contact-form lead must never be sent a website audit |
| created within 24h | re-emailing a stranger about a check they asked for a fortnight ago is worse than not sending |
| age `>= 0` | a row dated in the future is not due |
| 🔴 **status is still "new"** | **the first thing this sweep would have done on the day it shipped is email an automated report to the prospect Bryson had answered by hand an hour earlier.** Moving a lead off "new" is him saying he has it, and it is one tap on the card |
| not `sent` / `review_sent` | never email the same stranger twice |
| `auditedAt` fresher than 20 min | that is another run's claim; a background function cannot live past 15 min, so an older claim is a crash and IS retried |
| `auditTries < 3` | an unfunded AI account will never succeed, and retrying every 10 minutes forever would bury the real failure in noise |

🔴 **The try count survives the error path** (`auditTries: tries` is written alongside `auditStatus: "error"`). Reset it there and the cap can never be reached, so it retries forever and the alert never fires.

## 🔴 And when it genuinely cannot send, it says so

Three failed attempts raises a **red** owner alert naming the prospect, their site, and the reason, and saying plainly that they have received nothing and are still a real lead. The failure mode being replaced is silence. `withFailureAlert` wraps the sweep itself, or the safety net could die quietly, which is the original bug one level up.

## On the lead card

A `lead_leak` lead now shows one line: sent automatically (green) · written and waiting for your review (gold) · writing it now · **could not be sent, they are still waiting** (red, with the reason) · **has not gone out yet, it sends on its own within ten minutes** (amber). Working this out on the day required reading the raw record and knowing which stamp to look for.

## 🔴 "I sent it myself" (added the same day)

Bryson, after writing to the prospect by hand: *"Make sure for this lead it knows I sent the report"*. The card went on saying the report had not gone out, with no way to tell it otherwise.

A button on the card writes `auditStatus: "sent_by_hand"`, and the sweep treats that exactly like a real send.

🔴 **This is the durable half, and the status check is the weak one.** Skipping leads that are off "new" stops the robot today, but a sales stage records what *he* is doing about a lead, not what the *prospect received*. Move the lead back to New to work it again and the status guard reopens, and a stranger gets a second report they never asked for once. The stamp does not reopen.

🔴 **The write re-reads the row first.** The whole payload goes back in one piece, so writing the copy the screen loaded minutes ago could erase a "sent" stamp the sweep wrote in between, and erasing "sent" is precisely how a prospect gets emailed twice. Same rule as the CRM retry queue. It also refuses to overwrite a genuine `sent`/`review_sent` with a guess.

## Still outstanding (Bryson's, on a computer)
Both are in the 10pm Netlify reminder for 2026-09-04:
1. `AUDIT_TRIGGER_SECRET` set to the **same** value on both sites (`boldline-media` WITH the hyphen = marketing, `boldlinemedia` NO hyphen = OS). Only buys instant instead of ten minutes now, so it is no longer urgent.
2. **Funding the Anthropic API account** at console.anthropic.com Billing, which is a **separate wallet from his Claude subscription**. Without it the sweep will now fail three times and alert, rather than failing silently.

## Files
- `netlify/functions/lead-leak-sweep.mjs` (new), `netlify.toml` schedule.
- `netlify/functions/lead-leak-audit-background.mjs` — `auditLead` exported; try count kept on error.
- `index.html` — the report-status line on the lead card.
- `tests/verify-lead-leak-delivery.mjs` (new).
