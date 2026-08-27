---
name: client-portal-approvals
topic: Client portal
task: let clients review + approve anything the owner sends (landing page, ad copy, plans) from their portal, with a badge count + auto email notification
keywords: [client approval, portal review, needs your review, approve, request changes, ClientApprovalsCard, approvals, landing page approval, portal badge, approval_request, notify client]
status: verified
summary: Clients approve ANYTHING the owner queues (not just landing pages) from a new "Review" tab in their portal (portal.mjs) that shows a red pending-count badge (mirrors the owner's alert count) and per-item Approve / Request Changes (+ optional note). Decisions POST back, update client.approvals[], and log to commLog; the owner sees them via getAlerts (changes=yellow, awaiting=blue). Owner queues items from the ClientApprovalsCard on the Client View tab, which auto-emails the client (approval_request template). Built 2026-07-30.
verified: 2026-07-30
---

**Why (Bryson, 2026-07-30):** "when there's something the client needs to approve (e.g. the landing page) there must be a spot in their Client View to review + approve it, and they must be auto-notified about anything needing approval" + "it should be ANYTHING they personally need to approve, not just the landing page" + "they should also have a number for the amount of things needing approval, like how my alerts work on my side."

**Data model:** `client.approvals` = array of `{id, kind ("landing_page"|"custom"), title, body, previewUrl, status ("pending"|"approved"|"changes"), note, createdAt, decidedAt}`.

**Client side (`netlify/functions/portal.mjs`):**
- New **"Review" nav tab** with a red badge = count of `status==="pending"` (built as `apBadge`; the tab label is `Review` + badge). Panel id `t-approvals`, header "Needs Your Review".
- Each item card: title + status pill (Needs review/Changes sent/✓ Approved) + optional description + optional preview link ("View your landing page →") + for pending: an optional note textarea and **Request Changes** / **✓ Approve** buttons.
- JS `decideApproval(id, decision, btn)` POSTs `{approval:{id,decision,note}}` to the portal token endpoint; on success swaps the card to a confirmation and decrements the nav badge (`apDecBadge()`). (These live inside the portal's inline `<script>` string, right after `var TOKEN=…`.)
- **POST handler branch** (before the upgrade branch): finds the pending item in `data.data.approvals`, sets status/`note`/`decidedAt`, prepends a commLog entry (`Client APPROVED "…"` / `Client requested CHANGES on "…": <note>`), saves. Idempotent if the item is already decided/gone.

**Owner side (`index.html`):**
- **`ClientApprovalsCard`** on the **Client View ("portal") tab** (`{!client.internal && <ClientApprovalsCard/>}`, right under the live portal preview). Fields: title, description, preview link → **Send for Approval** creates a pending `client.approvals[]` item (via onUpdate) AND auto-notifies the client by email: calls `client-email` `render` (`type:"approval_request"`) then `send` to `client.email`. Lists all approvals with status pills + a ✕ to remove; shows the client's "changes" note.
- **getAlerts** (index.html): for each approval with `status==="changes"` → yellow "Client requested changes on …"; plus a blue "N items awaiting the client's approval" when any are pending. So decisions surface in the owner's normal alert flow.
- Notification email: **`approval_request`** template added to `client-emails-shared.mjs` ("Something's ready for your review" → Review & Approve button to the portal). Not in the manual EMAIL_TYPES catalog (auto-sent on create), but renderable via the `render` action.

**Verified 2026-07-30:** portal.mjs + client-emails syntax; embedded portal JS syntax; the REAL portal HTML rendered headless with 3 approvals → "Review 2" badge, panel visible, Approve/Request-Changes buttons present, landing-page preview link present, approved item shows its pill, no page errors; OS compiles + mounts clean.

**Refined 2026-07-30 (Bryson feedback):** (a) the approval card's link used to say "View the details →" and navigate to `previewUrl` (Bryson had set it to the OS, so it "opened the OS") — now the **details (`body`) render inline in full** (newlines → `<br>`) and any link is an explicit **"Open your landing page / Open preview ↗"** labeled "Opens in a new tab" (external preview, not "the details"). (b) The owner is now **emailed instantly when the client decides** — the portal POST fires `dispatchAlert` (best-effort, to OWNER_EMAIL) "✅ <client> approved: <title>" / "📝 <client> requested changes: <title> (+ note)" so Bryson can follow up right away. Client delivery is already instant on create (stored on the client → shows on next portal open + the approval_request email fires immediately).

**AUTOMATED 2026-07-30 (Bryson: "I don't want to manually request approval — the AI bots should automatically send it to them and me, and do both alerts"):**
- **Auto-create on deliverable-ready:** publishing a client's landing page (`handleTogglePublish` in index.html, going `published:false→true`) now **auto-creates a `landing_page` approval** (source:"auto"), **emails the client** (approval_request via client-email render+send), and **pings the owner** (new `client-email` action **`owner-alert`** → `dispatchAlert`). Deduped: skips if a `landing_page` approval is already **pending** (re-publish after an approval makes a fresh one). This is the first concrete "bot deliverable → auto approval" hook; the same pattern extends to other deliverables. previewUrl = `${origin}/lp/${landingSlug}` (the public landing page).
- **Both owner alerts:** (1) **create-ping** — fired on publish so Bryson knows it went out. (2) **stale nudge** — `alerts-watch.mjs` (daily) emails the owner if a client hasn't approved after **3 days** (STALE_APPROVAL_DAYS), de-duped via `nudgedAt` stamped on the item; runs for EVERY client (before the active-client `continue`). (3) plus the **decision ping** (client Approves/Requests Changes → instant owner email from the portal POST, prior deploy). getAlerts also escalates a pending approval **blue "awaiting" → yellow "hasn't approved in N days — follow up"** at 3 days.
- **Generalized 2026-07-30 (Bryson: "make sure auto-send is for EVERYTHING — budget included — and anything else"):** the auto-approval is now a reusable path via module-level helpers in index.html — `hasPendingApproval(client,kind)`, `makeApproval({kind,title,body,previewUrl})` (adds id/status:"pending"/createdAt/source:"auto"), and `notifyClientApproval(client,item)` (emails the client approval_request + fires the owner create-ping via client-email `owner-alert`). Pattern: a caller adds the item to `client.approvals` in its OWN onUpdate (composing with other changes — avoids dual-write), then calls notifyClientApproval. Wired triggers: **landing page publish** (kind `landing_page`, deduped on pending) and **campaign creation** in BOTH launch cards (kind `campaign`) — the campaign approval body spells out the **ad BUDGET** ($/day + ~monthly, "you pay the platform directly") so the client signs off on their spend before it goes live (this is the "budget included" ask). Internal My Ads account excluded everywhere. Any future deliverable = call the same two helpers.
- The manual **ClientApprovalsCard** still exists for ad-hoc requests; the landing page + campaign (main deliverables) auto-fire.
- **Client `owner-alert` action** (client-email.mjs): owner-JWT, `{title, body, severity}` → dispatchAlert. Reusable for any create-time owner ping.

**Follow-ups (not done):** (1) the OS portal PREVIEW mirror `makePortalHTML` in index.html was NOT updated to show the Review tab — purely cosmetic (owner-only preview; the real served portal.mjs has it). Update it when convenient (dual-copy gotcha — see os-client-media-upload/portal notes). (2) Could push a client decision to the owner as a phone push (alerts-watch) not just in-app. (3) Landing-page approval could auto-populate previewUrl from the client's built landing page URL.

## 🔴 2026-08-26 — THERE ARE TWO PORTAL RENDERERS AND THEY DRIFT

Bryson, after the upgrade-section rewrite: *"the update didn't stick and it's wrong"*, with a
screenshot of the **Live Client View** still showing a flat `$700/mo` and clickable options.

He was right. The client portal is rendered by **two separate implementations**:

| Renderer | Used by |
|---|---|
| `netlify/functions/portal.mjs` | the real portal the client logs into |
| `makePortalHTML` in `index.html` (~line 2484) | the **Live Client View** card in the OS, an iframe preview |

The fix had landed only in the server copy. **The preview is what Bryson actually looks at**,
so from where he sat nothing had changed. This is the SECOND instance of exactly this drift
found on the same day: the contract has the same split (`index.html` vs
`netlify/lib/contract-shared.cjs`) and had drifted the same way.

🔴 **The rule to carry forward: anything a client can see exists twice in this repo.** Before
calling a client-facing change done, grep for a second renderer.

**Guarded by OUTPUT, not by source.** `tests/verify-portal-upgrades.mjs` now lifts the OS
copy's upgrade block out of `index.html`, builds it with dependencies taken **from that same
file** (never hand-written — a harness that supplies what the real page lacks is how the
`useMemo` crash shipped), and asserts every sentence the server renders is present in the OS
copy too. It also pins the two specific defects from the screenshot: the bare `$price` with
`/mo` beside it, and an unconditional `onclick` on every option.

**59 checks (was 29). Reverting the OS copy to the old flat-price version fails 15 of them.**

## 2026-08-27 — "Upgrade" became "Scale", and the portal's own dashes were cleaned

Bryson: *"is upgrade the right word we should use still?"* No, and the portal contradicted
itself. The paragraph directly above the tier cards tells the client their plan is **set by
their monthly ad budget, not chosen from a list** — then the heading said "Request an
Upgrade", which is the opposite message in the same breath. Worse, "upgrade" means *pay us
more for a better version*, which is a pitch, and the first client signed precisely because
this pricing is not one. The tier follows the budget. That is **scaling**.

| Was | Now |
|---|---|
| Request an Upgrade | **Ready to Scale** |
| Available with Upgrade | **Unlocks As You Scale** |
| Request This Upgrade | **Ask About Scaling Up** |
| "Upgrade" pill on each locked feature | **As you scale** |
| Confirm Upgrade Request | **Send Request** |

The HTML id stays `upgrade-section`; only the words a client reads changed.

**Do the tiers unlock by themselves? Yes.** `qualifies = curBudget > 0 && curBudget >= needed`
(and a combined package needs the higher of its tier floor and `COMBO_MIN_BUDGET`). A
qualifying card loses `uopt-locked`, becomes clickable, and reads "You qualify". ⚠️ It reads
`cl.adBudget` — **the number the client typed in My Info, not their real spend** — so it is
a conversation starter, not a fact. They can only REQUEST; Bryson still approves.

### 🔴 The portal was full of em dashes, and nothing was checking

`verify-no-dashes` covered hyphenated marketing compounds and every model-writing surface,
but never looked at the portal's own hardcoded sentences. A dozen shipped: *"ask for changes
— nothing goes live without your OK"*, *"you pay Google directly — we never hold or touch
it"*. All rewritten. Also two in the OS's campaign-approval copy sent to clients.

**Two things made this invisible.** Half were written as **`&mdash;` entities**, which a
source grep for the character misses entirely. And the guard now **renders the page and
reads it** — decoding entities first — because the copy is assembled from template literals
across hundreds of lines. Left alone: package NAMES (`Full System — Growth`, Bryson's own
product names) and the stage-ring placeholder.

**🔴 A test-harness bug found in the same pass:** `verify-no-dashes` ran its checks with a
synchronous wrapper, so an async test returned a promise, `n++` ran regardless, and any
assertion inside was **silently discarded**. The new portal check reported "passed" no
matter what until the harness was fixed to collect and await promises. *A check that cannot
fail is worse than no check.*
