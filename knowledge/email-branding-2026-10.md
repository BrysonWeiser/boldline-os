---
name: email-branding-2026-10
topic: Email
task: change how BoldLine's emails look (client lifecycle emails, weekly/monthly reports, newsletter, emails to a client's customers), the email header/logo, or the report email's numbers
keywords: [email branding, email header, email logo, report email, weekly report email, monthly report email, renderReportEmail, reportStats, email-brand, brandHeaderRow, leadEmailHTML, newsletter email, dark email, em dash subject]
status: LIVE 2026-10-07 (merge 0e03c03, rollback/20261007-213834)
summary: Bryson, 2026-10-07, "lets look at the email branding" then "fix it". Found 5 issues: the weekly/monthly REPORT (the email clients get most) was a white/grey template unlike every other client email; its heading AND subject had an em dash; it was signed "The BoldLine Media Team"; it had no numbers; the header everywhere was a dated Georgia serif wordmark; and emails to a client's own customers used BoldLine gold. Fixed: one header (gold B logo + "BoldLine Media" in sans) defined once in netlify/lib/email-brand.mjs; reports now use the dark shell with counted number tiles, a portal button, signed by Bryson, no dashes; lead emails use the business's brand colour (brandColorOf) or neutral ink.
verified: 2026-10-07
---

## Where things live
- `netlify/lib/email-brand.mjs` (no imports, to avoid loops): `EMAIL_GOLD`, `EMAIL_SANS` (Inter then system sans),
  `EMAIL_DARK`, `EMAIL_LOGO_URL` = https://boldlinemedia.com/logo.png (the gold B, hosted by the marketing site),
  `brandHeaderRow()` (logo + wordmark; readable with images off), `emailH1()`.
- Used by `client-emails-shared.mjs` (emailShell, every lifecycle + website email) and `newsletter-shared.mjs`.
- Report: `renderReportEmail({period, text, client, portalUrl})` + `reportStats()` in client-emails-shared. Tiles: leads this
  week (weekly) or last 30 days (monthly), qualified in the same window, and only if `adPerf` exists: ad spend 30 days and
  cost per lead 30 days ("Not yet" when no leads; never a dash, the no-dash test catches "&ndash;"). Line under the tiles:
  ad spend is paid by the client to the platform, never part of our invoice. Subject: "Your weekly report for <business>".
- `report-shared.mjs` calls it through `clientReportEmail()` with a DYNAMIC import (client-emails-shared imports
  report-shared, so a static import back would loop). The internal weekly briefing to Bryson keeps the old light layout.
  The monthly copy to Bryson is the exact client html.
- `leadEmailHTML` (auto-replies/follow-ups to a client's customers): accent = `brandColorOf(client)` from site-render (the
  same rule as their website and landing page), else #1F2937. Never BoldLine gold.
- The portal's empty tiles also changed from "–" to "Not yet" (same dash rule).

## Tests
`verify-email-brand` (77 checks): header + no Georgia + no emoji on every EMAIL_TYPES template and the newsletter; header
defined once; report counts, no dash in subject/body, portal link, Bryson signoff, no-adPerf case, XSS; both report sends use
the new email; lead email colour. Suite 144/144.

## Follow-up (same day): the free Lead-Leak Check email to PROSPECTS
- Found in the "anything else?" sweep: its fixed wording had 3 em dashes (intro, closing, preheader) and its writing prompt
  had 10 (a model mirrors the style it is given; the output is also run through `humanize`). All removed; it now uses
  EMAIL_SANS. Owner-only subjects ("[Review before sending] ... — email") keep theirs (exempt). Pinned in verify-email-brand.
- The client AGREEMENT was reviewed and left as is: a light, printable serif legal document is right for a contract, and
  existing signed agreements must not move a byte (verify-billing-for-sales 5b).
