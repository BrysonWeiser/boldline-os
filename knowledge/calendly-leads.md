---
name: calendly-leads
topic: Leads
task: understand why a Calendly booking does or does not appear on the OS Leads screen, or change how booked calls are imported
keywords: [calendly, booked call, book a call, calendly lead, calendly-leads, CALENDLY_API_TOKEN, website_leads, scheduled_events, invitees, questions_and_answers, dedupe, calendlyEventUri, booking questions, reschedule url]
status: built-unverified-live
summary: A Calendly booking now creates a lead in the OS. Before this, "Book a Call" — the PRIMARY button on /get-started — produced a calendar entry and nothing else, so the better the prospect the less likely they existed in the OS. A scheduled poller reads Calendly every 15 minutes and writes each new booking to `website_leads`, deduped on the Calendly event id, carrying the invitee's answers, starting at status "meeting", and keeping the reschedule and cancel links. Needs CALENDLY_API_TOKEN, the same token the OS Calendar already uses.
verified: 2026-08-20
---

**Bryson, 2026-08-20:** *"I booked a call through the landing page and I didnt get an email
and it didnt say there was a lead ... When I fill out the leave your details which is not the
noticable button compared to book a call the lead gen works."*

(The email turned out to be fine, he had it. The missing lead was real.)

## 🔴 Why this mattered more than it looked

The landing page has two calls to action, and they were not equal:

| | Route | Ended up in the OS |
|---|---|---|
| **Book a Call** (the big, primary button) | Calendly | **No** |
| Leave your details (the fallback form) | Netlify → `submission-created` → `website_leads` | Yes |

So **the better the prospect, the less likely they were to exist anywhere in the OS.** Someone
ready to take a meeting is worth far more than someone leaving their details, and they were
the ones going unrecorded. Only the weaker half of the funnel was being captured.

It was never a bug, just an unconnected seam: `calendly.mjs` fed the OS **Calendar** screen,
`submission-created` fed the **Leads** screen, and nothing joined them.

## How it works

**`netlify/functions/calendly-leads.mjs`**, scheduled every 15 minutes. Reads Calendly's
scheduled events in a window (14 days back, 120 forward), fetches each booking's invitee for
the name, email and question answers, and inserts a `website_leads` row with `form:
"calendly"`.

**POLLING, NOT A WEBHOOK, on purpose.** Calendly webhooks need a paid plan and a registered
subscription. Polling needs only the Personal Access Token the calendar already uses, works
on any plan, and **survives a missed delivery** — a webhook that fails once loses that lead
forever, while the next poll picks it up.

## 🔴 The dedupe is the whole correctness argument

It runs on a schedule over an **overlapping window**, so it sees the same booking again and
again. Every insert is checked first against the Calendly event's own uri, stored on the
lead at `payload.calendlyEventUri`. Without it, **one booking becomes a lead every fifteen
minutes, forever**.

A failed dedupe read **skips** rather than inserting, because treating a database blip as
"not seen" duplicates just as badly.

## Decisions worth keeping

- **Status starts at `meeting`, not `new`.** Someone who booked a call is not at the same
  stage as someone who left their details, and recording them identically misrepresents the
  pipeline from day one.
- **Cancellations are imported too**, marked as cancelled and set back to `new`. Someone who
  booked and then cancelled is still a lead, arguably one worth calling.
- **No email means skip.** Calendly always has one for a real booking, and a lead with no way
  to reply is worse than no lead.
- **The business name is lifted from whichever booking question asked for it** (matching
  business/company/firm/shop) and left empty otherwise. Best effort: a missing name is fine,
  a wrong one is not.
- **The reschedule and cancel links are kept** on the lead, so the owner can act without
  going to find them.

## Setup Bryson must do

1. **`CALENDLY_API_TOKEN`** in Netlify env (Site configuration → Environment variables) if it
   is not already there for the Calendar. Calendly → profile → Integrations → API & webhooks
   → Personal Access Token.
2. **Add the booking questions** in Calendly → Event Types → the event → Invitee Questions.
   Whatever is asked there flows into the lead automatically, no code change.

## Verified by `tests/verify-calendly-leads.mjs` — 16 checks

Four deliberate breaks confirmed to fail: removing the dedupe, treating a failed lookup as
not-seen, recording a booked call as an ordinary new lead, and unscheduling the poller.

**NOT yet verified against live Calendly** — it needs the token and a real booking. First
real test is Bryson booking a call through the landing page and watching for a green "Booked
call" badge on the Leads screen within 15 minutes.
