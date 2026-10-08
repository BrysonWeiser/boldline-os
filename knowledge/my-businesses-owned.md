---
name: my-businesses-owned
topic: OS app
task: build a website, landing pages or ads for one of Bryson's OWN businesses (the car detailing business with his friend), or change anything that decides whether an account is BoldLine itself, an owned business, or a client
keywords: [my businesses, owned business, isOwned, isHouse, makeOwnedBusiness, AddBusinessSheet, MyBusinessesScreen, car detailing business, side business, own business, case study, results we can show, house account, internal, owned.mjs]
status: verified
summary: Bryson, 2026-10-07 - a place in the OS to build websites, landing pages and ads for his OTHER businesses (starting with a car detailing business he co-owns with a friend; he runs the site and ads, the friend does the work), whose results he will also show prospects. Built as "My Businesses" - a record flagged `internal` AND `owned`. `internal` keeps every money and relationship rule of the house account (never billed, invoiced, emailed, counted, or the founding offer). `owned` means it is NOT BoldLine, so it gets the customer-facing client tools and never BoldLine's page, prospects or agency ad copy. 🔴 Anything meaning "BoldLine's own account" must use isHouse (index.html + netlify/lib/owned.mjs); four places used to take the FIRST internal record. Pinned by verify-owned-businesses.
verified: 2026-10-07
---

## What he asked (2026-10-07, 8:40pm Phoenix)

> "I need a place in the os for me to build a website for my other businesses and then also to be able to
> run whatever ads I want to the other businesses including making landing pages for them. For some
> context behind that my buddy and I are starting a car detailing business and I am going to build and
> manage the website and run the ads while he does more of the physical labor. I'm planning on also using
> what we do with that business as results we can show"

## Two rules I insisted on (told to Bryson, written into the screen)

1. **The business pays for its own ads.** It gets its own Google Ads and Meta ad accounts, paid on the
   business's own card, never BoldLine's.
   - This keeps the hard constraint (BoldLine never fronts ad spend).
   - It keeps the numbers clean enough to show prospects.
   - It keeps taxes simple between the partners.
2. **Results shown to prospects must say it is his own business.** For example: "our own detailing
   business, run on the same system we sell".
   - Presenting it as a client result without disclosing that he co-owns it would mislead prospects.
   - US advertising rules require disclosing a material connection like this.
   - It is also the stronger pitch.
   - Any future "results" page or case study built from this business must carry the disclosure.

## The model

- **The flags:** an owned business is a client record with `internal: true, owned: true`.
- **The two questions** (same code in `index.html` near `HOUSE_PKG_ID`, and in `netlify/lib/owned.mjs`,
  which has no imports):
  - `isHouse(c) = c.internal && !c.owned`: BoldLine's own My Ads account.
  - `isOwned(c) = c.internal && c.owned`: one of his businesses.
- **`makeOwnedBusiness(form)`** is built on `makeInternalClient()`, so it inherits the house account's
  safe shape:
  - `contractStatus: "internal"`, `intakeComplete`/`contractSigned` set, no contract dates;
  - the `bl-house` package, every feature;
  - then its own name, niche, area, phone, lead email and platforms;
  - `website: ""`, so the website builder starts clean.
- **Why `internal` and not a new flag:** about 60 money and relationship checks already say
  `!c.internal`, so an owned business is safe everywhere by default:
  - founding count, revenue/MRR and `realClients`;
  - billing-watch, lead-invoice-run, website-monthly-run (`exempt`);
  - client-email-auto, client-nurture, docusign, contract alerts, onboarding;
  - the calendar digest.
  The opposite design (owned as a client, with exclusions added) would have meant finding every money
  check, and missing one bills or emails him.
- **What had to change** was every spot where "internal" meant "BoldLine itself". About 50 spots in
  `index.html` became `isHouse(...)`:
  - agency ad seeds and the `adGen` `agency` flag (Google, Meta, creatives);
  - the house `/get-started` landing default, the Arizona default locations, "Who should this ad target?";
  - the house landing page block; the website-leads mirror; the sales pipeline statuses and "Reach Out & Book";
  - the "BoldLine's own" labels in confirms and on the Campaigns screen;
  - `LinkRequestRow`, `LandingOptionsCard`, `ScorecardCard`, `TradePlaybookCard`, Reviews, the Website tab;
  - `AdCreativeStudio`, whose fixed angles like "Stop buying shared leads" are BoldLine selling to owners.
- **Server spots now on `isHouse`:**
  - `house-leads-run`: reads up to 50 internal rows and picks the house.
  - `alerts-watch`: both house reads.
  - `report-shared`: the monthly house read. The weekly briefing for an owned business has its own
    prompt, about that business.
  - `ads-autopilot` and `client-autobuild` (`systemFor`), and the `ads-sync` labels.
  - market research: an owned business is not an agency and does not sell nationally.
  - `site-uptime`: owned websites ARE watched.

## What he sees

- **Where to find it:** "My Businesses" is in the computer side menu (under Run clients, after My Ads),
  the phone More menu, the Home card under My Ads, and Ctrl K search.
- **The list screen:**
  - the shared header's "needs you" line names the next missing step per business (website, landing
    page, ad accounts) and opens that business;
  - a 14-day leads chart and counts;
  - one card per business with Website / Landing page / Ad accounts pills;
  - the two rules in a note at the bottom.
- **Add a business:** name, what it does (`NicheSelect`), where it works, phone, the email for leads and
  replies, and where to advertise. A reminder that it needs its own ad accounts and card.
- **Its page (ClientHub)** shows "Your business" in the header.
  - Tabs: Overview, Campaign, Pipeline, Leads, Reviews, Website, Assets, Package, Competitors, Reports.
    No Contract, Emails or Log.
  - Campaign tab: "Run <name>'s Ads", the setup checklist with "Add the business's own card", the
    budget, and step-by-step creation of its OWN Google account from inside the MCC and Meta ad account
    in Business Manager. Then the Google/Meta launch cards with client wording, and live campaigns with
    Start/Pause.
  - Acquisition ROI reads in "Customers won" and "Cost / customer".
  - Edit sheet title: "Edit Your Business", and it has the MCC link request.
  - Back returns to My Businesses.
- **Also fixed on the way:** the Meta launch card no longer says "(Meta ads also need App Review approved
  first.)". Meta was approved 2026-09-14.

## Partner view (built 2026-10-07 evening, Bryson: "can you make those two ideas")

- **What it is:** a private page for the partner on an owned business: every lead, newest first, with
  Call / Text buttons and Contacted / Won / Lost. It shows leads only.
  - Served by `netlify/functions/team.mjs` at `/team?t=<token>` (redirect in `netlify.toml`).
  - Built in `netlify/lib/team-view.mjs`; mobile-first; refreshes every minute.
- **Status changes:** written onto the same `leadsLog` entry, keyed by `leadId` (or `receivedAt` for
  older leads), with `statusBy: "partner"`. The record is re-read right before the write. The OS Leads
  tab and the partner page stay in step.
- **The OS card:** `TeamViewCard`, at the top of the Leads tab, owned businesses only.
  - "Make the partner link" mints `team.token` (`crypto.randomUUID`).
  - Buttons: Text it to them (`sms:`), Copy, Open (new tab), Turn off.
  - Turning it off sets `team.on:false` and clears the token, so the old link is dead.
- **🔴 Never embedded as a preview** (KB `preview-safety`): the page writes real data. The OS only
  opens it as the real page.
- **Safety:** the token is the whole key.
  - The endpoint answers only a well-formed token on an owned business with the link on.
  - `no-store`, `noindex`, `referrer-policy: no-referrer`.
  - Lead text is JSON-escaped in the script (`\u003c`), so a message cannot close the tag.
  - No emojis or dashes, and no link to BoldLine on the page.
- **Optional partner email** (`team.email`): `notifyTeamOfLead` in lead-intake sends each new lead as
  the business (`fromName`), with replies going to the customer, plus Call and "See all leads"
  buttons. 🔴 It is LAST in the `Promise.all`, because `const [, , crm]` reads the third result. Putting
  it earlier would have handed the CRM outcome the wrong value (caught before shipping).
- Pinned by `tests/verify-team-view.mjs` (38 checks).

## Results on boldlinemedia.com (built the same evening)

- **The OS card:** `ShowcaseCard`, at the top of the Overview tab, owned businesses only.
  - On/Off switch (`showcase.on`) and an editable description (`showcase.label`). The default is
    "<name>, our own <niche> business in <area>".
  - A live preview of the last-30-day numbers: leads, ad spend, cost per lead, jobs won.
  - The gate in plain words ("needs 4 more leads...").
- **The gate:** at least **10 leads** AND **$100 of ad spend** in the last 30 days. No zero or thin
  claims, and no cost per lead without spend.
- **One arithmetic:** `showcaseNumbers` / `showcaseLabel` live in `netlify/lib/showcase.mjs` between
  `SHOWCASE-MIRROR` markers, and are copied character for character into `index.html`.
  `verify-showcase` compares the two copies and runs both on the same records.
- **The public endpoint** `netlify/functions/proof.mjs` (CORS `*`, cached 15 min):
  - returns aggregates only (label, leads, won, spend, costPerLead, window, updatedAt), for owned
    businesses switched on and past the gate;
  - a failure returns an empty list.
- **On the site:**
  - `marketing-src/proof.html`: a `hidden` section, on Home just before the founder strip and on
    About after the founder;
  - CSS in `new.css`;
  - `site.js` fetches `https://os.boldlinemedia.com/.netlify/functions/proof` with credentials
    omitted, builds the cards with `textContent`, and unhides only if there are items.
  - It always carries "Our own business. We run it on the same system we sell, so these are our
    numbers, not a client's."
- **Rebuild after editing:** `node scripts/build-marketing-site.mjs`.
- Pinned by `tests/verify-showcase.mjs` (27 checks).

## Not built yet (natural next steps)

- Texting the partner on a new lead, instead of email. Texts are off until the texting account is paid
  and registered (KB `client-text-back`).
- **Ad images for owned businesses:** the creative studio is BoldLine-only, so use real photos of their
  work uploaded under Assets (better anyway). A customer-angle creative studio could come later.

## Verification

- `tests/verify-owned-businesses.mjs` (42 checks):
  - never a client: founding, website exempt, auto emails refused, realClients, lead invoices;
  - never BoldLine: My Ads, leads mirror, alerts, reports, agency copy, landing default, bots, research, labels, ARIA;
  - gets client tools: reviews, website tab, landing options, scorecard, playbook, link request,
    customer pipeline, own-card setup wording, creative studio house-only;
  - reachable from the side menu, phone menu, home, search, and back navigation.
- Ten older suites were updated from `client.internal` to `isHouse(client)` for the same behaviour:
  house-leads, manager-link, niche-picker, review-requests, site-domain, campaign-launch, landing-pages,
  meta-generator, house-pipeline, sites-split.
- Driven headlessly at 1600 / 1280 / 768 / 390: list, empty state, add sheet, and an owned business's
  Overview / Campaign / Assets / Website / Leads tabs. No sideways scroll, no script errors. Full suite
  149/149.
