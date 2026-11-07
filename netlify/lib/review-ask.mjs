// When BoldLine asks a client for a review of BoldLine, and where the ask points (KB client-review-ask).
//
// Bryson, 2026-11-06: "we should make it so we automatically send something to our clients after a month of running
// ads or selling a website or service etc to them for them to give us a review". The ask existed since 2026-09-07 but
// waited 45 days and, for ads, 10 leads, and a website bought outright was never asked at all. Now ONE MONTH, on every
// path a client can buy something from us:
//   ads      a month since the ads went live (contractStart is the go-live day, campaign-live.mjs), the ads really
//            delivered (hasAdActivity), and at least a few leads, so "the leads are coming through" is true. A client
//            with fewer after a month is NOT asked yet: an unhappy client asked for a review writes an unhappy review.
//            It goes out the day they reach that number instead.
//   website  a site on our hosting, live for a month, its plan not behind on payment.
//   owned    a site bought outright, a month after it was paid in full (they host it themselves, so "live" is theirs).
// Once per client, ever (client-nurture keeps `emailAuto.reviewAsked`).
//
// Where it points: BoldLine's own Google profile ("write a review" link from the connected Business Profile, KB
// google-listing), because a Google review is what shows when somebody looks BoldLine up and helps Google show it.
// The review form on boldlinemedia.com stays as the other choice.
import { hasAdActivity, liveStats } from "./report-shared.mjs";
import { isWebsiteOnly } from "./client-email-auto.mjs";
import { termsOf, fullyPaid, amountsOf } from "./website-deal.mjs";
import { isHouse } from "./owned.mjs";

export const REVIEW_AFTER_DAYS = 30;
export const REVIEW_MIN_LEADS = 3;
const DAY = 864e5;
const daysSince = (iso, now) => { const t = Date.parse(iso || ""); return Number.isFinite(t) ? (now - t) / DAY : null; };

// When a website bought outright was paid in full: the latest of its paid stages.
export const paidInFullAt = (cl) => {
  if (!fullyPaid(cl)) return null;
  const inv = ((cl && cl.websiteDeal) || {}).invoices || {};
  const dates = amountsOf(termsOf(cl)).stages.map((s) => inv[s] && inv[s].paidAt).filter((d) => Number.isFinite(Date.parse(d || "")));
  return dates.length ? dates.sort().slice(-1)[0] : null;
};

// { due, path, why }. `ea` is the client's emailAuto. Pure, so the timing is testable without a clock or a database.
export function reviewAskDue(cl, ea = {}, now = Date.now()) {
  const no = (why) => ({ due: false, path: "", why });
  if (!cl || cl.internal || cl.demo) return no("not a client");
  if (ea.reviewAsked) return no("already asked");
  if (!isWebsiteOnly(cl)) {
    if (cl.contractStatus !== "active") return no("contract not active");
    if (!ea.welcome) return no("not onboarded yet");
    if (!hasAdActivity(cl)) return no("ads haven't run");
    const age = daysSince(cl.contractStart, now);
    if (age == null || age < REVIEW_AFTER_DAYS) return no("ads live under a month");
    if (liveStats(cl).leads < REVIEW_MIN_LEADS) return no("not enough leads yet");
    return { due: true, path: "ads", why: "a month of ads with leads coming in" };
  }
  const w = cl.websiteDeal || {};
  if (termsOf(cl).mgmt === "own") {
    const at = paidInFullAt(cl);
    const age = daysSince(at, now);
    if (age == null || age < REVIEW_AFTER_DAYS) return no("not a month since paid in full");
    return { due: true, path: "owned", why: "a month since they bought their website" };
  }
  if (!(cl.website && cl.website.published)) return no("site not live");
  const live = daysSince(w.launchedAt, now);
  if (live == null || live < REVIEW_AFTER_DAYS) return no("site live under a month");
  if (w.careSub && w.careSub.status === "past_due") return no("plan behind on payment");
  return { due: true, path: "website", why: "a month since their website went live" };
}

// Google's own "write a review" page for a profile, from the place id the Business Profile API reports.
export const googleWriteReviewUrl = (gbp) => {
  const id = String((gbp && gbp.placeId) || "");
  return /^[A-Za-z0-9_-]{10,200}$/.test(id) ? `https://search.google.com/local/writereview?placeid=${id}` : "";
};
// BoldLine's own link, from the house account's connected profile. "" when not connected (the email then points at
// the review form on the website only).
export const boldlineReviewUrlFrom = (rows) => {
  for (const r of rows || []) { const d = (r && r.data) || r || {}; if (isHouse(d)) { const u = googleWriteReviewUrl(d.gbp); if (u) return u; } }
  return "";
};
export async function boldlineReviewUrl(supabase) {
  try {
    const { data } = await supabase.from("clients").select("id, data").eq("data->>internal", "true").limit(20);
    return boldlineReviewUrlFrom(data);
  } catch (e) { return ""; }
}
