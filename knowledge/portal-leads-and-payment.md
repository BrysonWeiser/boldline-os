---
name: portal-leads-and-payment
topic: Client portal
task: give the client his own Leads tab, a separate Reports tab, and a place to add a payment method; fix the per-lead rate and card-on-file state the portal was getting wrong
keywords: [portal leads tab, leads tab, reports tab, five tabs, nav overflow, 360px tabs, payment method, add a card, card on file, billingCheckoutUrl, results only billing, per lead rate, billingPerLead, setup session, stripe setup mode, launch checklist card step, portal payment]
status: verified
summary: The client portal now has FIVE tabs (Status | Review | Leads | Reports | Account). Leads was briefly folded into Reports because five buttons overflowed a 360px strip; Bryson reversed that the same day and the overflow was fixed in CSS instead (`@media(max-width:460px){.nb{flex:1 1 0}}` — the buttons divide the strip rather than sizing to their text, so they cannot overflow at any width). A Payment Method accordion on the Account tab shows the Stripe link the OS issued (`billingCheckoutUrl`) so a client can add a card himself; it never creates a link. Three real bugs fixed alongside: the portal quoted the niche default per-lead rate instead of the client's agreed `billingPerLead`; a Stripe `mode:"setup"` checkout was recorded as `billingStatus:"active"` when there is no subscription; and the launch checklist's "card on file" step looked only for a subscription id, so it could never tick for a results-only client. Built 2026-09-08.
verified: 2026-09-08
---

**Why (Bryson, 2026-09-08):**
- *"for this i dont want the reports and lead pages combined into a leads tab i want them seperate so a seperate leads and report tab between review and account"*
- *"in the os he doesnt have a place to add a payment method for when i bill him"*

## Five tabs, and why five now fits

Order is **Status | Review | Leads | Reports | Account**, panels `t-status`, `t-approvals`,
`t-leads`, `t-reports`, `t-account`.

The history matters, because the count has now moved three times:
- Six tabs (pre-2026-08-31) measured **451px in a 390px strip** — Contract sat off-screen.
- Four tabs (2026-08-31) fixed it by moving Package, Info and Contract into Account.
- Leads was added on 2026-09-08 by taking over the Reports tab, because five buttons measured
  **384px in a 360px strip**.
- Bryson reversed that within hours. He is right on priority: a client on per-lead pricing
  opens his leads daily and reads the written report weekly, so stacking them buried the
  daily one.

🔴 **The fifth tab only fits because of one CSS rule**, and the two are pinned together in
`tests/verify-portal-upgrades.mjs`:

```
@media(max-width:460px){.nb{flex:1 1 0;min-width:0;padding:11px 2px;font-size:9.5px;letter-spacing:.03em}}
```

Under it the buttons **divide the strip they are in** rather than sizing to their text, so
overflow is arithmetically impossible at any width. Base padding also came down from
`11px 14px` to `11px 12px`. Verified headless at 360/390/768/1280/1600: one row, no
horizontal scroll, every panel renders.

## Payment Method (Account tab)

New accordion, above Your Agreement, with an amber dot until a card exists. Three states:

| Client record | What he sees |
|---|---|
| `billingStatus` active / card_on_file, or a `stripeSubscriptionId` | "Payment method saved", plus how to change the card |
| `billingCheckoutUrl` present | **Add My Payment Method** button, opens Stripe in a new tab |
| neither | "Your account manager will send you a secure link" |

🔴 **The portal SHOWS a link, it never CREATES one.** Creating a checkout is a write against
a payment processor, and the portal is a read-mostly surface a token opens. Bryson issues the
link in the OS (Contract tab → Billing card). Stripe clears `billingCheckoutUrl` itself when
the card is saved, so a spent link cannot be re-offered — and the card-on-file branch is
checked first anyway, so a stale field still shows "saved".

Preview safety: the button carries `onclick="return blPay(this)"`, and `blPay` returns false
under `BL_PREVIEW`, so an owner-side preview can never navigate to a real payment page.
Copy says plainly **"Nothing is charged today"** — a payment page with no warning reads as a
bill, and a client who fears a charge does not click.

## Three bugs found doing it

1. **The portal quoted the wrong per-lead price.** `const pl = PER_LEAD[cl.niche]` ignored
   `cl.billingPerLead`, which is the number in the signed agreement (Sebastian: **$50**).
   A price in a client's own portal that disagrees with his own contract looks authoritative
   and is wrong. Now resolves the override first, same as the OS and the contract text.
2. **A `mode:"setup"` checkout was stamped `billingStatus:"active"`** in
   `stripe-webhook.mjs`. A setup session saves a card and charges nothing, so it completes
   with **no subscription at all**. The OS would show "Billing Active" for a client with no
   monthly. Now `obj.mode === "setup" ? "card_on_file" : "active"`.
3. **The launch checklist could never tick "their card on file"** for a results-only client:
   it looked for `stripeSubscriptionId`, which a setup session cannot produce. Our first
   client is on exactly that deal, so it would have told Bryson to chase a card already on
   file. Now also accepts `billingStatus` card_on_file / active. Fixed in **both** copies
   (`netlify/lib/launch-checklist.mjs` and `index.html`). Its wording now names where the
   Billing card actually is, because he could not find it.

## Tests

`tests/verify-portal-leads.mjs` — 39 checks. Pins the five tabs, their order, the two
separate panels, every payment-method state, the preview guard, the agreed rate, and all
three bug fixes. `tests/verify-portal-upgrades.mjs` pins the tab list by name **and** the
flex rule that makes five safe. 13 mutations, 13 caught.
