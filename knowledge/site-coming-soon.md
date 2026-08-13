---
name: site-coming-soon
topic: Marketing
task: the marketing site's temporary "Meta coming soon" state, and the automatic trigger that reverts it
keywords: [coming soon, meta coming soon, site gating, CS:META-SOON, sentinel comments, revert a4b83f0, october 2026 estimate, google only, auto revert trigger, meta approval watch]
status: verified
summary: boldlinemedia.com temporarily shows "Coming soon — estimated October 2026" on the Meta Ads, Combined Systems and E-Commerce package tabs (Google is untouched and genuinely open), so Bryson can cold call for Google clients without over-promising. The ENTIRE change is one self-contained commit **`a4b83f0`**, designed to be reverted in one step the moment Meta grants standard access. Reverting is AUTOMATIC by two mechanisms: a standing rule in CLAUDE.md that any session must act on the instant it learns Meta is live, and a weekly Routine (`trig_012hH9VLXchaMj7LUc461Wrb`, Mondays 09:00 Phoenix) that checks and either reverts or asks Bryson directly. Every edit is wrapped in `CS:META-SOON` sentinel comments as a fallback if `git revert` ever conflicts.
verified: 2026-08-13
---

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

