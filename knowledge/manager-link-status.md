---
name: manager-link-status
topic: Google Ads
task: send a client's Google Ads manager link request from the OS and know whether we actually have manager access
keywords: [manager link, customerClientLinks, customer_client_link, linkClient, linkStatus, manager access, MCC link, link request, google ads access, operations unknown name, LinkRequestRow]
status: verified
summary: Two fixes, 2026-09-08. (1) The "Send manager link request" button never worked — `customerClientLinks:mutate` takes a single `operation`, not an `operations` array like every other mutate in google-ads.mjs, and Google's error ("Unknown name 'operations': Cannot find field") reads like a permissions problem. Bryson had to send the request by hand mid-call. (2) New `linkStatus` action queries `customer_client_link` on the MANAGER account and reports ACTIVE / PENDING / refused / NONE, so the OS knows whether we manage a client's account. Observed from Google every time, never stored — a client can revoke manager access from their own account without telling us. Sebastian's account 924-850-6870 is ACTIVE under manager 989-283-2533.
verified: 2026-09-08
---

**Why (Bryson, 2026-09-08):** *"make sure the os knows that we already sent the manager
request and it was approved so we have manager access to sebastians google ad account"*

## The one-letter bug

`linkClientAccount()` in `netlify/functions/google-ads.mjs` sent:

```
{ operations: [{ create: { clientCustomer: "customers/…", status: "PENDING" } }] }
```

Every other mutate in that file takes `operations: [...]`, so this was written the same way.
**CustomerClientLinkService is the exception** — it links one account at a time and its
request carries a single `operation`. Google's reply, *"Invalid JSON payload received.
Unknown name 'operations': Cannot find field"*, names a field but reads like an access
problem, which is exactly how it went undiagnosed on a live call.

Correct body: `{ operation: { create: { clientCustomer: …, status: "PENDING" } } }`.

## Knowing whether we have access

New export `getClientLinkStatus(accessToken, clientCustomerId)` + action `linkStatus`.
GAQL against the **manager** account (that is where the link rows live):

```
SELECT customer_client_link.client_customer, customer_client_link.status,
       customer_client_link.manager_link_id
FROM customer_client_link
WHERE customer_client_link.client_customer = 'customers/<10 digits>'
```

Statuses: `ACTIVE` (they approved, we manage it), `PENDING` (sent, waiting on them),
`REFUSED`/`CANCELLED`/`INACTIVE` (no access), no row at all → we report `NONE`.
🔴 A client can be asked twice — a refused request then a fresh one — so **ACTIVE anywhere
in the rows wins, and PENDING beats a stale refusal**. Picking the first row would report a
refusal on an account we now manage.

## OS side

`LinkRequestRow` in `index.html` now checks the status itself whenever the Customer ID field
holds a **full 10 digits**, and shows Google's answer in Bryson's words ("We manage this
account. Access is approved and live."), not Google's ("ACTIVE"). When access is live the
Send-request button is hidden entirely — a Send button under a green "access is live" line is
an invitation to break it. A failed check says so rather than reading as no access.

🔴 **Observed, never stored.** The tempting build is a tick box. A client can revoke manager
access at any moment from their own account without telling us, and a stored tick would keep
saying yes with the ads no longer ours to touch. Same rule the launch checklist runs on.
This also means a request sent **by hand outside the OS** — which is what happened with our
first client — shows up here as granted, with nothing to mark off.

🔴 **Still never automatic on save.** A link request is visible to whoever owns the number
typed in, so one mistyped digit would reach a stranger. The status *read* is safe to run on a
complete id; the *request* still takes two presses with the number read back.

## Tests

`tests/verify-manager-link.mjs` — 24 checks, including the `operation`/`operations`
regression, ACTIVE-beats-stale-refusal, no lookup on a half-typed id, and the hidden button
once access is live. Mutations: 4 written for this work, 4 caught.
