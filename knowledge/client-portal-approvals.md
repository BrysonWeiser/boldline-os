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


## 2026-08-31 — the "Your Website" card, and two more copies that had drifted

Added after auditing the portal against what the first real client's launch actually needed
(Bryson: *"double check that there is everything in the client portal that there needs to
be"*). Two genuine gaps, both hit on the very first client:

1. **Who looks after their website.** Both the custom landing-page domain and the CRM lead
   forward need one small change on the client's side, and on client one that meant emailing
   to ask who to talk to. Now `campaignSetup.webContact`.
2. **The three legal pages a text-consent checkbox has to link** — `privacyUrl`, `termsUrl`,
   `smsOptInUrl`. Shaun Smith, 2026-08-29: without a consent box the lead still arrives but
   **can never be texted**, so the one-minute reply that makes ad leads convert never happens
   and nothing anywhere reports it as a failure. Keep any `.html` on the end; the
   extensionless versions often do not resolve.

All four are `campaignSetup.*`, and `sanitizeFields` passes any `campaignSetup` sub-key
through, so no server change was needed. **A test now pins that**, because if it ever became
a per-field allowlist these answers would be silently discarded on save.

### 🔴 The parity test found two drifts nobody had noticed

Adding a field-level comparison of the two portal copies immediately failed on two
pre-existing bugs, neither of which was what I was looking for:

- The **preview asked for `callTrackingNumber`**, which the real portal does not and should
  not. That is the number BoldLine provisions for the client, not one they supply.
- The **preview omitted `businessPhone`**, which the real portal does ask for, for call
  forwarding.

So the preview showed a field no client ever sees and hid one every client fills in. Both
corrected to match the real portal. The lesson is the usual one for this file: the tab-level
check pins the panes, but **the field-level check is the half that loses a client's answer.**

### Known and accepted: the tab strip scrolls on a phone

Six tabs is 481px of buttons in a 390px strip, so the nav row is swipeable at phone width.
That is the deliberate scrolling-tab pattern the OS uses too, not content overflow. Worth
revisiting only if a client reports missing the Contract tab, which sits last.


## 2026-08-31 — unsigned agreements are announced on Status, and the nav measurements

**The banner.** `Pending Signature` used to exist only inside the Contract pane, the last of
six tabs and off-screen on a phone until you swipe. A client who had not signed got no hint
anywhere. Status now leads with an amber banner (cannot start until signed, check spam or
promotions, **Read and Sign It** button) and the Contract tab carries a dot. Driven by
`needsSignature = !cl.contractSigned && cl.contractStatus === "pending"`, mirrored in both
portal copies, and tested in BOTH directions since a banner that never clears nags someone
who signed months ago.

**The nav, measured rather than argued about** (real portal CSS, headless, 390 and 360px):

| Option | 390px | 360px |
|---|---|---|
| Current six tabs | 451px, overflows by 61 | overflows by 91 |
| Six with shorter labels (Package, Info) | 411px, overflows by 21 | overflows by 51 |
| **Four: Status, Review, Reports, Account** | **fits exactly** | **fits** |
| Five: …Account, Contract | fits | overflows by 1 |

So shortening the labels does not work, and five only moves the problem to smaller phones.
**The recommendation is four**, with Account holding My Package, My Info and Contract as
sections on one page. That matches use: Status often, Review when badged, Reports monthly,
and the other three touched once at setup then almost never. Not built yet, deliberately:
the tab layout is tidiness, and getting the first client's campaign live is worth more.


## 2026-08-31 — BUILT: the four-tab portal

Shipped. **Status | Review | Reports | Account.** Package, Info and Contract are now
`<details>` sections inside Account, closed by default.

**Why collapsed, not stacked.** The first build stacked them flat and measured **5,785px,
nearly seven phone screens**, which is worse than the six tabs it replaced. Closed it is
**844px, exactly one screen**. That change only happened because the mockup was measured
rather than trusted.

**Both dots.** `sigDot` puts the unsigned-agreement marker on the Agreement section header as
well as the tab, so it is visible on the way in and again once inside. `goContract()` switches
tab AND sets `acc-agreement.open = true`; landing on three collapsed rows reads as a broken
button, and there is a test for it.

**The OS preview renders Status and Account only.** It has never had the approvals or reports
panes, and a tab that opens nothing is worse than a tab that is absent. The Live Client View
card says so and links to the real portal.

### 🔴 Two method notes worth keeping

1. **Edit this file by LINE, not by substring.** The first attempt at this change did
   substring surgery across a 400-column template literal, produced an unterminated string,
   and was reverted. One pane opens with `'` and the next with a backtick, so a replacement
   that is valid in one is a syntax error in the other.
2. **A mutation that does not apply looks exactly like a guard that works.** One of the three
   break-tests here silently no-oped because the search string did not match, and reported a
   pass. Always confirm the mutation actually changed the file before believing the result.


## 2026-08-31 — the contract letterhead, and one false alarm

**False alarm first, because the lesson is about tooling.** Bryson spotted a missing logo in
a screenshot. It was my screenshot harness answering EVERY url with the portal HTML, so
`/logo.png` received HTML bytes and drew as a broken image. The product was fine. Confirmed
three ways before saying so: the live OS site serves `/logo.png` as image/png at the repo
file's exact byte size, the iframe's own image reported `naturalWidth` 292, and a corrected
screenshot shows it. **The harness now serves real files**, so a missing image in a future
screenshot is a finding rather than an artifact. A guard also fails if the logo tag or
`logo.png` itself ever disappears, because the agreement would still render, just unbranded,
on every client's portal.

**The real fix.** The wordmark needs **204px** on one line. In the portal iframe the contract
gets 274px on a 360px phone and 304px on a 390px one, so BOLDLINE and MEDIA wrapped beside the
logo on every phone. Below 460px the header is now a centred stack; two smaller steps carry it
down to a 320px screen. **Print is unaffected** (a sheet is ~816px, above every rule) and that
was verified by rendering standalone at print width, not assumed.

🔴 **THE BREAKPOINTS ARE THE CONTRACT'S WIDTH, NOT THE PHONE'S.** It renders in an iframe, so
the media query sees the frame, not the device. A 340px cutoff looks like "small phones" and
actually fires on ordinary ones. Measure the frame before choosing a number.

---

## 2026-09-02 — Publish and "send for approval" are two buttons now

**Bryson:** *"when I pressed publish for the updated landing page it automatically published
it and sent it for approval... I think we should add a button that says send for approval...
and make it so if I want to manually publish the page without sending for approval that's
what the publish button does"*.

🔴 **The old combined behaviour was HIS OWN earlier request** (2026-07-30: *"don't make me
manually request it"*), and it was right while publishing was the only action there was. It
stopped being right the moment he needed to fix a typo on a live page: every small edit
re-published AND emailed the client another approval request. **Superseded on purpose. Do not
"restore" it.**

| Button | Publishes | Emails the client |
|---|---|---|
| **Publish / Unpublish** | yes | **no** |
| **Send to <name> for Approval** | **no** | yes |

Both carry hover text saying which one sends mail. Not knowing that was the actual confusion.

### 🔴 The real bug was not the buttons: an unpublished page does not render

`landing.mjs` serves a **Coming Soon placeholder** unless `published` is true. So sending an
unpublished page for approval would have emailed the client a link to a page that is not
there, and **every surface on our side would have reported success** while the client sat
looking at a placeholder.

So sending for approval mints `landingPage.previewKey`, and the approval link carries
`?preview=<key>` **only while the page is unpublished**.

**Three properties of that key, each closing a real hole:**

1. 🔴 **It is its own random value, NOT the portal token.** A landing page loads third-party
   fonts, and the full URL travels in the referrer header, so a portal token in a page
   address is handed to every host the page touches on the first request. This key unlocks
   one page render and nothing else.
2. 🔴 **Compared against a NON-EMPTY stored key.** Without the emptiness check, a client with
   no key set is previewable by anyone sending `?preview=`, which is the entire gate defeated
   by an empty string.
3. 🔴 **An existing key is REUSED, never rotated.** Minting a fresh one per send kills the
   link in any approval email already sitting in the client's inbox, which is the same
   dead-link failure in a slower costume.

The button is hidden on the **house account** (nobody to approve anything, so it would email
Bryson about his own page) and while an approval is already pending, with a line saying why
rather than a control that silently disappears.

### Testing note

`tests/verify-publish-vs-approval.mjs`, 14 checks. The publish gate is **lifted out of
`landing.mjs` and executed**, not restated, because a restated rule is a second
implementation that happens to agree today. Six mutations, all caught.

🔴 One test bug fixed on the way, and it is the usual shape: the extraction's END anchor
matched an identical line ABOVE the gate, so it lifted an empty string and the suite failed
on "could not lift the gate" rather than on anything real. The end anchor is now searched
**from** the start anchor.

### Not built, and worth deciding later

Approving in the portal does **not** publish the page. It records the decision and alerts
Bryson, same as every other approval. Auto-publishing on approval would mean a client action
putting a page live with nobody looking, so it was left out rather than assumed.

---

## 🔴 2026-09-02, later — approving something MAKES IT GO LIVE

**Bryson:** *"Once something is approved by whichever party needs to approve it the thing
should instantly go live"*.

**This was not a missing feature. It was the product saying something untrue.** The campaign
approval card reads, in writing:

> "Approve to launch, or request changes and we'll adjust before anything spends."

A client pressing Approve had every reason to believe their ads were now running. What
actually happened: a decision was recorded, Bryson got an email, and **nothing ran** until he
went and pressed a second button himself, possibly hours later.

| Approval kind | What approving does now |
|---|---|
| `landing_page` | Sets `landingPage.published = true`. No API call, no failure mode. |
| `campaign` | Starts it on the platform at **every level**, via the same `activateCampaign` the owner-side approve uses. |
| any, "changes" | **Nothing.** That is the point of requesting changes, and it is pinned. |

### Which platform

`makeApproval` now stamps `platform` on campaign approvals, and both launch cards pass it.
**Fallback:** the owner's `pendingActions` entry with the same `exec.campaignId`, because
approvals created before this change carry no platform, and without the fallback any such
approval would refuse to launch.

(An earlier version of this note claimed one such approval was outstanding on Stencil &
Thread. It was not. A campaign approval only exists once a campaign has been BUILT, and no
campaign can be built for Sebastian until his Google Ads customer id arrives. What he has
outstanding is a LANDING PAGE approval.)

🔴 **With no platform from either source it REFUSES.** Guessing starts a campaign on the
wrong account and spends somebody else's money. Refusing is loud and costs nothing.

### 🔴 Failure is contained and loud, and the three parts matter separately

1. **The approval is still recorded.** Losing a client's approval because Google had a bad
   minute makes them approve twice and trust the portal less.
2. **The owner's reminder is NOT cleared.** Clear it on failure and nothing anywhere is left
   saying the campaign is dead.
3. **The alert goes RED**, titled "approved but it did NOT go live", instead of the same
   green tick a working launch gets. A green tick on a dead campaign is how it sits there for
   days. The alert body now reports what ACTUALLY happened, because since this change
   "approved" and "live" are two different facts.

### Testing note

`tests/verify-approval-goes-live.mjs`, 13 checks. The real block is **lifted out of
`portal.mjs` and executed**, with only the dynamic `import(...)` specifier rewritten so the
platform modules can be stubbed. Six mutations, all caught.

🔴 One EXISTING assertion in `verify-approval-cleanup` had to be **updated, not deleted**: it
matched `makeApproval({kind:"campaign",campaignId:` and so required the id to sit immediately
after the kind. Adding `platform` between them made it report "the cards stopped stamping the
id" when they had not. A pattern that pins field ORDER pins more than it means to.

### Still not automatic

Nothing else has an approval kind yet. If one is added, decide at that moment what "go live"
means for it, and add it to the block in `portal.mjs` rather than leaving it recording a
decision that does nothing.
