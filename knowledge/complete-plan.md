---
name: complete-plan
topic: Pricing
task: the proposed "do all their marketing" offer (ads per lead with no minimum, websites, Google profile, extra services) and what was decided vs only proposed
keywords: [complete plan, all in one, done for you marketing, no monthly minimum, pay per lead only, first month free, founding offer, bundle, website plus google profile, $299, speed to lead, missed call text back, customer emails, booking deposits, package redesign]
status: LIVE 2026-11-07 ~7pm Phoenix (merge defc39f, rollback/20261108T015902Z, pre-merge ee2b6ca). Site and OS went live together on Bryson's go, after the test copy and the OS screenshots. 187/187 tests.
summary: The new pricing, decided and BUILT 2026-11-07 (dev branch, not live until Bryson says go). No monthly minimum for anyone (ads per qualified lead, stores 15%/12% of spend); 3 months then month to month with 30 days' notice; first five clients get the first month of lead fees free; Complete = $500/mo plus the lead fee with the website built free on a 12-month first term (leave early = $125 per month left), hosting/care, Google profile, blog, past-customer emails, booking, one agreement and one bill. Agreement terms v9 (old agreements untouched), Plan card with one-tap ad tier on the Contract tab, Deal Prep recommends Ads/Complete/Website, marketing site on the test copy. Tests verify-new-pricing + verify-complete-plan-site.
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

## ✅ DECIDED Sat 2026-11-07 evening: a cancellation fee, and Complete for online stores
1. **Cancellation fee (Ads, first 3 months):** pay back the setup fee we WAIVED, less a third for each month they stayed
   (any part of a month left counts as a whole month; only completed months are used up). A client who paid setup owes nothing extra. Recommended
   over a flat fee because it is tied to a real cost (the free build), so it survives a challenge as liquidated damages,
   and it keeps working whatever is decided about setup fees for client six onward.
2. **Complete for online stores:** $300/mo plus 15% of ad spend (12% at $10k+). Ads, shop landing pages, monthly emails
   that bring past buyers back, Google profile care if they have a location customers visit. NO website (we don't build
   online stores), so no 12-month lock: 3 months then month to month, and the same setup payback as Ads.

## 🔁 CHANGED Mon 2026-11-09: the free first month is a CALL-ONLY closer, not advertised
Bryson asked for a brutally honest view on showing "first month free for the first 5" on the site vs saying it on calls.
Advice given (and he agreed, after seeing a before/after picture of the banner): keep it, but off the website. It is a
small offer dressed as a big one (month one is the learning month, fewest leads), it does not touch the client's real
risk (their ad spend), and on the banner it diluted the strong, concrete offer (the free setup, $1,500 to $4,900). On a
call it is something to GIVE a hesitant owner. Conditions: always ticked on the Plan card so it is in the agreement, never
a verbal-only promise, never tied to an invented deadline.
- Banners (home + get-started) = free setup only. `verify-complete-plan-site` fails if "first month" reappears on them.
- Plan card box: "Free first month of lead fees (only if you offered it on the call)", never pre-ticked;
  `withQuotedPlan` no longer sets `foundingFreeMonth`.
- Deal Prep prompt: "A CLOSER BRYSON MAY USE, NOT PART OF THE OFFER", objection handling only, no deadline. Deal Prep
  screen notes say the same. Agreement clause 4.5 and billing unchanged (they apply whenever it IS ticked).

## 📸 OS screenshots shown before going live (Sun 2026-11-08, Bryson: "is there anything different in the os if so I want screenshots first")
Taken by running the real OS locally against a FAKE Supabase (scratchpad os-shots: fake-supabase.js serves made-up
clients from window.__FIX, every write discarded, all outside hosts blocked except the served React/Babel copies; Playwright
tries the LAST route first, so the block-all route must be registered FIRST). Fixes found from the pictures: the Package
tab now shows the client's own per-lead rate and "Setup waived" (it read the niche default and the list setup); a store's
Plan card no longer says "lead fees" or the two-platform sentence; Deal Prep's Website box no longer calls the site
"its own agreement, separate from the ads" beside a Complete recommendation.

## 🏗️ BUILT (same evening): the cancellation fee and Complete for stores
- `waivedSetupOf(cl,pkg)` (standard setup minus agreed setup, frozen at send as `contractWaivedSetup`) and
  `setupPaybackOwed(cl,pkg,now)` = waived x months left of the first 3 / 3, in both renderer copies. Agreement v9 (b)
  states it with the amount as liquidated damages; key terms show "Waived ($X standard; paid back in part if Client
  leaves in the first 3 months)". A client who paid setup still reads "NO EARLY-TERMINATION FEE". The website Complete
  plan pays back the build instead, never both. OS early-exit card adds it.
- 🔴 `monthsLeftOf` counts only COMPLETED months as used (a month under way is still owed), matching the agreement's
  "any part of a month counting as a whole month". The first version had it backwards; a test now pins it.
- Store Complete: `COMPLETE_STORE` ($300, 3 months) in contract-shared + pricing-shared, `isStorePkgId` (packageId
  "e-"). Section "The Complete Plan for Online Stores" (shop pages, past-buyer emails, Google profile if they have a
  location; "Agency does not build or run the store itself"). `completeCovered` is false for stores, so no free website
  unlocks. Plan card and Deal Prep allow it; pricing page store tab has a "Complete for stores" box; FAQ + llms.txt.
- verify-new-pricing now 156 checks, 14/14 mutations caught overall. 187/187.

## 🏗️ Steps 1 to 6 BUILT (Sat 2026-11-07 afternoon, dev branch, not live)
Bryson: "update the agreements billing and deal prep to the new pricing. also make sure in the os that there is an easy
way to select which tier package they are on if they get the complete package".
- 🔴 **Terms v9** (`TERMS_CURRENT = 9`, `TERMS_V9_FROM` 7 Nov 2026 5pm Phoenix; OS `CONTRACT_TERMS_VERSION = 9`). EVERYTHING
  new is gated on v9, so a signed or sent agreement keeps its minimum, renewal menu and exit fee. Helpers, identical in
  `netlify/lib/contract-shared.cjs` and `index.html` (inside the lifted TERMS_V2_FROM span): `COMPLETE_PLAN`,
  `ADS_FIRST_TERM_MONTHS`, `NOTICE_DAYS`, `FOUNDING_FREE_DAYS`, `contractOut`, `noMinimumTerms`, `planOf`, `planFeeOf`,
  `foundingFreeMonthOf`, `minimumOf`, `rollingTerm`, `firstTermMonths`, `completeExitOwed`.
- **The catalog's `price` is now ONLY the minimum of pre-v9 agreements.** Nothing new reads it as a fee: `minimumOf` is 0
  on v9; `calcMonthlyBill` defaults to `noMinimum: true` (pass false to reproduce an old bill).
- **Agreement v9 (ads):** "THERE IS NO MONTHLY MINIMUM", Initial Term 3 months then month to month (2.2/2.3, no
  renewal menu, no holdover), termination (a) 30 days' notice from the end of the first term, (b) early during the first
  term owes only accrued fees, NO early-termination fee (decided by me: with no monthly fee there is no honest number to
  charge; tell Bryson if he wants one). Stores: 15%/12% of spend, no minimum, own wording.
- **Complete agreement** = the same ads agreement with section "The Complete Plan" after General: website (5 pages, 2
  rounds), hosting/care (2 edits), Google profile care (the add-on's conduct clauses reused), blog (~4/mo), past-customer
  emails, booking with deposits; $500/mo billed in advance from the Start Date, lead fees ON TOP; build fee $1,500 waived
  on the 12-month term, early exit $125 per month left (part month whole), ownership/handover clause.
- **Founding first month:** a per-client tick (`foundingFreeMonth`), clause 4.5 + key-terms row. Billing card counts a
  lead free when it ARRIVED within 30 days of `contractStart` (marked `freeFounding`, fee 0), never by approval date.
- **Frozen at send** (like add-ons): `contractPlan`, `contractPlanMonthly`, `contractFoundingFreeMonth`; Replace agreement
  clears them.
- **Billing:** v9 ads = results-only path (card on file, monthly lead invoice). Complete = Stripe subscription for the
  plan fee (product named "Complete plan with ... (monthly)", `productLabel`), lead fees parked as pending items that ride
  that invoice in FULL (`monthlyFloor = minimum` = 0). 🔴 No double billing: `addOnsOf` returns [] for Complete; website
  deal card shows "Covered by Complete" (no agreement/invoices); `website-deal` launch skips `startCarePlan`;
  `blogActive` true for a signed, live Complete site; build/publish locks open when the ads agreement is signed.
- **Renewals:** v9 clients are never offered one (Contract tab shows "First term ends X, then month to month"). A pre-v9
  client renewing goes ONTO v9: `billingMonthly: 0`, stamp v9, and new Stripe action `end-minimum` sets the old ads
  subscription to cancel at the end of the period already paid (never immediately). The 1/3/6/12 term menu is retired.
- **No more "contract ending, renew" for v9:** `daysToRenewal` (Infinity when rolling) in every OS list/alert/score;
  billing-watch renewal email, calendar digest, report-shared health/renewals and the portal all skip rolling clients.
- **OS Plan card** (Contract tab, above Special Terms): Ads / Complete buttons, then one tap per tier (Launch / Growth /
  Acquisition, the tier their `adBudget` fits marked FITS) and platform (Google / Meta / Both, Both only from $5,000),
  Complete price box, founding tick. Stores can't pick Complete. After sending it only states what the agreement holds.
- **Deal Prep:** prompt has `completePromptBlock` and a third header line `PLAN: ads|complete|website` (`parsePlanLine`,
  stored as `recommendPlan`); screen shows the three plans with the trade's lead fee and "★ Pitch this"; package rows say
  "no monthly fee"; founding note = setup waived + first month of lead fees free; "Create the client" has Ads/Complete
  (`withQuotedPlan`). Cold-call objection card, portal upgrades/package card, invoice email (Complete line), blog writer
  facts, lead scout prompt, lead-fee finder all updated.
- Tests: NEW `tests/verify-new-pricing.mjs` (122 checks, 10/10 mutations caught). Old-terms suites pinned to
  `contractTermsVersion: 8` where they describe a minimum (they still guard agreements already out), with v9 checks added
  beside them; `verify-term-incentive` rewritten for the retired menu. 187/187.
- 🔴 Existing clients: they keep what they signed. To move one onto the new pricing, "Replace this agreement" and they
  sign the new one, or renew them onto it at the end of their term.

## 🔨 BUILD PLAN (DONE, kept for the record) (recommended to run in a FRESH session; this one's context was huge)
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

## 2026-11-10 — Bryson: "there is a big difference between if a client bought them individually vs in the bundle"
Triggered by Springbok (KB springbok-wellness-deal). The numbers (parts = website $1,500 + care $100/mo + Google
profile $130/mo + blog $300 + $150/mo):
- Year 1: parts $6,360 vs Complete $6,000 (Complete saves $360). Fine.
- 🔴 Year 2 on: parts $4,560 vs Complete $6,000. Complete costs $1,440 a year MORE than the same parts once the
  free build is paid off, and it is month to month then, so a sharp client downgrades. That is the real flaw.
- A client who wants only website + Google profile (no blog): parts $4,260 year 1 / $2,760 after vs $6,000. Not a
  flaw: a bundle is only good value if you want most of it. Show the "just the pieces" path clearly instead.
DECIDED by Bryson 2026-11-10 ("Let's change it to what you said"), BUILT same day: after the first 12 months Complete drops to $375/mo (the $125 a month that paid off the
free website comes off: 375 + 125 = 500), so it is never dearer than the parts. Alternative $350 for a clearer
discount. No Complete client exists yet, so changing it now costs nothing; it touches the pricing page, the v9
agreement's month-to-month price, billing (price drops at month 13), Deal Prep and tests.

## The step-down, as built (2026-11-10)
- Price list: `COMPLETE_PLAN.monthlyAfterTerm` (375 = 500 - build/12) in pricing-shared; the contract-shared/index.html
  mirror carries `monthlyAfterTerm: 375` too. Stores never step down (no website to pay back).
- Agreement (both copies): (b) says the fee drops to $375 from the first month after the initial term; the summary
  row reads "$500/mo, then $375/mo after the Initial Term". Frozen at send as `contractPlanMonthlyAfter`
  (`planFeeAfterTermOf`); an agreement sent BEFORE this has no stamp and keeps its flat fee ("the same fee").
  `planFeeNowOf(cl, now)` = this month's fee. No new terms version was needed (still v9) because of the stamp.
- Billing: `netlify/lib/complete-stepdown.mjs` (`completeStepDownDue`, `applyStepDown`), run daily by billing-watch on
  the ads subscription: lowers the Stripe price (proration none, idempotent) as soon as the NEXT invoice is the first
  after the initial term, never raises a price, logs it on the client and emails Bryson (or emails him if Stripe refused).
- Shown in: Package tab price box, Plan card (button, sent-agreement line, fee note), overview tile, Website tab line,
  billing terms + invoice email (planFeeNowOf), Deal Prep plan card + sales prompt, cold-call objection card, Lead Scout
  brief, client portal package line, pricing page (choices card, price box, terms), How it works, FAQ (2 answers),
  industry pages, llms.txt, the blog writer's facts.
- Guards: `tests/verify-complete-stepdown.mjs` (24), plus verify-new-pricing (168) and verify-complete-plan-site (59).

