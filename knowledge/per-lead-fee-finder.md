---
name: per-lead-fee-finder
topic: Pricing
task: work out what to charge a client per qualified lead, or change how that number is calculated
keywords: [per-lead fee, lead fee finder, what should I charge per lead, lead-fee function, LeadFeeFinder, getNicheLeadFee, LEAD_FEE_TABLE, DEFAULT_LEAD_FEE, job value, close rate, lead value, CPL, billingPerLead, fee clamp, Deal Prep fee]
status: verified
summary: OS tool (BUILT 2026-08-18) — type a niche and any company detail, get a defensible per-qualified-lead fee back in seconds with the arithmetic shown: job value, close rate, what a lead is therefore worth, and the fee as a share of that. Ends on a month projection that flags when the fee is too low to ever clear the monthly minimum. Reachable from Deal Prep and from a client's Billing card, where "use this rate" writes it straight onto the client. Synchronous Netlify function, no web search, no new Supabase table.
verified: 2026-08-18
---

**Bryson, 2026-08-18:** *"I want to build something where I can put in the niche and or details
about a specific company and I quickly get a per lead fee generated."*

## Why it is not just a lookup

`getNicheLeadFee` already covers ~90 keywords and returns a good **anchor**. It cannot know that
this particular roofer only does commercial re-roofs at $80,000 a job, or that this med spa's
whole business is $200 facials. Under the greater-of pricing model the per-lead fee is the ONLY
number that varies per client, so it is the one that has to be right.

## Why it shows its working

The fee is quoted out loud on a call and has to be defended in the next breath. So it returns the
whole chain, which is also the script:

1. One customer is worth **$X** (first-year value for anything with repeat purchase, because a
   $40 car wash that comes back monthly is not a $40 customer)
2. They close about **Y%** of qualified leads
3. So one lead is worth **$X × Y%**
4. The fee is **2-5%** of that

Plus what they already pay Google per lead, and the fee as a percentage on top of it. A bare
number he cannot explain is worse than no number.

## 🔴 Why it ends on the month projection

A fee that never clears the package's monthly minimum means the client is effectively on a flat
rate and the whole performance pitch is fiction. The tool projects `budget ÷ CPL` leads through
`calcMonthlyBill` and says so in amber when `atFloor` is true. **This is the most useful thing it
does** and the reason it is worth running before a call rather than guessing.

## Guard rails are in CODE, not the prompt

The prompt asks for sane values; these are what happens when it does not get them:

| Guard | Why |
|---|---|
| fee clamped to **$10–$5,000** | below $10 the fee can never clear any minimum, which silently turns performance pricing into a flat rate |
| missing / non-numeric fee → the table anchor | never return nothing |
| reversed range swapped, then forced to contain the fee | a range quoted backwards on a call is a real mistake |

`tests/verify-pricing-tools.mjs` **pins the clamp expressions in the source**, so moving a bound
fails the test and forces the re-implementation in the test to be updated with it, rather than
silently testing a fossil. Four deliberate breaks were confirmed to fail.

## Wiring

- `netlify/functions/lead-fee.mjs` — synchronous on purpose (no web search, one small tool call),
  so it answers inline instead of needing a polling table like Deal Prep does. Owner-JWT auth,
  same pattern as `ad-generator`. Model fallback list, same as the ad generator.
- `LeadFeeFinder` in `index.html` — one component, rendered twice:
  - **Deal Prep**, collapsed behind *"What should I charge per lead?"*. The full brief also
    returns a fee but takes about a minute; this answers in seconds, which is the difference
    between having a number on a live call and not.
  - **A client's Billing card**, next to the rate editor as *"what should this be?"*. `onUse`
    writes `billingPerLead` straight onto the client so the number cannot be mistyped in transit.
- No new env vars. No new Supabase table.

## Related

`pricing-model` (the greater-of rule the fee plugs into), `deal-prep`, `revenue-tracking`.
