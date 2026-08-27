// The month-end bill for every client who pays on results.
//
// Bryson, 2026-08-27: *"the invoice should only include the x amount per qualified lead
// which I go through before the invoice is sent and then it automatically does the math
// for the leads i sent through."*
//
// 🔴 THIS EXISTS BECAUSE APPROVING IS NOT INVOICING, AND THE AGREEMENT SAYS SO.
// Clause 4.3 of a results-only contract reads: "Nothing is billed in advance. After each
// month closes, Agency calculates the Performance Fee for that month and it is charged on
// the next invoice. Client is billed in arrears, for results already delivered."
//
// So the two halves are deliberately separate. Bryson reviews leads whenever they arrive,
// excludes any junk, and approves — which PARKS the money against the client in Stripe.
// Then on the 1st, this raises ONE invoice for everything parked since the last one and
// charges the card on file. A client on $50 a lead who produced eleven good ones in a
// month gets a single $550 bill, not eleven charges scattered through the month.
//
// The first version of this billed on approval. That was wrong against the very contract
// the first client was signing at the time, and it is the second time in one day that
// billing code and the signed document disagreed.
//
// Required env: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY (already on the site).
// The client's receipt is sent by Stripe's own webhook on invoice.paid, so nothing new.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients } from "../lib/report-shared.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { invoiceParkedLeads } from "../lib/stripe-shared.mjs";

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const money = (n) => "$" + Number(n || 0).toLocaleString();

// Who gets a month-end invoice. A client with a live subscription is NOT one of them:
// Stripe already sweeps their pending items onto the recurring invoice, and invoicing
// them here as well would bill the same leads twice in a month.
export const dueForInvoice = (client) => {
  const c = client || {};
  if (c.internal) return false;
  if (!c.stripeCustomerId) return false;
  if (c.stripeSubscriptionId) return false;   // 🔴 their leads ride the monthly invoice
  return c.billingStatus === "card_on_file" || c.billingStatus === "past_due";
};

export async function runLeadInvoices({ loadClients, invoiceFor, saveClient, alert }) {
  const rows = (await loadClients()) || [];
  const due = rows.filter((r) => dueForInvoice(r.data));
  const summary = { due: due.length, invoiced: 0, nothingDue: 0, unpaid: 0, errors: 0, total: 0 };
  const billed = [];

  for (const row of due) {
    const cl = row.data;
    let res;
    try {
      res = await invoiceFor(cl);
    } catch (e) {
      // 🔴 ONE CLIENT FAILING MUST NOT STOP THE REST BEING BILLED. This runs once a month;
      // a thrown error here would mean everyone after them goes unbilled for a month.
      summary.errors++;
      console.error(`lead-invoice-run: ${cl.name} failed:`, e.message);
      await alert({
        severity: "red",
        title: `Could not invoice ${cl.name}`,
        body: `The month-end invoice for ${cl.name} failed: ${e.message}. Their approved leads are still recorded and still owed, so nothing is lost, but this needs raising by hand from their Billing card ("Invoice Now"). Nothing was charged.`,
        smsText: `Invoice failed for ${cl.name}. Raise it by hand.`,
      }).catch(() => {});
      continue;
    }

    // A quiet month is a normal month, not a problem. No invoice, no alert, no noise.
    if (res.nothingDue) { summary.nothingDue++; continue; }

    const note = `Invoiced ${money(res.amount)} for qualified leads delivered${res.paid ? " — paid" : " — awaiting payment"}.`;
    const next = {
      ...cl,
      lastLeadInvoiceUrl: res.invoiceUrl || cl.lastLeadInvoiceUrl || null,
      lastLeadInvoiceAt: new Date().toISOString(),
      // The running tally the Billing card shows is now settled up to here.
      ...(cl.billingLeadPeriod
        ? { billingLeadPeriod: { ...cl.billingLeadPeriod, charged: (cl.billingLeadPeriod.charged || 0) + res.amount } }
        : {}),
      commLog: [{ date: fmt(new Date()), note, cat: "billing", ts: Date.now() }, ...(cl.commLog || [])],
    };
    try {
      await saveClient(row.id, next);
    } catch (e) {
      // The MONEY is already invoiced and probably charged — that part is real and correct.
      // Only our own record of it failed, so say exactly that rather than implying the
      // client was not billed.
      summary.errors++;
      console.error(`lead-invoice-run: saved invoice but could not update ${cl.name}:`, e.message);
      await alert({
        severity: "yellow",
        title: `${cl.name} was invoiced, but the OS did not record it`,
        body: `${cl.name} has been invoiced ${money(res.amount)} and Stripe ${res.paid ? "collected it" : "is collecting it"}. The invoice is real. What failed was writing it into their record in the OS, so their history will be missing this line. Nothing needs re-invoicing.`,
      }).catch(() => {});
      continue;
    }

    summary.invoiced++;
    summary.total += res.amount;
    if (!res.paid) summary.unpaid++;
    billed.push({ name: cl.name, amount: res.amount, paid: res.paid, url: res.invoiceUrl });
  }

  if (billed.length) {
    const lines = billed.map((b) => `${b.name}: ${money(b.amount)}${b.paid ? " (paid)" : " (payment pending)"}`);
    await alert({
      severity: summary.unpaid ? "yellow" : "green",
      title: `Month-end invoices sent — ${money(summary.total)}`,
      body: `${billed.length} client${billed.length === 1 ? "" : "s"} invoiced for the qualified leads you approved.\n\n${lines.join("\n")}\n\n${
        summary.unpaid
          ? "Some payments have not gone through yet. Stripe keeps retrying automatically, and you will be told if one stays unpaid."
          : "All collected."}`,
      smsText: `Month-end invoices sent: ${money(summary.total)} across ${billed.length} client${billed.length === 1 ? "" : "s"}.`,
    }).catch(() => {});
  }
  return summary;
}

export const summaryLine = (s) =>
  `lead-invoice-run: ${s.due} due, ${s.invoiced} invoiced (${money(s.total)}), ` +
  `${s.nothingDue} with nothing owed, ${s.unpaid} awaiting payment, ${s.errors} errors`;

const handler = async () => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("billing not configured — skipped", { status: 200 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const summary = await runLeadInvoices({
    loadClients: () => loadAllClients(supabase, "lead-invoice-run"),
    invoiceFor: (cl) => invoiceParkedLeads(cl.stripeCustomerId, cl.name),
    saveClient: async (id, data) => {
      const { error } = await supabase.from("clients").update({ data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    alert: dispatchAlert,
  });

  const line = summaryLine(summary);
  console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("lead-invoice-run", handler);
