---
name: per-lead-billing
topic: OS app
task: change how per-qualified-lead fees are billed to clients, the lead-billing review panel, or which leads count as billable
keywords: [charge-leads, billingPerLead, PER_LEAD, leadsLog, notBillable, billed, billableCount, perLeadRate, invoiceitems, per-lead fee, junk lead, exclude lead, qualified lead]
status: verified
summary: Per-qualified-lead billing — BUILT 2026-08-02. Every delivered lead is billable at the client's per-lead rate; the owner reviews the batch on the Billing card (Contract tab), toggles off any junk/spam, then one-tap approves and the total rides the client's NEXT monthly Stripe invoice as one line item (pending invoice item, same auto-sweep the late-interest watcher uses — NOT a standalone charge). Review-first by design so a client is never auto-billed for junk. Rate = client.billingPerLead override, else PER_LEAD[niche] (only Roofing/Med Spa/Auto Detailing have defaults) — inline rate editor is essential for every other niche. No new Supabase table (uses client.leadsLog) and no new env vars. Verified headlessly at all four widths + a live exclude-toggle recompute (4×$75=$300 → exclude junk → 3×$75=$225).
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
