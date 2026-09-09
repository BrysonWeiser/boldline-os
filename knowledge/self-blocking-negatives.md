---
name: self-blocking-negatives
topic: Ads
task: choose or debug negative keywords, or work out why a campaign gets no impressions on its best search
keywords: [negative keywords, negatives, free, free quote, blocked own offer, self blocking, NEVER_NEGATIVE, dropSelfBlockingNegatives, UNIVERSAL_NEGATIVES, negativesRefused, near me, discount, bulk discount, coupon, promo code, no impressions, why no leads, negative keyword blocking, campaign gets no traffic]
status: verified
summary: The seed negative list every client started from began with the bare word "free", which in Google blocks EVERY search containing it — including "free quote", the button on every landing page BoldLine builds. Bare "discount" likewise blocked "bulk discount", a buying search for a printer. Fixed at the seed (bare words replaced by the phrases that carry the bad intent) AND enforced at the build, where the typed box, the model's output and a learned playbook all arrive; what gets refused is reported in the success message, never dropped silently. 76 checks, 13 mutations.
verified: 2026-09-09
---

**Found 2026-09-09, in the box, seconds before the first real client's campaign was built.** Bryson asked whether the launch screen looked right. It did not, and the defect was in the part nobody looks at.

## The bug

`UNIVERSAL_NEGATIVES` — the list every client's campaign is seeded with — began:

```
"free", "cheap", "cheapest", "discount", "bargain",
```

🔴 **A one-word negative keyword in Google blocks every search containing that word.** So the bare word `free` blocks:

- `free quote screen printing`
- `free estimate custom shirts`
- `get a free quote for embroidery`

**"Get Your Free Quote" is the button on every landing page BoldLine builds.** We were paying a model to write the offer, paying to build a page around it, and then paying to block the people searching for it. On a $16/day budget that is not a rounding error, it is the best traffic in the account.

`discount` has the same shape and is less obvious: for a screen printer, **`bulk discount t shirts` is a buying search** from exactly the kind of business Sebastian wants. Blocking the whole word to catch coupon hunters throws that away.

## The rule that came out of it

**The bad intent lives in the second word, not the first.** `for free` and `free sample` are freebie hunters. `free quote` is a buyer. So the bare words go and the phrases stay:

| Was | Now | Why |
|---|---|---|
| `free` | `for free`, `free download`, `free sample` | keeps `free quote` alive |
| `discount` | `discount code`, `coupon`, `promo code` | keeps `bulk discount` alive |
| `cheap`, `cheapest`, `bargain` | unchanged | pure price-shopper signals, correct to block |
| `jobs`, `salary`, `tutorial`, `course` | unchanged | never buyers |

**The exception to "the second word carries the intent" is when the second word IS the offer**, which is why `free quote`, `free estimate`, `free consultation`, `get a quote` are refused as whole phrases too.

## Enforced at the build, not just fixed in the list

Fixing the seed list is not enough, because **three different sources can supply a negative**: the box Bryson types into, the model that writes the generated campaign, and a playbook a previous client taught us. So `dropSelfBlockingNegatives()` (in `netlify/lib/trade-playbooks.mjs`, exported alongside `NEVER_NEGATIVE`) runs at `createCampaign`, where all three arrive. It normalises case, spacing and Google's own `[bracket]` / `"quote"` notation, so none of those is a way past it. The generator filters its own output through the same function, because **the schema description had literally been telling the model that `free` was the obvious example of a good negative.** The prompt now says the opposite and says why.

🔴 **NOTHING IS DROPPED SILENTLY.** `createCampaign` returns `negativesRefused`, and the launch message names each one with the reason: *"Not blocked, on purpose: free — those words also appear in 'free quote', which is the button on the landing page this campaign points at."* A quietly ignored instruction is how an operator ends up relying on a block that does not exist.

## Verified

`tests/verify-self-blocking-negatives.mjs` — **76 checks, 13 mutations, all caught.** Every protected term refused and every legitimate one kept; messy case, spacing and bracket notation caught; refusals reported **verbatim** rather than tidied (he has to find the line he typed in a box of 25); the seed list run through the guard and coming back clean, which is the assertion that the net is a net and not the fix; both mirrors of the list checked, because the OS keeps its own copy and fixing only the server would fix nothing he sees.
