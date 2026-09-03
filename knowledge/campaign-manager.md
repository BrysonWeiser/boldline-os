---
name: campaign-manager
topic: OS app
task: see, start, pause and DELETE every ad campaign across all ad accounts in one screen
keywords: [campaign manager, CampaignManagerScreen, delete campaign, removeCampaign, deleteCampaign, start ads, pause, stray campaigns, not delivering, effective_status, adset paused, campaigns screen, cross-client campaigns]
status: verified
summary: New global **Campaigns** screen (`CampaignManagerScreen` in index.html; SideNav + More sheet, `screen==="campaigns"`) listing EVERY campaign on EVERY linked ad account — the My Ads house account and all clients — with Start / Pause / **Delete** per campaign, summary tiles (count, live, live daily budget, 30d spend), and status/platform/account filters. Adds the first destructive campaign actions to the API layer: `google-ads.mjs action=removeCampaign` and `meta-ads.mjs action=deleteCampaign`, both double-confirmed in the UI and both PAUSING a live campaign before deleting. Built 2026-08-12 after four stray test campaigns appeared the moment Bryson linked the ad account and he had no way to reach or remove them. 26-case Playwright suite, all passing.
verified: 2026-08-12
---

**Why (Bryson, 2026-08-12):** linking the Meta ad-account ID surfaced four identical paused `DetailKing ATL — Leads` campaigns (leftovers from earlier API testing) inside the house account's per-client card. *"I need a way to access them and to be able to delete them if I want. This goes for all campaigns for me or any client. I want a clean spot where I can see all the paused and active campaigns."* Until now the ONLY campaign view was `LiveCampaignsCard`, which is per-client, buried in a tab, and had no delete.

**The screen — `CampaignManagerScreen({clients,onBack,isDesktop,onSelectClient})`.**
- Reachable from the **desktop SideNav** ("Campaigns", paper-plane icon, above Lead Scout) and the **mobile More sheet** (first row); `screen==="campaigns"` also lights the bottom-nav More button.
- **Gets the FULL `clients` array, not `realClients`** — the house account must appear here (it is the whole reason the screen exists). Clients with no linked ad account are skipped entirely.
- Loads every linked account in parallel (`Promise.all`), one read per account. **Per-account failures are collected and RENDERED** in a red "Couldn't load N accounts" card with the real underlying error, while everything else still lists — the recurring lesson from the Lead Scout week (a collected-but-never-displayed error is the same as no error handling).
- **Summary tiles:** Campaigns · Live now · Live daily budget · Spend (30d).
- **Filters:** All/Live/Paused, Both/Google/Meta, and an account dropdown (only when >1 account is linked). Grouped by client, house account sorted first with a gold INTERNAL pill and an "Open ›" jump into that client.
- `maxWidth:1180` (not 900) so 1280/1600 don't sit in an oversized gutter — the standing responsive rule.

**"Not delivering" — a genuinely useful catch.** Meta reports BOTH `status` and `effective_status`. A campaign's own switch can read `ACTIVE` while delivery is blocked underneath (`ADSET_PAUSED`, no active ads). The row shows the campaign as **Live** (that IS its status, and the Pause button acts on it) plus an amber **Not delivering** chip and a plain-English line: *"Meta says this campaign is on, but it isn't serving (adset paused) — usually the ad set or the ad underneath is paused."* Without this a campaign looks live and spends nothing.

**DESTRUCTIVE ACTIONS — new, and irreversible.**
- **`google-ads.mjs` `action:"removeCampaign"`** ({customerId, campaignResourceName, wasLive}) → `campaigns:mutate` with a `remove` operation. Google has **no hard delete**: the campaign goes to status REMOVED, which is **permanent — it can never be re-enabled**, only rebuilt.
- **`meta-ads.mjs` `action:"deleteCampaign"`** ({campaignId, wasLive}) → HTTP `DELETE` on the campaign node, which takes its ad sets and ads with it. Required adding `DELETE` to the `graph()` helper's query-param branch (it previously only handled GET/POST).
- **Both PAUSE a live campaign first** (`wasLive:true`), so spend stops even if the delete then fails — a half-finished delete must never leave ads running. The pre-pause is best-effort and logged; the delete proceeds regardless.
- **UI confirmation is two-step for a live campaign**, one step for a paused one. The copy names the client, the platform, that it cannot be undone, and (for Google) that REMOVED is permanent. Already-spent money stays on the ad account's billing record either way — stated in the dialog so it isn't a surprise.

**`LiveCampaignsCard` is untouched** and stays as the in-client view. Two views on purpose: the card answers "what's running for THIS client" while you're already inside them; the screen answers "what's running anywhere".

**Verified 2026-08-12 — 26 Playwright cases, all passing**, driving the REAL component in a real Chromium with `gadsCall`/`metaCall` monkey-patched: per-account reads, grouping, unlinked-client exclusion, all four summary tiles' arithmetic ($56.58 live daily from 6.58+5+45; $1,465 30d), the ADSET_PAUSED flag, delete-declined sends no API call, a live campaign requires TWO confirmations and sends `wasLive:true`, all three filters, a failing account rendering alongside successful ones, and **0px horizontal overflow at 390/768/1280/1600**.

**GOTCHA — headless harness against index.html:** Chromium in the sandbox has no route to unpkg, so the four CDN `<script src>` URLs must be **vendored locally and rewritten by the test server** (curl needs `-L`; unpkg's `@18` specifiers are redirects, and without it you silently get 56-byte files). Also, `Label` and the tile labels are CSS-uppercased, so `innerText` assertions must be case-insensitive. Full harness: `scratchpad/verify-campaigns.js` pattern — worth rebuilding rather than hunting for.

**🔴 GHOST CAMPAIGNS + AN UNDELETABLE ROW — fixed 2026-08-14.** Bryson tried to delete two campaigns and got `removeCampaign: The operation is not allowed for removed resources. [contextError=OPERATION_NOT_PERMITTED_FOR_REMOVED_RESOURCE]`. Google was saying **they are already deleted** — he was looking at rows that no longer existed and could never be acted on.

**Cause, and it is two bugs stacked:**
1. **`getCampaigns` never filtered out REMOVED campaigns.** A removed campaign keeps its historical metrics rows, so `WHERE segments.date DURING LAST_30_DAYS` returns it **forever**. The list showed ghosts. Fixed with `AND campaign.status != 'REMOVED'`, which also corrects the campaign COUNT that `ads-sync` stores and therefore the `keywords`/`ads` pipeline steps derived from it.
2. **Delete was not idempotent.** Deleting something already deleted is *the outcome the caller asked for*, but it surfaced as a red error and left the row on screen looking broken. `isAlreadyRemoved()` now detects it by Google's error **code** (with the message as a fallback, because the code is the reliable half and the message is the readable one) and returns success.

**Tolerance is opt-in, per call.** Only the three delete paths pass `tolerateRemoved` — campaign, ad group, ad and keyword removes. A **pause** or an **add** hitting a removed resource is a genuine error the operator must see, and the tests assert exactly that: same fake Google failure, delete succeeds, pause and add still raise.

**Also fixed while in there:** `setAdGroupStatus(..., "REMOVED")` was sending a status *update*. Google models ad-group removal as a `remove` operation, the same way ad removal already was.

**Verified by 16 cases** using Google's verbatim error body, including that an unrelated failure still raises, the detector survives a malformed body, and exactly three call sites are tolerant.

---

## 2026-09-03 — you can now OPEN a campaign, and Meta finally has a detail view

**Bryson:** *"i need a way to be able to open a specific campaign (internal ones included)
and it opens up the details of that campaign not the campaign builder screen"*.

### 🔴 Gap 1: Meta returned "unsupported" and drew nothing

`loadDetail` read `if (r.platform !== "google") { setDetail(... state:"unsupported") ; return; }`
and **nothing rendered that state**. Google campaigns expanded into ad groups, ads and
keywords; Meta expanded into blank space. **The one campaign he actually had running was
the one he could not look at.**

`meta-ads.mjs` now exports `getCampaignDetail(adAccountId, campaignId)` and exposes an
`action: "campaignDetail"`, **deliberately shaped to match Google's**: ad sets come back
under the same `adGroups` key with the same `impressions / clicks / cost / conversions /
ads` fields. One panel renders either. Two shapes would have meant two panels, and two
panels drift until one is quietly wrong.

An ad set also carries what **only** it knows and what appears nowhere else in the OS:
`dailyBudget`, `optimizationGoal`, `billingEvent`, `destinationType`, and `targeting`
flattened to `{places, ageMin, ageMax, platforms}`. That is the answer to *who is this ad
even going to*.

Insights are fetched **once at `level: "adset"` for the whole account** and joined locally,
not once per ad set. A missing insights response leaves zeros rather than failing the read,
because "not delivered yet" must not look like "broken".

🔴 **An ad whose ad set is missing is listed under "Ads with no ad set".** Dropping it would
render a campaign as having **no ads while it is spending money**.

### 🔴 Where the two platforms genuinely differ (each one a shipped bug avoided)

| | Google | Meta |
|---|---|---|
| Ad copy | MANY headlines, mixed at serve time | **one** headline + one body |
| Live status | `ENABLED` | `ACTIVE` |
| Writes | resource names, all supported | **read only here** |

- Rendering Meta through the Google shape printed **"(no headlines)"** over perfectly good
  copy, which reads as broken software.
- Checking only `ENABLED` marked **every live Meta ad set and ad as paused** on a campaign
  that was spending.
- Every write button posts a **Google resource name** to `google-ads`. On Meta they are
  hidden, with a visible line saying *"Read only. Start and pause the whole campaign from
  the row above"* — a control that silently vanishes reads as broken; one that explains
  itself reads as deliberate. **Meta ad-set writes were not added**: he asked to SEE, and
  new destructive surface on the platform he is live on was not worth it unasked.

### Gap 2: getting there from where he actually looks

From **My Ads** a campaign name led nowhere but the builder underneath it, which is what he
was complaining about. `LiveCampaignsCard` rows now carry **Details ›**, which calls
`onOpenCampaign(key)` → `CampaignManagerScreen` opens on that campaign.

🔴 **The key must be the one the list opens on** (`campaignResourceName` for Google, `id`
for Meta). If they ever disagree the deep link silently does nothing: the screen opens, the
campaign does not, and the button looks broken.

🔴 **It opens ONCE.** The effect is guarded on `openKey` being unset as well as on the key,
or every re-render drags him back to the campaign he arrived on after he has closed it. The
focus is cleared on Back, or a later visit from the sidebar jumps somewhere he did not ask.

### Testing note

`tests/verify-campaign-detail.mjs`, 16 checks, eight mutations, all caught.

🔴 One mutation reported the **wrong cause**: removing the Meta call failed with *"the panel
no longer asks Google for detail"*, because the ternary was checked first. Assertions
reordered so the likeliest break reports itself rather than its neighbour.

🔴 Two **existing** checks in `verify-approval-cleanup` pinned `CampaignManagerScreen`'s
exact prop list. Adding `focusKey` made them report *"the Campaign Manager can save"* as
broken while saving worked perfectly. They now check that it **receives** `onUpdate`.
**A signature match fails on every future prop; pin the rule, not the spelling.**
