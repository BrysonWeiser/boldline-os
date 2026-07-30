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

**Follow-ups (not done):** (1) the OS portal PREVIEW mirror `makePortalHTML` in index.html was NOT updated to show the Review tab — purely cosmetic (owner-only preview; the real served portal.mjs has it). Update it when convenient (dual-copy gotcha — see os-client-media-upload/portal notes). (2) Could push a client decision to the owner as a phone push (alerts-watch) not just in-app. (3) Landing-page approval could auto-populate previewUrl from the client's built landing page URL.
