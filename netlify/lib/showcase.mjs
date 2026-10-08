// Results from one of Bryson's own businesses, shown on boldlinemedia.com (Bryson, 2026-10-07: "I'm
// planning on also using what we do with that business as results we can show", then "can you make
// those two ideas"). Only real numbers, only when there are enough of them to mean something, and
// always labelled as his own business, never as a client's (KB `my-businesses-owned`).
//
// 🔴 THE OS SHOWS THE SAME NUMBERS BEFORE HE SWITCHES IT ON. `showcaseNumbers` is mirrored in
// index.html between SHOWCASE-MIRROR markers, and verify-showcase runs both on the same records, so
// the preview in the OS and the section on the website can never disagree.
import { isOwned } from "./owned.mjs";

// SHOWCASE-MIRROR-START
const SHOWCASE_MIN_LEADS = 10;
const SHOWCASE_MIN_SPEND = 100;
const showcaseNumbers = (cl, now = Date.now()) => {
  const cut = now - 30 * 864e5;
  const log = ((cl && cl.leadsLog) || []).filter((l) => l && l.receivedAt && Date.parse(l.receivedAt) >= cut && Date.parse(l.receivedAt) <= now);
  const leads = log.length;
  const won = log.filter((l) => l.status === "won").length;
  const spend = Math.round(Number((((cl && cl.adPerf) || {}).totals || {}).spend30d || 0));
  const costPerLead = leads > 0 && spend > 0 ? Math.round(spend / leads) : null;
  const ready = leads >= SHOWCASE_MIN_LEADS && spend >= SHOWCASE_MIN_SPEND;
  const short = [];
  if (leads < SHOWCASE_MIN_LEADS) short.push(`${SHOWCASE_MIN_LEADS - leads} more lead${SHOWCASE_MIN_LEADS - leads === 1 ? "" : "s"} in the last 30 days`);
  if (spend < SHOWCASE_MIN_SPEND) short.push(`at least $${SHOWCASE_MIN_SPEND} of ad spend in the last 30 days`);
  return { leads, won, spend, costPerLead, ready, short };
};
const showcaseLabel = (cl) => {
  const s = (cl && cl.showcase) || {};
  if (s.label && String(s.label).trim()) return String(s.label).trim().slice(0, 140);
  const what = String((cl && cl.niche) || "service").toLowerCase();
  const where = String((cl && (cl.businessAddress || (cl.campaignSetup || {}).serviceArea)) || "").trim();
  return `${(cl && cl.name) || "Our business"}, our own ${what} business${where ? " in " + where : ""}`;
};
// SHOWCASE-MIRROR-END

export { SHOWCASE_MIN_LEADS, SHOWCASE_MIN_SPEND, showcaseNumbers, showcaseLabel };

// What the website is allowed to see: aggregates only, only for businesses he switched on, and only
// once they clear the minimums. No names of customers, no ad account ids, nothing per lead.
export const showcaseItems = (rows, now = Date.now()) => (rows || [])
  .map((cl) => cl && (cl.data || cl))
  .filter((cl) => isOwned(cl) && cl.showcase && cl.showcase.on)
  .map((cl) => ({ cl, n: showcaseNumbers(cl, now) }))
  .filter((x) => x.n.ready)
  .map(({ cl, n }) => ({
    label: showcaseLabel(cl),
    leads: n.leads, won: n.won, spend: n.spend, costPerLead: n.costPerLead,
    window: "last 30 days", updatedAt: new Date(now).toISOString(),
  }));
