---
name: trade-playbooks
topic: Ads
task: reuse what one client taught us on the next client in that trade, or check what still has to happen before a client goes live
keywords: [trade playbook, negative keywords by trade, qualifying questions, disqualifiers, learned vs seeded, recordLearning, playbookFor, launch checklist, launchChecklist, LaunchChecklistCard, TradePlaybookCard, PlaybookCtx, tradePlaybooks, onboarding, client two, mirrored copy, browser copy drift]
status: built
summary: Two things that turn the first client's time into a permanent asset. A per-trade playbook of searches to block, questions to ask and what a bad lead looks like, where a SEEDED guess and a LEARNED fact are stored and shown separately. And a launch checklist whose every step is observed from the client record rather than ticked by hand.
verified: 2026-08-26
---

## Why

Bryson, 2026-08-25, before his first client's setup call: *"there will be a lot of testing
and building things from working with him and I don't want that time to be wasted."*

He was right to ask. The campaign machinery already carried over to client two untouched
(checked: every mention of Stencil, Sebastian or Shaun in the shipped code is a COMMENT
recording why a rule exists, sitting above logic that reads whatever client record is in
front of it). **The judgement did not carry over.** The searches worth blocking for a screen
printer mostly apply to the next screen printer, and the questions that separate a real
buyer from a tyre kicker are learned once and reused forever. Until this, that lived in
emails.

## 🔴 The invariant: a guess and a fact are never the same thing

Same rule as Market Research, for the same reason. **A plausible-sounding guess that blocks
a profitable search costs money silently, forever, and nobody ever finds out**, because a
blocked search leaves no trace in the data.

| Source | Meaning |
|---|---|
| `seed` | Written into `trade-playbooks.mjs` from general knowledge. A hypothesis. |
| `learned` | A real client said so. Carries their name, the date, and **why**. |

Provenance travels with every entry and the two are rendered apart in the OS. **A client can
overrule a seed** with `keep: true` and it is removed rather than argued with: the person
who runs the business knows their market better than the file does. Re-teaching a term
updates it instead of stacking a near-duplicate with a stale reason beside the corrected one.

**Disqualifiers are entirely learned.** There is no honest way to guess what a bad lead
looks like in someone else's business, and guessing would be the most damaging invention
here, so an unknown trade gets an empty list rather than a plausible one.

**Seeded thin on purpose.** Three trades (apparel, home services, professional services).
It was tempting to fill in twenty from general knowledge, which would have produced exactly
the confident guesses this design exists to keep separate from evidence.

**Where it lands:** `negativeTerms()` seeds the campaign builder's block list, replacing a
hardcoded universal list. So the playbook reaches the thing that spends money, which is the
whole point.

**Stored on the HOUSE account** (`data.tradePlaybooks`), not a new table: no migration to
run (a migration nobody ran is what made Lead Scout hang silently), already backed up,
already live-refreshed. Rides a React context rather than six layers of props. With no house
account, `save` is null and the card disables its own button rather than failing on press.

## The launch checklist

Eleven steps, `netlify/lib/launch-checklist.mjs`, shown on a client's Overview and hiding
itself once the launch is done.

🔴 **Every step is OBSERVED, never ticked** (same rule as KB `house-pipeline-honesty`): a
hand-ticked box drifts the moment anything changes underneath it, and a checklist that lies
is worse than none because it gets trusted. Tracking counts as done only when the tag really
exists; live means a campaign is actually serving, not merely built.

The **two steps the OS genuinely cannot see** (a signed contract, a DNS record on someone
else's domain) carry a stored flag AND say *"Tracked by hand. The OS cannot see this one."*

It names **one next thing** rather than showing eleven boxes, and separates **what you are
waiting on someone else for**, because that needs chasing rather than doing and the two get
confused in one list. The CRM step is optional and never blocks a launch.

## 🔴 Mirrored into the browser, and the mirror is tested by RUNNING it

The OS is one file running Babel in the browser, so it cannot import from `netlify/lib`.
Both modules are duplicated in `index.html`, same arrangement as `PACKAGES_DB`.

`verify-trade-playbooks` slices the browser copies out, executes them, and compares the
**output** of both against the same inputs, so drift is a failing test rather than a slow
divergence nobody notices until a campaign is built wrong.

**Two assertions in the first draft could not fail, and deliberate breaks found both:**
1. The equivalence fixtures were hand-written clients that always had `mainOffer` and
   `targetLocations` together, so a rule change reading only one of them passed. **An
   equivalence test only proves agreement on the inputs it is given.** Each field is now
   varied INDEPENDENTLY, then cumulatively, across 25+ shapes.
2. A "never rounds up to 100" assertion was guaranteed by arithmetic: with ten required
   steps every fraction lands on a whole percent, so `floor` and `ceil` are identical. It
   now asserts what is actually worth guarding, that the percentage counts the REQUIRED
   steps and not all of them.

**89 checks, eight deliberate breaks confirmed to fail**, including mirror drift in either
direction, presenting a guess as evidence, ignoring a client's override, letting an optional
step block a launch, and cutting the playbook off from the campaign builder.

## Next

Seeded from general knowledge and waiting on real data. After the first client's setup call,
record what he says about his last five headaches as `disqualifier` entries and any searches
he names as `negative` entries, attributed to him.

## Related

`stencil-and-thread-deal`, `conversion-loop`, `lead-handoff`, `market-research`, `repo-tests`.

## 2026-08-26 — the niche picker, and a silent way to lose a whole playbook

Bryson, adding his first real client: *"the categories are white and i cant read them i also
need a way to search or put a specific niche."*

**Both complaints had one cause.** A native `<select>` hands its dropdown to the operating
system, which renders `<optgroup>` labels in ITS own colours and ignores ours, so on the dark
theme every group heading came out white on white. There is no CSS fix; the popup is not the
page's to style. And a ~200-entry native list has no search, so the custom-niche escape hatch
that already existed sat invisible at the very bottom where nobody would scroll to find it.

**Fix: `NicheSelect` is now a combobox we draw ourselves.** Type to filter, arrow keys and
Enter, click-away to close, and **anything typed that matches nothing is kept as the value**
(`+ Use "…"`). Grouped while browsing, flat once you type, because headings help across 200
entries and are noise across six. Verified headlessly: the heading renders gold `rgb(200,
168, 75)` on the panel rather than white on white.

### 🔴 THE REAL BUG UNDERNEATH, WHICH WAS ABOUT TO COST MONEY
**The niche string is the only key into the trade playbook.** The closest existing option for
a screen printer was *"Clothing & Apparel Brand"*, which matches none of the apparel
patterns. Picking it yields **31 blocked searches (universal only) instead of 48** — losing
cricut, heat press, iron on, blank shirts, etsy and the rest — with **no error anywhere**.
The campaign would simply have launched buying searches it should have blocked.

So `"Custom Apparel & Screen Printing"` and `"Promotional Products"` were added to
`NICHE_GROUPS`, and a guard now asserts **every seeded trade is reachable from the niche
list**. A playbook nobody can select is dead code that looks alive.

**95 checks in `verify-trade-playbooks`, the new guard broken once** (removing the two
niches) and confirmed to fail.
