---
name: late-fee-setting
topic: Contracts
task: change, lower, waive or set a client's late fee, or understand why a client was charged a particular late fee
keywords: [late fee, edit late fee, change late fee, lower late fee, waive late fee, no late fee, billingLateFee, contractLateFee, chargedLateFee, agreedLateFee, lateFeeSetting, lateFeeFrozen, LateFeeRow, 3.4(b), feeWords, $150]
status: verified
summary: Built 2026-10-19. Every client on the late-fee terms (v6+) now has a "Late fee" box on the Billing card (Contract tab), editable any time. Blank = the standard $150, 0 = no late fee, whole dollars up to $1,000. Before the agreement goes out the box IS the number printed in section 3.4(b) (in words and digits; $0 prints "No late fee applies"). Sending stamps it as `contractLateFee`, so a signed agreement never changes, and anything sent before this existed signed $150. The automatic charge, the late-payment email and the OS alerts all use `chargedLateFee` = the LOWER of what was signed and today's box, so Bryson can always go easier on a client after signing, never charge more than they agreed. Springbok's 19 Oct agreement went out before this shipped, so it says $150, but lowering his box now lowers what he would actually be charged.
verified: 2026-10-19
---

## The ask
Bryson, 2026-10-19, while sending Springbok's replacement agreement: *"if i want to lower his late fee how do i do
that"*, then *"for the future for all clients i want an easy way to edit the late fee"*. Before this the fee was a
constant ($150) in `late-payment.mjs` and hard-written into the contract text, so a Special Term saying "$25" would
have left the agreement saying $25 while billing-watch still added $150 automatically.

## Where he sees it
Client > **Contract** tab > **Billing** card > **Late fee** row: a dollar box and Save. Shown for every non-internal,
non-one-time client whose agreement is on terms v6+ (older terms have interest, not a fee, so no box).
- Before sending: "Charged once if a bill is 3 days late. Blank means the standard $150, 0 means no late fee. This is
  the number printed in their agreement, and it locks when you send it."
- After sending/signing: "Their agreement says $X. You can lower it here any time. It can never go above what they
  signed." Typing more than $X shows an amber note that $X is still the most they will be charged.

## The rules (both copies: `netlify/lib/contract-shared.cjs` and index.html, after `termsVersionOf`)
| Helper | Meaning |
|---|---|
| `lateFeeSetting(cl)` | the box: `billingLateFee`, blank/invalid = 150, rounded, 0..1000 |
| `lateFeeFrozen(cl)` | an agreement went out or was signed (same voided/declined rule as `termsVersionOf`) |
| `agreedLateFee(cl)` | what the agreement says: `contractLateFee` stamp, else 150 if frozen (pre-feature), else the box |
| `chargedLateFee(cl)` | `min(agreed, setting)`: what billing-watch, the past-due email and the alerts use |
| `lateFeeClause(f)` / `feeWords(n)` | 3.4(b) text; $150 renders byte-for-byte as before |

Stamps: Send writes `contractLateFee: agreedLateFee(client)`; Replace archives it in `contractHistory[].lateFee` and
resets it to null (the box unlocks); Renew writes `chargedLateFee(client)` so a renewal never raises it.
billing-watch never creates a Stripe item for a $0 fee, and its owner alert says "No late fee (you set theirs to $0)".

## Tests
`tests/verify-late-fee-setting.mjs` (33 checks): both copies of the rules run on the same probes, the agreement text
for $150 / $25 / $0 / signed-then-lowered / stamped, the OS agreement equals the server's, the charge, the $0 Stripe
guard, the email both ways, and the OS wiring. `verify-late-payment` updated for the $0 guard. Full suite 166/166.
Box driven in a browser at 390/768/1280/1600.
