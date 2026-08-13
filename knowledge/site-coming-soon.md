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
