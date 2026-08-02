---
name: per-lead-billing
topic: OS app
task: change how per-qualified-lead fees are billed to clients, the lead-billing review panel, or which leads count as billable
keywords: [charge-leads, preview-invoice, billingPerLead, PER_LEAD, leadsLog, notBillable, billed, billableCount, perLeadRate, invoiceitems, per-lead fee, junk lead, spam lead, flagLead, exclude lead, qualified lead, invoice_review, billingNextCharge, invoiceReminderSent, upcoming invoice]
status: verified
summary: Per-qualified-lead billing — BUILT 2026-08-02, EXTENDED same day (junk flagger + one-bill preview + pre-invoice reminder). Every delivered lead is billable at the client's per-lead rate; the owner reviews the batch on the Billing card (Contract tab), toggles off junk/spam, then one-tap approves and the total rides the client's NEXT monthly Stripe invoice as one line item (pending invoice item, same auto-sweep the late-interest watcher uses — NOT a standalone charge). A heuristic junk flagger marks likely-junk leads WITH the reason (never auto-excludes — Bryson's call). An "Upcoming Invoice" preview (stripe-billing preview-invoice → invoices/upcoming) shows fee+setup+leads+interest bundled on ONE bill with the auto-charge date. billing-watch fires a review reminder (push+email, once/cycle) ~7 days before the invoice auto-charges when there are undecided leads. Invoicing model = AUTO-CHARGE, REVIEW-GATED (Bryson chose this 2026-08-02 over hold-until-send / emailed-invoice). Rate = client.billingPerLead override, else PER_LEAD[niche] (only Roofing/Med Spa/Auto Detailing have defaults) — inline rate editor essential elsewhere. No new Supabase table (uses client.leadsLog) and no new env vars. Verified headlessly at all 4 widths + unit-tested flagger (false positive "Dana Cole"→placeholder-substring fixed).
verified: 2026-08-02
---

**What triggered it (Bryson, 2026-08-02):** "do we automatically calculate and charge the cost
per lead for however many leads we get" → "yes build that with every lead we deliver." Renewal
pricing was already auto (see `contract-renewal-pricing`); late fees already auto (see
`billing-automation`); per-lead was the real gap.

**Design decision — review-first, not fully-auto.** Leads auto-*calculate* and are one-tap
*approved*, but never silently charged. This protects the client relationship: junk/spam leads
must be excludable before money moves. Matches Bryson's standing billing-risk caution. The batch
rides the next monthly invoice (no separate charge event, no new card prompt) — the client just
sees "Qualified leads delivered — N leads" as a line on their normal monthly bill.

**Backend — `netlify/functions/stripe-billing.mjs`, action `charge-leads`:**
`{customerId, count, amount, clientName?}` → creates ONE `invoiceitems` (amount=`dollars(amount)`
cents, no `invoice` field) on the customer. Stripe automatically sweeps pending invoice items onto
the next *subscription* invoice — the same mechanism the late-interest watcher relies on, so no
standalone invoice / `/pay` dance (unlike `charge-etf`). Returns `{ok, itemId, count, amount}`.
Guards: customer required, count>0, amount>0. HARD RULE preserved — management/lead fees only,
never ad spend.

**Front end — `BillingCard` in `index.html` (Contract tab, `status==="active"` block only):**
- `perLeadRate = client.billingPerLead!=null ? client.billingPerLead : (PER_LEAD[client.niche]||0)`.
  **GOTCHA:** most niches have NO `PER_LEAD` default (only Roofing 75 / Med Spa 35 / Auto Detailing
  15 in `index.html`), so `perLeadRate` is often 0 until the owner sets it — the inline **edit**
  link (persists `client.billingPerLead`) is the primary way to set the rate, and the Approve button
  is disabled + an amber "no default rate for this niche" note shows while rate ≤ 0.
- Lead-billing state lives **on each lead object** in `client.leadsLog`, NOT in a side table:
  `lead.billed` + `lead.billedAt` (charged) and `lead.notBillable` (excluded junk). Storing flags
  on the object makes them survive leadsLog reordering (new leads are *prepended* by
  `appendLead`) — index is only used transiently to toggle within the current render.
- `unbilledLeads = leadsLog.map((lead,idx)=>({lead,idx})).filter(x=>!x.lead.billed)` keeps the real
  index so the Exclude toggle hits the right object even though only unbilled leads are listed.
  `billableLeads` = unbilled & !notBillable. `leadAmount = billableCount * perLeadRate`.
- UI: rate row (with inline editor), one row per unbilled lead (name + source · date + Exclude/
  Include toggle; excluded = line-through + green Include), "N billable · M excluded", "N × $R = $T",
  and a green **"Approve — add $T to next invoice"** button. `chargeLeads()` calls the action, then
  marks every billed lead `{billed:true, billedAt}` and logs a `commLog` entry.
- `PER_LEAD` also drives the CPL benchmark elsewhere (index.html ~276) — unchanged.

**How leads reach `leadsLog`:** `netlify/lib/report-shared.mjs appendLead` (called by
`lead-intake.mjs`) prepends `{status:"new", followUps:[], ...lead}` where lead =
name/phone/email/message/source/receivedAt. Leads have **no stable id** — billing uses the
on-object flags + transient render index (fine for a single-owner app).

**Junk vs qualified (Bryson asked):** there is **no automatic AI lead-scoring** yet. Today it's
the owner's judgment at review time, aided by: the honeypot bot-field at intake (blocks obvious
bots before they ever land), visible signals in the row (source="unknown", fake-looking
name/phone/email, dates), and the Exclude toggle keeping the final call human. A future upgrade
could auto-flag likely junk (dupes, disposable emails, gibberish, off-hours bursts) as a
*suggestion* — but the exclude decision should stay with Bryson so clients are never wrongly billed.

**No setup step for Bryson:** no new Supabase table (reuses `leadsLog`), no new Netlify env var.
Only visible where `billingStatus==="active"` (a live subscription to attach the invoice item to).

## 2026-08-02 extension — flagger + one-bill preview + pre-invoice reminder

**Invoicing model (Bryson chose):** AUTO-CHARGE, REVIEW-GATED. Clients' subscriptions
auto-charge the card/bank on file on their cycle date (Stripe `charge_automatically`); there is
no manual "send." Per-lead fees + late interest are pending invoice items that Stripe sweeps onto
that same monthly subscription invoice — so it's already ONE bill. The only control needed is a
review window before the auto-charge, which the reminder provides. (Rejected alternatives:
hold-until-I-click-send, and emailed-invoice-they-pay — both worse for automation/cash flow.)

**Junk flagger — `flagLead(lead, allLeads)` (front-end, `index.html`, near PER_LEAD):**
NEVER auto-excludes — returns `{level:"junk"|"suspicious"|null, reasons:[]}` and the review row
shows a "⚠ Likely junk"/"⚠ Check" chip + the reason text; Bryson still decides via Exclude.
Signals: no phone+email, invalid email, disposable-domain email (`DISPOSABLE_EMAIL_DOMAINS`),
short/fake phone, placeholder/gibberish name, spammy message (link / SEO-backlink-crypto words),
unknown source (soft), and duplicate phone/email vs another lead. `level` = "junk" if any strong
signal or ≥2 reasons, else "suspicious". Header shows "N flagged". **GOTCHA (caught by the unit
test):** placeholder-word matching must be WORD-BOUNDARY, not substring — `"dana cole".includes("na ")`
falsely flagged a real name; fixed to split into words + full-name list (`LEAD_PLACEHOLDER_NAMES`).
Also treat `y` as a vowel in the gibberish check so "Lynn"/"Flynn" aren't flagged. To re-test:
extract the `flagLead` block from index.html and `eval` it in node against sample leads (recipe
used 2026-08-02).

**One-bill preview — `stripe-billing.mjs` action `preview-invoice {customerId}`:** GETs
`invoices/upcoming` and returns `{total, subtotal, chargeDate, lines:[{description,amount}]}` — the
exact next subscription invoice with the recurring fee + every pending item (approved leads,
interest) on ONE bill. Fails soft to `upcoming:null` if the account's API version moved the
endpoint (UI just hides the preview; the bundling still happens server-side). BillingCard shows an
"Upcoming Invoice" section (live fetch via `useEffect`, re-fetched after approving leads) with the
line items + total + auto-charge date — this is the visual proof of "everything on the same
invoice."

**Pre-invoice review reminder — `billing-watch.mjs` (daily 14:30 UTC):** for each active client it
now also fetches the subscription's `current_period_end`, stores it as `billingNextCharge`, and if
that's ≤7 days out AND there are undecided leads (`!billed && !notBillable`) AND
`cl.invoiceReminderSent !== periodEnd`, fires `dispatchAlert` (push + email + SMS, once per cycle)
"invoice in N days — review M leads." Re-arms automatically next cycle (new period end ≠ stored
`invoiceReminderSent`). In-app mirror: `getAlerts` raises a yellow `invoice_review` alert under the
same condition (auto-clears once all leads are decided). New client fields (no migration; plain
JSON on the client): `billingNextCharge`, `invoiceReminderSent`; per-lead flags on each lead:
`billed`, `billedAt`, `notBillable`.
