---
name: site-coming-soon
topic: Marketing
task: the marketing site's temporary "Meta coming soon" state, and the automatic trigger that reverts it
keywords: [coming soon, wizard lost meta, contact wizard platform options, pickFamily reachability, meta coming soon, site gating, CS:META-SOON, sentinel comments, revert a4b83f0, october 2026 estimate, google only, auto revert trigger, meta approval watch]
status: verified
summary: boldlinemedia.com temporarily shows "Coming soon — estimated October 2026" on the Meta Ads, Combined Systems and E-Commerce package tabs (Google is untouched and genuinely open), so Bryson can cold call for Google clients without over-promising. The ENTIRE change is one self-contained commit **`a4b83f0`**, designed to be reverted in one step the moment Meta grants standard access. Reverting is AUTOMATIC by two mechanisms: a standing rule in CLAUDE.md that any session must act on the instant it learns Meta is live, and a weekly Routine (`trig_012hH9VLXchaMj7LUc461Wrb`, Mondays 09:00 Phoenix) that checks and either reverts or asks Bryson directly. Every edit is wrapped in `CS:META-SOON` sentinel comments as a fallback if `git revert` ever conflicts.
verified: 2026-09-14
---

# ✅ FLIPPED BACK — 2026-09-14, the hour Meta approved

All 31 `CS:META-SOON` sentinels removed (29 in `marketing-site/index.html`, 2 in
`get-started/index.html`). Every one of the 11 packages now books a call. No waitlist button, no
"Coming soon" pill, no coming-soon copy survives anywhere.

**Flipped by the SENTINELS, per `docs/META-FLIP-CHECKLIST.md`, not by `git revert a4b83f0`** — the
revert would have left the Full System: Acquisition card's waitlist button in place, because that
card was added after the commit.

## 🔴 The flip deleted something it should have kept, and the checklist told it to

Bryson caught it the same day: *"at the bottom of the website its still just google meta wasn't
added."* The **contact wizard's first question** ("What do you need help with?") came back offering
only **Google Ads** and **Not sure yet**.

**Why.** The gating commit did not *label* the existing Meta buttons, it **added** them, wrapped in
`<!-- CS:META-SOON:START wizard -->` … `END wizard`. The checklist's rule for a START/END block is
"delete the whole block including both markers", so the flip did exactly what it was told and took
the buttons with it. The block markers could not tell the difference between *scaffolding added for
the gated state* and *real content that merely arrived inside the gated state*.

**The lesson for any future gating job:** a START/END block must contain ONLY things that should
cease to exist. Anything the visitor should still see afterwards goes outside the markers, even if
its wording changes. Wrap the `(soon)` label, not the button.

**Restored** with the original `data-val` strings byte-for-byte (`Meta Ads`, `Google + Meta`) so the
Netlify form payload and the whole lead pipeline are unchanged, and the original label
**"Facebook / Instagram"** rather than "Meta Ads" — in a lead form the visitor may not know the word
Meta. Four chips now, wrapping to two rows on a phone.

**The recommender was fine.** Its `FAMILIES` map and routing survived intact; a Meta result is
reachable and so is Combined. But that was checked by *running* it, not by grepping for `meta:`.

## Pinned so it cannot silently regress

`tests/verify-meta-flip.mjs` now asserts, in its flipped branch:
- the contact wizard offers a Meta option, and a both-platforms option
- **the shipped `pickFamily` is executed** across every combination the modal can actually produce
  (its real button values, read out of the page), and each of google / meta / combined / ecom must
  come out at least once

The second one is the point. `FAMILIES.meta` existing proves nothing about whether any answer can
reach it — the gated build had the map intact and the routing switched off. Both assertions were
mutation-tested: removing the wizard buttons fails 2 checks, making the social branch return
`google` fails "a real answer set reaches the meta packages".

The two traps the checklist warns about both held: `rec-gate` is a `/* */` JavaScript comment, not
HTML, and `styles` + `rec-gate` carry a trailing note after the id. The removal matched on
`CS:META-SOON:START <id>` and accepted either comment syntax, so neither was skipped.

🔴 **A test assertion in the flipped branch was stale and had never once run.**
`verify-meta-flip` expected **12** packages; the site has **11**, because Full System: Launch was
deleted on 2026-08-18 when pricing moved to the greater-of model. That branch only executes once
the sentinels are gone, so a wrong number sat there for a month and failed on the one morning it
mattered. Now counted **per panel** (google 3, meta 3, combined 2, ecom 3) so a card moving between
panels cannot cancel out. Same shape as KB `scheduled-job-wiring`: code that has never executed is
not tested code.

Verified in a real browser at 390/768/1280/1600: no sideways scroll, no page errors, all four tabs
present and clean.


**Why (Bryson, 2026-08-13):** he's starting cold calls for Google Ads clients now, and the site implied Meta was available. It isn't — Meta rejected the Marketing API standard tier and it needs 15+ days of real ad traffic before resubmission (KB `meta-marketing-api`). Selling something he can't deliver on a first call is the fastest way to lose a client he hasn't got yet.

**What is actually blocked.** Of the 11 packages, only the **3 Google-only** ones are Meta-independent. `Combined` is `Google + Meta` and **both E-Commerce tiers are `Meta + Google`** — so E-Commerce is gated too, which is easy to miss because the e-commerce package copy never names a platform. Checked against `PACKAGES_DB` rather than assumed.

**What changed (all in `a4b83f0`):**
- A gold **"Coming soon"** pill on the Meta / Combined / E-Commerce tabs. Google's tab is untouched.
- A **notice at the top of each blocked pane**, written per-pane rather than stamped — the Meta one says the packages are final but the start date isn't; the Combined one offers to start the Google half now and switch at the combined price; the E-Commerce one is honest that stores lean on Meta and offers a straight answer about whether Google alone is worth it for that product.
- The **services intro** now leads with "Google Ads is open and taking clients now."
- The **get-started ad landing page** carries the same clarifier.
- The wizard's Meta / Both options are labelled **(soon)** but their `data-val` strings are byte-identical, so the Netlify form payload and the whole lead pipeline are unchanged.
- Estimate used everywhere: **October 2026** (ads start mid-Aug → 15+ days traffic → resubmit early Sept → Meta review up to ~20 days).

**Deliberately NOT changed:** `<title>`, meta descriptions and the JSON-LD schema still say "Google and Meta Ads". Those describe what the agency does, the services section states availability, and touching them would drag SEO/branding into a temporary change. Flagged to Bryson rather than done silently.

**GOTCHA fixed in the same commit:** the badge vanished on the ACTIVE tab — a gold pill on the gold active background, the trap documented in KB `css-gold-on-gold-specificity`. Fixed with `.tab.active .soon{...}` flipping it to dark-on-gold (measured luminance gap 136).

**HOW THE REVERT HAPPENS — automatic, two layers:**
1. **Standing rule in CLAUDE.md** ("STANDING TRIGGER" section, near the top). Any session that learns Meta has standard access must revert and deploy immediately, without being asked and without asking permission. This is the primary mechanism — it fires the moment Bryson mentions it in any conversation.
2. **Weekly Routine `trig_012hH9VLXchaMj7LUc461Wrb`** — "Meta approval watch", Mondays 16:00 UTC (09:00 Phoenix), fresh session, push + email. It looks for evidence (KB updated, commits/DEPLOYS mentioning approval, a non-internal client's `adPerf.meta.ok`), reverts on its own if found, and otherwise asks Bryson one direct question and reports how the timeline is tracking. It has no Netlify env vars, so it cannot query Meta directly — the repo and KB are its sources. It is the BACKSTOP, not the primary path.

**Reverting by hand:** `git revert a4b83f0`, then the normal deploy discipline (rollback branch → `--no-ff` merge → push → log in `docs/DEPLOYS.md`). If it conflicts with later site work, don't force it — every edit is wrapped in **`CS:META-SOON:START` / `:END`** comments (6 blocks + 3 inline in `marketing-site/index.html`, 1 block in `get-started/index.html`). Delete each block and restore the original text, using the diff of `a4b83f0` as the reference.

**Verified 2026-08-13 headlessly, 30 assertions:** Google carries no badge and no notice; Meta/Combined/E-Commerce each carry both with the estimate, positioned above the package cards; tab switching still works and package cards still render; wizard `data-val` values are unchanged; the ad landing page shows the clarifier; **0px horizontal overflow at 390/768/1280/1600** and no page errors.

**IF THE ESTIMATE SLIPS:** update the date rather than letting it go stale — a visibly missed public estimate is worse than no estimate. The string "October 2026" appears in both files inside the sentinel blocks.

**BOOKING IS GATED TOO (2026-08-13, second pass — Bryson: "make sure that people cant book a meeting for meta ads, and if the survey gives them meta ads then give a notice").** The first pass only *labelled* the blocked packages; a prospect could still book a 30-minute call off a Meta package card, which is the one thing that actually wastes his time.
- **All 8 per-package "Book a Call" CTAs inside the Meta / Combined / E-Commerce panes** (3 + 2 + 3) now read **"Join the waitlist"** and point at `#contact` instead of Calendly. Google's 3 CTAs are untouched and still book normally — asserted in the test so a future edit can't quietly change them.
- **The package recommender is gated at the result.** `pickFamily()` can return `meta` (social channel), `combined` (type=both, or channel=ads) or `ecom` (type=ecom); when it does, a `.soon-note` appears inside the modal and the **Book a Call button is hidden**. The email capture stays visible, so the lead is still captured — the notice explicitly tells them to leave it. A Google result is untouched and fully bookable.
- Notice copy mirrors the pane notices: what's blocked, the October 2026 estimate, and the Google alternative with an offer to move them across when Meta opens.

**GOTCHA — `hidden` did nothing, and the test didn't catch it.** `recBook` is an `<a class="btn">`, and `.btn{display:inline-flex}` outranks the low-specificity UA `[hidden]{display:none}` rule, so `recBook.hidden = true` left the button fully visible while JS believed it was hidden. The first test asserted on the `.hidden` PROPERTY and passed; only the screenshot revealed it. Fixed with `#recBook[hidden],#recSoon[hidden]{display:none!important}`, and the test now asserts on **computed display + measured height**, never the property. **Lesson: assert what the user can see, not what the DOM property says.**

**TAP NOTICE (2026-08-13, third pass — Bryson on mobile: "if I press packages with meta a little note comes up saying they arent available").** Relabelling the CTA wasn't enough — on a phone, tapping it just scrolled somewhere and looked like nothing happened. Now **any CTA inside a Meta-dependent pane pops a fixed bottom-of-screen notice** (`#metaSoonToast`): what's blocked, the October 2026 estimate, "Google Ads is live and taking clients today", a "Join the waitlist →" link and a dismiss X, auto-hiding after 9s. Bottom-centre with safe-area padding on phones, bottom-right from 820px. The **get-started wizard** pops the same notice when Meta or Both is picked. Google CTAs are untouched and still navigate straight to Calendly.

**TWO BUGS FOUND BY TESTING, both invisible in the markup:**
1. **The site's own nav-glide handler won.** `marketing-site/index.html` registers a document-level `a[href]` smooth-scroll listener around line 2103 — EARLIER than the notice script at the end of body. Same-target listeners fire in registration order, so it scrolled to `#contact` before the notice handler ran. Fixed by binding in the **capture phase** (`addEventListener(..., true)`) plus `stopPropagation()`. **Any late-added click handler on this site must capture, or the nav glide beats it.**
2. **An inline note inside the wizard step could never work.** The wizard advances to the next step on selection, which hides the step the note lived in — so it would flash and vanish. Replaced with the fixed-position toast, which survives the step change. The inline markup + CSS were removed rather than left as dead code.

**Verified 2026-08-13 at 390x844 (mobile emulation) and 1280x900 — 36 assertions:** notice starts hidden; a Meta, Combined AND E-Commerce package tap each shows it; the copy carries the estimate and the Google alternative; **the page does not silently jump**; dismiss works; the Google CTA still points at Calendly, is not intercepted, and pops nothing; the wizard pops it for Meta and for Both but not for Google; 0px overflow and no page errors on both viewports.

**TAB TAP (2026-08-13, fourth pass — Bryson: "it still lets me click on meta ads on mobile").** First check was whether the change was even live: `curl https://boldlinemedia.com` confirmed all sentinels deployed, and the marketing site has **no service worker**, so it was neither a deploy nor a cache problem. The real gap: the **tab button itself** swapped panes silently. The pane notice was there, but on a phone it is easy to scroll straight past — so tapping "Meta Ads" felt like it simply worked. Tapping any blocked TAB now pops the same notice, bound in the capture phase but deliberately **without** preventDefault/stopPropagation so the pane still switches and the packages stay readable. Google's tab pops nothing.
**Still deliberately ungated:** the floating mobile "Book a Call" bar (`#mobileCta`) — it is a generic call CTA, not tied to a package, and blocking it would also block legitimate Google bookings from someone who happened to browse Meta. Flagged to Bryson rather than changed silently.
**46 assertions now**, at 390x844 and 1280x900.

## 🔴 THE FLIP IS NOW CHECKLIST-DRIVEN, NOT REVERT-DRIVEN (2026-08-17)

**Bryson:** *"make sure from now on any updates we do to the website are saved for when we flip the
website back to normal"*.

`git revert a4b83f0` **is no longer sufficient on its own.** A revert only touches lines that
existed when the commit was made, so anything added to the site afterwards survives it. The **Full
System: Acquisition** card proved this the same day it was added: its waitlist button would have
outlived the revert and stayed wrong, with nobody noticing until a prospect clicked it.

**`docs/META-FLIP-CHECKLIST.md`** is now the procedure: every `CS:META-SOON` marker with what it
becomes. Current inventory is **9 buttons, 10 blocks, 3 inline pills**.

**`tests/verify-meta-flip.mjs` (56 checks) keeps it honest, and that is the actual answer to what
Bryson asked for.** While the site is gated it fails if a sentinel is missing from the checklist, if
the checklist names one that no longer exists, if a waitlist button carries no marker, or if a
Google card ever gets gated. After the flip it **switches its own expectations** and asserts all 12
packages book and no marker survives, so the post-flip half is not dead code. Proved by three
simulated mistakes (a new gated card left unrecorded, a waitlist button with no marker, a Google
card accidentally gated) — each failed by name, then restored.

**Two gotchas found while testing the flip, both now in the checklist:** `rec-gate` is a JavaScript
comment rather than an HTML one, and `styles` and `rec-gate` carry a trailing note after the id. A
naive find-and-replace silently skips both — which is exactly what happened on the first attempt,
and the test correctly refused to call that half-done flip "flipped".
