---
name: business-emails
topic: My Businesses
task: emails a business Bryson owns sends its own customers (booking confirmation, reminder before the job, review request after, time for another for one-off customers), sent from the business's own address and branded from its website; unsubscribe; the phone calendar feed
keywords: [customer emails, reminder email, review request, rebook, time for another, one-off customers, subscription, plan package, planCustomers, sendAsBusiness, emailSender, emailSenderStatus, customerEmailLog, emailOptOut, optout, unsubscribe, biz-email.mjs, biz-email-shell.mjs, biz-customer-emails, brandFromHTML, Resend domain, fromAddress, biz-cal, webcal, ics, calendar feed]
status: verified
summary: Bryson, 2026-10-09 - "lets do all of them" (reminder before a job, review request after, phone calendar feed, time for another) "but make sure the email comes from the business email for my other business not boldline media (make a way for you to brand the email based off of the business name and website when i add it to the my businesses tab)" and the rebook email "only goes to the one off customers ... and dont already have a subscription". Built a branded email design per business (logo and colour pulled from its own website), sending from its own address once a test send proves it, an hourly job for the three automatic emails with narrow windows (no backlog), strict one-off-only rebook logic, signed unsubscribe, and a webcal calendar feed. Needs Bryson to verify the business's email domain in Resend before the automatic emails start.
verified: 2026-10-09
---

## What he asked (2026-10-09)

"lets do all of them but make sure the email comes from the business email for my other business not
boldline media (make a way for you to brand the email based off of the business name and website when i add
it to the my businesses tab) and then for 4. make sure it looks that they didnt already sign up for a
subscription but that it only goes to the one off customers that book a one time detail and dont already have
a subscription."

## The look: `netlify/lib/biz-email-shell.mjs` (no imports)

- **`bizBrand(cl)`** takes:
  - the colour from `brand.color`, then the website's brand colour, then the landing page's, then near-black;
  - the logo from `brand.logoUrl`, `brandLogo` or the landing page logo (https only);
  - the website, phone, email and area.
- **`textOn`** picks dark or white text by contrast. A light colour becomes grey when used for words.
- **`bizEmailHTML` / `bizEmailText`:**
  - the logo, or the business's name in place of one;
  - a top border in the brand colour;
  - a details box and a button that keeps its colour in Gmail dark mode (gradient);
  - a footer with name, phone, website and area;
  - an optional unsubscribe link.
  - All text is escaped. No BoldLine, no emojis, no dashes.
- **The booking confirmation** (`booking.mjs` `bookingConfirmEmail`) now uses this design too.

## Branding pulled from the business's own website

- **When adding a business:** the Add Business sheet has "Website it already has (optional)", which
  `makeOwnedBusiness` saves as `brand.website`.
- **First open:** the first time the Overview tab's **Customer emails** card opens, it calls
  `biz-email` `sniff`.
  - It finds the logo: an `<img>` with "logo" in its src, alt, class or id, else the
    apple-touch-icon, else a large icon or an SVG.
  - It reads `theme-color` for the colour.
  - It saves `brand.{logoUrl,color,fetchedAt}`.
- **Manual controls:** a "Pull logo and colour" button, and fields for the logo link and the colour.
- 🔴 **Fetch safety:** https only, no IP addresses, localhost or internal names, no odd ports. Every
  redirect is followed by hand and re-checked. 8-second timeout, 1.5MB cap.

## Sent from the business's own address

- **`sendEmail` takes `fromAddress`** (report-shared). Resend refuses any domain it has not verified.
- **How an address is proven:**
  - `cl.emailSender.address` is his choice, set in the OS. It defaults to the business email typed when
    the business was added.
  - `cl.emailSenderStatus` is the server's finding. It is written only by the "Send a test to me"
    button (`biz-email` `test-sender`, a real send to OWNER_EMAIL) or by a send that fails.
  - `senderOf(cl)` returns the address only when the status is verified AND for that same address.
- **`sendAsBusiness(cl, msg, {send, strict})`:**
  - With a proven address, it sends from it, with replies going to the business email.
  - **strict** (the three automatic emails): nothing is sent from our address, ever. They wait.
  - **not strict** (the booking confirmation, which must arrive): it falls back to our sending address
    under the business's name, with replies going to the business.
- 🔴 **SERVER_OWNED_KEYS** now includes `emailSenderStatus`, `customerEmailLog` and `emailOptOut`, so an
  OS screen opened before a send can never save over the record of it and cause a second send.

## The automatic emails: `dueCustomerEmails` (pure) + `netlify/functions/biz-customer-emails.mjs`

- **When it runs:** hourly, at 7 past (netlify.toml).
- **Who it covers:** owned businesses only. Never a demo, a client or the house account.
- **What it needs:** a proven sender and a customer email.
- **Never twice:** `customerEmailLog["<bookingId>:<kind>"]` records each send.
- **Order of work:** send first, then record, then merge into a fresh read. A failed send is retried
  next hour. A sender that breaks is marked unverified, so the OS asks for a new test.

| Email | Window | Needs |
|---|---|---|
| Reminder | 26h to 2h before the start. Skipped if booked within 30h of the start (the confirmation is fresh). | on (default) |
| Review request | 18h to 72h after the job ends | on + `customerEmails.reviewUrl` (Google review link) + not unsubscribed |
| Time for another | `rebookDays` (default 60; 30/45/60/90/120) to rebookDays+14 after their **latest** job | on + one-off rules below |

- 🔴 **The narrow windows mean switching it on never sends old reminders or review requests**, whatever
  the history.
- 🔴 **Rebook is for one-off customers only.** A customer is matched by email, or by phone digits (with a
  leading 1 removed), across every booking. They are left out if any of these is true:
  - any non-cancelled booking was of a **plan package** (`booking.packages[].plan`, a checkbox in the
    package editor). The booking also remembers `plan` in case the package is later deleted;
  - they are on **`customerEmails.planCustomers`** (emails or phones, one per line, for subscriptions
    sold some other way);
  - they have a **later booking** (they already came back), or one still to come;
  - they are on `emailOptOut`;
  - it was already sent.
  A cancelled booking does not count as coming back.
- **Dates are written out** ("Saturday, October 10 at 6:00 AM"), never "tomorrow" (Arizona time rule).

## Unsubscribe: `netlify/functions/optout.mjs`

- **Where the link appears:** in the review and rebook emails (marketing). The reminder and confirmation
  are transactional.
- **The signature:** `optOutSig` is an HMAC over (business id, email), keyed by `OPTOUT_SECRET` or, if
  that is not set, the service-role key.
- 🔴 **GET only shows a button. POST unsubscribes**, because mail scanners open links.
- **On the business's own domain** when it has one live: `sites/functions/optout.mjs` relays it,
  client-domain `PASS_PATHS` includes `/optout`, and `sites/deps.mjs` lists it in ENTRIES. Otherwise it
  is on the OS.

## Phone calendar feed

- `biz-portal.mjs` `bookingsIcs` (iCalendar format) is served at `/biz-cal?t=<portal token>`
  (`netlify/functions/biz-cal.mjs`, GET only, portal must be on).
- It covers the last 60 days and everything ahead. Cancelled bookings are sent as CANCELLED, so they
  disappear from the phone. Long lines are folded, and commas, semicolons and backslashes are escaped.
- **Where to get it:**
  - the portal (an "Add to my phone's calendar" `webcal://` button, plus the https address for Google
    Calendar);
  - the OS Business portal card.

## Bryson's one-time setup (computer job; in the 10pm reminder)

1. **The business needs an email address on its own domain** (for example hello@desertglossdetailing.com).
   Gmail or Outlook addresses cannot be verified as a sender.
2. **Add that domain in Resend:** Domains, then Add Domain. Put the DNS records it shows into wherever the
   domain is registered, then press Verify.
   - Resend's free plan covers one domain, which boldlinemedia.com already uses, so a second domain
     probably needs Resend's paid plan. He should check this on Resend's pricing page.
3. **In the OS:** open the business, go to Overview, then Customer emails, and press "Send a test to me".
   Once that works, everything sends as the business.
4. **The Google review link:** in the business's Google profile, use "Ask for reviews" and copy the link.
   Paste it into the Customer emails card.

## Verification

- `tests/verify-business-emails.mjs` (62 checks).
- `verify-booking` and `verify-business-portal` were updated. Full suite 154/154.
- The OS card renders on laptop and phone with no sideways scroll.
