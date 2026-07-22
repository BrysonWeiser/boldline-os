---
name: meta-ads-integration
topic: OS app
task: connect, test, debug, or extend the Meta (Facebook/Instagram) Ads integration in the OS
keywords: [meta-ads.mjs, metaCall, MetaAdsTestCard, MetaLaunchCard, createCampaign, System User token, ads_management, metaAdAccountId, metaPageId, appsecret_proof]
status: built-untested
summary: Full Meta Marketing API integration BUILT 2026-07-20 (mirrors + extends the Google Ads side). netlify/functions/meta-ads.mjs — test / campaigns / setBudget / setStatus / createCampaign, owner-Supabase-session gated, System-User-token auth, Graph v25.0 (META_GRAPH_VERSION overrides). OS: Deploy-tab Test card, per-client metaAdAccountId + metaPageId in Edit→Campaign, ARIA reads live Meta campaigns + ⚡ approve→execute (exec.platform "google"|"meta"), and a Launch Meta Campaign form on the Package tab (builds campaign→adset→creative→ad ALL PAUSED). NOT yet runnable on client accounts — needs env vars set + Meta App Review (advanced ads_management). NOT tested against a live account.
verified: 2026-07-20
---

**Architecture (mirrors the Google MCC):** ONE business **System-User token** operates across every CLIENT ad account the client shares with BoldLine's business portfolio. BoldLine holds **manager access only** — every campaign runs on the CLIENT's own ad account + payment method + Facebook Page. BoldLine never fronts/pays ad spend (hard constraint enforced by design: the `adAccountId` is always the client's).

**Env vars (Netlify — NOT set yet):**
- `META_SYSTEM_USER_TOKEN` — long-lived system-user token with `ads_management` scope (generate in Business Settings → Users → System Users → Add → Generate Token, pick the BoldLine OS app + ads_management + business_management).
- `META_APP_SECRET` — the app's secret (used for `appsecret_proof` on every call).
- `SUPABASE_SERVICE_ROLE_KEY` — already set (shared).
- optional `META_APP_ID`, optional `META_GRAPH_VERSION` (defaults `v25.0`; bump if calls return version errors — Meta ships a new version ~quarterly).

**Code — `netlify/functions/meta-ads.mjs`** (hand-rolled Graph REST, no SDK; stage-tagged errors like google-ads.mjs):
- `test` → GET `me/adaccounts` — lists visible ad accounts. Deploy-tab smoke test.
- `page` → GET `me/accounts` (**pages_show_list**) + GET `{pageId}?fields=name,fan_count,followers_count,engagement` (**pages_read_engagement**). Added 2026-07-21 as the ONLY OS call that exercises the two page permissions — createCampaign's page_id in object_story_spec is an ads-publish, NOT a page read, so it does not tick pages_*. Surfaced as the "📄 Read Page" button on MetaLaunchCard (per-client, uses `metaPageId`). Required for the App-Review demo screencast.
- `campaigns` → `{adAccountId}` reads campaigns + one `insights` call (last_30d), merges by campaign id; returns `{id,name,status,objective,dailyBudget(dollars),impressions,clicks,spend,leads,cpl}`. Budgets are Meta MINOR units (cents) → dollars. Leads summed from lead-type actions.
- `setBudget` → `{campaignId, dailyBudgetDollars}` POST daily_budget (cents). **Assumes campaign-level/CBO budget** — which `createCampaign` uses.
- `setStatus` → `{campaignId, status}` PAUSED|ACTIVE (note: Meta uses ACTIVE, not Google's ENABLED).
- `createCampaign` → builds a lead-gen funnel ALL PAUSED: adimages (optional, from imageUrl→base64→hash) → campaign (OUTCOME_LEADS, CBO daily_budget, PAUSED) → adset (LINK_CLICKS optimization, geo/age targeting, PAUSED) → adcreative (link_data to the landing page on the client's page_id) → ad (PAUSED). Returns the 4 ids. **Nothing spends until activated.**

**OS wiring (index.html):**
- `metaCall(payload)` — owner-authed fetch helper (twin of `gadsCall`).
- Deploy-tab **`MetaAdsTestCard`** (📘 Test Meta Ads Connection).
- Per-client **`metaAdAccountId`** + **`metaPageId`** — set in **Edit → Campaign → Ad Account Linking** (same card also links Google's `googleAdsCustomerId`; before this there was NO UI to link either).
- ARIA reads live Meta campaigns (parallel to Google) and injects a `META ADS:` block into the prompt; `propose_action.exec` gained a **`platform` ("google"|"meta")** field; intake validation + `decideAction` route by platform (Meta re-reads campaigns, fires setBudget/setStatus via metaCall). Approve→execute works identically for both platforms.
- **`MetaLaunchCard`** on the client **Package tab** — pre-fills from client data (landing URL from `landingSlug`, headline/text from `landingPage`, image from `mediaLibrary`), owner tweaks + launches → `createCampaign` (PAUSED). Shows a link-to-Edit hint until `metaAdAccountId` + `metaPageId` are set.

**✅ createCampaign VERIFIED LIVE 2026-07-21** — full funnel (image upload → campaign → adset → creative → ad) created PAUSED on BoldLine's own "BoldLine Demo" ad account (`act_1045064901242944`). The OUTCOME_TRAFFIC + no-adset-bid_strategy + image-required pre-flight fixes all held against the real API. **GOTCHA (cost real time in the demo):** the ad-creatives step fails with *"Ads creative post was created by an app that is in development mode. It must be in public to create this ad."* until the Meta **app is switched from Development → Live** (developers.facebook.com → app → left sidebar **"Publish"**, badge flips Unpublished→Live). Everything before the creative (test/image/campaign/adset) works in Dev mode; only the creative/ad publish needs Live. Going Live ≠ App Review — a Live app + Standard Access operates on the app owner's OWN assets (which the demo uses).

**⚠ STATUS on CLIENT accounts = still unverified.** With standard access the token only works on ad accounts the app's admins/devs own (verified above). CLIENT accounts require **App Review** for advanced `ads_management` (weeks; App Review needs a demo of the working integration — which now exists, so it's submittable). Likely first-run tweaks: the `createCampaign` field set (Meta is picky — objective/optimization_goal/special_ad_categories/targeting spec), city-radius geo targeting (currently country-level only; city targeting needs geo KEYS not names), and `optimization_goal` (LINK_CLICKS works without a pixel; switch to OFFSITE_CONVERSIONS once the client has a pixel + events). Render-verified headless (10/10 screens, zero errors); functions syntax-clean.

**Business verification** (prerequisite) APPROVED 2026-07-19 — see `meta-marketing-api`.
