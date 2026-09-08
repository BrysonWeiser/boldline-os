---
name: portal-leads-and-payment
topic: Client portal
task: give the client his own Leads tab, a separate Reports tab, and a place to add a payment method; fix the per-lead rate and card-on-file state the portal was getting wrong
keywords: [portal testimonials, client reviews, own testimonials, reviews box, startCard, self serve card, connect payment portal, portal leads tab, leads tab, reports tab, five tabs, nav overflow, 360px tabs, payment method, add a card, card on file, billingCheckoutUrl, results only billing, per lead rate, billingPerLead, setup session, stripe setup mode, launch checklist card step, portal payment]
status: verified
summary: The client portal now has FIVE tabs (Status | Review | Leads | Reports | Account). Leads was briefly folded into Reports because five buttons overflowed a 360px strip; Bryson reversed that the same day and the overflow was fixed in CSS instead (`@media(max-width:460px){.nb{flex:1 1 0}}` — the buttons divide the strip rather than sizing to their text, so they cannot overflow at any width). Inside Your Information on the Account tab the client now has a Payment Method card that CREATES its own Stripe setup session (`{startCard:true}` on the token endpoint, `mode:"setup"` only, so it charges nothing) rather than waiting on a link Bryson pastes in, and a Your Reviews box for typing his own testimonials straight onto his landing page. Three real bugs fixed alongside: the portal quoted the niche default per-lead rate instead of the client's agreed `billingPerLead`; a Stripe `mode:"setup"` checkout was recorded as `billingStatus:"active"` when there is no subscription; and the launch checklist's "card on file" step looked only for a subscription id, so it could never tick for a results-only client. Built 2026-09-08.
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

## Payment Method (inside Your Information, on the Account tab)

🔴 **It is a card inside "Your Information", not a section of its own.** Bryson,
2026-09-08: *"put the connect payment option under the your information section under the
account tab"*. It first shipped as its own tap-to-open section, which meant a client had to
know to open it. Your Information is the one section a new client already opens, because it
is where he fills everything else in, and this sits directly under the card where he
connects his ad account: connect the account, then the card that pays for the leads it
brings, one trip. Until a card exists the card is outlined in gold so it is not scrolled
past. Three states:

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

## The client starts his own card, with nobody in the loop

🔴 Bryson, 2026-09-08: *"i dont want to have to send them a link I want them to be able to
connect it through the client portal"*. The button first shipped showing only a link Bryson
had created in the OS and pasted in. With no link the client read *"your account manager will
send you a secure link"*, which is a dead end dressed as an answer, and on a results-only deal
that is the difference between invoicing a delivered lead and not being able to.

The portal endpoint now takes **`{startCard:true}`** on the client's own token and creates the
Stripe session itself, importing `stripe` and `ensureCustomer` from `netlify/lib/stripe-shared.mjs`
rather than carrying a second copy.

🔴 **The only thing it can create is `mode:"setup"`, which charges nothing.** It cannot take a
payment, start a subscription, or set a rate. The worst a stolen portal token could do is cause
a card-entry page to exist for the client whose token it already is. It refuses when a card is
already saved, and refuses without an email while naming the box to fill. It **mints a fresh
session every press** rather than reusing `billingCheckoutUrl`, because a Stripe link expires
and a client sent to a dead page assumes we are broken. The return URL is the client's **own
portal**, never the OS (both checkout paths once dropped a paying client onto an admin login
screen). In a preview the POST is blocked and the button says so instead of reading as broken.

## Your Reviews, typed by the client

Bryson, 2026-09-08: *"add in the client portal a spot for them to put their own testimonials"*.
Until this, a real review reached a landing page only by Bryson typing it into the OS from
something the client emailed him, so the highest-converting block on the page depended on a
manual round trip nobody scheduled.

Textarea under the media card in Your Information, writing the same `reviews` field the OS Edit
screen and `landing.mjs` already use. One per line, name after a dash. The copy states out loud
that we never write or change them, and blank hides the reviews section rather than filling it
with anything invented.

🔴 **The whitelist is the trap here.** `sanitizeFields` in `portal.mjs` drops anything not named
in it, with no error, so a new box whose field is not whitelisted shows a tick and saves nothing.
`reviews` is its own entry with a 2000-character clip, because six reviews do not fit the
200-character limit the other fields use.

🔴 **`landing.mjs` now splits on a plain hyphen too.** The owner-side field has always documented
an em dash, which nobody types on a phone keyboard (and the standing copy rule bans anyway). The
hyphen carries a guard the other delimiters do not, since a hyphen is ordinary punctuation: the
trailing chunk becomes a NAME only if it is ≤40 characters, ≤5 words, starts with a capital, and
does not end in `!?,;:`. A final full stop **is** allowed and must be, because "Maria B." is a
surname initial and rejecting it threw away the commonest real case. Whitespace is required on
both sides, so "top-notch" and "A-Grade" are never splits. Em dash, en dash and pipe keep their
old behaviour exactly.

New testimonials write a `commLog` entry ("Client added 2 testimonials in their portal"), and
only when the text actually changed, so re-saving the tab is not noise. A review that lands
silently is a review nobody rebuilds the page for.

## Setting the rate, where he looks for it

🔴 **The per-lead rate is now on the Edit screen too.** Bryson, 2026-09-08: *"there is no
place to put 50 in the edit tab"*. It existed only on the Billing card at the bottom of the
Contract tab, a different screen behind a different tab, so the one number the whole invoice
is built from was hidden behind the document it appears in. New "What You Bill Them" card in
`EditClientSheet` carries **Per qualified lead ($)** and **Monthly minimum ($)**, the same
two fields the Billing card writes, so setting it either place is the same act. Hidden on the
house account, which bills nobody.

Both store a **number or null, never a string** — everything downstream multiplies the rate,
and `"50"` times a lead count is not 50 times a lead count. Blank clears back to the niche
default rather than storing an empty string, which would read as a real rate of nothing. Both
fields read the record as well as write it, or they would show blank over a real number and
the next save would wipe the rate in the signed agreement.

## 🔴 The deploy that did not deploy

Writing *"Sebastian's account is ACTIVE under manager <id>"* into this KB **failed the
Netlify build**: the secret scanner fails on the value of any env var appearing in a
committed file, and the manager account number is `GOOGLE_ADS_MANAGER_CUSTOMER_ID`. Git said
merged, the live site said otherwise, and the portal fix simply never reached the client.
Diagnosed with the one command from KB `netlify-secret-scan-deploys` (curl the live file and
grep for a marker only the new build has), and the ancestry check it insists on — the id was
absent from the last successful deploy, so it was a valid suspect rather than a guess.

Fixed the documented way: **`GOOGLE_ADS_MANAGER_CUSTOMER_ID` added to
`SECRETS_SCAN_OMIT_KEYS`** in `netlify.toml`. A Google Ads customer id is an identifier, not
a credential — it is printed in Google's own interface and shown to every client who approves
a manager link request. The credentials (developer token, OAuth refresh token) stay fully
scanned. The id stays in the KB, per the standing decision.

## Tests

`tests/verify-portal-leads.mjs` — 72 checks. Pins the five tabs, their order, the two
separate panels, every payment-method state, the preview guard, the agreed rate, and all
three bug fixes. `tests/verify-portal-upgrades.mjs` pins the tab list by name **and** the
flex rule that makes five safe. 40 mutations written across three rounds, all caught.
