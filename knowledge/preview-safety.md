---
name: preview-safety
topic: Working preferences
task: add or change any preview, demo, test send or dry run in the OS
keywords: [preview, iframe, srcdoc, srcDoc, sandbox, allow-forms, allow-scripts, allow-same-origin, BL_PREVIEW, about:srcdoc, phantom lead, fake approval, preview fires for real, dry run, demo mode, test send, landing preview, portal preview, contract preview, email preview, verify-preview-safety]
status: standing rule + enforced
summary: Anything the OS renders so Bryson can look at it must be incapable of writing to a client's record, sending to a real person, spending money, or navigating the OS away from itself. Two live bugs of this shape were found in one sitting, one of which recorded a client decision the client never made. Enforced by a manifest test that fails when a new preview is added without a guard.
verified: 2026-09-01
---

## The rule

Bryson, 2026-09-01, after finding the landing page preview navigated to the OS: *"make sure to
always check that things like that dont happen with future clients or anything we build."*

**Anything the OS renders so he can LOOK at something must be incapable of changing anything
real.** No writing to a client's record, no sending to a real person, no spending, and no
navigating the OS away from itself. Previews, demos, test sends, dry runs, all of it.

## 🔴 Why this class of bug keeps happening

Every preview works by handing a **real client object, carrying real access tokens, to the same
renderer that serves the real thing.** Same origin, same token, same code. That is deliberate,
because a preview built from a second implementation drifts and then lies about what the client
sees. The cost of that choice is that **the only thing between "looking at it" and "doing it" is
a guard somebody remembered to add.**

So the failure is never exotic. It is always: someone added a preview and did not think about it.

## What was actually found, 2026-09-01

**1. The landing page preview navigated to the OS.** A bare `href="#lead-form"` inside an
`iframe srcdoc` resolves against the **parent** document, because a srcdoc document's own URL is
`about:srcdoc`. Pressing the main button took the frame to the OS app. It also carried the real
`leadToken`, so a submit would have created a phantom lead.

**2. 🔴 THE CLIENT PORTAL PREVIEW ACTUALLY FIRED, and nobody had reported it.** Found by
sweeping for the class rather than waiting. Pressing **Approve** or **Request Changes** in the
preview sent a real `POST /.netlify/functions/portal` with the client's real `portalToken` and
**recorded a decision the client never made.** `delMedia` would really have deleted a client's
uploaded file. Confirmed in a headless browser, not inferred from source.

🔴 **And note WHY the portal was worse than the landing page.** The landing page happened to be
protected by an unrelated accident: the preview sandbox omits `allow-forms`, so Chromium blocked
its form submit. The portal's actions are **buttons calling fetch**, not form submits, so that
accident protected nothing. **Never count on a sandbox attribute in another file as the guard.**

## The guards now in place

| Preview | What stops it | Where |
|---|---|---|
| Landing page | `about:` check **before** the intake fetch, and fragment clicks handled in JS so nothing navigates | `netlify/functions/landing.mjs` |
| Client portal | `BL_PREVIEW` wraps `window.fetch` and **rejects every non-GET**, plus `alert` silenced, `confirm` answers no, and a visible "Preview only" bar | `netlify/functions/portal.mjs` **and** its mirror in `index.html` |
| Contract (two embeds) | Inert by construction: no fetch, no form, no onclick, no external links. Asserted, so it stays that way | `netlify/lib/contract-shared.cjs` |
| Email | `sandbox=""`, so nothing in it can run | `index.html` |

**GETs are deliberately still allowed** in the portal guard. Blocking everything makes the
preview useless, and a useless preview gets "fixed" later by deleting the guard.

**The bar is not decoration.** A button that silently does nothing reads as broken, and broken
previews get repaired by removing whatever is stopping them.

## 🔴 Enforced, not remembered

`tests/verify-preview-safety.mjs` (27 checks). It holds a **MANIFEST of every `srcDoc` embed in
the OS** and what makes each safe. **A new preview added without an entry fails the suite**, which
forces the question to be asked once instead of discovered by a client. It also rejects an embed
with no `title`, since one that cannot be named cannot be reasoned about.

**Eight mutations applied, all caught**, including a new unreviewed preview appearing, a preview
losing its title, the portal guard no longer blocking writes, the email sandbox removed, and the
contract gaining a live fetch.

🔴 **One mutation escaped the first version and the lesson generalises.** Setting
`BL_PREVIEW=false` left every string the suite looked for intact while disarming the guard
completely: it asserted the guard's PARTS existed, not that the detection was ARMED. The
expression itself is now pinned. **A guard that is never armed reads identically to one that
works.**

There is also a **drift check**: the portal exists twice (served function + OS mirror) and the
two guards must be byte-identical. Every bug of this class so far has been one copy fixed and
the other forgotten.

## When you add a preview

1. Give the iframe a `title`.
2. Add a row to `MANIFEST` in the test naming what makes it safe.
3. Add an assertion for that guard.
4. Break the guard once and watch the test fail.

## Related

`sms-consent` (where both bugs were found), `lead-handoff`, `repo-tests` (the testing doctrine,
including the Playwright route-shadowing trap that wasted a cycle here twice), `sheet-layering`
(the backtick-in-a-template-literal trap, which also bit during this work).
