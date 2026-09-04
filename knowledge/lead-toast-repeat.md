---
name: lead-toast-repeat
topic: OS app
task: stop the OS announcing the same lead every time it is opened, and keep announcing genuinely new ones
keywords: [new lead toast, notification repeats, keeps telling me about the lead, seenLeadIds, leadsLoaded, bl_announced_leads, swipe away every time, lead banner, toast on launch]
status: verified
summary: The in-app "New lead" banner fired on EVERY launch. The seen-set was seeded on the first RUN of the effect, when `leads` was still the empty array the fetch had not filled, so the next run found every lead unseen and announced all of them. Fixed three ways: nothing is announced until the leads have genuinely loaded (`leadsLoaded`), the seen set is remembered on the device in `localStorage` (capped at 300) so closing the app does not forget, and only leads still at status "new" are announced at all. First run on a device seeds silently. Verified in a real browser: silent on install, silent across two reopens, and a genuinely new lead still announces itself.
verified: 2026-09-04
---

**Why (Bryson, 2026-09-04):** *"each time I close and reopen the os it keeps telling me about the new lead and I have to swipe it away every time. After its status is set to contacted it shouldn't keep notifying me"*.

## 🔴 Three faults, and the first is why it fired every single launch

The comment above the code said it *"seeds the seen set on first load so existing leads don't toast"*. It seeded on the first **run**, which is not the same thing. `leads` starts as `[]` and the fetch has not returned, so the set was seeded with **nothing**. The next run, when the data actually arrived, found every lead unseen and announced all of them.

> The bug was not a missing seed. It was a seed taken against an empty list, which is exactly what "it worked when I tested it with data already in memory" looks like.

**Second:** the set lived only in a `useRef`, so even a correct seed forgot everything the moment he closed the app. On a phone he opens twenty times a day that is twenty announcements of one lead.

**Third, and the part he asked for:** a lead he has already worked is not news, however new it is to *this browser*.

## The fix

- `leadsLoaded` state, set by `loadLeads` on a successful read. The effect returns early until then, so the seed can never be a lie.
- The seen ids are kept in `localStorage` under `bl_announced_leads`, capped to the last 300 (a convenience, not a record). Every read and write is wrapped: a browser with storage blocked should toast twice, not crash.
- Only `status === "new"` leads are announced.
- **First run on a device seeds silently** from what is on screen, so installing the app does not announce every lead he has ever had.

## 🔴 The check that matters most

Silencing a noisy notification is trivially achieved by breaking it. The suite and the browser run both assert the opposite too: a genuinely new lead arriving while the app is open **still** announces itself. Verified live by pushing a new lead into the running app and watching the banner appear.

This is the in-app banner only. The phone push (see `lead-attribution`) is separate and fires once per lead from the server.
