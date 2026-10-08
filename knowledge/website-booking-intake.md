---
name: website-booking-intake
topic: Website
task: set or change how a business takes customers through its website (quote form, online booking with packages and times, its own booking link like Square or Calendly, or call first), set up booking packages and hours, block time, see or cancel bookings
keywords: [booking, book online, online booking, packages, time slots, book page, intake, how customers book, quote form, booking link, square, calendly, housecall pro, call first, intakeOf, bookingOn, booking.mjs, book.mjs, BookingCard, /book, travel time, buffer, block time, WA-3, two rounds of changes]
status: verified
summary: Bryson, 2026-10-07 - the detailing business should show its number for callers but let customers book by tapping a package, picking a day and time, and giving the address and their details; then "modify websites (my other businesses and my clients) to include whatever booking system they have ... and it won't count as one of the two client edits". Built one setting per business, `cl.intake.how` (quote | book | link | call), that decides where every main website button goes, plus a built-in Book page (packages, working hours, travel time between jobs, soonest-allowed window, blocked time, never double-booked), a "How customers book" card on every website's Website tab, and agreement WA-3 saying this setup is never a round of changes.
verified: 2026-10-07
---

## What he asked (2026-10-07, about 9:40pm Phoenix)

1. "For the detailing business we will want it so our number is displayed if they want to call us but
   they can book by just pressing what package they want (which we will set up later) and then choose a
   date and time and put in the location plus their info"
2. Mid-build: "I essentially want to be able to modify websites (my other businesses and my clients) to
   include whatever booking system they have whether it is requesting a quote and they fill out a form or
   they do what I just described and book directly through the website and any other possible ways to get
   clients for whatever business ... (and it won't count as one of the two client edits because it's just
   to fit how their business takes clients)"

## The setting: `cl.intake`

`netlify/lib/booking.mjs` `intakeOf(cl)` resolves `cl.intake.how`:

| how | Every main button (header, hero, footer pill, closing band) | Falls back to the quote form when |
|---|---|---|
| `quote` (default) | the Contact page form, as every site worked before | never |
| `book` | the built-in Book page `/book/` | there is no package yet |
| `link` | their own booking system, `intake.link`, opened in a new tab | the address is not `https://` (scripts and bare domains are refused) |
| `call` | `tel:` the business phone (`intake.callLabel`, default "Call now") | there is no phone number |

- **Back-compat:** with no `intake.how`, `booking.on` true means book.
- **The phone number** now shows in the website header on computers (`.hph`, hidden under 1000px, where
  the footer pill already has a call button). It shows for every method except call, where the button
  already calls.
- **The quote form stays** on the Contact page whatever is picked.
- **One button builder:** `site-render.mjs` `ctaBtn(C, base)` builds every main button.
- **OS mirror:** `osIntake` in `index.html` gives the same outcome. `verify-booking` compares the two on
  seven cases.

## The built-in Book page

- **Data:** `cl.booking`:
  - `packages[{id,name,price,minutes,desc}]` (up to 12);
  - `hours[7]` (minutes from midnight; default Mon to Sat 8 to 5, Sunday closed);
  - `buffer` travel time (default 30 min);
  - `leadHours` soonest-allowed window (default 12h);
  - `daysAhead` (21), `step` (30), `note` (line under the heading), `cta` ("Book now");
  - `blocks[{start,end,note}]`, `tz` (default America/Phoenix; DST-aware via Intl).
- **Bookings:** `cl.bookings[{id,packageId,packageName,price,minutes,start,end,address,name,phone,email,notes,status:"booked"|"cancelled"}]`.
- **Open times** = working hours, minus the soonest-allowed window, minus every live booking with travel
  time on both sides, minus blocked time. A cancelled booking frees its time.
- **The page** (`bookBody` plus `bookScript`, in all three designs):
  1. Pick a package (cards with price and length).
  2. Pick a day and time (day strip, time grid).
  3. Where and who: the address where the vehicle will be, name, phone, email (one of the two is
     required), and notes.
  - Then "You're booked".
  - The side panel has "Rather talk to a person? Call (number)" and the hours. On phones it comes first.
- **🔴 A preview never books:** `BKP` is true for `about:` documents (OS iframes) and for any
  `?preview=` link.
- **No internal `//` comments** in the shipped script. No emojis, no dashes, no BoldLine links.
- **🔴 Phone overflow gotcha:** the day strip is a horizontal scroller, so its grid column must be
  `minmax(0,1fr)` (and `.bk{min-width:0}`). With `1fr` the page was 1700px wide on a phone. Steps
  have `scroll-margin-top:96px`, so the fixed header does not cover them.

## The server

- **`netlify/functions/book.mjs`** (OS, redirect `/book`): looks up the business by `leadToken`.
  - GET returns `publicBooking` + phone + `bookingDays(pkg)`.
  - POST: 🔴 re-reads the record, runs `makeBooking` against it (a taken or never-offered time is
    409 and the page refetches times), and writes in this order: the booking, then a lead (`source:
    "booking"`, `leadId` = booking id, message with package, time and address), then the account log.
  - Only then does it email Bryson (`notifyOwnerOfLead`), the partner (`notifyTeamOfLead`), and the
    customer (`bookingConfirmEmail`, sent as the business, replies to the business, no emojis or dashes).
- **On a client's own domain:** `sites/functions/book.mjs` (path `/book`) passes GET/POST to the OS. If
  the OS does not answer: "Online booking is down for a moment. Please call us." It is in
  `sites/deps.mjs` ENTRIES, and `client-domain` PASS_PATHS has `/book`.

## The OS card ("How customers book", Website tab, every website: clients and owned businesses)

- **The choice:** four choice tiles. A line says where the buttons go right now, or why a choice is not
  ready yet ("Until then the buttons go to the quote form").
- **Book online** adds:
  - the packages editor and the working hours;
  - the rules: travel time, soonest booking, how far ahead, the line under the heading, the button wording;
  - Save booking setup;
  - "Coming up" with Call and Cancel. Cancel frees the time and does NOT tell the customer; it says so.
  - Block time off: a day, from and to, and a note.
- **Their own booking link** adds the https address and the button wording. **Call first** adds the
  button wording.
- **States it plainly:** "Changing this never counts as one of the client's website changes."

## The agreement: WA-3

`website-deal.mjs` `AGREEMENT_VERSION = "WA-3"` adds: "Setting up, and later changing, how customers reach
Client through the website (a quote form, online booking, a link to a booking system Client already uses,
or calling) is part of the build and the care plan. It never counts as a round of changes and is never
charged separately." Already-signed agreements keep their wording (DocuSign snapshots, KB
`contract-start-date`).

## Not built yet

- **Landing pages** still use their own form (and their own booking-URL variant). They do not yet follow
  `cl.intake`.
- **Deposits or payment at booking.**
- **Text reminders before a job** (texts are off until the texting account is paid and registered).
- **Two-way sync with Google Calendar.** Bookings do not show on the OS Calendar screen yet.

## Verification

- `tests/verify-booking.mjs` (73 checks):
  - the clock: Phoenix and New York;
  - open times: hours, soonest window, buffer, blocks, cancelled bookings;
  - the server: re-read, double-book refusal, 409, save-before-email, confirmation as the business;
  - the site: Book page only when on; buttons in all three designs; phone in the header; packages,
    steps and the call button; a preview never posts; no comments;
  - every intake way, with unsafe links refused; OS and site agree;
  - routing: `/book` on the OS, client domains and the websites site;
  - the OS card and WA-3.
- `verify-website-deal` checks WA-3.
- Sample sites rebuilt.
- Driven at 390 / 768 / 1280 / 1600 in Aurora (plus phone and laptop in Cinematic and Editorial), with a
  package and a time picked. No sideways scroll and no script errors. The OS card was checked on laptop
  and phone.
- Full suite 152/152.
