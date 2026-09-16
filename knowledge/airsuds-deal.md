---
name: airsuds-deal
topic: Clients
task: work on the Air Suds deal, quote Constantine, or decide how to price an e-commerce client
keywords: [Air Suds, AirSuds, Constantine, car side, aircraft side, car cleaning product, schools, subscription, bottles, e-commerce client, ecommerce pricing, no leads, buys on website, store, g-launch vs e-launch, founding terms ecommerce, ad spend percentage, third client, website down maintenance]
status: open
summary: 🔴 NOT A CLIENT YET AND MUST NOT BE COUNTED AS ONE — Constantine said yes verbally, nothing signed and nothing in the OS. Air Suds makes cleaning products; ads are for the NEW CAR side (Bryson's own recommendation to open it), which is about a week away while logo variations are made. Customers BUY STRAIGHT FROM THE WEBSITE, no forms and no contact, so this is e-commerce and the per-qualified-lead billing Bryson quoted has nothing to count. 🔴 Founding terms as written ("no monthly minimum, pay only per qualified lead") would bill Air Suds $0/month forever while BoldLine runs $1,000/month of ads. 🔴 AND BRYSON ALREADY TOLD CONSTANTINE "basically free, you only pay for results", so a % of AD SPEND is off the table — the fee has to sit on a RESULT. The fix is to name the result correctly: a sale, or better a new subscriber. Not built: the OS has no billing mode for either. Budget $1,000/mo. Unit economics are the real risk: the known product is $6 to make and sells for $11, so single-bottle sales cannot pay for Google clicks; subscriptions and the 25-bottle minimum can.
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

🔴 **AND THE FIX IS CONSTRAINED BY WHAT BRYSON ALREADY PROMISED.** He told Constantine it is
*"basically free, he only pays for results, he only pays for qualified leads."* So **15% of ad
spend is off the table** — a fee charged on money spent is not a fee charged on results, and
quoting it would make him go back on his word. (An earlier version of this entry recommended
exactly that. It was wrong for this deal.)

**What actually keeps the promise:** the promise was *results*. "Qualified lead" was just the
word for the result. For a store the result is a **sale**, and paying per sale is MORE
results-based than paying per lead, not less — a lead can be junk, a sale is money in his till.
So nothing has to be walked back, the result just has to be named correctly.

**Recommended, in order:**
1. **A flat fee per new SUBSCRIBER**, if the car side has a subscription. A subscriber is the
   real qualified customer; a one-bottle buyer is the store's version of an unqualified lead,
   worth little to either side. It also keeps the monthly "agree what counted" meeting Bryson
   already runs with Sebastian and promised Brendon.
2. **A small share of the sales the ads bring in**, if the car side is one-off purchases only.
   It scales itself across an $11 bottle and a $275 bulk order.

🔴 **Watch the percentage against a 45% margin.** 10% of revenue is 22% of his gross profit, and
he needs about **2.2x return just to break even on the ad spend alone** before any fee. That is
why the subscription matters more than the fee structure does.

🔴 **The fee only exists if purchases are TRACKED.** No purchase tracking means BoldLine earns
nothing and cannot prove the sales happened. Their site is being rebuilt right now, which is the
one moment this is easy to get right. It must be in before launch.

🔴 **NOT BUILT.** `pricingModel` supports `per_lead`, `ad_spend_pct` and `one_time`. Neither
"per new subscriber" nor "share of tracked revenue" exists in the OS, the portal or the contract.
This is real work, not a setting.

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

## Which platform, and the honest tension in the answer

**Meta is the better channel for this product and BoldLine cannot run it for him.** A $11
consumer bottle with a subscription is textbook direct-to-consumer: visual, impulse, low
consideration. That is Meta's home ground. But Meta is still on **Development tier — BoldLine's
own ad accounts only** (KB `meta-marketing-api`), so it is not on the table for a client today.
Say this to Bryson rather than quietly recommending Google as though it were first choice.

**So: Google now, Meta as phase two**, and the phase two date is partly in Bryson's own hands.
The tier unlock needs real Meta ads running on the house account for 15+ days to generate API
calls. The audience campaigns he can now build in one press (KB `audience-ad-plan`) are exactly
that traffic. **His own Meta ads are what unlock Meta for clients.**

🔴 **And the Google play is probably NOT the one Constantine asked for.** His note says *"target
more individual consumers than bulk"*. On Google that is the weaker half:

- **Consumer, single bottle:** $5 of margin. No Google click is that cheap. Generic product
  searches are also owned by Amazon and the big retailers.
- **Business, bulk (detailers, car washes, dealerships, fleets):** the 25-bottle minimum is ~$275
  with ~$125 of margin, and these buyers genuinely search ("wholesale car wash chemicals",
  "bulk car cleaning supplies"). That works at Google prices.
- **Consumer subscription:** real but thin search volume ("car cleaning subscription"). Worth
  buying, not worth building the account around.

So the shape to propose: **Google goes after the bulk and subscription buyers, where intent
already exists. Meta goes after individual consumers once it is available.** That gives
Constantine what he asked for, in the right order, rather than spending his first $1,000
proving that $11 impulse buys do not work on search.

**Google Shopping** is the other half of the Google answer for a physical product, and needs
Merchant Center plus a product feed. Their site is being rebuilt now, which is the moment to ask
for the feed. Note it is only listed in `e-domination` in the catalog, so including it at Launch
tier is a deliberate choice to make and to say out loud.

