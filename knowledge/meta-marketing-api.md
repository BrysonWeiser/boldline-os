---
name: meta-marketing-api
topic: OS app
task: continue the Meta (Facebook) Marketing API setup and business verification
keywords: [meta-marketing-api, business-portfolio, business-verification, ads_management, app-review, security-center]
status: stale-able
summary: Meta Marketing API setup is IN PROGRESS (longest approval pipeline — Business Verification + App Review, weeks). Started from scratch. As of 2026-06-25 Bryson was on steps 1-3 (Business Portfolio + Page); next is Business Verification. No env vars yet. (Current position is volatile — re-check.)
verified: 2026-07-02
---

**Status: IN PROGRESS** (started 2026-06-25). The longest approval pipeline of the four integrations (Business Verification + App Review can take weeks) — started early on purpose to run in parallel with the Google Ads Basic Access wait. Started **from scratch** (no prior Facebook/Meta presence).

**Setup path (click-by-click):**
1. Personal Facebook login (the admin "key" behind any business; it stays separate from the business) — use brysonaweiser@gmail.com.
2. **Business Portfolio** at business.facebook.com — name `BoldLine Media`, email brysonaweiser@gmail.com, confirm via the email link.
3. **Facebook Page** `BoldLine Media`, category Marketing Agency (needed for ads + verification).
4. **Business Verification** (Business Settings → Security Center) — the weeks-long step; submit ASAP to start the clock.
5. **Developer app** at developers.facebook.com (Business-type) + add the **Marketing API** product.
6. **App Review** for advanced `ads_management` access.

**Current position (2026-07-07): Business Portfolio CREATED.** The June "steps 1-3" had never completed. Bryson's personal Facebook account is BRAND NEW (created 2026-07-06, brysonaweiser@gmail.com); Meta first blocked portfolio creation with "your Facebook account is too new — try again in an hour," and the retry ~1h later succeeded. Portfolio: business name `BoldLine Media`, business email `theboldlinemedia@gmail.com` (contact address only; the personal login is the admin key). **Risk + mitigation:** a days-old admin account doing business actions is checkpoint-prone, so Bryson's OLDER personal account (lleatherboy@gmail.com — check real name + good standing) should be a SECOND full-control admin (Settings → People → Invite people). **RESTRICTION LIFTED 2026-07-08 — portfolio REINSTATED** (email confirmation) within hours of the review request; the ID/identity review cleared it. Resuming setup: Page creation next, then Business Verification (gated on the LLC/EIN answer), second-admin invite still deferred ~a week. Pace actions — no bursts.

**Original restriction, for the record — 2026-07-08 ("We restricted your business" / "Business Account Not Allowed to Advertise")** — surfaced when Page creation was attempted; the "Why this happened" text is Meta's generic anti-automation boilerplate, i.e. the brand-new-account pattern got auto-flagged (portfolio + 2 invite attempts + Page attempt within ~an hour of creation). NOT a policy violation by us and NOT permanent: the restriction page (Account Overview → Business portfolio, or business.facebook.com/business-support-home) has a **Request review** button (179-day window). Review requested via that button (usually asks for ID/identity confirmation; decision typically 24-48h, email + Business Support Home). **Everything Meta (Page creation, verification, invites) is paused until the review clears — do not retry actions meanwhile.** Ignore the "Chat with Meta AI" popup.

**Invite BLOCKED 2026-07-07** ("User Cannot be Added to Business") — confirmed to be the day-old-portfolio ageing restriction, since it failed identically with the CORRECT email. **PENDING: retry the invite in ~a week; don't spam attempts.** Interim protection: 2FA on the new sole-admin account (Accounts Center → Password and security). **ACCOUNT MAP correction (2026-07-07):** the OLD/aged personal FB account = **brysonaweiser@gmail.com** (this is the one to invite as second admin); `lleatherboy@gmail.com` is NOT one of his Facebook logins (first invite mistakenly went there). The NEW FB account (created 2026-07-06, current sole portfolio admin) shows **theboldlinemedia@gmail.com** in the People list — its actual login email still to be confirmed with Bryson. Next: confirm the business-email verification link, create the BoldLine Media Facebook Page (category Marketing Agency), then Business Verification in Security Center. **Open question raised 2026-07-07: is BoldLine Media a registered entity (LLC/EIN)?** Verification wants legal name/address/phone + official docs (formation papers, EIN letter, or utility/bank statement in the business name) — if unregistered, that must be solved first (also needed for Stripe + contracts).

**No env vars yet** — App ID, App Secret, and a long-lived/system-user access token get added once the app exists. Same hard constraint: clients link and pay for their own ad accounts; BoldLine holds manager access only (see `business-constraint-ad-spend`).
