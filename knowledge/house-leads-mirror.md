---
name: house-leads-mirror
topic: Forms/Leads
task: work out why BoldLine's own My Ads account shows no leads, no cost per lead or no live ad numbers, or change how website leads reach the house account
keywords: [house account, leadSync, heartbeat, lead count test, ads-sync hourly, sync stale, zero leads or broken, my ads, internal client, website_leads, leadsLog, house-leads, mirror, leads 0, avg cpl, cost per lead, ad health score, adPerf, ads-sync, live ad performance, acquisition roi, leads arriving, house-leads-merge, delete lead, lead comes back, deleted lead reappears, tombstone, calendly re-insert, newsletter subscribers as leads, website_leads RLS insert]
status: verified
summary: BoldLine's own ads send people to /get-started, whose leads land in the `website_leads` table, but the house account keeps leads on the client record in `leadsLog`. Nothing joined them, so the My Ads overview read `leads: 0` forever and five separate things derived from that number were wrong with it. A 15-minute `house-leads` job now mirrors website leads onto the internal client (deduped on the row id, status synced one way until he moves it by hand), and the Overview gained a Live Ad Performance card that renders the ads-sync snapshot instead of hiding it on the Campaigns tab.
verified: 2026-08-22
---

## What he saw

Bryson, 2026-08-21, with his first Meta ad live and serving 284 impressions, looking at the
My Ads overview: *"also something i noticed just now is that the os isnt taking the data from
the live ad"*. The screen showed **LEADS 0**, **AVG CPL —**, an Ad Health Score of 5.8/10 with
*"Leads arriving — No leads yet"*, and no spend, views or clicks anywhere on it. He had, the
day before, watched a real Calendly booking arrive on the OS Leads screen.

He was right, and it was two separate gaps that happened to look like one.

## Gap 1 — the lead count could never move

BoldLine's ads point at **`/get-started` on the marketing site**. Everything that lands there
(contact form, the fit quiz, and since 2026-08-20 a booked Calendly call) is written to the
**`website_leads` table**, which feeds the OS's **global Leads screen**.

The **house account** — the client record flagged `internal: true`, named "BoldLine Media" —
keeps its leads **on the record itself, in `leadsLog`**, exactly like a paying client does.
A real client's leads get there through `/lead?token=…` → `appendLead()`.

**Nothing ever joined the two.** Not a bug in either half; a seam between them. So the house
account read `leads: 0` permanently, and everything downstream was wrong with it:

| Reader | What it showed |
|---|---|
| Overview "Leads" tile | `0`, while real leads sat in the OS |
| Overview "Avg CPL" | `—` forever, because the divisor was always zero |
| Ad Health Score | docked 2 of 10 for "No leads yet" |
| Pipeline, Lead Quality Analyst | stuck on "waiting" forever |
| Acquisition ROI funnel (Campaigns tab) | nothing to draw |

🔴 **Why mirror the data rather than fix the screen.** Each of those is a different reader, and
two of them run server-side with no access to the browser. Deriving the count in the UI would
have fixed one tile and left the rest wrong. One write fixes all five.

Worth noting: the house Leads tab was always **built** for these leads. It has a five-stage
pipeline with "Meeting Booked" and a book-a-call outreach tool that a client's leads tab does
not. It had simply never been fed.

## Gap 2 — the live ad numbers were only ever on one tab

`ads-sync` has pulled live spend, impressions, clicks and conversions from Google and Meta
every 6 hours for a while, storing them on the client record at **`data.adPerf`**. But the only
things that rendered it were the **Campaigns tab** (`MyAdsInsights`, `LiveCampaignsCard`) and,
indirectly, the health score's pacing row. The **Overview** — the first screen he opens — showed
none of it. From where he was standing, the OS genuinely was not taking the data.

## What was built

**`netlify/functions/house-leads.mjs`**, scheduled `*/15 * * * *`. Reads `website_leads`
(read-only), finds the one client with `data->>internal = 'true'`, and merges. Three rules,
each load-bearing:

1. **Dedupe on the website lead's row id**, stored as `websiteLeadId` on the mirrored entry.
   This runs 96 times a day over the whole table; a weak dedupe multiplies every lead by 96.
2. **Status syncs one way, and only while he has not touched it.** The entry remembers the
   status it was last given (`mirroredStatus`). If the house copy still matches, the website
   lead's status wins. The moment he moves it by hand in the house Leads tab the two differ
   and the job stops overwriting him. Without this, marking a lead "Meeting Booked" there
   would silently revert within fifteen minutes.
3. **Pruning only on a complete read.** He deletes test leads from the Leads screen and the
   mirrored copies should follow, but a run whose page came back *full* has not seen the whole
   table, so it prunes nothing. Deleting a lead for falling off a page boundary is data loss.

Hand-entered leads and leads posted to the client lead webhook carry no `websiteLeadId` and are
never touched.

**`netlify/lib/house-leads-merge.mjs`** holds the pure merge, deliberately outside the function
file — see the testing note below.

**UI (`index.html`)**:
- `adPerfStats(cl)` reads the stored `adPerf` snapshot plus `leadsLog` and returns views,
  clicks, CTR, 30-day spend, 30-day leads and a **computed** cost per lead (`spend30 / leads30`,
  null unless both exist). `cpl` on the record is now only a fallback for clients.
- A **Live Ad Performance** card on the Overview, showing those numbers with "Updated N hours
  ago", an honest empty state, a note when nobody has seen the ad in 30 days, and a **"These
  numbers are stale"** panel naming the platform whenever a linked account failed to read.
  That last one matters: a failed read previously looked identical to a zero.
- Health score and pipeline now count `leadsLog.length` rather than the cached `leads` number,
  which only the lead webhook ever incremented.
- **Parity:** the card renders for any client with a linked ad account, not just the house one.

## 🔴 Testing note worth not relearning

`tests/verify-house-leads.mjs` (49 checks) at first **re-implemented** the merge, because the
function imports Supabase at module load and cannot be imported without credentials, and pinned
the original with regexes over the source. Breaking the guards per KB `repo-tests` showed **two
of them did not bite**: deleting the hand-set-status guard and renaming the dedupe key both left
the suite fully green. The copy in the test was still correct, and the pins (`/mirroredStatus/`,
`/websiteLeadId/`) matched unrelated lines nearby.

The fix was structural: move the pure logic into `netlify/lib/house-leads-merge.mjs` with no I/O
and no imports, and have the test run the real thing. Regex pins now cover only the wiring the
merge cannot see (which row is written, that `website_leads` is never written, the schedule).
Every guard has since been broken individually and confirmed to fail.

A related trap in the same suite: the first prune-gate test passed a "full page" that was not
actually missing anything, so it could not fail. It now seeds six leads and reads a five-row
page, and asserts both directions (full page prunes nothing; a page with room prunes the one
that is genuinely gone).

## Timing, so nothing looks broken again

- **Leads** appear on the house account within **15 minutes** of arriving.
- **Spend, views and clicks** refresh **every 6 hours** (`ads-sync`). The card says how old the
  snapshot is. For live-to-the-second numbers, the **Campaigns tab** calls Google and Meta
  directly on open.

## Follow-up, same day: "the delete doesn't work"

Within minutes of the mirror going live Bryson deleted his test leads and reported:
*"every time I reload the app they are still there so the delete doesnt work"*. Two
separate defects, one of them mine from an hour earlier.

### 🔴 A Calendly lead is RE-DERIVED, so deleting the row cannot remove it

`calendly-leads` runs every 15 minutes over a 14-day window and, for each booking Calendly
returns, asks *"is there already a lead carrying this event id?"*. **Deleting the row
answered no**, so the next run created it again. **The delete worked perfectly every single
time** and the lead was rebuilt within the quarter hour, which is indistinguishable from a
delete that never fired. A website form submission cannot come back this way — it is pushed
once and never re-read — which is why only bookings behaved like this.

This is the general hazard with any poller that re-derives records from an external source:
**deletion is not a durable action unless something remembers the deletion**.

**The fix is a tombstone, and it is the row itself.** Deleting a Calendly lead now clears
every personal field (`name`, `email`, `business`, `recommended`, `notes`) and re-files the
row as `form: "deleted"`, keeping nothing but the opaque `calendlyEventUri`. It disappears
from the Leads screen and from the house account (both filter that form), and the sync's
existing lookup finds the id and skips the booking permanently — **no change to the sync**,
because its dedupe queries the whole table without filtering on form. A non-Calendly lead is
still hard-deleted.

**🔴 WHY NOT A SEPARATE TOMBSTONE ROW — this is the part worth remembering.** The obvious
design is to insert a small marker row. It would have been **refused every time**:
`website_leads` RLS grants the signed-in app **SELECT, UPDATE and DELETE but NOT INSERT**
(only the marketing site's service-role key inserts, bypassing RLS). An update is allowed,
and re-using the row is better anyway — it removes the person's details rather than keeping
a second copy of them. **Before designing anything that writes to `website_leads` from the
browser, check which verbs that table's policies actually grant.**

### 🔴 Newsletter subscribers were being mirrored as leads (mine, one hour old)

The first version of the mirror selected **every** row in `website_leads`. That table also
holds the **durable backup of the Resend subscriber list** (`form: "newsletter"`), which the
Leads screen has always filtered out and the mirror did not. So every subscriber was landing
on the house account as a lead, **inflating both the lead count and the cost-per-lead that is
divided by it** — a wrong number presented as a real one, which is worse than the zero it
replaced. `isLeadRow()` now filters newsletter rows and tombstones.

A **denylist, not an allowlist**: real enquiry rows are named after whichever Netlify form
they came from, so a form added later must arrive as a lead by default rather than silently
vanish. Subscribers mirrored before the filter existed are pruned automatically on the next
run, since they are no longer in the incoming set.

**One ordering detail that is load-bearing:** the prune gate measures the **raw** page length,
before filtering. Filtering first would make a page that came back *full* look short, which
would re-enable pruning on an incomplete read — exactly the data loss the gate exists to
prevent. There is a test for that specific ordering.

### A refused write no longer hides

Both the lead save and the lead delete previously reported failure to the browser console
only, and the screen carried on as though it had worked. They now surface a plain message on
the Leads screen, and a refused delete **reloads the list** so what is shown matches what is
actually stored. That also means if the delete ever is genuinely refused, he will be told
rather than left guessing.

**73 checks in `verify-house-leads.mjs`, seven more deliberate breaks confirmed to fail.**

## Follow-up 2026-08-24: hourly ad numbers, and a heartbeat on the lead count

Bryson: *"can you make it so the ads performance metrics in the os updated accurately every
hour or two instead of 6. I also want to make sure the actual lead count works (i havent
gotten any yet but i still want to test that itll work)."*

**`ads-sync` is now HOURLY** (was every 6 hours). Comfortably inside both platforms' limits
at this volume: two reads per linked account per run, 48 calls a day for one account against
limits in the thousands. It also **helps the Meta Marketing API tier request**, which was
rejected for *"not a sufficient number of Ads API calls in the last 15 days"* — four times
the traffic is four times the evidence (KB `meta-marketing-api`).

Recorded so nobody tries to make it faster: **the platforms do not update minute by minute
themselves.** Meta's insights lag real delivery by up to a few hours and Google's can too.
Polling harder than hourly buys nothing but API calls. Hourly is where the OS stops being
the slow part.

### 🔴 The second half is the interesting one

He wants to verify the lead count works **while having no leads**. He cannot, and that is
precisely the state where a broken mirror is invisible: **the screen reads 0, which is also
the correct answer**, so nothing looks wrong. Exactly the shape of the `client.cpl` defect
and of the failed ad read that looked like a zero.

So `house-leads` now writes a **heartbeat** (`leadSync: { at, scanned, total }`), and every
screen that shows a lead count shows when the check last ran:

- healthy and zero → *"No leads yet, and the lead check is running normally. A new enquiry
  shows up here within 15 minutes."*
- gone quiet (no run in 3 hours) → an amber line saying so, because a lead could be missing.
- never run → says it has not reported in yet.

**It does not write 96 times a day to say nothing happened.** A quiet run with a heartbeat
under 55 minutes old writes nothing at all; only a change, or an hour of silence, touches
the record. That keeps the honesty without the noise.

**86 checks.** Three more deliberate breaks confirmed to fail. One existing assertion had to
be **updated rather than deleted** when the early-return gained the heartbeat condition:
its intent (a quiet run writes nothing) still holds, the expression it pinned had changed.

---

## 2026-09-02 — it refreshes live now, and the earlier diagnosis was wrong

**Bryson:** *"lets have the numbers update live"*, after reading the Netlify log himself.

### 🔴 What the log actually said

**No errors.** 96 clean runs a day, about a second each, all reporting
`5 website lead(s) scanned — 0 added, 0 status-synced, 0 pruned.`

And a **two-and-a-half hour hole** between 06:30 and 09:00 where Netlify simply **did not
start the job**. Nine runs missed. Scheduled functions on Netlify are best effort, so no
amount of hardening in our code prevents this. The "not run in 4 hours" warning was correct
and was pointing at Netlify, not at a bug.

### 🔴 THE CORRECTION THAT CHANGED WHAT WAS WORTH BUILDING

An earlier reply told him leads *"sit in the website's inbox for a couple of hours"*.
**That was wrong.** Website leads reach the OS **immediately**: the Leads screen reads
`website_leads` directly on a realtime subscription, refreshed every 20 seconds.

What lags is only the **house account's copy** in `leadsLog`, which feeds:
the My Ads lead tile, cost per lead, the ad health score, the pipeline stage.

**So this makes a dashboard current. It does not make leads arrive sooner.** He had chosen
the build on the strength of a false claim, so it was put back to him with the accurate
picture before anything was written. The on-screen copy said the same false thing and now
states plainly that the leads themselves are safe on the Leads screen.

### What was built

- The merge moved to `netlify/lib/house-leads-run.mjs`. **One implementation**, called by
  both the scheduled job and the new endpoint. A check fails if `mergeHouseLeads(` is ever
  called from more than one place.
- `netlify/functions/house-leads-sync.mjs` — **owner-JWT authed**, POST only, no alerting of
  its own (the scheduled job alerts because nobody watches it; this runs while Bryson is
  looking at the screen, and a red banner for something he can fix by refreshing is noise).
- `ClientHub` subscribes to `website_leads` via the existing `useLiveData`, house account
  only, with a re-entrancy guard so a burst of leads cannot fire overlapping merges.

### 🔴 The build that was deliberately NOT done

A push from the marketing site's form handler. It crosses **two separate Netlify sites**,
needs a **shared secret in an env var** (a job he can only do at a computer, and he had just
made one such trip), and leaves an endpoint anyone can hammer. The OS is already logged in
and already subscribed to the table, so it can simply ask. Same freshness, no new secret,
nothing to configure.

### 🔴 It asks the SERVER, it does not count in the browser

Deriving the house lead count in the UI is far less work and is the trap `house-leads.mjs`
warns about in its own header: **five other readers, two of them server-side with no browser
to derive anything in**, would have kept the old figure. One write still fixes all of them.

### The no-write shortcut matters more now

`if (!changed && !staleBeat) return` was there to stop 96 pointless row writes a day. It now
also stops a My Ads screen left open from rewriting the client record on every realtime
nudge and every poll. The client row is re-read only when the mirror reports it wrote
(`beat !== false`).

### Testing note

97 checks, seven mutations, all caught.

🔴 **Ten existing checks read the scheduled function's source, and the code moved.** They
were **re-pointed at both files read as one body**, not narrowed. Scoping them to the
scheduled file would have silently retired ten real guards at the exact moment the code
moved out from under them.

🔴 **Two copy assertions now pin the RULE, not the sentence.** The wording had to change to
stop implying leads were late, and a phrase-match would have reported an accuracy fix as a
regression.
