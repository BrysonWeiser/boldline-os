---
name: business-constraint-ad-spend
topic: Business rules
task: make any billing, ad-account, Stripe, or Meta decision without violating the ad-spend ownership rule
keywords: [ad-spend, MCC, manager-access, stripe, service-fee, client-owns-account]
status: verified
summary: HARD RULE — the client always owns and is billed for their own ad account; BoldLine never fronts, holds, or is financially exposed for client ad spend, and only ever holds manager-level access. Stripe (not started) will bill BoldLine's service fee ONLY, never ad spend.
verified: 2026-07-02
---

**The hard business constraint (do NOT violate):** the client pays for everything. **BoldLine never fronts, holds, or is financially exposed for client ad spend** ("it gets too risky and messy"). Each client's ad account stays **owned and billed by the client**; BoldLine only ever holds **manager-level access** (e.g. via the Google Ads MCC, or Meta manager access — clients link and pay for their own ad accounts).

This governs **all** billing / ad-account / Stripe / Meta / Google Ads work.

- Stated verbatim to clients on the marketing site ("You Keep the Keys" / "your ad account stays yours").
- **Stripe (Task #10, NOT started):** when built it bills **BoldLine's management/service fee only** — never ad spend (the client pays Google/Meta directly). Research/walkthrough already given in chat.
