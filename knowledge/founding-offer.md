---
name: founding-offer
topic: Marketing site
task: change or remove the founding-client setup-fee waiver on the website
keywords: [founding client, setup fee waived, CS:FOUNDING, first three clients, free build, scarcity claim, FOUNDING-OFFER.md, waiver banner]
status: verified
summary: The setup fee ($1,500 to $4,900) is waived for BoldLine's first three clients. Bryson decided this 2026-08-27 and asked for it to be advertised; it was on NO page until 2026-08-28. Now a banner on the homepage hero and on the ads landing page, sentinel-wrapped so both come out together when the third client signs.
verified: 2026-08-28
---

Bryson, 2026-08-27: *"for my first 3 clients I am waiving the set up fee entirely that way I
can get clients and get case studies. **I also want to advertise this as well.**"*

**It was advertised nowhere.** Checked 2026-08-28: zero mentions on the homepage, zero on the
ads landing page. He was giving away **$1,500 to $4,900** of build work and telling no one,
while an ad ran for eight days and brought 88 people to a page that never mentioned it.

## Where it is now

| Marker | File | Placement |
|---|---|---|
| `CS:FOUNDING:START home` | `marketing-site/index.html` | Under the hero "Book a Call" button |
| `CS:FOUNDING:START get-started` | `marketing-site/get-started/index.html` | Under the free-audit form, where paid traffic lands |

Above the fold at 390 / 768 / 1280 / 1600, verified in a real browser, no overflow, no errors.

## 🔴 Three wording decisions worth not re-litigating

1. **The price is stated in the same breath.** The site had **never mentioned a setup fee
   anywhere**, so "setup fee waived" would have landed on a reader who did not know one
   existed. Without the number it is a sentence, not an offer.
2. **No count of remaining spots.** *"Two spots left"* becomes a lie the moment a client signs
   and nobody edits the page, and that is the kind of thing nobody notices for months.
   *"Our first three clients"* stays true throughout. The test fails if a countdown claim
   appears.
3. **It repeats that the client pays their own ad spend.** A free build is exactly the moment
   a reader might assume BoldLine covers the advertising too, and not holding or fronting ad
   spend is the hard business rule.

## Taking it down

**When the third client signs.** Removal instructions in `docs/FOUNDING-OFFER.md`; delete
each block including its sentinels.

**🔴 `tests/verify-founding-offer.mjs` fails if ONE copy is removed and the other is left.**
A half-removed offer is worse than either state: the site would promise a free build on one
page and stay silent on the page the ads point at. Removing both together passes.

The wording itself is deliberately **not** pinned, so the pitch can be rewritten without a
test arguing about it. Six mutations, all caught: half-removal both ways, a rotting countdown
claim, a dropped price anchor, a dropped ad-spend line, and a dash creeping into the copy.

As of 2026-08-28 **zero clients have signed.** Stencil & Thread's agreement is out and their
setup fee is already waived in the OS, so they are founding client one when they sign.

## 🔴 2026-09-07 — IT TAKES ITSELF DOWN NOW. NOBODY HAS TO REMEMBER.

Bryson: *"Make sure once I land a third client that once the contract is signed that triggers
the copy and website banner to take down the offer."*

**Why a switch was not good enough.** Earlier the same day the offer was moved out of website
copy and into a constant, `FOUNDING_OFFER_ACTIVE`, after Deal Prep quoted the standard prices to
a live prospect. A constant is still a thing to forget on the single day it matters: the day the
third client signs, the site would keep advertising a free build worth **$1,500 to $4,900**, and
he would find out when somebody asked for it.

**The source of truth is now the clients themselves** (`netlify/lib/founding.mjs`). It counts
signed, real, non-internal, non-demo clients and compares to three. It cannot drift from reality
because it IS reality.

| Rule | Why |
|---|---|
| `contractSigned` OR `contractStatus === "active"` counts | Stencil & Thread signed an **emailed PDF**, not DocuSign. A signature-only test would have missed the first client |
| Demo and internal never count | The demo exists so empty screens look alive; letting it eat a founding place would be absurd |
| **Monotonic** — never re-opens if a client churns | *"We gave the first three a free build"* is a statement about history, not about current headcount. Re-opening would re-advertise something already given away |

### What changed on each surface

- **The marketing site** (both pages) — the banner is now `hidden` in the HTML and revealed only
  when `/.netlify/functions/founding-status` explicitly answers `active === true`.
- **Deal Prep's briefing** — reads the live count before writing, and **falls back to STANDARD
  prices if the lookup fails**. Quoting more than the offer is a conversation. Quoting a giveaway
  that is gone is a promise he then has to break.
- **The OS package card** — computes from the loaded client list and now shows *"2 of 3 places
  left"* rather than a fixed sentence.
- **An alert** — one message, on the transition, telling him the offer is spent and that the
  banner and pricing have already switched themselves off. A pitch that changes silently is a
  pitch he learns about from a prospect.

### 🔴 A deliberate exception to "never gate content on JS", and the reasoning

KB `content-visibility-no-js` says never hide content behind JS, because a scroll-reveal once
left the whole page blank to crawlers. **That rule still holds and is not being broken:** the
hero, packages, FAQ and reviews are all in the HTML. Verified with scripts disabled, the page
still renders **12,139 characters** of visible text.

This is one promotional claim, and it is the one thing on the page where being wrong costs real
money. So it **fails closed** in every direction: endpoint spent, endpoint 500, endpoint
unreachable, JS off — all four hide the banner. Only an explicit `active: true` shows it. Worst
case he loses a line of persuasion. The other fail direction hands out a free build.

**Verification:** `tests/verify-founding-in-deal-prep.mjs`, 33 checks, **10 of 10 mutations
caught**, plus a real browser run of all five states above.

> 🔴 **And a caught mistake worth keeping.** The first version of those tests was appended
> BELOW the file's `process.exit()`, so the whole block never ran, and the suite still printed
> "17 passed, 0 failed". Nine mutations came back NOT CAUGHT in a row, which is what exposed it.
> **A green suite is not evidence a test executed.** Mutation-test new assertions, always.
