---
name: complete-plan
topic: Pricing
task: the proposed "do all their marketing" offer (ads per lead with no minimum, websites, Google profile, extra services) and what was decided vs only proposed
keywords: [complete plan, all in one, done for you marketing, no monthly minimum, pay per lead only, first month free, founding offer, bundle, website plus google profile, $299, speed to lead, missed call text back, customer emails, booking deposits, package redesign]
status: ALL DECIDED + both "confirm" items confirmed 2026-11-07. Step 7 (marketing site) BUILT on the TEST COPY, waiting on his look. Steps 1-6 (agreement, billing, Deal Prep, OS) NOT built yet; the site must not go live before them.
summary: Bryson, 2026-11-06, floated (1) no monthly minimum for anyone, pay only per qualified lead, first 5 clients get their first month free; (2) a system where a client pays BoldLine to manage all their marketing. Advice given and NOT yet confirmed by him - say "first month of lead fees free" not "completely free" (ad spend stays theirs), keep a ~3-month minimum term, keep the setup fee after the first five; per-lead only for ADS leads, flat monthly for website + Google profile; a "Complete" plan around $299/mo with the website built free on a 12-month term (leave early = pay the rest of the build) plus ad lead fees; skip social media and SEO retainers. Extras recommended - instant lead reply + missed-call text-back (blocked on Twilio upgrade + A2P), bring back past customers emails (BUILT for clients 2026-11-06, KB business-emails), online booking + deposits (already built, just name it).
verified: 2026-11-07
---

## Meta is part of it
Meta was approved 2026-09-14 (KB meta-marketing-api): Complete and every offer include Google AND Meta ads.
Never describe Meta as pending or coming soon.

## DECIDED by Bryson, Sat 2026-11-07 (answers to the five questions)
1. ✅ No monthly minimum for anyone: clients pay only per qualified lead (ads). Replaces the "greater of" minimum.
2. ✅ First five clients get their first month of LEAD FEES free (ad spend stays theirs, say it that way).
3. ✅ Every agreement has a 3-month minimum.
4. ⏸ Setup fee for client six onward: NOT decided, "we can reevaluate when we get there". First five stay waived.
5. 💬 Complete price: Bryson proposed **$500/mo** ("that would be about $2000 worth of value"). Recommendation given:
   $500 works ONLY with the blog included (4 articles/mo, normally $150/mo). Without it Complete costs more than the
   parts bought separately (~$355/mo: build $1,500/12 + care $100 + Google profile $130); with it the parts are ~$505/mo
   plus emails, review requests and booking that aren't sold alone. Don't advertise a "$2,000 value" figure; show the
   itemised list. AWAITING his yes on "$500 with the blog included" before building.
Preview shown 2026-11-07 (an HTML mock of the pricing page, the list of every page that changes, and the OS flow),
sent as a file only, not published. Open questions put to him in it: (1) $500 WITH the blog; (2) store plans: keep 15%
of ad spend with no minimum (recommended) or a fee per sale; (3) Complete includes ONE ad platform, both still needs
$5,000/mo ad budget. Pages that mention the old pricing: pricing (19 mentions), home, ads, websites, the four industry
pages, compare, about, get-started, llms.txt. OS work: a Complete package that switches on ads + website + Google
profile + blog + customer emails + booking; ONE agreement (today ads and website are separate); billing = $500/mo
subscription + approved lead fees on the same bill, founding first month of lead fees skipped automatically.
Build order once he says yes: marketing site on the TEST COPY first (his OK), then agreement terms, Deal Prep, billing.

## ✅ FINAL ANSWERS (Sat 2026-11-07, ~10:30am Phoenix)
- Complete = **$500/mo WITH the blog included** (yes).
- **Online stores: 15% of their monthly ad spend (12% at the top tier, as today), no monthly minimum** (yes). Bryson
  first read it as "instead of a cut from each client"; clarified: only stores (no leads to count), the ad money still
  goes from their card to Google/Meta, BoldLine bills the 15% separately.
- Complete includes **one** ad platform; both Google and Meta still needs $5,000/mo ad budget, same as Combined (yes).
- With 1-4 above (no minimum for anyone, first month of lead fees free for the first five, 3-month minimum, setup fee
  for client six undecided).

## ✅ RENEWALS: MONTH TO MONTH ONLY (Bryson, Sat 2026-11-07)
"for renewals after the first 3 months will only be month to month because there is no reason for a client to sign
for more than a month at a time anymore". With no monthly fee for ads, the old renewal menu (1/3/6/12 months with
month-to-month +10%, 6 months -5%, 12 months -10%, KB `contract-renewal-pricing`) has nothing left to discount, so:
- After the 3-month initial term, the agreement simply continues **month to month**. No renewal to sign, no term
  choice, no +10% month-to-month premium. Either side can end it with notice (the agreement already uses thirty days'
  written notice for add-ons; use the same unless Bryson says otherwise, and confirm it with him in the build).
- **Complete**: its first term is 12 months (that pays back the free website build); after that, month to month at
  $500 too. (Inferred from the same reasoning; confirm with Bryson when building.)
- Build impact: the renewal flow on the Contract tab, the renewal email, `TERM_RATE`/term discounts and the contract's
  term wording all change for NEW terms only; clients already signed keep what they signed.

## ✅ CONFIRMED by Bryson, Sat 2026-11-07 ~11:30am Phoenix (the two "confirm with Bryson" items)
- After the first term, either side ends it with **30 days' notice**.
- **Complete goes month to month at $500 after its first 12 months**, same notice.
Both live in `TERMS` in `netlify/lib/pricing-shared.mjs` (with `COMPLETE_PLAN`), which the site already reads.

## 🌐 Step 7 DONE on the test copy (2026-11-07, dev branch, pushed to the test-copy branch)
- Test copy = Netlify branch deploy of `claude/monday-sept-7-catchup-hyschf` (address in KB two-netlify-sites). The dev
  branch of the session is pushed there; a commit must touch `marketing-site/` or Netlify skips the build.
- Pricing page: hero "Pay for leads, not promises."; three choices (Ads "No monthly fee" / Complete $500 featured /
  Website $1,500); plan finder says "No monthly fee" at every budget and its example month now LIGHTS THE LEADS you
  pay for (3 slow, 11 busy, `.pf-dots`) instead of the old minimum-vs-fee bars; ad cards "No monthly fee" + "A set fee
  per qualified lead. Nothing in a month with none."; stores "15%/12% of your ad spend, billed after the month. No
  minimum."; rewritten how-you-pay box (3 months then month to month, 30 days' notice); new `#complete` section (7
  parts, each with its stand-alone price from the price list, NO invented total value; terms boxes: 12 months, early
  exit = $125 per month left of the $1,500 build, one platform, both needs $5,000).
- Elsewhere: home price tile, Websites tile "or free with Complete", trade pages' price block, /compare/ rows (paid
  per lead; 3 months then month to month, 30 days), FAQ (cost answer, 30 days' notice, NEW "What counts as a qualified
  lead?" and "What's in the Complete plan?"), founding banners (home + get-started) add "and so is the first month of
  lead fees", Google profile eyebrow "Add-on, or included in Complete", ads structured data price 0, llms.txt,
  recommender's sub-$500 answer no longer mentions a minimum.
- 2026-11-07 ~12:10pm Phoenix, Bryson on the ad plan cards: "instead of showing no monthly fee lets say that they only
  pay for results and which ad budgets qualify them for which tier". Cards now read: name, a gold-edged band "For ad
  budgets of $X to $Y/mo" (from `adSpend`), then "Pay only for results" (the Ads choice card and plan finder say the same).
  STORE cards lead with "15% / 12% of your ad spend" instead, because "only for results" is not true of a share of spend
  (told him; tests enforce headline-per-model).
- Tests: NEW `tests/verify-complete-plan-site.mjs` (37 checks, 7 mutations caught); verify-packages section 6,
  verify-site-matches-packages, verify-marketing-pages, verify-marketing-motion updated to the new model. 186/186.
- 🔴 KNOWN, DELIBERATE GAP: the catalog's `price` (and the OS, agreement, Deal Prep, `calcMonthlyBill`) still carry the
  old monthly minimums. verify-packages says so in a comment where it now checks "advertises no monthly fee" instead of
  "price matches". Do NOT merge the dev branch to main (that would put the new site live) until steps 1-6 land.
- Still to update with the OS step: `netlify/lib/blog-shared.mjs` (blog writer facts say "whichever is higher"),
  `client-emails-shared`, `scout-shared`, `lead-fee`, `ads-autopilot`, `deal-research-background`, portal copy.

## 🔨 BUILD PLAN (recommended to run in a FRESH session; this one's context was huge)
What already exists (do not rebuild):
- Results-only billing: card on file via Checkout mode "setup", each approved lead batch charged as its own invoice
  (KB `results-only-billing`). Clause 4.1 has a results-only variant, but today it is "no monthly minimum DURING THE
  INITIAL TERM" (founding, `introOnly` in contract-shared.cjs ~line 548/581); the 3-month initial term clause is 2.2.
- Founding count and banner wiring (KB `founding-offer`, netlify/lib/founding.mjs), Deal Prep quoting
  (netlify/lib/pricing-shared.mjs), store plans at 15%/12% (KB `pricing-model`), website deals, Google profile care
  billing (KB `addon-billing`), blog, customer emails (KB `business-emails`), booking + deposits.
Steps:
1. **No minimum for every lead-gen package, permanently** (not just the founding initial term). New contract TERMS
   VERSION (terms are stamped at send, so signed/out-for-signature agreements keep theirs; KB `late-payment-policy`,
   `contract-terms-versioning`). Package `price` stops being a floor: the catalog's FIVE copies + `verify-packages`
   (KB pricing-model) show "No monthly fee, pay per qualified lead". `calcMonthlyBill` floor 0. Keep tiers by budget.
2. **Stores**: 15% (12% top) of ad spend, no minimum; same terms version.
3. **Founding (first five)**: setup waived (as now) + **first month of lead fees free** = leads delivered in the first
   30 days after go-live (contractStart, KB campaign-live) are not charged; clause in the agreement; Deal Prep + banner.
4. **3-month minimum** stays for ads-only (already clause 2.2), then MONTH TO MONTH (see Renewals above). **Complete = 12 months**, then month to month.
5. **Complete package** (new id): $500/mo Stripe subscription; one ad platform (both = Combined rules, $5k budget);
   Standard 5-page website with the $1,500 build WAIVED on the 12-month term, early exit = the rest of the build
   pro-rated; hosting/care, Google profile care, blog (4/mo), customer emails (still per-client consent + own sender),
   booking + deposits. ONE agreement covering ads (per lead, no minimum) + website + the rest. Lead fees go on the same
   bill as the $500. 🔴 Must NOT double bill: Google profile care ($130) auto-billing on link, website care ($100),
   blog ($150) must all be suppressed for a Complete client (they are inside the $500).
6. **OS**: plan picker (Ads / Complete / Website) on the client sheet; Complete switches on everything; Contract tab
   sends the one agreement; Deal Prep recommends between the three with the trade's lead fee.
7. **Marketing site, TEST COPY FIRST for his OK** (pages: pricing, home, ads, websites, 4 industry pages, compare,
   about, get-started, llms.txt), matching the preview he approved (heading "Pay for leads, not promises.", three
   choices, ad tiers "No monthly fee", rewritten how-you-pay box, founding banner adds the free first month).
8. Then agreements/billing/Deal Prep merge to main after tests; site goes live on his "go".

## Status
- Pricing changes (no minimum for all, free first month, Complete plan) are ONLY PROPOSED. He has not confirmed the
  three conditions or the $299. Do not change the site, Deal Prep, agreements or billing until he does.
- He said "yes" to: start with customer emails (built) and booking/deposits (already built, to be named in Complete),
  and a walkthrough to start the Twilio upgrade + A2P registration (instant lead reply / missed-call text-back).

## The reasoning given (so it is not re-derived)
- Only ADS leads are fairly countable; website/Google-profile enquiries include customers who'd have come anyway, so
  billing those per lead invites disputes. Flat monthly for always-on work is honest.
- Bought separately: website $1,500 over 12 months (~$125) + care $100 + Google profile $130 = ~$355/mo; Complete at
  $299 with no upfront cost is the hook; ~$3,600/yr per client to BoldLine plus ad lead fees.
- Today the website and the ads are SEPARATE agreements and bills; Complete needs one agreement + one bill, the
  pricing page and Deal Prep.
- Calls, not packaging, land the next client.
