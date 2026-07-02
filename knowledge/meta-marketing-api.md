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

**Current position (2026-06-25 — may be stale, re-check):** on steps 1-3 (creating the Business Portfolio + Page). Next checkpoint: confirm the portfolio dashboard is up, then do Business Verification (step 4).

**No env vars yet** — App ID, App Secret, and a long-lived/system-user access token get added once the app exists. Same hard constraint: clients link and pay for their own ad accounts; BoldLine holds manager access only (see `business-constraint-ad-spend`).
