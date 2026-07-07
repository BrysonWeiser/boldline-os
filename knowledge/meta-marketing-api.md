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

**Current position (2026-07-07):** the June "steps 1-3" never completed — as of today NO portfolio existed. Bryson created his **personal Facebook account fresh on 2026-07-07** (brysonaweiser@gmail.com), and Meta then **blocked portfolio creation: "Unable to Create Account — Your Facebook account is too new to create a business account. Try again in an hour."** This is a standard anti-spam cooldown on brand-new personal accounts, not a rejection; the wait can stretch past the stated hour (retry later same day / next day; do NOT spam Submit — bot-like). Advised warming the account (profile photo, log into the mobile app) since bare new accounts also trip Meta's trust checks at Business Verification time. **Retry with the same form values: business name `BoldLine Media`, name Bryson Weiser, business email `theboldlinemedia@gmail.com`** (the business gmail — deliberate; it's only the contact address, the personal login stays the admin key). After the portfolio: confirm the verification email sent to that inbox, create the BoldLine Media Facebook Page (category Marketing Agency), then Business Verification in Security Center.

**No env vars yet** — App ID, App Secret, and a long-lived/system-user access token get added once the app exists. Same hard constraint: clients link and pay for their own ad accounts; BoldLine holds manager access only (see `business-constraint-ad-spend`).
