---
name: os-calendar
topic: OS
task: the built-in OS Calendar (month view + agenda), what dated events it aggregates, how meetings sync from Calendly, and the mobile "More" nav
keywords: [calendar, CalendarScreen, buildCalendarEvents, calendly.mjs, CALENDLY_API_TOKEN, scheduled events, meetings sync, agenda, MoreSheet, mobile nav parity, month grid]
status: verified
summary: Built 2026-08-06 (Bryson). A CalendarScreen in the OS (desktop sidebar "Calendar" + mobile "More" sheet) shows a month grid + selected-day agenda that AGGREGATES every dated thing — pure client-side data, NO AI, so it works regardless of Anthropic API-credit balance. Sources: Calendly meetings (via new calendly.mjs), invoice auto-charges + "review leads" reminders (7d before), contract renewals/expiries (+30d-before window), and scheduled newsletter + blog content. Color-coded dots (meeting=red, billing=gold, contract=amber, content=blue); tap an event to jump to its client. Meetings need CALENDLY_API_TOKEN (a Calendly Personal Access Token — requires a PAID Calendly plan; API access isn't on the free tier). Fail-soft: no token = calendar still renders, meetings just omitted with a "connect Calendly" hint.
verified: 2026-08-06
---

**Why (Bryson, 2026-08-06):** wanted one place to see everything scheduled — meetings, lead/email reviews + sends, billing, content.

**Architecture — aggregation, not a new table.** `buildCalendarEvents({clients, newsletter, blog, meetings})` (index.html, above HomeScreen) derives events from data the OS already has + a couple fetches. Each event = `{ymd, kind, title, sub, clientId?, joinUrl?}`. Sources:
- **clients[]** (already loaded, passed as `realClients`): `billingNextCharge` → **invoice** event + a **review-leads** event 7 days before; `contractEnd` → **contract** event + a **renewal** event 30 days before. Internal house account skipped.
- **newsletter** (`newsletter-admin` `list` → `emails[]`): `scheduled_for`/`sent_at` → **newsletter** event.
- **blog** (`blog-admin` `list` → `posts[]`): `published_at` (status `draft`=scheduled) → **blog** event.
- **meetings** (`calendly` fn): `start` → **meeting** event (title = invitee name if found).

**UI — `CalendarScreen`:** month grid (`gridTemplateColumns:repeat(7,1fr)`, 6 weeks) with per-day color dots + a selected-day agenda list below; prev/next month + Today; legend. Tap an event → jumps to its client (`onSelect`) or opens a meeting's join URL. Dark, responsive (grid fractions can't overflow; agenda uses minWidth:0 + `S.ovh` truncation). Fetches newsletter/blog/calendly on mount. Colors: meeting `C.red`, invoice/review `C.gold`, contract/renewal `C.amber`, newsletter/blog `C.blue`.

**Calendly integration — `netlify/functions/calendly.mjs`** (owner-JWT). Reads `CALENDLY_API_TOKEN`. `GET api.calendly.com/users/me` → user URI → `GET /scheduled_events?user=<uri>&min_start_time&max_start_time&status=active&count=100` (window: -45d…+120d) → per event, `GET {event.uri}/invitees` (capped at 40, parallel) for the invitee name. Returns `{ok, configured, meetings:[{id,name,start,end,inviteeName,joinUrl,locationType}]}`. **Fail-soft:** missing token → `configured:false, meetings:[]`; any Calendly error → `configured:true, meetings:[], error`. Never breaks the calendar.
- **Env var: `CALENDLY_API_TOKEN`** on the OS site (mark secret). Get it: calendly.com → Integrations & apps → API & webhooks → Personal access tokens → create → copy. **GOTCHA: Calendly API access requires a PAID Calendly plan (Standard+); the free plan has no API.** So meetings-sync is gated on a paid Calendly — same "defer paid upgrades until revenue" pattern as Twilio if Bryson isn't ready. Everything else on the calendar works with zero setup. (Manual meeting entry could be a free fallback if he doesn't want to pay for Calendly — offered, not built; he chose auto-sync.)

**Mobile nav parity (fixes Bryson's "mobile missing Deal Prep"):** the mobile `BottomNav` was Home/Leads/Website/Alerts/ARIA only — Deal Prep + Revenue were desktop-sidebar-only. Added a 6th **"More"** button → `MoreSheet` (bottom sheet) with **Calendar, Deal Prep, Revenue**. Desktop `SideNav` got a first-class **Calendar** entry (after Deal Prep). Screen key = `"calendar"`; `showMore` state in App.

**Verified 2026-08-06:** `calendly.mjs` `node --check` clean; full OS Babel-compiles clean (670KB block, presets env+react). Headless render of the authed screen not feasible here; layout relies on overflow-proof primitives.

**Possible v2:** lead-followup (day 1/3/7/14) events; recurring report markers (weekly/monthly); Calendly webhook push (instead of on-open pull) for instant meeting updates; manual meeting entry as a free alternative to the Calendly API.
