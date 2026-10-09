---
name: business-portal
topic: My Businesses
task: give Bryson (or his partner) a private view-only page for one of his own businesses with a bookings calendar, booking details, leads, numbers, ads and setup; turn the portal link on or off
keywords: [business portal, portal link, view only, read only, /biz, biz-portal.mjs, biz.mjs, BusinessPortalCard, bookings calendar, booking details, owned business, partner, portal token]
status: verified
summary: Bryson, 2026-10-08 - "when i add my business to it can you also give me a portal link (similar to client portals) except include everything for the business but dont allow edits through there but have the calendar showing all of the bookings for that specific business with the ability to click each person whos booked and it will open up to their details". Built /biz?t=<token>, a view-only page per owned business (right now, month calendar of bookings with a tap-to-open detail sheet, coming up, last 30 days, leads, ads, setup and live links). The server answers GET only, so nothing can be changed from it. Every new business gets the link automatically; existing ones get a "Make the portal link" button on the Overview tab.
verified: 2026-10-08
---

## What he asked (2026-10-08)

"when i add my business to it can you also give me a portal link (similar to client portals) except include
everything for the business but dont allow edits through there but have the calendar showing all of the
bookings for that specific business with the ability to click each person whos booked and it will open up
to their details of what they filled out"

## How it works

- **Page:** `netlify/lib/biz-portal.mjs` (`portalData` builds everything once on the server, and
  `renderBizPortal` draws it). It is served by `netlify/functions/biz.mjs` at `/biz?t=<token>`.
  `&data=1` returns the same data as JSON, which the page uses to refresh itself every 3 minutes and when
  he presses Refresh.
- **Record:** the link lives at `cl.portal = {on, token, createdAt}`. The lookup is
  `data->portal->>token`.
- 🔴 **View only is enforced by the server.** `biz.mjs` refuses every method except GET/HEAD (405) and has
  no code path that writes. The page makes exactly one kind of request, a read. Call, text, email and map
  links leave the page.
- **Sections:**
  - **Right now:** jobs today, how many are booked ahead, leads waiting for a call, deposits not paid yet,
    and the next job (tap it to open).
  - **Calendar:** the month, with back, forward and Today. Phones show dots and computers show the time
    and name. Cancelled bookings are grey and struck through.
  - **Tap a day** to see that day's list. **Tap a booking** to open a sheet with everything the customer
    filled in: package, price, length, when, address (opens in Google Maps), phone, email, deposit, when
    they booked, and "What they told us". It has Call, Text and Email buttons.
  - **Coming up:** the next 12 jobs, grouped by day.
  - **Last 30 days:** leads, bookings made, jobs won, ad spend, cost per lead, and the dollar value booked
    ahead (added up from the package prices). Below that, a chart of leads per day.
  - **Ads:** live campaigns, spend over 30 days, clicks, and progress against the monthly budget.
  - **Leads:** read-only. Shows 8, then "Show all".
  - **Setup:** how customers book, phone, email, area, hours, booking rules, the packages, and links to
    the live website, booking page and landing page. Only pages that are really live are listed.
- **Clock:** times use the business's own time zone (`booking.tz`, default Phoenix).

## Safety

- Only an **owned** business with the portal **on** and a token gets a page. Turning it off in the OS
  removes the token, so the old link is dead. A malformed or unknown token gets "This link is turned off".
- Headers: no-store, noindex, no-referrer.
- Only what the page needs leaves the server. Not sent: payment links, ad account ids, the partner token,
  or notes.
- Every customer's words are drawn with `textContent`, never as HTML. The data is embedded with
  `<`, `>` and `&` escaped, so a booking note cannot close the script.
- **Brand colour:** `textOn()` picks near-black or white text by actual contrast, so a gold brand gets dark
  button text. Words that would be in the brand colour use grey when the colour is too light to read.
- No emojis, no dashes, and nothing pointing at BoldLine.
- **The OS opens it in a new tab and never embeds it** (KB `preview-safety`).

## In the OS

- **`BusinessPortalCard`** sits at the top of an owned business's **Overview** tab. When the link is off it
  has "Make the portal link". When it's on, it shows the link with Open, Copy link, Text it and Turn off, a
  warning that anyone holding the link sees customers' details, and how many bookings are coming up.
- **`makeOwnedBusiness`** now sets `portal: {on:true, token, createdAt}`, so every business he adds has the
  link ready.

## Versus the partner page

The partner page (`/team`, KB `my-businesses-owned`) is leads only and CAN change a lead's status. This
portal shows everything and changes nothing. Both can be live at once.

## Verification

- `tests/verify-business-portal.mjs` (43 checks).
- Driven in a browser at 390 / 768 / 1280 / 1600 with 16 bookings and 14 leads: tapped a booking (the
  sheet opens), changed months, and pressed Refresh. No sideways scroll, no script errors, and no request
  other than a read.
- The OS card was checked on laptop and phone.
