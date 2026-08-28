# Founding client offer — how to take it down

**The offer:** the setup fee (normally $1,500 to $4,900 depending on package) is waived for
BoldLine's **first three clients**. Bryson's decision, 2026-08-27: *"for my first 3 clients I
am waiving the set up fee entirely that way I can get clients and get case studies. I also
want to advertise this as well."* Put on the site 2026-08-28.

## 🔴 IT LIVES IN TWO PLACES AND THEY COME OUT TOGETHER

| Marker | File | What it is |
|---|---|---|
| `CS:FOUNDING:START home` | `marketing-site/index.html` | The banner under the hero "Book a Call" button |
| `CS:FOUNDING:START get-started` | `marketing-site/get-started/index.html` | The shorter banner under the free-audit form, where paid traffic lands |

**To remove:** delete each block including its `CS:FOUNDING:START` / `CS:FOUNDING:END`
comments. Nothing else references them. `tests/verify-founding-offer.mjs` fails if one copy
is removed and the other is left behind, because a half-removed offer is worse than either
state: the site would promise something on one page and not the other.

## When to take it down

**When the third client signs.** Not before, not long after. An expired scarcity claim
sitting on a live site is a straightforward honesty problem, and it is the kind of thing
nobody notices for months.

As of 2026-08-28: **zero signed.** Stencil & Thread's agreement is out for signature and
their setup fee is already waived in the OS, so they are founding client one when they sign.

## Why the wording is what it is

The site had **never mentioned a setup fee anywhere**, so "setup fee waived" would have
landed on a reader who did not know there was one. The banner states the number in the same
breath, which is what makes it an offer rather than a sentence. It also repeats that the
client pays their own ad spend directly, because that is the hard business rule and a free
build is exactly the moment someone might assume otherwise.

**No count of remaining spots.** "Two left" decays into a lie the moment a client signs and
nobody edits the page. "Our first three clients" stays true throughout. If Bryson wants a
live count later, it is one number in two files and this doc is where to record it.
