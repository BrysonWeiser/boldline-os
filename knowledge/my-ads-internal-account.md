---
name: my-ads-internal-account
topic: OS app
task: run ads for BoldLine itself via the "My Ads" house account (internal, not a client) and how it's kept out of business metrics
keywords: [my ads, internal, house account, makeInternalClient, realClients, myAccount, dogfood, first client, google launch, self client, run own ads]
status: verified
summary: BoldLine runs its OWN ads (and dogfoods the whole client flow) via a "My Ads" house account — a client record flagged `internal:true` that reuses ALL the client machinery (Package Google/Meta launch cards, landing pages, leads, ARIA) but is kept OUT of the client list + MRR/revenue/count/billing, and has NO Client-Portal or Contract tab. Reached from its own "My Ads" section (dashboard card + desktop sidebar item). Built 2026-07-24 (Bryson: run ads for myself + be the first test client). Doubles as the first real Google account linked to the MCC → the live E2E test of the launch card + approve→execute.
verified: 2026-07-24
---

**Why (Bryson, 2026-07-24):** run BoldLine's own ads to get clients, AND use BoldLine as the first client/test subject to prove the whole build works on a real account. Answers to the design question: reuse the client machinery, but NOT listed as a regular client — give it its own "My Ads" section, show all the ad info in its tabs, and **no client portal or contract** (not needed for self). Exclude it from all business metrics.

**The model — `internal:true`:** `makeInternalClient()` (index.html, just above `AddClientSheet`) builds a normal client record flagged `internal:true`, `name:"BoldLine Media"`, `packageId:"c-growth"` (combined → BOTH Google + Meta launch cards show on the Package tab), `stage:"active"`, `intakeComplete/contractSigned:true`, no contract dates. Stored in Supabase as `data` like any client, so the flag round-trips automatically. Created on first open (there's normally exactly one).

**Kept out of the client list + metrics:** in the App component, `realClients = clients.filter(c=>!c.internal)` and `myAccount = clients.find(c=>c.internal)`. `realClients` is passed to HomeScreen / RevenueScreen / SegmentScreen, so MRR, revenue, active/client counts, the client list, alerts, and expiring all exclude the house account. ARIA's STATE line (MRR/counts) also uses a local `realClients`; ARIA's CLIENTS list still includes it but tagged `[INTERNAL: … never propose upgrades/billing/contract … don't count as revenue]` so ARIA can help optimize its ads without treating it as billable. The live-ad readers + ad execution still run over the FULL `clients` (so its campaigns are managed normally).

**Its own "My Ads" section (entry points):**
- A distinct **dashboard card** at the top of Home (`🚀 My Ads — BoldLine Media`) — "Set up ›" when it doesn't exist yet (creates it), "Open ›" once it does. `onOpenMyAds` = `if(myAccount) selectClient(myAccount) else addClient(makeInternalClient())`.
- A **desktop sidebar item** "My Ads" (target icon), highlighted when the open client is internal (`myAdsActive`).
- No mobile bottom-nav item (kept the bar uncrowded — the dashboard card is the mobile entry).

**Its detail view (ClientHub) when `client.internal`:**
- **Tabs:** portal ("Client View") and contract are removed → Overview / Pipeline / Leads / Package / Reports / Log only.
- **Header badge:** a gold "MY ADS" pill + "Internal — house account" chip; health score + contract "days left" chips hidden.
- **Overview tab:** the client-billing stuff is hidden (Monthly Revenue card, Health Score breakdown, Contract Timeline, Onboarding Checklist, and the Health/Contract-End/Revenue stat tiles). Shows ad-relevant tiles only (Platform, Ad Budget, Niche, Leads, Avg CPL, Landing Page) + Internal Notes. This avoids the misleading "BoldLine pays itself $1,000/mo" display.
- **Package tab:** the package pricing/features/upgrade block is replaced by a short "Run Your Own Ads" note; the **Google + Meta launch cards still render** (gated by `pkg.platform`, which `c-growth` satisfies).

**How Bryson uses it (the E2E test):** open My Ads → Overview → Edit → enter BoldLine's own **Google Ads Customer ID** (+ approve the MCC manager link) → Package tab → Build Campaign. This is the FIRST real account linked to the MCC, so it's the live verification of `createCampaign` + ARIA approve→execute that had been untestable (see `google-ads-api`). Meta side waits on Meta App Review like everything Meta.

**Verified 2026-07-24 (headless):** OS compiles clean; dashboard shows the My Ads card + sidebar item, MRR/count exclude the house account (MRR $600 with 1 real client, not $1,600/2); internal detail has no Client-View/Contract tabs, MY ADS badge, cleaned Overview, and the Google launch card present on its Package tab.

**Lead → meeting BOOKING outreach (2026-07-24, Bryson: don't auto-convert a lead to a client — that skips the sales call and looks unprofessional; instead help contact leads + book a meeting).** The funnel is: ad lead → Bryson reaches out → they book a call → Bryson closes on the call → THEN they become a client (kept manual on purpose). Built into `LeadsTabContent`, **gated `client.internal`** (a regular client's leads are their own customers, not BoldLine prospects — they don't get this):
- **Sales pipeline** gains a **"Meeting Booked"** stage: New → Contacted → Meeting Booked → Won → Lost (regular clients keep the plain New/Contacted/Won/Lost).
- **"📅 Reach Out & Book"** per lead opens a panel with an **auto-drafted, editable** message personalized from the lead (first name, business, and their own message quoted) + the Calendly link. Send is **personal, not automated**: one-tap **Email** (`mailto:` prefilled subject+body) and **Text** (`sms:` prefilled, shorter body) open from Bryson's own address/phone — professional, and dodges the dormant branded-email deliverability problem (see `branded-lead-email-dormant`). Plus Copy / Copy-booking-link, and quick "Mark Contacted" / "Meeting Booked" status buttons.
- `CALENDLY_URL` constant (`https://calendly.com/theboldlinemedia/30min`, public, same link as BLOG_FACTS / marketing site). No new function, no AI call — instant smart template; AI personalization could be a later add.
- Verified headless: panel renders in the house account's Leads tab with a seeded lead, Email/Text/Calendly/Meeting-Booked all present, compiles clean.
- **NOT built (deferred until ads run):** the acquisition-ROI view (ad spend → leads → clients won → CAC), since it needs live spend data.

**DUAL COPY note:** this is all OS-app (`index.html`) — the portal isn't involved (internal has no portal). No `portal.mjs` change.