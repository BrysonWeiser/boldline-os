---
name: payments-connect
topic: Payments
task: let a business (client or one of Bryson's own) take payment from ITS customers through the website or landing page booking - connect Stripe or Square, a payment link, or in person; deposits or full price at booking; pay links; marking paid
keywords: [customer payments, get paid, connect stripe, connect square, stripe connect, oauth, square oauth, payment link, paypal, venmo, deposit, full price, pay at booking, pay link, /pay, payConnect, payLog, payments, pay-sweep, pay-connect, how customers pay, how your customers pay you, direct charge, standard account]
status: open
summary: Bryson 2026-10-09 ("put in the client portal (or my own businesses portal) ... connect whatever method ... to collect payment"). Built: "How Your Customers Pay You" card in the client portal (Website tab, or Your Information for booking-only) and "How customers pay" in the OS (every business's Website tab). Choices - Stripe (OAuth, Standard, direct charges on THEIR account), Square (OAuth, their key encrypted in private storage), payment link, in person. Connected - each booking charges the package deposit (or the exact full price) via a signed /pay link on the business's own domain; paid status in server-owned payLog, swept every 15 min. Agreement WA-5 says the money is the client's. LIVE in code but Stripe/Square buttons need Bryson's one-time setup (env vars STRIPE_CONNECT_CLIENT_ID, SQUARE_APP_ID, SQUARE_APP_SECRET) - in the 10pm reminder Fri 2026-10-09.
verified: 2026-10-09
---

## What he asked
Business owners (clients, and his own businesses from the OS) connect whatever they use to take payment, so
customers can pay when they book. Recommended and agreed order: Stripe, then Square, with the link and
in-person options alongside. PayPal stays link-only (a real "Connect PayPal" needs PayPal partner approval).

## 🔴 Hard constraint (CLAUDE.md): BoldLine never holds the money
- Stripe: business's existing account connected through Stripe's OAuth (Standard). Checkouts are created with
  BoldLine's secret key + `Stripe-Account: acct_...` = **direct charges**: the business is the seller, Stripe pays
  it, it carries refunds/chargebacks/fees. No `application_fee`, `transfer_data`, `on_behalf_of` (test pins this).
- Square: the business's own OAuth token, its own location, `online-checkout/payment-links`.
- Website agreement **WA-5** (section 4): payments go straight to Client, Client is the seller, BoldLine never
  receives/holds/handles it, takes no share, Client can disconnect any time. Ad contract (contract-shared) NOT
  changed; consider adding the same line if an ad client takes payments on a landing page.

## Data
- `cl.payments` `{method: stripe|square|link|inperson, link, charge: deposit|full}` (client-editable; OS or portal).
- `cl.payConnect` `{provider, account, name, live, connectedAt}` - SERVER_OWNED.
- `cl.payLog[bookingId]` `{provider, ref (Stripe session id / Square order id), url (Square), cents, status open|paid, createdAt, paidAt}` - SERVER_OWNED, newest 300.
- Paid status is NEVER written into `bookings` by the server (the OS saves bookings whole; a stale screen would
  overwrite). Readers use `depositPaid(cl,b)` / `withPayStatus(cl)` (biz portal, reminder email) and the OS reads
  `client.payLog` (booking list "Paid online", calendar).
- Square tokens: `client-contracts` bucket (private) at `payments/<clientId>/square.json`, AES-256-GCM with a key
  derived from SQUARE_APP_SECRET + service role key. Rotating SQUARE_APP_SECRET = every Square business reconnects.

## Flow
1. Connect: portal (`token`) or OS (JWT) POST `pay-connect` `{action:"start"}` -> provider authorize URL with a signed
   30-minute state -> business approves -> `/pay-connect/done` (pay-connect-done.mjs) exchanges code, stores
   connection (+ Square tokens), sets `payments.method`, lets go of any previous connection, redirects back to the
   portal (`?pay=connected|cancelled|failed` notice) or OS root.
2. Book: `makeBooking` uses `chargeFor(cl,pkg)`: deposit amount, or exact full price when `charge:"full"`;
   "From $150"/ranges never charged; < $0.50 never. book.mjs adds `deposit.link = payUrl(...)`.
3. Pay: `/pay?c&b&s` (signed per booking). GET shows a branded page with "Pay $50" (GET never creates anything: mail
   scanners); POST creates the Stripe Checkout (fresh each time, they expire in 24h) or reuses/creates the Square
   link, 303 to it. Return `&done=1` verifies and shows "Paid, thank you". Lives on the business's own domain when
   its website is live there (`sites/functions/pay.mjs` proxies with redirect:"manual"; `/pay` in client-domain
   PASS_PATHS), else os.boldlinemedia.com.
4. `pay-sweep` (4,19,34,49 * * * *) checks open entries < 14 days and refreshes Square tokens with < 7 days left.
- Disconnect from portal or OS: Stripe deauthorize / Square revoke, delete `payConnect`. Bookings already made keep
  their pay link, which then says online payment is off.

## Screens
- Portal: `netlify/lib/portal-payments.mjs` (`customerPayCardHTML`, `CUSTOMER_PAY_JS`). Hides a provider BoldLine
  hasn't switched on. Every button checks BL_PREVIEW (OS preview can't connect/save/disconnect).
- OS: `CustomerPayCard` after `BookingCard` on the Website tab (`osPay` mirrors `payOf`; test compares them).
  BookingCard: with a connection the per-package link field becomes "Charged through Stripe at booking";
  booking rows show "Paid online, $50 (Stripe)" and drop Mark paid for those.
- Booking widget: package line shows `payNote` ("$50 deposit" / "Paid when you book"); after booking "Pay now"
  for full price.
- Verified headless: portal card at 390/768/1280/1600 (0 overflow, 2x2 tiles on wide), pay page 4 widths, OS card
  phone/tablet/laptop/desktop.

## Setup Bryson must do (status: NOT DONE as of 2026-10-09 18:20 Phoenix; in 10pm reminder trig_01NMyjjyJ9R2r2rM6x5Us6ND)
- Stripe: dashboard > Settings > Connect > Onboarding options > OAuth: enable for Standard, redirect
  `https://os.boldlinemedia.com/pay-connect/done`, copy live client id (ca_...) -> env `STRIPE_CONNECT_CLIENT_ID`.
  (Uses existing `STRIPE_SECRET_KEY`.) If Stripe no longer offers OAuth for new platforms, the fallback is
  Account Links (new Standard accounts) - would need building.
- Square: developer.squareup.com > Applications > new app > Production > OAuth: redirect URL as above; copy
  Application ID + secret -> env `SQUARE_APP_ID`, `SQUARE_APP_SECRET`. Optional `SQUARE_ENV=sandbox` for testing.
- Optional `PAY_SECRET` (signing key for pay links and state; falls back to the service role key).
- Live check: POST `/.netlify/functions/pay-connect` `{"action":"ready"}` -> `{stripe, square}`.

## Tests
`tests/verify-payments.mjs` (70). Updated: verify-booking, verify-business-emails, verify-site-editor,
verify-results-only-billing, verify-website-deal (WA-5).

## Not built / next
- Subscriptions (monthly plans billed automatically) - possible with the same connections, not built.
- Refunds from the OS (do them in Stripe/Square for now).
- Notifying the business when a deposit lands (it shows in the OS/portal; no push/email yet).
