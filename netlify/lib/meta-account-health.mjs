// Why a Meta campaign that says it is running has stopped spending.
//
// Bryson, 2026-09-04, looking at a campaign marked RUNNING with $9.05 spent and not a cent
// more for seven hours, on a $14 a day budget: *"why has the ad not been doing anything for
// the past few hours"*.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 THE CAMPAIGN WAS NOT THE PROBLEM, AND THE CAMPAIGN IS ALL WE WERE LOOKING AT.
//
// Everything the OS reads about Meta is per campaign: status, effective status, spend,
// budget. Every one of those can be perfectly healthy while the ACCOUNT underneath refuses to
// spend another penny, and when that happens Meta does not mark the campaign as broken. It
// just quietly stops delivering. So the screen says Running, the numbers freeze, and there is
// nothing anywhere to explain it.
//
// The account-level reasons, in the order they actually happen to a small advertiser:
//
//   • A SPENDING LIMIT that has been reached. An ad account can carry a lifetime cap, and
//     the moment `amount_spent` reaches `spend_cap` EVERY campaign on the account stops.
//     $9.05 frozen against a cap somebody set at $10 while testing is the single most common
//     version of this, and nothing about it looks like an error.
//   • THE CARD. Declined, expired, or removed. Meta keeps the campaign "active" and simply
//     does not serve it.
//   • THE ACCOUNT ITSELF disabled, in grace period, unsettled, or under risk review.
//
// None of these are visible from a campaign read, which is why this file exists. It costs one
// extra API call per account per hour and it answers a question that otherwise takes a person
// days to find.

// Meta's numeric account states. Anything not listed is reported by its number rather than
// guessed at, because a wrong explanation is worse than an unfamiliar one.
export const ACCOUNT_STATES = {
  1: { ok: true, label: "active" },
  2: { ok: false, label: "disabled", say: "Facebook has disabled this ad account, so nothing can run. Open Meta Ads Manager to see why." },
  3: { ok: false, label: "unsettled", say: "There is an unpaid balance on this ad account, so Facebook has stopped delivery until it is settled." },
  7: { ok: false, label: "pending risk review", say: "Facebook is reviewing this ad account and has paused delivery while it does. This usually clears on its own." },
  8: { ok: false, label: "pending settlement", say: "Facebook is waiting on a payment to settle before it will deliver again." },
  9: { ok: false, label: "in grace period", say: "This ad account is in a grace period over a payment problem. Delivery stops when it ends." },
  100: { ok: false, label: "pending closure", say: "This ad account is being closed, so nothing will run on it." },
  101: { ok: false, label: "closed", say: "This ad account is closed." },
};

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };

// Meta reports money in the account's smallest unit, so cents for dollars. A cap of $10 comes
// back as "1000", and reading that as ten dollars would put the warning off by a hundredfold.
const money = (v) => { const c = num(v); return c == null ? null : c / 100; };

// 🔴 What the account says about itself, turned into one plain sentence or nothing at all.
// `null` means there is nothing worth saying, which must stay distinct from "we did not look".
export function accountTrouble(acct) {
  const a = acct || {};
  const state = ACCOUNT_STATES[Number(a.accountStatus)];
  if (state && !state.ok) return { blocked: true, reason: state.label, say: state.say };
  if (a.accountStatus != null && !state) {
    return { blocked: true, reason: `status ${a.accountStatus}`,
      say: `Facebook reports an unusual state on this ad account (status ${a.accountStatus}), and it may not be delivering. Check it in Meta Ads Manager.` };
  }
  // 🔴 THE CAP, WHICH IS THE ONE NOBODY REMEMBERS SETTING. Every campaign on the account
  // stops the moment the total reaches it, and the campaigns still read as active.
  const cap = num(a.spendCap), spent = num(a.amountSpent);
  if (cap != null && cap > 0 && spent != null) {
    if (spent >= cap) {
      return { blocked: true, reason: "spend cap reached",
        say: `This ad account has a lifetime spending limit of $${cap.toLocaleString()} and it has now spent $${spent.toLocaleString()}, so Facebook has stopped every campaign on it. Raise or remove the limit in Meta Ads Manager under Billing, then Payment settings.` };
    }
    // Warn BEFORE it bites, because after it bites the ads are already off.
    if (spent >= cap * 0.9) {
      return { blocked: false, reason: "spend cap close",
        say: `This ad account is close to its lifetime spending limit ($${spent.toLocaleString()} of $${cap.toLocaleString()}). Everything stops when it is reached.` };
    }
  }
  return null;
}

// Trimmed to what a warning needs. The raw account object carries far more and none of it
// belongs on a client record that is read on every screen.
export const trimAccount = (raw) => {
  const a = raw || {};
  return {
    accountStatus: num(a.account_status),
    disableReason: num(a.disable_reason),
    spendCap: money(a.spend_cap),
    amountSpent: money(a.amount_spent),
    balance: money(a.balance),
    currency: String(a.currency || ""),
    // A funding source that has gone is the other silent killer, and its absence is worth
    // recording even though Meta will not always say why.
    hasFunding: !!(a.funding_source || (a.funding_source_details && a.funding_source_details.id)),
    at: new Date().toISOString(),
  };
};
