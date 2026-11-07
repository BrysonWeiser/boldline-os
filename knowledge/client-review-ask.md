---
name: client-review-ask
topic: Clients
task: automatically ask clients for a review of BoldLine a month after they buy (ads, website, website bought outright), and where the ask points
keywords: [review request, ask for a review, client review, google review for boldline, review_request, reviewAsked, review-ask.mjs, reviewAskDue, client-nurture, one month, 30 days, write a review link, placeid, writereview, testimonial, social proof]
status: LIVE 2026-11-06
summary: Bryson, 2026-11-06 - "automatically send something to our clients after a month of running ads or selling a website or service etc to them for them to give us a review". The ask existed since 2026-09-07 (45 days, 10 leads, ads and hosted sites only, and it never linked to Google). Now one month on every path - ads (a month from go-live, ads really delivered, at least 3 leads; fewer waits), a website we host (live a month, plan not past due), a website bought outright (a month after paid in full). Once per client ever, never the same morning as a milestone email. The main button is BoldLine's own Google "write a review" page from the connected Business Profile; the website form is the other choice.
verified: 2026-11-06
---

## The rules (`netlify/lib/review-ask.mjs`, `reviewAskDue(cl, emailAuto, now)`)
- **ads** (anything not website-only): contract active, onboarding welcome sent, `hasAdActivity` (impressions, spend or
  a live campaign), `contractStart` at least 30 days ago (under terms v5 that IS the go-live day, KB campaign-live),
  and `liveStats(cl).leads >= 3`. Fewer leads after a month: not asked yet; it goes the morning they reach 3.
  Why: the email says "the leads are coming through", and an unhappy client asked for a review writes an unhappy one.
- **website** (website-only, our hosting): `website.published`, `websiteDeal.launchedAt` 30+ days ago, care plan not
  `past_due`.
- **owned** (website-only, terms `mgmt: "own"`): fully paid, the LAST paid stage 30+ days ago (`paidInFullAt`). The
  email never says their site is "live" (they host it): "has been yours for about a month now".
- Never: internal (BoldLine's own account and Bryson's businesses), demo clients, anyone already asked.
- Sent by `client-nurture` (daily, 16:00 UTC = 9am Phoenix), skipped on a run that already sent a milestone email.
  Stores `emailAuto.reviewAsked`, `reviewAskedAt`, `reviewAskedFor` (ads | website | owned).

## Where it points
- `boldlineReviewUrlFrom(rows)`: the house account's connected Google profile (`data.gbp.placeId`, KB google-listing)
  becomes `https://search.google.com/local/writereview?placeid=...`. Only the HOUSE account (internal and not owned),
  never a client's or one of Bryson's businesses.
- With it: button "Leave a Google Review" + "Rather not use Google? write it on our website" (boldlinemedia.com
  #reviews). Without it: the old "Leave a Review" button to the website.
- 🔴 Fixed copy bug: the old line said a Google review "helps you get found too" (wrong, it helps BoldLine) and gave no
  Google link at all.
- A preview or send by hand from the OS Emails tab gets the same link (client-email `render` fills `reviewGoogleUrl`).
- New email button picture `leave-a-google-review.png` (marketing-site/email/v1). 🔴 GOTCHA: running
  build-email-buttons on a newer Chromium re-draws EVERY existing picture with tiny pixel changes; keep only the new
  file and restore the rest, or every inbox's cached buttons change for nothing.

## Also on 2026-11-06: the test browser moved
The cloud machine's Chromium moved from `chromium-1194/chrome-linux/chrome` to `chromium-1243/chrome-linux64/chrome`
(with a stable link `/opt/pw-browsers/chromium`). Every browser-driven test failed to start. Tests now use
`scripts/chromium-path.mjs` (`chromiumPath()`), and the build scripts accept both layouts.

## Tests
`tests/verify-review-ask.mjs` (26 checks); older pins updated in verify-client-lifecycle-gaps and verify-website-emails.
