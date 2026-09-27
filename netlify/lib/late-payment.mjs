// What happens when a client pays late, decided in ONE place.
//
// Bryson, 2026-09-27: *"when a payment is late let's cut the time down from 10 days to 3 days
// without interest accumulating and then from there have one week of accumulated interest before
// the contract is automatically voided and all ads landing pages etc are stopped and deleted."*
// Agreed after pushback (KB `late-payment-policy`): three days, then a flat $150 fee plus a PAUSE
// that deletes nothing, then at ten days Bryson MAY end the contract for cause. Never automatic.
//
// 🔴 THE CLIENT'S OWN CONTRACT DECIDES, NEVER TODAY'S. Terms are versioned and a signed agreement
// never gains a clause it was not signed with. A v1-v5 client signed "ten days, then 1.5% a month
// interest, then maybe a manual suspension", and pausing their ads on day three would be doing
// to them something their contract does not allow. So the version comes from the contract's own
// resolver, the same function that decides which clause they see.
//
// Pure: no network, no clock of its own. billing-watch does the talking to Stripe and the ad
// platforms; this only says what the rules are and what state an account should be in.

import { termsVersionOf } from "./contract-shared.cjs";

export const PAUSE_TERMS_FROM = 6;   // the first terms version with the pause-and-fee clause
// $150. Was $50 for the first five hours of v6; Bryson raised it the same morning (2026-09-27).
// A test pins the contract's printed figure to this constant, so the two cannot drift.
export const LATE_FEE = 150;        // dollars, once per overdue invoice (Agreement 3.4(b))
export const PAUSE_AFTER_DAYS = 3;  // Agreement 3.4(a)
export const END_AFTER_DAYS = 10;   // Agreement 3.4(c): Bryson MAY end it. Nothing ends it for him.
export const LEGACY_GRACE_DAYS = 10;
export const LEGACY_MONTHLY_RATE = 0.015;

// The rules this client actually signed.
export function latePolicyFor(cl, { legacyGrace = LEGACY_GRACE_DAYS } = {}) {
  const version = termsVersionOf(cl || {});
  if (version >= PAUSE_TERMS_FROM) {
    return { version, kind: "pause", lateFee: LATE_FEE, pauseAfter: PAUSE_AFTER_DAYS, endAfter: END_AFTER_DAYS, interest: false };
  }
  return { version, kind: "interest", lateFee: 0, pauseAfter: null, endAfter: null, interest: true, graceDays: legacyGrace };
}

// Interest owed under the OLD terms. Zero under v6, which says in words that none accrues.
export function interestFor(policy, overdue, daysLate) {
  if (!policy || !policy.interest) return 0;
  const over = Number(daysLate) - Number(policy.graceDays);
  if (!(over > 0) || !(Number(overdue) > 0)) return 0;
  return Math.round(Number(overdue) * LEGACY_MONTHLY_RATE * (over / 30) * 100) / 100;
}

// Where an overdue account should be, given how late it is. Every flag is a permission the
// contract grants, not an instruction: `canEnd` means Bryson may, and nothing acts on it alone.
export function lateStage(policy, daysLate) {
  const d = Number(daysLate) || 0;
  if (!policy || policy.kind !== "pause" || d <= 0) return { fee: false, pause: false, canEnd: false };
  return { fee: d >= policy.pauseAfter, pause: d >= policy.pauseAfter, canEnd: d >= policy.endAfter };
}

// Which campaigns a pause should stop. Only ones actually switched on: pausing a campaign that
// was already paused, and then "resuming" it when they pay, would switch on something Bryson had
// deliberately left off. The list of what WE paused is the only list a resume may use.
export const pausableGoogle = (camps) => (camps || []).filter((c) => String(c.status || "").toUpperCase() === "ENABLED" && c.campaignResourceName);
export const pausableMeta = (camps) => (camps || []).filter((c) => String(c.status || "").toUpperCase() === "ACTIVE" && c.id);

// Is the account paused for non-payment right now? The landing page reads this, so it lives
// here rather than being re-derived in two places that could disagree.
export const isBillingPaused = (cl) => !!(cl && cl.billingPause && cl.billingPause.at && !cl.billingPause.resumedAt);
