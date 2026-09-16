---
name: airsuds-deal
topic: Clients
task: work on the Air Suds deal, quote Constantine, or decide how to price an e-commerce client
keywords: [Air Suds, AirSuds, Constantine, car side, aircraft side, car cleaning product, schools, subscription, bottles, e-commerce client, ecommerce pricing, no leads, buys on website, store, g-launch vs e-launch, founding terms ecommerce, ad spend percentage, third client, website down maintenance]
status: open
summary: 🔴 NOT A CLIENT YET AND MUST NOT BE COUNTED AS ONE — Constantine said yes verbally, nothing signed and nothing in the OS. Air Suds makes cleaning products; ads are for the NEW CAR side (Bryson's own recommendation to open it), which is about a week away while logo variations are made. Customers BUY STRAIGHT FROM THE WEBSITE, no forms and no contact, so this is e-commerce and the per-qualified-lead billing Bryson quoted has nothing to count. 🔴 Founding terms as written ("no monthly minimum, pay only per qualified lead") would bill Air Suds $0/month forever while BoldLine runs $1,000/month of ads — this must be settled before the contract. Budget $1,000/mo. Unit economics are the real risk: the known product is $6 to make and sells for $11, so single-bottle sales cannot pay for Google clicks; subscriptions and the 25-bottle minimum can.
verified: 2026-09-16
---

## 🔴 NOT A CLIENT YET

Constantine, the owner, said yes on a call. **Nothing is signed and nothing is in the OS**, so
the standing rule applies (CLAUDE.md, Bryson 2026-09-14: *"until they are in the os still act as
if we only have one"*). Do not change the banner, the founding offer, the package copy, or any
number quoted back to Bryson. **Signed clients: one.**

Worth watching: Springbok is also a verbal yes. If both sign, **the three founding places are
full**, and the site's free-build offer has to come down. Nothing happens until signatures.

## The deal as it stands

- **Ads are for the CAR side**, not the aircraft side. That side is Bryson's own recommendation
  and Constantine is opening it now. **About a week away** while logo variations are made.
- **Budget: $1,000/month.**
- **Their website is down for maintenance. The DOMAIN is fine**, so the landing page subdomain
  can be connected now (see KB `lead-handoff` for the "site down vs domain down" rule).
- Deal Prep was run against the **aircraft** side and returned **g-launch (Launch System)**,
  which is what Bryson quoted and what Constantine agreed to.

## 🔴 It is e-commerce, and the billing basis Bryson quoted has nothing to count

From the meeting notes: *"just buy through website no forms or contacting him."* No lead form,
no calls, no enquiries. That is the exact case `pricing-shared.mjs` describes when it says
e-commerce bills a percentage of ad spend **"because a store has no lead to count"**.

At $1,000/month of ad budget the difference is invisible on standard pricing:

| | Monthly minimum | Performance fee at $1,000 budget | Client pays |
|---|---|---|---|
| g-launch (per lead) | $400 | $0 (there are no leads) | $400 |
| e-launch (15% of ad spend) | $400 | $150 | $400 |

**So the package name and the price Bryson quoted are not wrong.** Same tier, same $400 floor,
setup $750 vs $800.

🔴 **But under FOUNDING terms there is no floor**, and the offer says in so many words: *"There
is NO monthly minimum. They pay ONLY the per-qualified-lead fee."* For a store with no leads
that is **$0 per month, forever**, while BoldLine runs the account. This is a genuine hole in
the pricing model, not a detail of this deal — see `pricing-model` for the same note.

**Recommended fix, to settle before the contract:** founding terms for a store keep the waived
setup and the absent monthly minimum, and BoldLine takes the **e-commerce 15% of ad spend**
($150/month at his budget). It is still the risk-reversed pitch in spirit, because the fee only
exists while he is spending, and it is not zero.

## 🔴 The bigger risk is the unit economics, not the package

The only product priced in the notes is the schools one: **$6 to make, sells for $11**, so about
**$5 of margin a bottle**.

- A **single bottle** sale has to be won for under $5 of ad spend. On Google that is not
  achievable, and $1,000/month buys a loss.
- A **subscription** (10+ bottles a month, ~$110/month, ~$50/month of margin) carries a
  new customer worth a few hundred dollars over six months. A $50 to $100 cost per subscriber
  works comfortably.
- The **25-bottle minimum order** (~$275, ~$125 margin) also works.

So the ads must sell **the subscription or the bulk minimum, not one bottle**. The note *"target
more individual consumers than bulk"* points the opposite way and is the thing to talk through
before launch.

**The number still missing: the CAR product's price and cost.** All of the above is the schools
product. Nothing should be promised on conversion or return until the car side's own margin is
known.

## Why Google is still right anyway

Every e-commerce package at this budget (`e-launch`, `e-growth`) is **Meta-only**, and BoldLine
cannot run Meta on a client's account until Meta grants standard access (KB `meta-marketing-api`,
`meta-parked-work`). So the catalog's own e-commerce answer is not deliverable today. **Google
Search at the Launch tier is the right build.** What needs to change is the fee basis, not the
platform or the work.
