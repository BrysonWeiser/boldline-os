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
