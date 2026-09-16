---
name: billing-for-sales
topic: Pricing
task: bill a client who sells straight from a website, or change what the performance fee is charged on
keywords: [billing for sales, per qualified sale, qualified sale, billingResultKind, billingSaleDefinition, resultWords, e-commerce billing, store client, no lead form, buys on website, Air Suds, contract qualified lead definition, results only shop, sale definition, contractGaps sale]
status: verified
summary: A client who sells straight from a website can be billed per QUALIFIED SALE instead of per qualified lead. Set it on the Billing card (Billing for → Leads / Sales) plus a one-sentence description of which purchases count, which the agreement then quotes word for word. 🔴 It is a RENAME, not a third pricing model — the mechanic is a count times a rate either way, so `billingPerLead` still carries the rate and no calculation changed. The contract, the key terms, the Stripe clause and the client portal all follow the same word. A sale has no standard definition, so the description is required and `contractGaps` blocks the send without it. Built 2026-09-16 for Air Suds. 39 checks, 8 mutations caught.
verified: 2026-09-16
---

## 🔴 Why it exists

Bryson, 2026-09-16, on Air Suds: the customers *"just buy through website no forms or contacting
him"*. The agreement defines a **Qualified Lead** as a form submission, a tracked call of thirty
seconds or longer, or a chat. **Not one of those can ever happen on that account.**

Sending that contract would have had a client sign a document in which **the billable event is
impossible**. And Bryson had already told the owner *"it's basically free, you only pay for
results"*, so the fee has to sit on a real result. For a shop, that is a **sale**.

Paying per sale is *more* results-based than paying per lead, not less — a lead can be junk, a
sale is money in the client's till. So nothing about the founding pitch had to change. Only the
word for the result.

## 🔴 A rename, not a third pricing model

The mechanic is identical in both cases: **a count multiplied by a rate**, billed in arrears,
monthly minimum absorbed. So:

- `cl.billingResultKind` is `"sale"` or absent (absent = lead). **Only the exact string `"sale"`
  switches it** — anything else is a lead, because a stray value silently rewording a real
  agreement is the worst failure available here.
- `cl.billingPerLead` still carries the rate. **Every existing calculation is untouched.**
- `cl.billingSaleDefinition` is the sentence that defines the billable event.

Adding a third `pricingModel` would have meant a new branch at roughly fifteen call sites, and
fifteen chances to get one wrong.

## Where the words come from

`resultWords(cl)` in `netlify/lib/contract-shared.cjs`, **mirrored in `index.html`** (the OS is
one browser file and cannot import it) and pinned by a test that RUNS both and compares field by
field. It supplies the noun, the plural, the "per …" phrase, the definition paragraph and the
warranty sentence, so the whole agreement follows one switch: key terms row, clause 4.1, 4.2,
4.4 and the Stripe charging clause.

The **client portal** carries its own small copy (`RW`), in both the served page and the OS
preview, so a shop is never told in their portal that they pay per qualified lead while their
signed agreement says sales.

## 🔴 The definition is the client's, so it can be missing

BoldLine's Qualified Lead wording is the same on every lead-gen agreement and can never be
absent. **What counts as a sale worth paying for is the client's own commercial question** (Air
Suds: a subscription sign-up or a bulk order, never a single bottle at $5 of margin), so the
contract quotes the sentence Bryson wrote.

Which means it can be blank. So:
- the contract renders **`[NOT SET]` in bold** rather than an empty phrase,
- `contractGaps` **blocks the send** until it is written,
- and it is **HTML-escaped**, because a stray tag typed into that box would otherwise re-shape a
  document someone signs.

The clause also protects both sides without being asked to: the sale must have come **from the
campaigns**, refunds and chargebacks are not Qualified Sales and any fee taken on one is credited
back, repeat purchases inside thirty days count once, and the warranty promises **no particular
level of sales, revenue or return** (which matters on an $11 product with $5 of margin).

## Testing notes

`tests/verify-billing-for-sales.mjs` — 39 checks, **8/8 mutations caught**.

🔴 **Three existing contract suites broke, all for the same reason:** they lift
`makeContractHTML` out of `index.html` with `new Function` and hand it a scope, and that scope
had no `resultWords`. Fixed by handing them **the real one**, lifted from the same file — a stub
would have been more permissive than the page and would have passed while the document said the
wrong thing.

🔴 **A dual-copy check silently compared nothing.** The OS portal slice used
`indexOf("function contractGaps(")` as its end anchor, and `contractGaps` sits *above*
`makePortalHTML` in that file, so the slice was empty and every parity assertion passed on an
empty string. Now anchored forward from the start, with a length check. **Slicing to "whatever is
declared next" keeps producing this bug** — it also hit `verify-draft-persistence` the day
before.

Responsive: checked at 390/768/1280/1600, no horizontal scroll, nothing spilling.
