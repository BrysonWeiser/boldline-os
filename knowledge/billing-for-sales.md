---
name: billing-for-sales
topic: Pricing
task: bill a client who sells straight from a website, or change what the performance fee is charged on
keywords: [billing for sales, per qualified sale, qualified sale, billingResultKind, billingSaleDefinition, resultWords, e-commerce billing, store client, no lead form, buys on website, Air Suds, contract qualified lead definition, results only shop, sale definition, contractGaps sale]
status: verified
summary: A client who sells straight from a website can be billed per QUALIFIED SALE instead of per qualified lead. Set it on the Billing card (Billing for → Leads / Sales) plus a one-sentence description of which purchases count, which the agreement then quotes word for word. 🔴 It is a RENAME, not a third pricing model — the mechanic is a count times a rate either way, so `billingPerLead` still carries the rate and no calculation changed. The contract, the key terms, the Stripe clause and the client portal all follow the same word. A sale has no standard definition, so the description is required and `contractGaps` blocks the send without it. Built 2026-09-16 for Air Suds. 39 checks, 8 mutations caught.
verified: 2026-09-16
---


## 🔴 AND THE CLIENT-FACING HALF (2026-09-17, same day)

Bryson: *"is there anywhere else on my side or in his client portal that still needs updated"*.
Yes, and the client-facing half was worse than the OS half, because the client reads it.

- **The portal** had its own private `RW` with three words in it, so seven other lines went on
  saying "lead": the **nav tab**, the stage descriptions ("generating leads, which are sent
  straight to you", "improve lead quality and lower your cost per lead"), the **Per Lead** stat,
  "Your Leads", and the minimum explanation. It now imports `resultWords` from
  `contract-shared.cjs`, which is exported for exactly this. 🔴 Both copies, served and the OS
  preview.
- **The invoice email** billed a per-sale client for "Qualified leads". That is a line item
  naming something their agreement never mentions, sent to the person paying it. It now takes
  `resultKind`, passed in by `buildClientCtx` from the client record.

🔴 **NOT renamed, deliberately:** `welcome`, `renewal`, `onboarding_nudge`, `review_request` and
`lead_milestone` use "leads" as the general thing advertising produces, not as the unit on an
invoice. A store's campaigns really do generate interest before they generate orders. Renaming
those chases the word rather than the meaning, and `lead_milestone` counts rows in `leadsLog`,
which a shop client never has, so it cannot fire for one anyway. The SMS-consent section is about
the client texting their OWN enquirers and says to leave it blank if they do not.

🔴 **A DUAL-COPY TEST THAT COULD NOT SEE THIS.** `verify-founding-terms` renders both copies of
the contract and compares them byte for byte, and every fixture was a LEAD client, so a drift on
the sale side rendered identically in all of them. Mutating the OS copy's `resultWords(cl)` to
`resultWords({})` survived untouched until a per-sale case was added. Same trap as the logo
branch in `verify-lead-handoff`: a mutation that does not reach the output looks exactly like a
guard that works.

## 🔴 THE RENAME HAD TO REACH EVERY SCREEN (2026-09-17)

Bryson, looking at a client switched to Sales: *"make sure everything has the correct
terminology"*. The switch renamed the agreement and the portal on the day it was built, and left
the OS around it saying "lead" in fifteen places, **including the summary line directly above the
switch itself**. A screen that contradicts the document it prints is how someone stops trusting
either one.

The Billing card now takes its words from **`resultWords`, the same helper `makeContractHTML`
asks**, so the two cannot drift: flip the switch and both move together. `W.itNoun` is the
singular, `itPlural` the plural, `W.many` the capitalised plural, `W.per` the fee phrase.

Other screens fixed, each found by rendering a real per-sale client in a browser and scanning the
**text on screen** (an earlier scan read `document.body.textContent`, which on this page includes
the Babel source, so it returned code comments as false positives and no real hits):

- **The scorecard** said "Qualified leads" and "Cost per qualified lead".
- **The overview revenue card** said `$25/qualified lead`.
- **The package fee label** (`pkgPerfLabel`) quoted the PACKAGE's model, so a store client read
  "15% of ad spend" beside an agreement saying $25 per sale. It now takes an optional
  `resultKind` and the sale branch is tested **before** the percentage branch, or the percentage
  wins and nothing changes.
- **The Adjust Fees field** asked for a price "per qualified lead".
- **The renewal preview** likewise.

🔴 **The lead fee finder is HIDDEN on a per-sale client, not renamed.** It works from job value
and close rate to price a lead. Relabelling it would dress lead-to-customer arithmetic up as
something it is not: a sale is already the customer, so there is no close rate left to apply.

Left alone on purpose: Google's own conversion action names ("Qualified lead" is Google's
concept), the founding-offer brochure copy, and the Add Client sheet, where no basis has been
chosen yet.

## 🔴 THE SWITCH WAS UNREACHABLE UNTIL 2026-09-17

Bryson, looking at Air Suds' finished agreement: *"the contract didnt update with the way hes
going to be billed. it still says 15% of monthly ad spend"*.

The Billing for switch, the sentence saying which purchases count, and the rate were all inside
the Billing card's `managed` branch, **which means behind Stripe**. Billing is set up AFTER the
client signs, so the order was impossible: send the contract, then gain the ability to make the
contract correct. A store client would have been sent the package default, 15% of ad spend, no
matter what was agreed on the call.

Worse, `contractGaps` sends him there BY NAME ("Set it on the Package tab under Billing for →
Sales") and the control was not on the page. An instruction pointing at nothing is how someone
concludes the OS is broken rather than that they missed a step. And nothing warned him, because a
percentage IS set on the package, so there was no gap to raise: the contract was internally
coherent and simply described a different deal.

These are TERMS, not payment plumbing, so they now render outside that gate under `!oneTime`. The
lead approval queue stays inside it, because invoicing a lead really does need a Stripe customer.
The Adjust Fees panel's field label follows the same rename, so a client billed per sale is never
asked for a price "per qualified lead".

🔴 **Guarded by the gate CONDITION, not by position.** A first attempt proved the controls sat
before the Stripe-gated block in the source, and a mutation putting them back behind `managed&&(`
survived it untouched, because the block still sat earlier in the file. The check now reads the
condition the section actually renders under.

## 🔴 Why it exists

Bryson, 2026-09-16, on Air Suds: the customers *"just buy through website no forms or contacting
him"*. The agreement defines a **Qualified Lead** as a form submission, a tracked call of thirty
seconds or longer, or a chat. **Not one of those can ever happen on that account.**

Sending that contract would have had a client sign a document in which **the billable event is
impossible**. And Bryson had already told the owner *"it's basically free, you only pay for
results"*, so the fee has to sit on a real result. For a shop, that is a **sale**.

Paying per sale is *more* results-based than paying per lead, not less — a lead can be junk, a
sale is money in the client's till. So nothing about the founding pitch had to change. Only the
word for the result.

## 🔴 A rename, not a third pricing model

The mechanic is identical in both cases: **a count multiplied by a rate**, billed in arrears,
monthly minimum absorbed. So:

- `cl.billingResultKind` is `"sale"` or absent (absent = lead). **Only the exact string `"sale"`
  switches it** — anything else is a lead, because a stray value silently rewording a real
  agreement is the worst failure available here.
- `cl.billingPerLead` still carries the rate. **Every existing calculation is untouched.**
- `cl.billingSaleDefinition` is the sentence that defines the billable event.

Adding a third `pricingModel` would have meant a new branch at roughly fifteen call sites, and
fifteen chances to get one wrong.

## Where the words come from

`resultWords(cl)` in `netlify/lib/contract-shared.cjs`, **mirrored in `index.html`** (the OS is
one browser file and cannot import it) and pinned by a test that RUNS both and compares field by
field. It supplies the noun, the plural, the "per …" phrase, the definition paragraph and the
warranty sentence, so the whole agreement follows one switch: key terms row, clause 4.1, 4.2,
4.4 and the Stripe charging clause.

The **client portal** carries its own small copy (`RW`), in both the served page and the OS
preview, so a shop is never told in their portal that they pay per qualified lead while their
signed agreement says sales.

## 🔴 The definition is the client's, so it can be missing

BoldLine's Qualified Lead wording is the same on every lead-gen agreement and can never be
absent. **What counts as a sale worth paying for is the client's own commercial question** (Air
Suds: a subscription sign-up or a bulk order, never a single bottle at $5 of margin), so the
contract quotes the sentence Bryson wrote.

Which means it can be blank. So:
- the contract renders **`[NOT SET]` in bold** rather than an empty phrase,
- `contractGaps` **blocks the send** until it is written,
- and it is **HTML-escaped**, because a stray tag typed into that box would otherwise re-shape a
  document someone signs.

The clause also protects both sides without being asked to: the sale must have come **from the
campaigns**, refunds and chargebacks are not Qualified Sales and any fee taken on one is credited
back, repeat purchases inside thirty days count once, and the warranty promises **no particular
level of sales, revenue or return** (which matters on an $11 product with $5 of margin).

## Testing notes

`tests/verify-billing-for-sales.mjs` — 39 checks, **8/8 mutations caught**.

🔴 **Three existing contract suites broke, all for the same reason:** they lift
`makeContractHTML` out of `index.html` with `new Function` and hand it a scope, and that scope
had no `resultWords`. Fixed by handing them **the real one**, lifted from the same file — a stub
would have been more permissive than the page and would have passed while the document said the
wrong thing.

🔴 **A dual-copy check silently compared nothing.** The OS portal slice used
`indexOf("function contractGaps(")` as its end anchor, and `contractGaps` sits *above*
`makePortalHTML` in that file, so the slice was empty and every parity assertion passed on an
empty string. Now anchored forward from the start, with a length check. **Slicing to "whatever is
declared next" keeps producing this bug** — it also hit `verify-draft-persistence` the day
before.

Responsive: checked at 390/768/1280/1600, no horizontal scroll, nothing spilling.

## The four sentences added 2026-09-16, and why each one exists

A lead arrives in BoldLine's own system. A sale happens on the client's website, where two
different numbers exist and disagree on purpose. So a sale agreement has to settle four things a
lead agreement never had to:

- **A 30-day window from the click.** Without it, a click today and a purchase in six weeks is
  arguable forever, in both directions.
- **The CLIENT'S own order records govern**, beating the platform's reporting where they differ.
  The platform grades its own homework; the client believes their own till. Conceding this costs
  little when the ads work and removes the whole fight when they nearly work.
- **A view-through is not a sale.** Meta counts a scroll-past followed by a purchase, by default.
- **An existing customer is not a sale we won.**

Clause 4.4 now names the **same source** as 4.2. It used to say "campaign tracking data" while
the definition above it said the client's records, and two clauses naming different numbers in
one document is the argument, written down.

🔴 **AND THE AD SET IS BUILT TO MATCH.** `createCampaign` sends
`attribution_spec: [{CLICK_THROUGH, 7}]`, because Meta's default is 7-day click **plus 1-day
view**. Two reasons, only one about money: the agreement says a non-clicker is not a Qualified
Sale, so the default would have the platform reporting a number the contract does not recognise;
and the attribution setting is **the signal Meta's delivery learns from**, so counting
view-throughs teaches it to find people who look. The honest cost is slower learning on a small
budget, taken deliberately.

🟡 **Known mismatch, left alone on purpose:** the contract allows 30 days, Meta's click window
maxes at 7. So the platform can only ever prove a subset, and the count comes from the client's
records anyway. It can under-count and never over-count, which is the safe direction.

## 🔴 IT LEAKED INTO EVERY LEAD AGREEMENT, AND NOTHING NOTICED

Bryson asked whether any of this touched the current packages or pricing. The packages and prices
were untouched (`pricing-shared.mjs` has no diff at all, and `PACKAGES_DB` / `PKG_FEATURES` in the
OS have none either). **But one sentence had moved on every lead agreement**, including signed
ones.

Genericising clause 4.2 so it would read for sales turned *"the **Per-Qualified-Lead Fee** stated
above"* into *"the **fee** stated above"*. A contract **renders fresh every time it is opened**,
so Stencil & Thread's signed agreement would have started showing wording nobody signed — the
exact thing the terms versioning exists to prevent (KB `contract-terms-versioning`).

Fixed by putting the name in the vocabulary (`feeName`) so each kind carries its own, which
restores the lead wording byte for byte.

🔴 **How it was found, and the method worth keeping.** Not by a test — **all 57 assertions passed
the whole time**, because not one of them was looking at the sentence that moved. It was found by
**rendering the OLD file and the NEW file and diffing the output**, across four packages and four
client shapes. That comparison is now the standard check for any contract change:

```
git show <pre-change sha>:netlify/lib/contract-shared.cjs > /tmp/before.cjs
# render both against the same clients, compare strings
```

The suite now also freezes six exact phrases of a lead agreement, so the next leak fails instead
of needing to be noticed.

## How the option actually gets OFFERED (2026-09-16)

🔴 **It is deliberately NOT on the public site.** Per-sale only works when the shop can attribute
purchases, which cannot be known before the call. Advertising it means promising it to shops that
cannot track and then withdrawing it, which is the promise-then-retract that costs trust. Kept as
something Bryson gives on the call once he has seen their setup, which is also a stronger moment
than a line on a pricing page. A test asserts the phrase stays off the marketing site.

Two things make it usable, and without both the feature exists and is never offered:

1. **A question on the first call** — `salesTracking` in `MEETING_QUESTIONS`: *"If people buy
   straight from your website, can you see exactly which sales came from the ads?"* Deliberately
   about sales FROM THE ADS, not sales in general: every shop can see its own orders, and the
   whole question is whether it can attribute them. Asked on the **first** call, not at intake,
   because the answer decides how they are billed. Lands at `salesNotes.salesTracking`.
2. **A note on the Deal Prep screen**, on the E-Commerce group only, headed "Only you see this".
   Nobody but Bryson sees Deal Prep, and it is the screen he reads immediately before a call, so
   the reminder sits where it is needed rather than in a document he has to remember to open.

Both are pinned, including that the note is scoped to the shop group (a shop-only note on every
package is noise he learns to skip) and that it names where to set the switch afterwards.

## Fixing an ad set that is already running (2026-09-16)

Bryson: *"is there a way we can add that new update for the clicks without having to build a
whole new campaign?"* Yes. `attribution_spec` is editable on a live ad set.

Everything the OS builds from 2026-09-16 is click-only, but three kinds of ad set still carry
Meta's default (7-day click **plus** 1-day view): **his own first campaign**, anything **built by
hand in Ads Manager**, and anything **inherited with a new client**. On a results-only agreement
that is the platform reporting a number the contract does not recognise.

**How it surfaces:** `getCampaignDetail` now reads `attribution_spec` and reports
`countsViewThrough` per ad set. In the Campaigns screen, an ad set that counts view-throughs
carries an amber line and **one press** to fix it. It appears only when true, and only on Meta.
`pieceAction` re-reads the campaign afterwards, so the warning clears itself.

🔴 **The warning is not decoration: narrowing the window RESETS Meta's learning phase**, because
delivery loses the signals it was learning from. **Cheap on a campaign that started last night,
not free on one running a month**, so the cost is stated before the press rather than discovered
after. The confirmation says so in those words.

🔴 **Why it is safe as one tap:** the write touches `attribution_spec` and nothing else. No
budget, no status, no targeting, no creative — so it cannot start an ad, raise a bill or widen
who sees it. A test asserts the payload contains none of those fields.

🔴 **A test lesson worth keeping.** The original guard banned the string `VIEW_THROUGH` from the
whole file. That broke the moment the reader learned to *detect* view-throughs in order to offer
the fix: **a file-wide ban on the word bans the cure along with the disease.** Now scoped to the
ad-set creation payload, with a second assertion that detection and repair still exist.

