---
name: airsuds-deal
topic: Clients
task: work on the Air Suds deal, quote Constantine, or decide how to price an e-commerce client
keywords: [Air Suds, AirSuds, Constantine, car side, aircraft side, car cleaning product, schools, subscription, bottles, e-commerce client, ecommerce pricing, no leads, buys on website, store, g-launch vs e-launch, founding terms ecommerce, ad spend percentage, third client, website down maintenance]
status: open
summary: 🔴 NOT A CLIENT YET AND MUST NOT BE COUNTED AS ONE — Constantine said yes verbally, nothing signed and nothing in the OS. Air Suds makes cleaning products; ads are for the NEW CAR side (Bryson's own recommendation to open it), which is about a week away while logo variations are made. Customers BUY STRAIGHT FROM THE WEBSITE, no forms and no contact, so this is e-commerce and the per-qualified-lead billing Bryson quoted has nothing to count. 🔴 Founding terms as written ("no monthly minimum, pay only per qualified lead") would bill Air Suds $0/month forever while BoldLine runs $1,000/month of ads. 🔴 AND BRYSON ALREADY TOLD CONSTANTINE "basically free, you only pay for results", so a % of AD SPEND is off the table — the fee has to sit on a RESULT. The fix is to name the result correctly: a sale, or better a new subscriber. BUILT 2026-09-16 (KB `billing-for-sales`): the Billing card now has Billing for → Leads / Sales plus a required sentence saying which purchases count, and the agreement, key terms, Stripe clause and portal all follow it. Budget $1,000/mo. Unit economics are the real risk: the known product is $6 to make and sells for $11, so single-bottle sales cannot pay for Google clicks; subscriptions and the 25-bottle minimum can.
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

✅ **BUILT 2026-09-16** — see KB `billing-for-sales`. Set **Billing for → Sales** on the Billing
card and write the sentence that says which purchases count ("a new monthly subscription, or a
single order of 25 bottles or more"). The agreement then quotes it word for word, and the send is
blocked until it is written. It is a rename rather than a new pricing model, so the rate still
lives in the same place and nothing else changed.

**His package: Store Launch** (`e-launch`) — the honest name for a shop, $1,000/mo budget puts
him in the Launch tier, $400 monthly minimum and $800 setup, both waived under founding terms.
His performance fee is **per qualified sale** instead of the store default of 15% of ad spend,
which is a choice at the same tier rather than a different package (see `pricing-model`).

🟡 **One thing that does not match:** Store Launch does not list a landing page among its
inclusions, and Bryson promised Constantine a dedicated page for the subscription offer. Either
add it to the package (affects every store client and the public site) or treat it as an extra on
this deal. **Not decided.**

**Still to decide with Constantine:** the fee itself (recommended $25 per new subscriber or bulk
order, single bottles free) and whether he pushes back on any of it. Bryson's message went out
inviting exactly that.

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

**The car side is the SAME numbers.** Bryson, 2026-09-16: *"the car side will cost the same as
well because its the same product formula and everything just different branding."* So $6 to
make, $11 to sell, ~45% margin, and the subscription and 25-bottle structures carry over. The
arithmetic above is the real arithmetic, not an estimate borrowed from the other side.

## Which platform

🔴 **CORRECTED 2026-09-16. An earlier version of this section said Meta was unavailable and
recommended Google as the only option. That was wrong: Meta granted standard access on
2026-09-14** and Bryson had already sent the screenshot. The error came from a stale KB summary,
which has been fixed in `meta-marketing-api`, `meta-parked-work` and `site-coming-soon`.

**Meta is the right primary channel and it IS available.** A $11 consumer bottle with a
subscription is textbook direct-to-consumer: visual, impulse, low consideration, and the whole
point is showing it to people who were not looking for it. Google catches existing demand, and
there is not much demand to catch for car cleaning spray — those searches are owned by Amazon
and the big retailers.

**Recommended: Meta for the consumer subscription, which is what Constantine asked for.** His
note says *"target more individual consumers than bulk"*, and on Meta that is the correct call
rather than the expensive one it would have been on search.

**Google is the second campaign, and aimed somewhere different:** the bulk buyers (detailers,
car washes, dealerships, fleets) who genuinely type "wholesale car wash chemicals" into a search
box. A 25-bottle order is ~$275 with ~$125 of margin, which pays for a Google click. At $1,000/mo
of total budget, splitting across both platforms is below `COMBO_MIN_BUDGET` ($5,000) for a
reason — **pick one to start.** Start on Meta.

**Google Shopping** is the other half of the Google answer for a physical product and needs
Merchant Center plus a product feed. Their site is being rebuilt now, which is the moment to ask
for the feed. It is only listed in `e-domination` in the catalog, so including it lower down the
ladder is a deliberate choice to make and to say out loud.

**Why each channel suits a different buyer here:**

- **Consumer, single bottle:** $5 of margin. No Google click is that cheap, and generic product
  searches belong to Amazon. On Meta the same person is reachable cheaply, and the job of the ad
  is to turn them into a subscriber rather than a one-bottle buyer.
- **Consumer subscription (Meta):** ~$110/month, ~$50/month of margin, worth a few hundred
  dollars over six months. This is the campaign to build.
- **Business, bulk (Google):** the 25-bottle minimum is ~$275 with ~$125 of margin, and these
  buyers genuinely search. Real, and the right second campaign once there is budget for two.

## 🔴 OPEN QUESTIONS BEFORE ANYTHING IS SIGNED OR LAUNCHED (2026-09-16)

Raised with Bryson after the per-sale billing shipped. None of these is a code problem; they are
things that decide whether the arrangement works or turns into an argument in month two.

**1. Whose number counts a sale.** The lead flow has an answer (leads land in the OS, Bryson
reviews and approves them onto an invoice). **Sales have no equivalent** — purchases happen on
the client's own website. Two candidate sources disagree on purpose: Meta's reporting
over-claims by design, and the client's own store data is what the client believes.
**Recommendation: use Constantine's own store numbers.** It costs little if the ads genuinely
work and it removes the exact argument that burned Brendon ("what counts as a lead"). Agree it on
a call, not in month two.

**2. The attribution window is NOT in the clause, and should be.** The agreement says a Qualified
Sale is a purchase by a customer who *"reached it as a result of the Campaigns"* with **no time
limit stated**. Someone clicking today and subscribing in six weeks is arguable either way.
Recommendation: state a window (30 days from the click reads as generous and is easy to check).

**3. View-through conversions.** Meta counts "saw the ad, never clicked, bought later" as a
conversion by default. That will inflate the count and the client will push back the first time
he compares it with his own data. Agree **click-only**, and set the campaign up that way.

**4. Existing customers re-ordering.** The clause counts repeat purchases once per thirty days but
does **not** exclude people who were already customers. On a subscription product an existing
customer re-subscribing is not a new customer BoldLine won. Worth excluding explicitly.

**5. 🔴 The pixel and the purchase event are the critical path, and not only for billing.**
Without a purchase event carrying a VALUE, Meta cannot optimise toward buyers at all and will
optimise for landing-page views instead. That is the difference between the campaign working and
not, quite apart from whether anyone can be invoiced. The site is being rebuilt right now, which
is the one cheap moment to get it in. **Get a date for the rebuild** — everything else waits on
it.

**Also confirm he has his own Meta ad account, Facebook page and pixel.** Hard business rule: the
client owns and pays for the ad account, BoldLine only ever holds manager access. If any of those
do not exist yet, that is setup work nobody has scheduled.

