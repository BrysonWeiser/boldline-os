---
name: campaign-launch-approval
topic: OS app
task: get alerted when a campaign is created/needs approval, and have a way to set it live
keywords: [campaign approval, launch alert, pendingActions, LiveCampaignsCard, GoogleLaunchCard, MetaLaunchCard, enable_campaign, go live, start ads, notifications, approve]
status: verified
summary: Creating a campaign (Google or Meta launch card) now (1) adds a pendingAction "Launch <platform> campaign X" to the client — which surfaces automatically in the bell count + a toast ("Approval needed…") + the Notifications panel with an Approve button that sets it LIVE — and (2) emails the owner (dispatchAlert, best-effort, server-side in createCampaign, so it also covers bot-created campaigns). Separately, the LiveCampaignsCard Start/Pause control is now shown for ANY client with a linked ad account (was internal-only), giving a persistent manual launch/pause control. Built 2026-07-28 (Bryson: created campaigns gave no notification + regular clients had no way to make the ad go live).
verified: 2026-07-28
---

**Why (Bryson, 2026-07-28):** in the Meta-recording test he created a campaign but got NO notification that it needed approval, and there was no way to make the ad go live for a regular client (the Start/Pause card was internal-only).

**The gap (not the infra):** the notification machinery ALREADY handled pending approvals — `notifCount` (index.html App) sums `pendingActions` into the bell badge, the toast detector pushes "Approval needed: <title>" for each new pendingAction, and `NotificationsPanel` renders `pendingApprovals` with Approve/Reject. Approving a pendingAction with an `exec` payload runs it (`decideAction`). The ONLY missing piece: **createCampaign never added a pendingAction**, so nothing ever surfaced.

**What was added (index.html):**
- `GoogleLaunchCard` / `MetaLaunchCard` now take an `onUpdate` prop (passed at the Package-tab render). On a successful `createCampaign`, they prepend a pendingAction to the client:
  `{id:"launch-g|m-<campaignId>", title:"Launch <Google|Meta> campaign \"<name>\"", detail, cat:"launch", ts, exec:{platform:"google"|"meta", campaignId, campaignName, kind:"enable_campaign"}}`.
  - Google's campaign id is extracted from the returned `campaignResourceName` (`.split("/").pop()`); Meta returns `campaignId` directly.
  - `kind:"enable_campaign"` hits `decideAction`'s non-pause/non-budget branch → sets **ENABLED** (Google) / **ACTIVE** (Meta) when approved. Approve = the campaign goes live (re-reads the account first to get fresh resource names, per the existing guarded-write pattern).
  - Result: bell +1, a toast fires, and the Notifications panel shows "Launch … campaign" with an **Approve** button = one-tap go-live.
- **LiveCampaignsCard un-gated:** the Package-tab render changed from `{client.internal && <LiveCampaignsCard/>}` to `{(client.internal || client.googleAdsCustomerId || client.metaAdAccountId) && <LiveCampaignsCard/>}`. The component was already client-agnostic (reads the client's linked account ids, real-spend-confirm Start/Pause) — it was only gated by a product decision. Now every client with a linked ad account gets the persistent Start/Pause launch control ("Your Live Campaigns").

**What was added (server, covers bot-created too):** `netlify/functions/google-ads.mjs` + `meta-ads.mjs` `createCampaign` now fire a best-effort `dispatchAlert` (email; SMS gated off) — "New <platform> campaign … created and PAUSED, awaiting approval." The launch cards pass `clientName` for the email. Because this lives in createCampaign itself, it fires for ANY creation path (owner launch card today; autonomous bot creation when that's added later). Dynamic-imported + try/caught so it never blocks the create.

**Two channels now:** IN-APP (pendingAction → bell + toast + panel + Approve) and EMAIL (dispatchAlert). SMS rides along once SMS_ENABLED=1.

**Verified 2026-07-28:** functions `node --check` clean; OS babel-compiles (env,react); headless render of a regular (non-internal) linked client's Package tab shows "Your Live Campaigns" + both launch cards, mounts with no page errors. The pendingAction path itself reuses the already-working ARIA-proposal approval flow.
