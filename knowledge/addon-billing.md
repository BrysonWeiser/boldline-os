---
name: addon-billing
topic: Billing
task: put Google profile care (or any future add-on) into a client's agreement, start or stop billing it, or work out why an add-on is or isn't being charged
keywords: [add-on, addon, add-ons, google profile care, gbp_care, addOns, contractAddOns, addOnsOf, ADD_ONS, gbpCareClauses, addOnBilling, addon-billing, addon-start, addon-stop, runAddOnStarts, AddOnsCard, GbpCareBilling, kind addon, adsSubscriptionOf, isAdsInvoice, terms v8, WA-9, $130, gbpCare, gbpMonthly]
status: built 2026-10-28, not yet used on a real client
summary: Bryson said "yes" (2026-10-27) to making the $130/mo Google profile care a proper checkbox in the agreement that adds it to the monthly bill automatically. It's a box on the Contract tab (ads agreement, terms v8) and on the website deal (website agreement WA-9). Ticked before sending, it becomes its own section; sending freezes it. Billing is its OWN Stripe subscription tagged kind "addon". It starts by itself once the agreement is signed AND the business's Google profile is linked (at link time, or by billing-watch each morning). It goes on the card on file, or Stripe emails an invoice. It never touches the ads billing status, the ads late-payment policy or the monthly minimum. Never billed to BoldLine or owned businesses. A status strip under the Google listing card shows where it stands and has Start/Stop buttons. 35 checks, 13 mutations caught.
verified: 2026-10-28
---

## The ask
Bryson, 2026-10-27, after the website went live with Google profile care at $130/mo: I flagged that no agreement or
bill carried it, so a client buying it would need it added by hand. He said **"yes"** to the fix I proposed: *a proper
checkbox in the agreement that adds $130 to their monthly bill automatically.*

## Where the box is
- **Ads agreement:** Contract tab, card "Add-on: Google profile care", above the send button. Price box defaults to
  $130 (`ADD_ONS.gbp_care.monthly`, pinned equal to `pricing-shared GOOGLE_PROFILE`). Hidden on a hand-off (that
  agreement promises in capitals that there is NO recurring charge of any kind) and on BoldLine's own accounts.
- **Website agreement:** the website deal editor, under the email setup tick, saved with `set-terms` (`gbpCare`,
  `gbpMonthly`). Section **7a** (or **7b** when the blog is 7a), so no other number moves.
- 🔴 **Once per business.** Each editor greys the box out when the other agreement already has it, and the website
  `set-terms` refuses it server-side. If both somehow did, billing still charges once (ads wins).

## What the agreement says (one wording, `gbpCareClauses` in contract-shared.cjs, used by BOTH agreements)
(a) replies to each new review, one post a week, watches calls/website clicks/direction requests.
(b) the profile is the client's; manager access only, removable any time; no changes to name/address/phone/hours/
categories, no removing photos or asking Google to remove reviews, unless the client asks; no offers or facts the client
didn't give us. (c) never write, buy or incentivise reviews, never ask only happy customers (Google bans review gating);
Google decides what shows; no ranking promise; Google isn't a party and doesn't sponsor or endorse us. (d) fee, monthly
in advance, **starting the day the client gives manager access**, separate from every other fee and **never counts
toward the Monthly Minimum or the Performance Fee**; 15 days unpaid lets us pause it. (e) month to month, not part of
the Committed Term, 30 days' notice, no early termination amount, ends when the rest ends, we remove our own access.

## Freezing (ads agreement, `addOnsOf`, both copies: contract-shared.cjs and index.html)
- Unsent: the live box (`addOns`). Sent or signed: ONLY the frozen `contractAddOns` stamped at send.
- 🔴 Sent/signed with no frozen list = **none**. Unlike declined features, it never falls back to the live box:
  everything sent before this existed was sent without it, and ticking the box later must not rewrite a signed contract.
- Version gate: terms **v8+** only (`TERMS_V8_FROM` = 27 Oct 2026, 11pm Phoenix). A voided envelope froze nothing.
- Replace-this-agreement clears `contractAddOns` and keeps the old list in `contractHistory[].addOns`.

## 🔴 Found on the way: Special Terms shared a section number with General
On every v2+ ads agreement with Special Terms, they rendered as "16. Special Terms" right after "16. General"
(`nSpec = nBase+13` while General is `nBase+12+dAb`). Fixed **from v8 only** (`nGen+1`). Agreements already sent keep
the number they went out with, because a signed document must not change.

## Billing (`netlify/lib/addon-billing.mjs`)
- 🔴 **Its own subscription, tagged `metadata.kind = "addon"`, `addOn = "gbp_care"`.** One mechanism for managed ads,
  results-only, website-only and stand-alone clients. Product + subscription created with Stripe idempotency keys so two
  triggers can never open two subscriptions (`stripe-shared` `stripe()` now takes `idempotencyKey`).
- Card on file (`resolvePaymentMethod`) → `charge_automatically`; none → `send_invoice`, due in 7 days.
- **Starts by itself** when the plan is `ready`: a SIGNED agreement carries it, the client isn't `internal`, and
  `cl.gbp.location` is set (their profile is linked). Triggers: the Google listing card's link action (`gbp.mjs`), and
  `billing-watch` each morning (`runAddOnStarts`) as the backstop. A stopped one is never restarted by itself.
- Bryson's buttons (strip under the Google listing card, `GbpCareBilling`): **Start billing now** (manual: may start
  before the profile is linked or restart a stopped one, still needs a signed agreement) and **Stop billing**
  (`cancel_at_period_end`, so the paid month runs out). Server actions `addon-start` / `addon-stop` in stripe-billing,
  which read the client from the database, never from the browser.
- `cl.addOnBilling.gbp_care = { subscriptionId, customerId, status, startedAt, monthly, collection, source, lastPaidAt,
  stopAt, endedAt }`, **server-owned** (`SERVER_OWNED_KEYS`).
- Webhook: `addOnKind(obj)` is checked FIRST and updates only `addOnBilling`; a failed payment alerts amber-ish
  ("yellow") and says the ads are not affected.

## 🔴 Keeping it apart from the ads billing (this also fixed an older website problem)
- `sync` and `update-subscription` used `subscriptions?limit=1`, the NEWEST subscription, which could have been the
  website care plan or now the add-on. They read up to 10 and take the first UNTAGGED one (`adsSubscriptionOf`).
- `billing-watch` anchored the ads late-payment policy on ANY open invoice, so an unpaid website build invoice could
  have paused a client's ads and added a late fee. It now only looks at ads invoices (`isAdsInvoice`).
- Still true, accepted: Stripe pulls a customer's pending invoice items (lead fees parked above the minimum, late fees)
  into whichever invoice comes next, which can be the add-on's. The client is still billed the right amount, just on
  that invoice. Fix if it ever confuses a client: pass `subscription` on those invoice items.

## Not built (on purpose)
- No add-on on a hand-off. No portal page of its own (the agreement in the portal shows the section).
- Bryson enters the client's own price if he discounts; there is no "waived" add-on (use Special Terms).

## Tests
`tests/verify-addon-billing.mjs` (35 checks, 13 mutations caught: version gate, frozen-empty fallback, hand-off,
numbering, browser copy, exempt, ads-subscription picker, signed-only, profile-linked, stopped, invoice filter, website
monthly total, cross-agreement refusal). Four older shape checks were updated to the same rule (late fee stamp, replace
history, website-only listing card, current terms version) and two website version pins now read "WA-8 or later".
Driven in the real OS at 390/768/1280/1600: Contract tab box and the Overview billing strip, no overflow.
